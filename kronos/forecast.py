"""Daily job: fetch prices, compute trend signals and Kronos forecasts, write data/signals.json.

Run:  python forecast.py --out ../data/signals.json
Env:  KRONOS_DIR (path to the cloned Kronos repo), KRONOS_MODEL (mini|small|base, default small)
"""
import argparse, json, os, time
from datetime import datetime, timezone
import numpy as np, pandas as pd

from fetch_data import load_all, COINS
from kronos_paths import load, sample_paths

HERE = os.path.dirname(os.path.abspath(__file__))
SMA_N = 50
COST = 0.0025
HORIZONS = [  # key, label, days, source, steps
    ("1j", "1 jour", 1, "daily", 1), ("5j", "5 jours", 5, "daily", 5), ("1s", "1 semaine", 7, "daily", 7),
    ("1m", "1 mois", 30, "daily", 30), ("3m", "3 mois", 91, "weekly", 13), ("6m", "6 mois", 182, "weekly", 26),
    ("9m", "9 mois", 273, "weekly", 39), ("1a", "1 an", 365, "weekly", 52),
]
QS = [0.05, 0.1, 0.25, 0.5, 0.75, 0.9, 0.95]


def weekly(df):
    w = df.set_index("date").resample("W-SUN").agg({"open": "first", "high": "max", "low": "min", "close": "last", "volume": "sum"})
    w = w.dropna()
    last_day = df["date"].iloc[-1]
    if last_day.weekday() != 6:  # current week unfinished
        w = w.iloc[:-1]
    w = w.reset_index()
    w["date"] = w["date"] - pd.Timedelta(days=6)  # label = week start (Monday)
    return w


def rsi(c, n=14):
    d = c.diff()
    up = d.clip(lower=0).ewm(alpha=1 / n, adjust=False).mean()
    dn = (-d.clip(upper=0)).ewm(alpha=1 / n, adjust=False).mean()
    return 100 - 100 / (1 + up / dn)


def trend_block(df):
    c = df["close"]
    sma = c.rolling(SMA_N).mean()
    above = c > sma
    state = bool(above.iloc[-1])
    # when did the current state start
    flips = above.ne(above.shift())
    start_i = int(np.where(flips.values)[0][-1])
    # strategy record over the full history
    pos = above.astype(float).shift(1).fillna(0)
    ret = c.pct_change().fillna(0)
    sw = pos.diff().abs().fillna(0)
    eq = (1 + pos * ret - sw * COST).cumprod()
    bh = (1 + ret).cumprod()
    s0 = SMA_N
    eq, bh = eq.iloc[s0:] / eq.iloc[s0], bh.iloc[s0:] / bh.iloc[s0]
    dd = lambda e: float((e / e.cummax() - 1).min())
    # past signals (last 12 switches) with the move that followed until the next switch
    idx = list(np.where(flips.values[s0:])[0] + s0)
    events = []
    for j, i in enumerate(idx[-12:]):
        k = idx.index(i)
        nxt = idx[k + 1] if k + 1 < len(idx) else len(c) - 1
        events.append({"date": df["date"].iloc[i].strftime("%Y-%m-%d"), "type": "achat" if above.iloc[i] else "vente",
                       "price": float(c.iloc[i]), "move_after": float(c.iloc[nxt] / c.iloc[i] - 1),
                       "open": k + 1 >= len(idx)})
    return {
        "sma_n": SMA_N, "sma": float(sma.iloc[-1]), "above": state,
        "distance": float(c.iloc[-1] / sma.iloc[-1] - 1),
        "since": df["date"].iloc[start_i].strftime("%Y-%m-%d"), "days": int(len(c) - 1 - start_i),
        "price_at_switch": float(c.iloc[start_i]),
        "rsi": float(rsi(c).iloc[-1]),
        "record": {"from": df["date"].iloc[s0].strftime("%Y-%m-%d"), "strategy": float(eq.iloc[-1] - 1), "strategy_dd": dd(eq),
                   "hold": float(bh.iloc[-1] - 1), "hold_dd": dd(bh), "switches": int(sw.iloc[s0:].sum()),
                   "time_in": float(pos.iloc[s0:].mean())},
        "events": events,
    }


def quantiles(rel_paths, k=1.0):
    """rel_paths: (samples,) relative to last close. Widen log-distance from the median by k."""
    lg = np.log(np.maximum(rel_paths, 1e-9))
    q = np.quantile(lg, QS)
    med = q[3]
    q = med + (q - med) * k
    pup = float(((med + (lg - med) * k) > 0).mean())  # probability read from the widened spread
    return {f"p{int(p * 100)}": float(np.exp(v)) for p, v in zip(QS, q)}, pup


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=os.path.join(HERE, "..", "data", "signals.json"))
    ap.add_argument("--samples", type=int, default=48)
    ap.add_argument("--wsamples", type=int, default=32)
    ap.add_argument("--lookback", type=int, default=400)
    a = ap.parse_args()

    model_name = os.environ.get("KRONOS_MODEL", "small")
    calib_path = os.path.join(HERE, "calibration.json")
    calib = json.load(open(calib_path)) if os.path.exists(calib_path) else {}
    t0 = time.time()
    data = load_all()
    tok, m, ctx = load(model_name)
    lb = min(a.lookback, ctx)
    out = {"generated": datetime.now(timezone.utc).isoformat(timespec="seconds"), "model": f"Kronos-{model_name}",
           "currency": "EUR", "sma_n": SMA_N, "coins": {}}
    for sym, df in data.items():
        last = float(df["close"].iloc[-1])
        last_date = df["date"].iloc[-1]
        # daily paths
        win = df.iloc[-lb:].reset_index(drop=True)
        fut = pd.date_range(last_date + pd.Timedelta(days=1), periods=30, freq="D")
        dp = sample_paths(tok, m, ctx, [win], [fut], 30, n_samples=a.samples, seed=1)[0] / last  # (S, 30)
        # weekly paths
        w = weekly(df)
        wwin = w.iloc[-min(len(w), ctx):].reset_index(drop=True)
        wfut = pd.date_range(wwin["date"].iloc[-1] + pd.Timedelta(days=7), periods=52, freq="7D")
        # expressed relative to today's price (the last complete week may end a few days earlier)
        wp = sample_paths(tok, m, ctx, [wwin], [wfut], 52, n_samples=a.wsamples, seed=2)[0] / last
        cal = calib.get(sym, {})
        hz = []
        for key, label, days, src, steps in HORIZONS:
            if src == "daily":
                rel = dp[:, steps - 1]
                k = cal.get(key, {}).get("k", 1.0)
            else:
                rel = wp[:, steps - 1]
                k = cal.get("1m", {}).get("k", 1.0)  # untested: at least as wide as the tested 1-month band
            q, pup = quantiles(rel, k)
            hz.append({"key": key, "label": label, "days": days, "source": src, "k": k, "pup": pup, **q,
                       "track": cal.get(key) if src == "daily" else None})
        # fan for the chart: daily quantiles for 30 days, weekly beyond
        fan = []
        for d in range(1, 31):
            q, _ = quantiles(dp[:, d - 1], cal.get("1s" if d <= 7 else "1m", {}).get("k", 1.0))
            fan.append([d, q["p10"], q["p25"], q["p50"], q["p75"], q["p90"]])
        for s in range(5, 53):
            q, _ = quantiles(wp[:, s - 1], cal.get("1m", {}).get("k", 1.0))
            fan.append([s * 7, q["p10"], q["p25"], q["p50"], q["p75"], q["p90"]])
        hist = df.iloc[-730:]
        out["coins"][sym] = {
            "name": COINS[sym]["name"], "source": COINS[sym]["src"], "last_date": last_date.strftime("%Y-%m-%d"),
            "last": last, "history": [[d.strftime("%Y-%m-%d"), round(float(v), 8)] for d, v in zip(hist["date"], hist["close"])],
            "sma": [round(float(v), 8) if v == v else None for v in df["close"].rolling(SMA_N).mean().iloc[-730:]],
            "trend": trend_block(df), "horizons": hz, "fan": fan,
            "weeks_of_history": int(len(w)),
        }
        print(sym, "ok", f"{time.time() - t0:.0f}s", flush=True)
    os.makedirs(os.path.dirname(os.path.abspath(a.out)), exist_ok=True)
    json.dump(out, open(a.out, "w"), separators=(",", ":"))
    print("wrote", a.out, f"{time.time() - t0:.0f}s")


if __name__ == "__main__":
    main()

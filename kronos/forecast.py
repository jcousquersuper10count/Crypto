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
    ("1m", "1 mois", 30, "daily", 30), ("3m", "3 mois", 91, "history", 91), ("6m", "6 mois", 182, "history", 182),
    ("9m", "9 mois", 273, "history", 273), ("1a", "1 an", 365, "history", 365),
]
QS = [0.05, 0.1, 0.25, 0.5, 0.75, 0.9, 0.95]


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


def spread(close, h, recent=730):
    """How far this coin has moved over h days: past h-day log returns, centred on their median.
    Short horizons use the last two years. When the history holds fewer than 4 independent
    h-day stretches, the widest horizon that does is scaled by sqrt(time)."""
    c_all = np.log(close.to_numpy())
    for h0 in [h] + [x for x in (182, 91, 30) if x < h]:
        if len(c_all) / h0 >= 4:
            break
    c = c_all[-(recent + h0):] if h0 <= 30 else c_all
    r = c[h0:] - c[:-h0]
    r = (r - np.median(r)) * np.sqrt(h / h0)
    return r


def dist(center, e):
    """center: log median; e: demeaned past log returns -> quantiles (relative to today) and P(rise)."""
    q = center + np.quantile(e, QS)
    return {f"p{int(p * 100)}": float(np.exp(v)) for p, v in zip(QS, q)}, float(np.mean(center + e > 0))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=os.path.join(HERE, "..", "data", "signals.json"))
    ap.add_argument("--samples", type=int, default=48)
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
        # Kronos gives the central path (median of its scenarios) up to 30 days. Its own spread was far too
        # narrow in the backtest, so the band comes from how far this coin has actually moved over the same
        # duration. Beyond 30 days no view on direction: the centre stays at the 1-month median.
        med = np.median(np.log(np.maximum(dp, 1e-9)), axis=0)  # (30,)
        cal = calib.get(sym, {})
        hz = []
        for key, label, days, src, steps in HORIZONS:
            center = med[steps - 1] if src == "daily" else med[-1]
            q, pup = dist(center, spread(df["close"], days))
            hz.append({"key": key, "label": label, "days": days, "source": src, "pup": pup, **q,
                       "track": cal.get(key) if src == "daily" else None})
        fan = []
        for d in list(range(1, 31)) + list(range(35, 366, 7)):
            q, _ = dist(med[d - 1] if d <= 30 else med[-1], spread(df["close"], d))
            fan.append([d, q["p10"], q["p25"], q["p50"], q["p75"], q["p90"]])
        hist = df.iloc[-730:]
        out["coins"][sym] = {
            "name": COINS[sym]["name"], "source": COINS[sym]["src"], "last_date": last_date.strftime("%Y-%m-%d"),
            "last": last, "history": [[d.strftime("%Y-%m-%d"), round(float(v), 8)] for d, v in zip(hist["date"], hist["close"])],
            "sma": [round(float(v), 8) if v == v else None for v in df["close"].rolling(SMA_N).mean().iloc[-730:]],
            "trend": trend_block(df), "horizons": hz, "fan": fan,
            "days_of_history": int(len(df)),
        }
        print(sym, "ok", f"{time.time() - t0:.0f}s", flush=True)
    os.makedirs(os.path.dirname(os.path.abspath(a.out)), exist_ok=True)
    json.dump(out, open(a.out, "w"), separators=(",", ":"))
    print("wrote", a.out, f"{time.time() - t0:.0f}s")


if __name__ == "__main__":
    main()

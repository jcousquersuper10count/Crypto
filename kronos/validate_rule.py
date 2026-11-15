"""Out-of-sample check of the trend rule (price vs n-day moving average).

1. Fixed SMA50 as published, under execution delays and costs.
2. Walk-forward: every 90 days, pick n among CANDS using only past data (net return over the
   previous 365 days), then apply it to the next 90 days. Concatenated test periods are scored.
3. Pre-registered variants on the same dates: SMA50 with a +/-2% neutral band, SMA50 confirmed on 2 closes.
All strategies earn 0 when out of the market. Costs are charged on each switch.
"""
import numpy as np, pandas as pd, json

CANDS = [20, 30, 50, 100, 150, 200]
TRAIN, TEST = 365, 90


def positions(c, n, band=0.0, confirm=1):
    sma = c.rolling(n).mean()
    up = c > sma * (1 + band)
    dn = c < sma * (1 - band)
    if confirm > 1:
        up = up.rolling(confirm).sum() == confirm
        dn = dn.rolling(confirm).sum() == confirm
    pos = pd.Series(np.nan, index=c.index)
    pos[up] = 1.0
    pos[dn] = 0.0
    pos[sma.isna()] = 0.0
    return pos.ffill().fillna(0.0)


def returns(c, pos, lag=1, cost=0.0025):
    """pos decided at close t; lag=1 means held from close t to t+1 (acts at the close),
    lag=2 means acts one day later."""
    r = c.pct_change().fillna(0.0)
    p = pos.shift(lag).fillna(0.0)
    sw = p.diff().abs().fillna(0.0)
    return p * r - sw * cost, p


def stats(ret):
    eq = (1 + ret).cumprod()
    dd = (eq / eq.cummax() - 1).min()
    return float(eq.iloc[-1] - 1), float(dd)


out = {}
for coin in ["BTC", "ATOM", "PLUME", "CETUS"]:
    df = pd.read_csv(f"{coin}.csv", parse_dates=["date"]).set_index("date")
    c = df["close"]
    res = {"days": len(c)}
    # 1. fixed SMA50, sensitivity
    start = 50
    bh = c.pct_change().fillna(0).iloc[start:]
    res["hold"] = stats(bh)
    for lag in (1, 2):
        for cost in (0.0025, 0.006):
            r, _ = returns(c, positions(c, 50), lag, cost)
            res[f"sma50_lag{lag}_cost{cost}"] = stats(r.iloc[start:])
    # 2. walk-forward
    if len(c) >= TRAIN + 2 * TEST + 200:
        all_r = {n: returns(c, positions(c, n), 2, 0.0025)[0] for n in CANDS}
        chosen, wf = [], []
        t0 = 200 + TRAIN
        for s in range(t0, len(c), TEST):
            past = slice(s - TRAIN, s)
            best = max(CANDS, key=lambda n: (1 + all_r[n].iloc[past]).prod())
            chosen.append(best)
            wf.append(all_r[best].iloc[s:s + TEST])
        wf = pd.concat(wf)
        dates = wf.index
        res["wf_from"] = str(dates[0].date())
        res["wf_chosen"] = chosen
        res["wf"] = stats(wf)
        res["wf_hold"] = stats(c.pct_change().reindex(dates).fillna(0))
        res["wf_sma50"] = stats(all_r[50].reindex(dates))
        res["wf_band2"] = stats(returns(c, positions(c, 50, band=0.02), 2, 0.0025)[0].reindex(dates))
        res["wf_confirm2"] = stats(returns(c, positions(c, 50, confirm=2), 2, 0.0025)[0].reindex(dates))
        for k in ("wf_sma50", "wf_band2", "wf_confirm2"):
            pass
        res["switches_sma50"] = int(positions(c, 50).diff().abs().reindex(dates).sum())
        res["switches_band2"] = int(positions(c, 50, band=0.02).diff().abs().reindex(dates).sum())
        res["switches_confirm2"] = int(positions(c, 50, confirm=2).diff().abs().reindex(dates).sum())
    # yearly split of SMA50 vs hold (stability)
    r50, p50 = returns(c, positions(c, 50), 2, 0.0025)
    yr = {}
    for y, g in r50.iloc[start:].groupby(r50.iloc[start:].index.year):
        h = c.pct_change().fillna(0).loc[g.index]
        yr[int(y)] = [round(float((1 + g).prod() - 1), 3), round(float((1 + h).prod() - 1), 3), round(float(p50.loc[g.index].mean()), 2)]
    res["by_year"] = yr
    out[coin] = res

print(json.dumps(out, indent=1, default=lambda x: round(x, 3)))
json.dump(out, open("rule_validation.json", "w"), indent=1)

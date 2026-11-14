"""Score backtest paths: direction, calibration, and buy/sell signal value vs baselines."""
import sys, glob
import numpy as np
from scipy.stats import spearmanr

HZ = [1, 5, 7, 30]


def score(f, buy=0.6, sell=0.4):
    z = np.load(f, allow_pickle=True)
    o, P, c = z["origins"], z["paths"], z["close"]
    rows = []
    for h in HZ:
        ok = o + h < len(c)
        oo, PP = o[ok], P[ok][:, :, h - 1]
        c0 = c[oo]
        r = c[oo + h] / c0 - 1
        fr = PP / c0[:, None] - 1
        med = np.median(fr, 1)
        pup = (fr > 0).mean(1)
        lo, hi = np.quantile(fr, 0.1, 1), np.quantile(fr, 0.9, 1)
        mom = c0 / c[np.maximum(oo - h, 0)] - 1
        up_rate = (r > 0).mean()
        ic = spearmanr(pup, r).statistic if len(r) > 5 else np.nan
        b, s = pup >= buy, pup <= sell
        rows.append(dict(
            h=h, n=len(r), up_rate=up_rate,
            acc=np.mean(np.sign(med) == np.sign(r)), acc_const=max(up_rate, 1 - up_rate),
            acc_mom=np.mean(np.sign(mom) == np.sign(r)),
            cover80=np.mean((r >= lo) & (r <= hi)), ic=ic,
            n_buy=int(b.sum()), r_buy=r[b].mean() if b.any() else np.nan,
            n_sell=int(s.sum()), r_sell=r[s].mean() if s.any() else np.nan,
            r_all=r.mean(),
        ))
    return rows


if __name__ == "__main__":
    for f in sorted(glob.glob(sys.argv[1] if len(sys.argv) > 1 else "bt_*.npz")):
        print("\n==", f)
        print(f"{'h':>3} {'n':>4} {'up%':>5} {'acc':>5} {'const':>5} {'mom':>5} {'cov80':>5} {'IC':>6} | {'nBuy':>4} {'rBuy':>7} {'nSell':>5} {'rSell':>7} {'rAll':>7}")
        for r in score(f):
            print(f"{r['h']:>3} {r['n']:>4} {r['up_rate']*100:5.0f} {r['acc']*100:5.0f} {r['acc_const']*100:5.0f} {r['acc_mom']*100:5.0f} {r['cover80']*100:5.0f} {r['ic']:6.2f} | "
                  f"{r['n_buy']:>4} {r['r_buy']*100:7.2f} {r['n_sell']:>5} {r['r_sell']*100:7.2f} {r['r_all']*100:7.2f}")

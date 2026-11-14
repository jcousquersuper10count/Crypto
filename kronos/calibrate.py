"""From backtest paths, per coin and horizon: band widening factor k (so the 10-90% band
held 80% of outcomes) and the track record shown on the dashboard."""
import json, sys, glob, re
import numpy as np
from scipy.stats import spearmanr

KEYS = {1: "1j", 5: "5j", 7: "1s", 30: "1m"}
model = sys.argv[1] if len(sys.argv) > 1 else "small"
out = {}
for f in sorted(glob.glob(f"bt_{model}_*.npz")):
    coin = re.search(rf"bt_{model}_(\w+)\.npz", f).group(1)
    z = np.load(f, allow_pickle=True)
    o, P, c = z["origins"], z["paths"], z["close"]
    out[coin] = {}
    for h, key in KEYS.items():
        ok = o + h < len(c)
        oo = o[ok]
        lr = np.log(c[oo + h] / c[oo])
        lp = np.log(np.maximum(P[ok][:, :, h - 1] / c[oo][:, None], 1e-9))
        med = np.median(lp, 1)
        half = (np.quantile(lp, 0.9, 1) - np.quantile(lp, 0.1, 1)) / 2 + 1e-9
        k = float(np.quantile(np.abs(lr - med) / half, 0.8))
        pup = (lp > 0).mean(1)
        up = float((lr > 0).mean())
        out[coin][key] = {
            "n": int(len(lr)), "k": round(max(k, 1.0), 3),
            "acc": float(np.mean(np.sign(med) == np.sign(lr))), "acc_const": max(up, 1 - up),
            "ic": float(spearmanr(pup, lr).statistic), "cover80_raw": float(np.mean(np.abs(lr - med) <= half)),
            "from": str(z["dates"][oo[0]])[:10], "to": str(z["dates"][oo[-1]])[:10],
        }
json.dump(out, open("calibration.json", "w"), indent=1)
for c, d in out.items():
    print(c, {k: (round(v["acc"], 2), round(v["acc_const"], 2), round(v["ic"], 2), v["k"]) for k, v in d.items()})

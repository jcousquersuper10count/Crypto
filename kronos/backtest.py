"""Walk-forward backtest: at past dates, sample Kronos paths using only earlier candles."""
import argparse, time, os
import numpy as np, pandas as pd
os.environ.setdefault("KRONOS_DIR", os.path.join(os.path.dirname(os.path.abspath(__file__)), "Kronos"))
from kronos_paths import load, sample_paths

ap = argparse.ArgumentParser()
ap.add_argument("--model", default="mini")
ap.add_argument("--lookback", type=int, default=256)
ap.add_argument("--pred", type=int, default=30)
ap.add_argument("--step", type=int, default=5)
ap.add_argument("--ntest", type=int, default=500, help="how many most recent days to test over")
ap.add_argument("--samples", type=int, default=16)
ap.add_argument("--chunk", type=int, default=4)
ap.add_argument("--coins", default="BTC,ATOM,PLUME,CETUS")
ap.add_argument("--out", default="bt")
a = ap.parse_args()

tok, m, ctx = load(a.model)
for coin in a.coins.split(","):
    df = pd.read_csv(f"{coin}.csv", parse_dates=["date"])
    n = len(df)
    first = max(a.lookback - 1, n - 1 - a.ntest)
    origins = list(range(first, n - 1 - a.pred + 1, a.step))
    paths = []
    t0 = time.time()
    for i in range(0, len(origins), a.chunk):
        oc = origins[i:i + a.chunk]
        wins = [df.iloc[o - a.lookback + 1:o + 1].reset_index(drop=True) for o in oc]
        fut = [pd.date_range(df["date"].iloc[o] + pd.Timedelta(days=1), periods=a.pred, freq="D") for o in oc]
        paths.append(sample_paths(tok, m, ctx, wins, fut, a.pred, n_samples=a.samples, seed=i))
        print(coin, f"{min(i + a.chunk, len(origins))}/{len(origins)}", f"{time.time() - t0:.0f}s", flush=True)
    paths = np.concatenate(paths)
    np.savez(f"{a.out}_{a.model}_{coin}.npz", origins=np.array(origins), paths=paths,
             close=df["close"].to_numpy(), dates=df["date"].astype(str).to_numpy())
print("done")

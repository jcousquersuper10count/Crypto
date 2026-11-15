"""Daily ETF quotes for the Revolut Robo positions -> data/etf.json (Yahoo Finance chart API, no key).

For each ticker: last close, change over 1 session / 7 days / 30 days / 1 year, and 60 closes for the sparkline.
Closes are split-adjusted by Yahoo. Run:  python kronos/fetch_etf.py --out data/etf.json
"""
import argparse, json, os, time, urllib.request
from datetime import datetime, timezone

# Revolut ticker -> Yahoo symbols to try, in order
SYMBOLS = {
    "WELK": ["WELK.DE"], "XDWI": ["XDWI.DE"], "EBUY": ["EBUY.DE"], "AMEL": ["AMEL.DE"], "LYMS": ["LYMS.DE"],
    "LEMA": ["LEMA.DE"], "PRAJ": ["PRAJ.DE"], "LGQK": ["LGQK.DE"], "LYP5": ["LYP5.DE"], "LYP6": ["LYP6.DE"],
    "HNDX": ["HNDX.DE"], "LYTR": ["LYTR.DE"], "LKOR": ["LKOR.DE"], "UBUD": ["UBUD.DE"], "2B72": ["2B72.DE"],
    "79U0": ["79U0.DE"], "EXW1": ["EXW1.DE"], "EXI2": ["EXI2.DE"], "IS3Q": ["IS3Q.DE"], "IS3K": ["IS3K.DE"],
}


def chart(sym):
    url = f"https://query1.finance.yahoo.com/v8/finance/chart/{sym}?interval=1d&range=1y"
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=30) as r:
        res = json.loads(r.read().decode())["chart"]["result"][0]
    ts = res["timestamp"]
    cl = res["indicators"]["quote"][0]["close"]
    pts = [(t, c) for t, c in zip(ts, cl) if c]
    # Yahoo leaves closes before a share split unadjusted: a one-day jump of more than 3x is a split,
    # so earlier closes are rescaled to the new share count.
    f, adj = 1.0, [pts[-1]]
    for i in range(len(pts) - 2, -1, -1):
        r = (pts[i][1] * f) / adj[-1][1]
        if r > 3 or r < 1 / 3:
            f /= r
        adj.append((pts[i][0], pts[i][1] * f))
    return res["meta"], adj[::-1]


def change(pts, days):
    t_last, c_last = pts[-1]
    target = t_last - days * 86400
    prev = [c for t, c in pts[:-1] if t <= target]
    if not prev:
        return None
    return c_last / prev[-1] - 1


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data", "etf.json"))
    a = ap.parse_args()
    out = {"generated": datetime.now(timezone.utc).isoformat(timespec="seconds"), "etfs": {}}
    for tk, cands in SYMBOLS.items():
        for sym in cands:
            try:
                meta, pts = chart(sym)
                if len(pts) < 2 or meta.get("currency") != "EUR":
                    continue
                out["etfs"][tk] = {
                    "symbol": sym, "name": (meta.get("longName") or meta.get("shortName") or tk).replace("Amundi Index Solutions - ", "").replace("Amundi ETF ICAV - ", ""),
                    "price": round(pts[-1][1], 4), "date": datetime.fromtimestamp(pts[-1][0], timezone.utc).strftime("%Y-%m-%d"),
                    "ch1d": pts[-1][1] / pts[-2][1] - 1, "ch7d": change(pts, 7), "ch30d": change(pts, 30), "ch1y": change(pts, 360),
                    "spark": [round(c, 4) for _, c in pts[-60:]],
                }
                break
            except Exception as e:  # noqa
                print(tk, sym, "failed:", e)
            time.sleep(0.4)
        time.sleep(0.4)
    if not out["etfs"]:
        raise SystemExit("no ETF quote fetched; keeping the previous file")
    os.makedirs(os.path.dirname(os.path.abspath(a.out)), exist_ok=True)
    json.dump(out, open(a.out, "w"), separators=(",", ":"))
    print("wrote", a.out, len(out["etfs"]), "ETFs")


if __name__ == "__main__":
    main()

"""Daily crypto quotes -> data/prices.json, used by VAULT when the live price provider refuses requests.

Reads the symbol -> CoinGecko id map (const CGM) from app.js so both stay in step.
Run:  python kronos/fetch_prices.py --out data/prices.json
"""
import argparse, json, os, re, time, urllib.request
from datetime import datetime, timezone

HERE = os.path.dirname(os.path.abspath(__file__))


def cg_map():
    src = open(os.path.join(HERE, "..", "app.js"), encoding="utf-8").read()
    body = re.search(r"const CGM=\{(.*?)\};", src, re.S).group(1)
    return dict(re.findall(r"['\"]?([\w$]+)['\"]?\s*:\s*'([^']+)'", body))


def get(url):
    for i in range(4):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "vault-prices/1.0", "Accept": "application/json"})
            with urllib.request.urlopen(req, timeout=40) as r:
                return json.loads(r.read().decode())
        except Exception as e:  # noqa
            if i == 3:
                raise
            time.sleep(15 * (i + 1))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=os.path.join(HERE, "..", "data", "prices.json"))
    a = ap.parse_args()
    m = cg_map()
    by_id = {}
    for sym, cid in m.items():
        by_id.setdefault(cid, []).append(sym)
    ids = list(by_id)
    out = {"generated": datetime.now(timezone.utc).isoformat(timespec="seconds"), "prices": {}}
    for i in range(0, len(ids), 50):
        chunk = ",".join(ids[i:i + 50])
        data = get("https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=" + chunk +
                   "&order=market_cap_desc&sparkline=true&price_change_percentage=24h,7d,30d,1y")
        for c in data:
            spark = (c.get("sparkline_in_7d") or {}).get("price") or []
            q = {"p": c.get("current_price") or 0, "ch24": c.get("price_change_percentage_24h_in_currency") or 0,
                 "ch7d": c.get("price_change_percentage_7d_in_currency") or 0,
                 "ch30d": c.get("price_change_percentage_30d_in_currency") or 0,
                 "ch1y": c.get("price_change_percentage_1y_in_currency") or 0, "mc": c.get("market_cap") or 0,
                 "img": c.get("image") or "", "name": c.get("name") or "", "rank": c.get("market_cap_rank"),
                 "ath": c.get("ath"), "athD": c.get("ath_date"), "spark": [round(v, 10) for v in spark[::3]]}
            for sym in by_id.get(c["id"], []):
                out["prices"][sym] = q
        time.sleep(6)
    if len(out["prices"]) < 5:
        raise SystemExit("too few prices fetched; keeping the previous file")
    os.makedirs(os.path.dirname(os.path.abspath(a.out)), exist_ok=True)
    json.dump(out, open(a.out, "w"), separators=(",", ":"))
    print("wrote", a.out, len(out["prices"]), "prices")


if __name__ == "__main__":
    main()

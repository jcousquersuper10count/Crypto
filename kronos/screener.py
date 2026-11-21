"""Radar VAULT : indications d'achat sur les grosses cryptos disponibles sur Neverless.

Univers : les ~330 premières cryptos de CoinGecko par capitalisation (hors stablecoins et jetons « enveloppés »),
limitées à celles qu'on peut acheter sur Neverless (API publique de Neverless, paires en USD),
avec l'écart achat/vente réel de Neverless pour chacune.

Règle fixée AVANT le test (20 novembre 2026), sans réglage après coup :
- chaque lundi, à la clôture : une crypto est « candidate » si son prix est au-dessus de sa moyenne 50 jours
  et qu'elle a au moins 120 jours d'historique ;
- on classe les candidates par variation sur 30 jours (élan) et on retient les 5 premières, 20 % chacune ;
- filtre de marché : si le Bitcoin est sous sa moyenne 50 jours, la liste est vide (tout en stablecoin) ;
- achat ou vente exécutés le lendemain ; coût = moitié de l'écart Neverless de la crypto, à chaque ordre.
C'est la variante C ci-dessous, affichée comme « liste d'achat ». Deux autres variantes sont calculées
pour information : A (sans le filtre Bitcoin) et B (classement par variation 90 jours divisée par la volatilité).

Comparaisons : garder du Bitcoin ; garder un panier égal de tout l'univers (rééquilibré chaque mois).
Les 30 premiers jours de cotation de chaque crypto sont ignorés (prix d'introduction erratiques).
Limite connue : l'univers est celui d'aujourd'hui (les cryptos qui ont disparu depuis n'y sont pas),
ce qui flatte toutes les stratégies, surtout le panier.

Sortie : data/screener.json
"""
import argparse, json, math, os, sys, time, urllib.request
from datetime import datetime, timezone
import numpy as np
import pandas as pd

UA = {"User-Agent": "vault-screener/1.0"}
TOPN, SLOTS = 330, 5
STABLE = {"USDT", "USDC", "DAI", "USDE", "FDUSD", "PYUSD", "TUSD", "USDS", "USD1", "RLUSD", "EURC", "USDD", "BUSD", "USDG",
          "USD0", "GHO", "FRAX", "USDF", "USYC", "BUIDL", "USTB", "USDTB", "SUSDE", "SUSDS", "STETH", "WSTETH", "WBTC", "WETH",
          "WEETH", "CBBTC", "RETH", "METH", "EZETH", "LBTC", "SOLVBTC", "JITOSOL", "BNSOL", "MSOL", "RSETH", "TBTC", "XAUT",
          "PAXG", "BFUSD", "OUSG", "USDX", "USDAI", "EUTBL", "USDY", "OUSD", "USX", "USAT", "EURCV", "KAU", "KAG", "USDGO"}


def get(url, tries=4, wait=2.0):
    for i in range(tries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=40) as r:
                return json.loads(r.read().decode())
        except Exception as e:
            if i == tries - 1:
                raise
            time.sleep(wait * (2 ** i))


def neverless():
    d = get("https://neverless.com/api/trading/public/prices")["prices"]
    out = {}
    for k, v in d.items():
        if v.get("assetType") != "CRYPTO" or not k.endswith("/USD"):
            continue
        b = k.split("/")[0]
        try:
            mid = float(v["midMarket"]["price"])
            bid, ask = float(v["bid"]["price"]), float(v["ask"]["price"])
            out[b] = {"mid": mid, "spread": (ask - bid) / mid if mid else None}
        except Exception:
            out[b] = {"mid": None, "spread": None}
    return out


def top_coins():
    rows = []
    for pg in (1, 2):
        rows += get("https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=250"
                    f"&page={pg}&price_change_percentage=7d,30d")
        time.sleep(3)
    out = []
    for c in rows:
        s = c["symbol"].upper()
        if s in STABLE or not c.get("current_price"):
            continue
        # pièces quasi stables (RWA, fonds monétaires) : variations minuscules
        if abs(c.get("price_change_percentage_30d_in_currency") or 0) < 1 and abs(c.get("price_change_percentage_7d_in_currency") or 0) < 0.5:
            continue
        out.append(c)
    return out[:TOPN]


def gate_hist(sym):
    d = get(f"https://api.gateio.ws/api/v4/spot/candlesticks?currency_pair={sym}_USDT&interval=1d&limit=1000", tries=2)
    if not isinstance(d, list) or not d:
        return None
    s = pd.Series({pd.to_datetime(int(r[0]), unit="s"): float(r[2]) for r in d})
    return s


def cg_hist(cid):
    d = get(f"https://api.coingecko.com/api/v3/coins/{cid}/market_chart?vs_currency=usd&days=730&interval=daily", tries=3, wait=8)
    s = pd.Series({pd.to_datetime(p[0], unit="ms").normalize(): float(p[1]) for p in d.get("prices", [])})
    return s


def history(c):
    """Historique journalier en USD ; la source doit coller au prix CoinGecko actuel (même actif)."""
    ref = c["current_price"]
    today = pd.Timestamp.now(tz="UTC").tz_localize(None).normalize()
    for src in ("gate", "cg"):
        try:
            s = gate_hist(c["symbol"].upper()) if src == "gate" else (time.sleep(2.5) or cg_hist(c["id"]))
        except Exception:
            s = None
        if s is None or len(s) < 30:
            continue
        s = s.sort_index()
        s = s[~s.index.duplicated(keep="last")]
        s = s[s.index < today]
        # changement d'actif derrière le même ticker : on coupe avant un saut de prix aberrant
        jump = s.pct_change().abs()
        bad = jump[(jump > 4) | (s / s.shift(1) < 0.2)]
        if len(bad):
            s = s[s.index >= bad.index[-1]]
        s = s.iloc[30:]  # premiers jours de cotation : prix d'introduction erratiques, ignorés
        if len(s) >= 30 and 0.85 <= s.iloc[-1] / ref <= 1.15:
            return s, src
    return None, None


# ---------- indicateurs et règle ----------

def indicators(s):
    r = s.pct_change()
    o = {"prix": float(s.iloc[-1]), "jours": int(len(s))}
    o["moy50"] = float(s.iloc[-50:].mean()) if len(s) >= 50 else None
    o["ecart50"] = float(s.iloc[-1] / o["moy50"] - 1) if o["moy50"] else None
    o["var7"] = float(s.iloc[-1] / s.iloc[-8] - 1) if len(s) > 8 else None
    o["var30"] = float(s.iloc[-1] / s.iloc[-31] - 1) if len(s) > 31 else None
    o["var90"] = float(s.iloc[-1] / s.iloc[-91] - 1) if len(s) > 91 else None
    o["vol30"] = float(r.iloc[-30:].std() * math.sqrt(365)) if len(s) > 31 else None
    o["recul1an"] = float(s.iloc[-1] / s.iloc[-365:].max() - 1)
    o["spark"] = [round(float(x), 8) for x in s.iloc[-60:].values[::2]]
    return o


def pick(px, d, variant):
    """Cryptos retenues à la date d (données jusqu'à d incluse)."""
    h = px.loc[:d]
    if variant == "C":
        b = h["BTC"].dropna()
        if len(b) < 50 or b.iloc[-1] <= b.iloc[-50:].mean():
            return []
    sc = {}
    for s in h.columns:
        c = h[s].dropna()
        if len(c) < 120 or c.iloc[-1] <= c.iloc[-50:].mean():
            continue
        if variant == "B":
            v = c.pct_change().iloc[-90:].std()
            sc[s] = (c.iloc[-1] / c.iloc[-91] - 1) / v if v and v > 0 else -1e9
        else:
            sc[s] = c.iloc[-1] / c.iloc[-31] - 1
    return sorted(sc, key=sc.get, reverse=True)[:SLOTS]


def backtest(px, spreads, start, variant=None, bench=None):
    """Rééquilibrage chaque lundi (décision à la clôture, exécution le lendemain)."""
    dates = px.index[px.index >= start]
    w, eq, curve, trades, pending = {}, 1.0, [], 0, None
    rets = px.pct_change()
    for i, d in enumerate(dates):
        if i > 0:
            day = sum(w[s] * (rets.at[d, s] if pd.notna(rets.at[d, s]) else 0) for s in w)
            eq *= 1 + day
            # dérive des poids
            tot = sum(w[s] * (1 + (rets.at[d, s] if pd.notna(rets.at[d, s]) else 0)) for s in w) + (1 - sum(w.values()))
            w = {s: w[s] * (1 + (rets.at[d, s] if pd.notna(rets.at[d, s]) else 0)) / tot for s in w}
        if pending is not None:
            cost = 0.0
            for s in set(w) | set(pending):
                diff = abs(pending.get(s, 0) - w.get(s, 0))
                if diff > 0.005:
                    cost += diff * (spreads.get(s) or 0.006) / 2
                    trades += 1
            eq *= 1 - cost
            w = {s: v for s, v in pending.items() if v > 0}
            pending = None
        curve.append((d, eq))
        if bench == "btc":
            if i == 0:
                pending = {"BTC": 1.0}
        elif bench == "panier":
            if i == 0 or d.day == 1:
                avail = [s for s in px.columns if px[s].loc[:d].notna().sum() >= 60]
                pending = {s: 1 / len(avail) for s in avail}
        elif d.weekday() == 0:
            sel = pick(px, d, variant)
            pending = {s: 1 / SLOTS for s in sel}
    v = np.array([e for _, e in curve])
    peak = np.maximum.accumulate(v)
    return {"rendement": round(float(v[-1] - 1), 4), "recul_max": round(float((v / peak - 1).min()), 4), "ordres": trades,
            "courbe": [[d.strftime("%Y-%m-%d"), round(float(e), 4)] for d, e in curve[::7]] + [[curve[-1][0].strftime("%Y-%m-%d"), round(float(curve[-1][1]), 4)]]}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="data/screener.json")
    a = ap.parse_args()
    nl = neverless()
    top = top_coins()
    uni = [c for c in top if c["symbol"].upper() in nl]
    if not any(c["symbol"].upper() == "BTC" for c in uni):
        uni.insert(0, next(c for c in top if c["symbol"].upper() == "BTC"))
    series, srcs, coins = {}, {}, {}
    for c in uni:
        s, src = history(c)
        sym = c["symbol"].upper()
        if s is None:
            continue
        series[sym] = s
        srcs[src] = srcs.get(src, 0) + 1
        coins[sym] = {"nom": c["name"], "rang": c.get("market_cap_rank"), "cap": c.get("market_cap"), "src": src,
                      "ecart_nl": nl.get(sym, {}).get("spread"), "img": c.get("image")}
    px = pd.DataFrame(series).sort_index()
    px = px[px.index >= px.index.max() - pd.Timedelta(days=760)]
    last = px.index.max()
    spreads = {s: coins[s]["ecart_nl"] for s in coins}

    # état du jour
    for s in coins:
        coins[s].update(indicators(px[s].dropna()))
    btc = px["BTC"].dropna()
    btc_ok = bool(btc.iloc[-1] > btc.iloc[-50:].mean())
    lists = {v: pick(px, last, v) for v in ("A", "B", "C")}
    cand = sorted([s for s in coins if coins[s]["ecart50"] is not None and coins[s]["ecart50"] > 0 and coins[s]["jours"] >= 120],
                  key=lambda s: coins[s]["var30"] or -9, reverse=True)
    for i, s in enumerate(cand):
        coins[s]["rang_elan"] = i + 1
    for s in coins:
        c = coins[s]
        c["etat"] = "liste" if s in lists["C"] else ("candidate" if s in cand else "defavorable")

    # test sur l'historique
    tests = {}
    for lab, days in (("12 mois", 365), ("2 ans", 730)):
        start = last - pd.Timedelta(days=days)
        res = {k: backtest(px, spreads, start, variant=k) for k in ("A", "B", "C")}
        res["btc"] = backtest(px, spreads, start, bench="btc")
        res["panier"] = backtest(px, spreads, start, bench="panier")
        tests[lab] = {"debut": start.strftime("%Y-%m-%d"), "fin": last.strftime("%Y-%m-%d"), "res": res}

    out = {
        "genere": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "derniere_cloture": last.strftime("%Y-%m-%d"),
        "univers": {"top": len(top), "neverless": len(uni), "avec_historique": len(coins), "sources": srcs},
        "btc_tendance": btc_ok,
        "listes": lists,
        "regle": "Lundi : cryptos au-dessus de leur moyenne 50 jours, classées par variation 30 jours ; les 5 premières, 20 % chacune ; rien si le Bitcoin est sous sa moyenne 50 jours.",
        "tests": tests,
        "cryptos": coins,
    }
    os.makedirs(os.path.dirname(a.out) or ".", exist_ok=True)
    json.dump(out, open(a.out, "w"), ensure_ascii=False, separators=(",", ":"))
    print(out["univers"], "BTC tendance", btc_ok, lists)
    for lab, t in tests.items():
        print(lab, {k: (v["rendement"], v["recul_max"], v["ordres"]) for k, v in t["res"].items()})


if __name__ == "__main__":
    main()

"""Agent VAULT : stratégies fixées à l'avance, test sur l'historique et trading fictif quotidien.

Règles communes (fixées avant tout test, ne pas les ajuster après coup) :
- comptant uniquement, cryptos de l'univers du profil, le reste en stablecoin (rendement nul) ;
- décision prise sur la clôture du jour J, exécutée à la clôture de J+1 (calcul le matin, ordre passé dans la journée) ;
- aucun frais (Neverless) mais un écart achat/vente estimé de 0,1 % sur chaque montant échangé ;
- on ne rééquilibre une ligne que si l'écart à la cible dépasse 3 % du capital ;
- arrêt : si la valeur tombe à -20 % du capital de départ, tout passe en stablecoin et la stratégie s'arrête.

Stratégies :
- garder      : on ne touche à rien (répartition Neverless de départ) ;
- tendance    : chaque crypto au-dessus de sa moyenne 50 jours reçoit 1/5 du capital ;
- tendance_vol: mêmes cryptos, pondérées à l'inverse de leur volatilité 30 jours, exposition visant
                une volatilité de 50 %/an, au plus 100 % investi ;
- elan        : parmi les cryptos au-dessus de leur moyenne 50 jours, les 2 meilleures sur 30 jours, 50 % chacune ;
- ia          : comité IA (kronos/committee.py), seulement en trading fictif (le modèle connaît le passé,
                un test sur l'historique serait faussé).

Sortie : data/agent.json
"""
import argparse, json, math, os, sys
from datetime import datetime, timezone
import numpy as np
import pandas as pd

sys.path.insert(0, os.path.dirname(__file__))
from fetch_data import coinbase, kraken, gate, clean, eurusd  # noqa: E402

HERE = os.path.dirname(__file__)
PROFILE = json.load(open(os.path.join(HERE, "agent_profile.json")))
U = PROFILE["univers"]
SRC = {
    "BTC": (lambda: coinbase("BTC-EUR"), "EUR"),
    "ETH": (lambda: coinbase("ETH-EUR"), "EUR"),
    "SOL": (lambda: coinbase("SOL-EUR"), "EUR"),
    "PLUME": (lambda: kraken("PLUMEUSD"), "USD"),
    "CETUS": (lambda: gate("CETUS_USDT"), "USD"),
}
NAMES = {
    "garder": "Garder sans bouger",
    "tendance": "Tendance 50 jours",
    "tendance_vol": "Tendance + volatilité",
    "elan": "Élan (2 meilleures)",
    "ia": "Comité IA (mélange)",
    "ia_groq": "IA Groq",
    "ia_gemini": "IA Gemini",
    "ia_openrouter": "IA OpenRouter",
    "ia_claude": "IA Claude",
    "ia_local": "IA locale",
}


def load_closes():
    fx = eurusd()
    cols = {}
    for s in U:
        f, q = SRC[s]
        df = clean(f())
        c = df.set_index("date")["close"]
        if q == "USD":
            c = c / fx.reindex(c.index).ffill().bfill()
        cols[s] = c
    px = pd.DataFrame(cols).sort_index()
    px.index = px.index.tz_convert(None).normalize()
    return px


# ---------- décisions (sur les données jusqu'à la clôture t incluse) ----------

def eligible(h):
    out = []
    for s in U:
        c = h[s].dropna()
        if len(c) >= 50 and c.iloc[-1] > c.iloc[-50:].mean():
            out.append(s)
    return out


def w_tendance(h):
    return {s: 1.0 / len(U) for s in eligible(h)}


def w_tendance_vol(h):
    el = eligible(h)
    if not el:
        return {}
    vol = {}
    for s in el:
        r = h[s].dropna().pct_change().iloc[-30:]
        vol[s] = max(float(r.std()) * math.sqrt(365), 0.05)
    inv = {s: 1 / v for s, v in vol.items()}
    tot = sum(inv.values())
    w = {s: inv[s] / tot for s in el}
    pvol = sum(w[s] * vol[s] for s in el)  # prudence : corrélation supposée totale
    k = min(1.0, 0.5 / pvol)
    return {s: w[s] * k for s in el}


def w_elan(h):
    el = eligible(h)
    sc = {}
    for s in el:
        c = h[s].dropna()
        if len(c) > 30:
            sc[s] = c.iloc[-1] / c.iloc[-31] - 1
    top = sorted(sc, key=sc.get, reverse=True)[:2]
    return {s: 0.5 for s in top}


RULES = {"tendance": w_tendance, "tendance_vol": w_tendance_vol, "elan": w_elan}


# ---------- simulation ----------

def simulate(px, start, w0, decide=None, log=None, use_stop=True):
    """px : clôtures EUR ; start : date de départ ; w0 : répartition de départ.
    decide(h) -> cible, ou log {date: cible} (comité IA). None = garder.
    Retourne courbe de valeur (1 = départ), journal d'ordres, répartition actuelle, état."""
    dates = px.index[px.index >= start]
    stop = 1 + PROFILE["arret"] if use_stop else -1.0
    spread, thr = PROFILE["ecart_estime"], PROFILE["seuil_ordre"]
    hold = {s: w for s, w in w0.items()}          # valeur détenue par crypto (en unités de capital)
    cash = 1 - sum(hold.values())
    pending, stopped, stop_date = None, False, None
    curve, trades, n_trades = [], [], 0
    for i, d in enumerate(dates):
        if i > 0:
            prev = dates[i - 1]
            for s in list(hold):
                p0, p1 = px.at[prev, s], px.at[d, s]
                if pd.notna(p0) and pd.notna(p1) and p0 > 0:
                    hold[s] *= p1 / p0
        eq = cash + sum(hold.values())
        # exécution à la clôture de d de la décision prise la veille
        if pending is not None and not stopped:
            tgt = pending
            orders = []
            for s in set(hold) | set(tgt):
                cur = hold.get(s, 0.0)
                want = tgt.get(s, 0.0) * eq
                if abs(want - cur) > thr * eq or (want == 0 and cur > 1e-9):
                    delta = want - cur
                    cost = abs(delta) * spread
                    hold[s] = cur + delta
                    cash -= delta + cost
                    orders.append((s, delta))
            if orders:
                n_trades += len(orders)
                trades.append({"date": d.strftime("%Y-%m-%d"), "ordres": {s: round(v / eq, 4) for s, v in orders}})
            hold = {s: v for s, v in hold.items() if v > 1e-9}
            eq = cash + sum(hold.values())
            pending = None
        if not stopped and eq <= stop:
            stopped, stop_date = True, d.strftime("%Y-%m-%d")
            pending = None
            # vente le lendemain : on marque l'ordre, exécuté au tour suivant
            stop_pending = True
        else:
            stop_pending = False
        curve.append((d, eq))
        if stopped:
            if stop_pending:
                continue
            if hold:  # exécution de l'arrêt (lendemain du franchissement)
                cash += sum(v * (1 - spread) for v in hold.values())
                trades.append({"date": d.strftime("%Y-%m-%d"), "ordres": {s: -1.0 for s in hold}, "arret": True})
                n_trades += len(hold)
                hold = {}
                curve[-1] = (d, cash)
            continue
        h = px.loc[:d]
        if decide is not None:
            pending = decide(h)
        elif log is not None and d.strftime("%Y-%m-%d") in log:
            pending = log[d.strftime("%Y-%m-%d")]
    eq = cash + sum(hold.values())
    cur_w = {s: v / eq for s, v in hold.items()} if eq > 0 else {}
    return curve, trades, n_trades, cur_w, stopped, stop_date, pending


def summary(curve, n_trades, stopped, stop_date):
    v = np.array([e for _, e in curve])
    peak = np.maximum.accumulate(v)
    return {
        "rendement": round(float(v[-1] / v[0] - 1), 4),
        "recul_max": round(float((v / peak - 1).min()), 4),
        "ordres": n_trades,
        "arret": stop_date if stopped else None,
    }


def weekly(curve):
    s = pd.Series({d: e for d, e in curve})
    s = s.iloc[::7].combine_first(s.iloc[[-1]]) if len(s) > 60 else s
    return [[d.strftime("%Y-%m-%d"), round(float(e), 4)] for d, e in s.items()]


def features(px):
    out = {}
    for s in U:
        c = px[s].dropna()
        if len(c) < 60:
            continue
        r = c.pct_change()
        out[s] = {
            "prix_eur": round(float(c.iloc[-1]), 6),
            "ecart_moy50_pct": round(float(c.iloc[-1] / c.iloc[-50:].mean() - 1) * 100, 1),
            "ecart_moy200_pct": round(float(c.iloc[-1] / c.iloc[-200:].mean() - 1) * 100, 1) if len(c) >= 200 else None,
            "var_7j_pct": round(float(c.iloc[-1] / c.iloc[-8] - 1) * 100, 1),
            "var_30j_pct": round(float(c.iloc[-1] / c.iloc[-31] - 1) * 100, 1),
            "var_90j_pct": round(float(c.iloc[-1] / c.iloc[-91] - 1) * 100, 1) if len(c) > 91 else None,
            "vol_30j_annuelle_pct": round(float(r.iloc[-30:].std() * math.sqrt(365)) * 100, 0),
            "recul_depuis_max_1an_pct": round(float(c.iloc[-1] / c.iloc[-365:].max() - 1) * 100, 1),
        }
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="data/agent.json")
    a = ap.parse_args()
    prev = {}
    if os.path.exists(a.out):
        try:
            prev = json.load(open(a.out))
        except Exception:
            prev = {}
    px = load_closes()
    last = px.index[-1]
    w0 = PROFILE["depart"]

    # 1) test sur l'historique, deux fenêtres, départ depuis la répartition actuelle de Neverless
    hist = {}
    for label, days in (("12 mois", 365), ("Historique complet", None)):
        start = last - pd.Timedelta(days=days) if days else px["PLUME"].dropna().index[0] + pd.Timedelta(days=60)
        res = {}
        for k in ["garder"] + list(RULES):
            c, t, n, _, st, sd, _ = simulate(px, start, w0, RULES.get(k))
            c2, _, n2, _, _, _, _ = simulate(px, start, w0, RULES.get(k), use_stop=False)
            res[k] = summary(c, n, st, sd) | {"courbe": weekly(c), "sans_arret": summary(c2, n2, False, None), "courbe_sans_arret": weekly(c2)}
        hist[label] = {"debut": start.strftime("%Y-%m-%d"), "fin": last.strftime("%Y-%m-%d"), "strategies": res}

    # 2) trading fictif depuis la date du profil
    pstart = pd.Timestamp(PROFILE["debut"])
    ia_log = dict(prev.get("ia_log", {}))
    feats = features(px)
    ia_note = None
    from committee import providers, decide_all
    # anciennes entrées (un seul comité) : converties au nouveau format
    ia_log = {d: (v if "mix" in v else {"mix": v, "avis": {}}) for d, v in ia_log.items()}
    provs = providers()
    if provs:
        key = last.strftime("%Y-%m-%d")
        if key not in ia_log or ia_log[key].get("erreurs"):
            pp = prev.get("papier", {})
            cur = {"mix": pp.get("ia", {}).get("repartition", w0)}
            for p in provs:
                cur[p["id"]] = pp.get("ia_" + p["id"], {}).get("repartition", w0)
            try:
                ia_log[key] = decide_all(feats, cur, PROFILE)
                if ia_log[key].get("erreurs"):
                    ia_note = "Sans réponse aujourd'hui : " + " ; ".join(f"{k} ({v})" for k, v in ia_log[key]["erreurs"].items()) + ". Nouvel essai au prochain calcul."
            except Exception as e:  # le comité ne doit jamais bloquer le reste
                ia_note = f"Comité IA indisponible aujourd'hui : {e}. Nouvel essai demain."
    else:
        ia_note = ("Comité IA en attente : il démarre au prochain calcul du matin avec un modèle ouvert lancé dans la tâche GitHub "
                   "(gratuit, sans compte). Les clés gratuites Groq et Gemini le rendent plus rapide et plus fiable.")

    paper = {}
    ia_ids = sorted({a for v in ia_log.values() for a in (v.get("avis") or {})})
    for k in ["garder"] + list(RULES) + ["ia"] + ["ia_" + a for a in ia_ids]:
        if k == "ia" or k.startswith("ia_"):
            if k == "ia":
                lg = {d: v["mix"]["cible"] for d, v in ia_log.items() if v.get("mix")}
            else:
                lg = {d: v["avis"][k[3:]]["cible"] for d, v in ia_log.items() if k[3:] in (v.get("avis") or {})}
            if not lg:
                continue
            c, t, n, cw, st, sd, pend = simulate(px, pstart, w0, log=lg)
        else:
            c, t, n, cw, st, sd, pend = simulate(px, pstart, w0, RULES.get(k))
        eq = c[-1][1]
        target = pend if pend is not None else (cw if k == "garder" or st else cw)
        orders = []
        if not st and pend is not None:
            for s in sorted(set(cw) | set(pend)):
                diff = pend.get(s, 0) - cw.get(s, 0)
                if abs(diff) > PROFILE["seuil_ordre"] or (pend.get(s, 0) == 0 and cw.get(s, 0) > 1e-6):
                    orders.append({"actif": s, "part": round(diff * eq, 4)})
        paper[k] = summary(c, n, st, sd) | {
            "courbe": [[d.strftime("%Y-%m-%d"), round(float(e), 4)] for d, e in c],
            "repartition": {s: round(v, 4) for s, v in cw.items()},
            "cible": {s: round(v, 4) for s, v in (target or {}).items()},
            "ordres_du_jour": orders,
            "valeur": round(float(eq), 4),
        }

    out = {
        "genere": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "derniere_cloture": last.strftime("%Y-%m-%d"),
        "profil": PROFILE,
        "noms": NAMES,
        "historique": hist,
        "papier": paper,
        "ia_log": ia_log,
        "ia_note": ia_note,
        "indicateurs": feats,
    }
    os.makedirs(os.path.dirname(a.out) or ".", exist_ok=True)
    json.dump(out, open(a.out, "w"), ensure_ascii=False, indent=1)
    for lab, h in hist.items():
        print(lab, h["debut"], {k: (v["rendement"], v["recul_max"], v["ordres"], v["arret"]) for k, v in h["strategies"].items()})
    print("papier", {k: (v["valeur"], v["ordres_du_jour"]) for k, v in paper.items()})


if __name__ == "__main__":
    main()

"""Comité IA de l'agent VAULT, inspiré de TradingAgents (Tauric Research) : des analystes
argumentent, puis un gérant tranche sous les contraintes du profil.

Version compacte : deux appels à l'API Claude par jour (analystes, puis gérant).
Les données fournies sont uniquement des indicateurs de prix calculés sur les clôtures ;
pas d'actualités ni de réseaux sociaux (sources payantes ou peu fiables).

Clé : variable d'environnement ANTHROPIC_API_KEY (secret GitHub du dépôt).
"""
import json, os, re, urllib.request

MODEL = os.environ.get("VAULT_AGENT_MODEL", "claude-sonnet-5-5")


def _call(system, user, max_tokens=1500):
    body = json.dumps({
        "model": MODEL,
        "max_tokens": max_tokens,
        "system": system,
        "messages": [{"role": "user", "content": user}],
    }).encode()
    req = urllib.request.Request(
        "https://api.anthropic.com/v1/messages", data=body,
        headers={"x-api-key": os.environ["ANTHROPIC_API_KEY"], "anthropic-version": "2023-06-01",
                 "content-type": "application/json"})
    with urllib.request.urlopen(req, timeout=120) as r:
        d = json.loads(r.read().decode())
    return "".join(b.get("text", "") for b in d.get("content", []))


def _json(txt):
    m = re.search(r"\{.*\}", txt, re.S)
    if not m:
        raise ValueError("réponse sans JSON")
    return json.loads(m.group(0))


def decide(features, current, profile):
    univers = profile["univers"]
    ctx = (
        f"Profil : compte {profile['compte']}, comptant uniquement (pas de levier), sans frais, "
        f"arrêt définitif si la valeur tombe à {int(profile['arret'] * 100)} % du capital de départ. "
        f"Univers autorisé : {', '.join(univers)} ; le reste est conservé en stablecoin. "
        f"Ordres exécutés le lendemain de la décision.\n"
        f"Répartition actuelle (part du capital) : {json.dumps(current)}\n"
        f"Indicateurs à la dernière clôture (en euros) : {json.dumps(features, ensure_ascii=False)}"
    )
    analystes = _call(
        "Tu es un comité d'analystes crypto prudents. Tu ne connais que les indicateurs fournis ; "
        "n'invente aucune actualité ni aucun chiffre. Réponds en français, en JSON uniquement.",
        ctx + "\n\nProduis {\"tendance\": \"...\", \"risque\": \"...\", \"pour\": \"...\", \"contre\": \"...\"} : "
        "analyse de tendance, analyse de risque (volatilité, reculs, proximité de l'arrêt), meilleur argument "
        "pour investir, meilleur argument contre. 3 phrases maximum chacun.")
    a = _json(analystes)
    gerant = _call(
        "Tu es le gérant. Tu respectes strictement le profil : comptant, univers autorisé, somme des parts ≤ 1. "
        "Tu préfères rester en stablecoin quand les arguments ne sont pas clairs. Réponds en JSON uniquement.",
        ctx + "\n\nAnalyses du comité : " + json.dumps(a, ensure_ascii=False) +
        "\n\nDonne {\"cible\": {\"SYMBOLE\": part, ...}, \"decision\": \"2 phrases en français\"} "
        "où part est entre 0 et 1 et où les symboles absents valent 0.")
    g = _json(gerant)
    cible = {}
    for s, v in (g.get("cible") or {}).items():
        s = str(s).upper()
        try:
            v = float(v)
        except (TypeError, ValueError):
            continue
        if s in univers and v > 0:
            cible[s] = min(v, 1.0)
    tot = sum(cible.values())
    if tot > 1:
        cible = {s: v / tot for s, v in cible.items()}
    return {"cible": {s: round(v, 4) for s, v in cible.items()},
            "decision": str(g.get("decision", ""))[:600],
            "analyses": {k: str(a.get(k, ""))[:600] for k in ("tendance", "risque", "pour", "contre")},
            "modele": MODEL}

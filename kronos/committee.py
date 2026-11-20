"""Comité IA de l'agent VAULT, inspiré de TradingAgents (Tauric Research) : des analystes
argumentent, puis un gérant tranche sous les contraintes du profil.

Version compacte : deux appels par jour (analystes, puis gérant), avec uniquement des
indicateurs de prix calculés sur les clôtures (pas d'actualités ni de réseaux sociaux).

Fournisseurs gratuits pris en charge, dans cet ordre (le premier configuré est utilisé) :
  GROQ_API_KEY        Groq, offre gratuite sans carte bancaire (modèle openai/gpt-oss-120b)
  GEMINI_API_KEY      Google AI Studio, offre gratuite (modèle gemini-flash-latest)
  OPENROUTER_API_KEY  OpenRouter, modèles « :free » (50 requêtes par jour)
  OLLAMA_URL          modèle ouvert lancé dans la tâche GitHub elle-même, sans compte ni clé
  ANTHROPIC_API_KEY   Claude, payant (facultatif)
VAULT_AGENT_MODEL remplace le modèle par défaut du fournisseur choisi.
"""
import json, os, re, time, urllib.request

ENV = os.environ


def provider():
    m = ENV.get("VAULT_AGENT_MODEL")
    if ENV.get("GROQ_API_KEY"):
        return {"nom": "Groq", "url": "https://api.groq.com/openai/v1/chat/completions",
                "cle": ENV["GROQ_API_KEY"], "modele": m or "openai/gpt-oss-120b"}
    if ENV.get("GEMINI_API_KEY"):
        return {"nom": "Gemini", "url": "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
                "cle": ENV["GEMINI_API_KEY"], "modele": m or "gemini-flash-latest"}
    if ENV.get("OPENROUTER_API_KEY"):
        return {"nom": "OpenRouter", "url": "https://openrouter.ai/api/v1/chat/completions",
                "cle": ENV["OPENROUTER_API_KEY"], "modele": m or "openai/gpt-oss-120b:free"}
    if ENV.get("OLLAMA_URL"):
        return {"nom": "modèle local", "url": ENV["OLLAMA_URL"].rstrip("/") + "/v1/chat/completions",
                "cle": "ollama", "modele": m or ENV.get("OLLAMA_MODEL", "qwen2.5:7b")}
    if ENV.get("ANTHROPIC_API_KEY"):
        return {"nom": "Claude", "url": "anthropic", "cle": ENV["ANTHROPIC_API_KEY"], "modele": m or "claude-sonnet-5-5"}
    return None


def _post(url, body, headers, timeout):
    req = urllib.request.Request(url, data=json.dumps(body).encode(), headers=headers)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode())


def _call(p, system, user, max_tokens=1500):
    if p["url"] == "anthropic":
        d = _post("https://api.anthropic.com/v1/messages",
                  {"model": p["modele"], "max_tokens": max_tokens, "system": system,
                   "messages": [{"role": "user", "content": user}]},
                  {"x-api-key": p["cle"], "anthropic-version": "2023-06-01", "content-type": "application/json"}, 120)
        return "".join(b.get("text", "") for b in d.get("content", []))
    d = _post(p["url"],
              {"model": p["modele"], "max_tokens": max_tokens, "temperature": 0.2,
               "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}]},
              {"Authorization": "Bearer " + p["cle"], "Content-Type": "application/json",
               "User-Agent": "vault-agent/1.0"}, 900 if p["nom"] == "modèle local" else 120)
    return d["choices"][0]["message"].get("content") or ""


def _json(txt):
    txt = re.sub(r"<think>.*?</think>", "", txt, flags=re.S)
    m = re.search(r"\{.*\}", txt, re.S)
    if not m:
        raise ValueError("réponse sans JSON")
    return json.loads(m.group(0))


def _ask(p, system, user):
    err = None
    for i in range(3):
        try:
            return _json(_call(p, system, user))
        except Exception as e:  # réponse mal formée ou limite de requêtes : on réessaie
            err = e
            time.sleep(5 + 10 * i)
    raise err


def decide(features, current, profile):
    p = provider()
    if not p:
        raise RuntimeError("aucun fournisseur configuré")
    univers = profile["univers"]
    ctx = (
        f"Profil : compte {profile['compte']}, comptant uniquement (pas de levier), sans frais, "
        f"arrêt définitif si la valeur tombe à {int(profile['arret'] * 100)} % du capital de départ. "
        f"Univers autorisé : {', '.join(univers)} ; le reste est conservé en stablecoin. "
        f"Ordres exécutés le lendemain de la décision.\n"
        f"Répartition actuelle (part du capital) : {json.dumps(current)}\n"
        f"Indicateurs à la dernière clôture (en euros) : {json.dumps(features, ensure_ascii=False)}"
    )
    a = _ask(p,
             "Tu es un comité d'analystes crypto prudents. Tu ne connais que les indicateurs fournis ; "
             "n'invente aucune actualité ni aucun chiffre. Réponds en français, uniquement par un objet JSON.",
             ctx + "\n\nProduis {\"tendance\": \"...\", \"risque\": \"...\", \"pour\": \"...\", \"contre\": \"...\"} : "
             "analyse de tendance, analyse de risque (volatilité, reculs, proximité de l'arrêt), meilleur argument "
             "pour investir, meilleur argument contre. 3 phrases maximum chacun.")
    g = _ask(p,
             "Tu es le gérant. Tu respectes strictement le profil : comptant, univers autorisé, somme des parts ≤ 1. "
             "Tu préfères rester en stablecoin quand les arguments ne sont pas clairs. Réponds uniquement par un objet JSON.",
             ctx + "\n\nAnalyses du comité : " + json.dumps(a, ensure_ascii=False) +
             "\n\nDonne {\"cible\": {\"SYMBOLE\": part, ...}, \"decision\": \"2 phrases en français\"} "
             "où part est entre 0 et 1 et où les symboles absents valent 0.")
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
            "modele": f"{p['modele']} ({p['nom']})"}

"""Comité IA de l'agent VAULT, inspiré de TradingAgents (Tauric Research) : des analystes
argumentent, puis un gérant tranche sous les contraintes du profil.

Version compacte : deux appels par jour (analystes, puis gérant), avec uniquement des
indicateurs de prix calculés sur les clôtures (pas d'actualités ni de réseaux sociaux).

Fournisseurs gratuits pris en charge. Tous ceux qui sont configurés rendent leur avis séparément,
puis un juge (Gemini en priorité) combine les avis ; chaque avis et le mélange sont suivis en fictif :
  GROQ_API_KEY        Groq, offre gratuite sans carte bancaire (modèle openai/gpt-oss-120b)
  GEMINI_API_KEY      Google AI Studio, offre gratuite (modèle gemini-flash-latest)
  OPENROUTER_API_KEY  OpenRouter, modèles « :free » (50 requêtes par jour)
  OLLAMA_URL          modèle ouvert lancé dans la tâche GitHub elle-même, sans compte ni clé
  ANTHROPIC_API_KEY   Claude, payant (facultatif)
VAULT_AGENT_MODEL remplace le modèle par défaut du fournisseur choisi.
"""
import json, os, re, time, urllib.error, urllib.request

ENV = os.environ


def _mk(nom):
    m = ENV.get("VAULT_AGENT_MODEL")
    if nom == "groq" and ENV.get("GROQ_API_KEY"):
        return {"id": "groq", "nom": "Groq", "url": "https://api.groq.com/openai/v1/chat/completions",
                "cle": ENV["GROQ_API_KEY"], "modele": ENV.get("GROQ_MODEL") or m or "openai/gpt-oss-120b"}
    if nom == "gemini" and ENV.get("GEMINI_API_KEY"):
        return {"id": "gemini", "nom": "Gemini", "url": "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
                "cle": ENV["GEMINI_API_KEY"], "modele": _gemini_model(ENV["GEMINI_API_KEY"], ENV.get("GEMINI_MODEL") or m or "gemini-flash-latest")}
    if nom == "openrouter" and ENV.get("OPENROUTER_API_KEY"):
        return {"id": "openrouter", "nom": "OpenRouter", "url": "https://openrouter.ai/api/v1/chat/completions",
                "cle": ENV["OPENROUTER_API_KEY"], "modele": m or "openai/gpt-oss-120b:free"}
    if nom == "local" and ENV.get("OLLAMA_URL"):
        return {"id": "local", "nom": "modèle local", "url": ENV["OLLAMA_URL"].rstrip("/") + "/v1/chat/completions",
                "cle": "ollama", "modele": ENV.get("OLLAMA_MODEL") or "qwen2.5:7b"}
    if nom == "claude" and ENV.get("ANTHROPIC_API_KEY"):
        return {"id": "claude", "nom": "Claude", "url": "anthropic", "cle": ENV["ANTHROPIC_API_KEY"], "modele": m or "claude-sonnet-5-5"}
    return None


ORDER = ["groq", "gemini", "openrouter", "claude", "local"]


_GEM = {}
_GEM_ALT = []


def _gemini_model(key, wanted):
    """Choisit un modèle Gemini réellement disponible pour cette clé (la liste change souvent)."""
    if wanted in _GEM:
        return _GEM[wanted]
    pick = wanted
    try:
        url = "https://generativelanguage.googleapis.com/v1beta/models?pageSize=200&key=" + key
        with urllib.request.urlopen(url, timeout=30) as r:
            ms = json.loads(r.read().decode()).get("models", [])
        names = [m["name"].split("/")[-1] for m in ms if "generateContent" in m.get("supportedGenerationMethods", [])]
        if wanted not in names:
            bad = ("image", "tts", "audio", "live", "embedding", "vision", "exp", "preview", "thinking")
            fl = [n for n in names if "flash" in n and not any(b in n for b in bad)]
            fl = fl or [n for n in names if "flash" in n] or names
            pick = next((n for n in fl if n.endswith("flash-latest")), None) or (sorted(fl)[-1] if fl else wanted)
        bad = ("image", "tts", "audio", "live", "embedding", "vision")
        _GEM_ALT[:] = [n for n in sorted({n for n in names if "flash" in n and not any(b in n for b in bad)}, reverse=True) if n != pick][:4]
    except Exception:
        pass
    _GEM[wanted] = pick
    return pick


def providers():
    """Tous les fournisseurs configurés (le modèle local seulement s'il n'y en a aucun autre)."""
    ps = [p for p in (_mk(n) for n in ORDER if n != "local") if p]
    return ps or [p for p in [_mk("local")] if p]


def provider():
    ps = providers()
    return ps[0] if ps else None


def _post(url, body, headers, timeout):
    req = urllib.request.Request(url, data=json.dumps(body).encode(), headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        try:
            msg = e.read().decode()[:300]
        except Exception:
            msg = ""
        raise RuntimeError(f"HTTP {e.code} {re.sub(r'AIza[0-9A-Za-z_-]+|gsk_[0-9A-Za-z]+', '***', msg)}")


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


def _ask(p, system, user, tries=2):
    err = None
    for i in range(tries):
        try:
            return _json(_call(p, system, user))
        except Exception as e:  # réponse mal formée ou limite de requêtes : on réessaie
            err = e
            time.sleep(5 + 10 * i)
    raise err


def _ctx(features, current, profile):
    return (
        f"Profil : compte {profile['compte']}, comptant uniquement (pas de levier), sans frais, "
        f"arrêt définitif si la valeur tombe à {int(profile['arret'] * 100)} % du capital de départ. "
        f"Univers autorisé : {', '.join(profile['univers'])} ; le reste est conservé en stablecoin. "
        f"Ordres exécutés le lendemain de la décision.\n"
        f"Répartition actuelle (part du capital{', compte réel Neverless' if 'STABLECOIN' in current else ''}) : {json.dumps(current)}\n"
        f"Indicateurs à la dernière clôture (en euros) : {json.dumps(features, ensure_ascii=False)}"
    )


def _clean(g, univers):
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
    return {s: round(v, 4) for s, v in cible.items()}


def decide_one(p, features, current, profile):
    ctx = _ctx(features, current, profile)
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
    return {"cible": _clean(g, profile["univers"]),
            "decision": str(g.get("decision", ""))[:600],
            "analyses": {k: str(a.get(k, ""))[:600] for k in ("tendance", "risque", "pour", "contre")},
            "modele": f"{p['modele']} ({p['nom']})"}


def judge(p, avis, features, current, profile):
    """Le juge lit les avis complets des comités et tranche ; il doit dire sur quoi ils s'accordent."""
    ctx = _ctx(features, current, profile)
    g = _ask(p,
             "Tu es le juge final d'un fonds prudent. Plusieurs comités indépendants ont rendu leur avis. "
             "Tu ne retiens une position que si leurs arguments la justifient ; en cas de désaccord, tu prends la position "
             "la plus prudente des deux ou un compromis inférieur. Comptant, univers autorisé, somme des parts ≤ 1. "
             "Réponds uniquement par un objet JSON.",
             ctx + "\n\nAvis des comités : " + json.dumps(avis, ensure_ascii=False) +
             "\n\nDonne {\"cible\": {\"SYMBOLE\": part, ...}, \"accord\": \"sur quoi les comités s'accordent ou divergent, 2 phrases\", "
             "\"decision\": \"2 phrases en français\"}.")
    return {"cible": _clean(g, profile["univers"]), "decision": str(g.get("decision", ""))[:600],
            "accord": str(g.get("accord", ""))[:600], "juge": f"{p['modele']} ({p['nom']})"}


def decide_all(features, current, profile):
    """Avis de chaque fournisseur configuré, puis mélange jugé.
    Retourne {"avis": {id: décision}, "mix": décision finale, "erreurs": {id: message}}."""
    ps = providers()
    if not ps:
        raise RuntimeError("aucun fournisseur configuré")
    # current : {"mix": répartition, "groq": répartition, ...}
    avis, err = {}, {}
    for p in ps:
        cands = [p] + ([dict(p, modele=a) for a in _GEM_ALT] if p["id"] == "gemini" else [])
        for q in cands:  # Gemini saturé (503/429) : on essaie un autre modèle Flash
            try:
                avis[p["id"]] = decide_one(q, features, current.get(p["id"]) or current.get("mix") or {}, profile)
                err.pop(p["id"], None)
                break
            except Exception as e:
                err[p["id"]] = f"{type(e).__name__}: {str(e)[:200]}"
                if not re.search(r"HTTP (503|429|404)", str(e)):
                    break
    if not avis:
        raise RuntimeError("aucun comité n'a répondu : " + ", ".join(f"{k} {v}" for k, v in err.items()))
    if len(avis) == 1:
        k = next(iter(avis))
        mix = dict(avis[k], accord="Un seul comité a répondu aujourd'hui : sa décision est reprise telle quelle.", juge=avis[k]["modele"])
    else:
        mix, jerr = None, {}
        # juge : Gemini en priorité (il n'a pas rendu le premier avis), sinon le premier qui répond
        for p in sorted(ps, key=lambda x: 0 if x["id"] == "gemini" else 1):
            try:
                mix = judge(p, avis, features, current.get("mix") or {}, profile)
                break
            except Exception as e:
                jerr["juge_" + p["id"]] = type(e).__name__
        if mix is None:
            err.update(jerr)  # seul un échec de tous les juges compte comme une erreur
        if mix is None:  # repli sans IA : pour chaque crypto, la part la plus faible des avis
            keys = set().union(*[set(v["cible"]) for v in avis.values()])
            cible = {s: min(v["cible"].get(s, 0) for v in avis.values()) for s in keys}
            mix = {"cible": {s: w for s, w in cible.items() if w > 0}, "decision": "Juge indisponible : on garde la part la plus prudente de chaque avis.",
                   "accord": "", "juge": "règle prudente"}
    return {"avis": avis, "mix": mix, "erreurs": err}


def decide(features, current, profile):
    """Compatibilité : décision finale seule."""
    return decide_all(features, current, profile)["mix"]

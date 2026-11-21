"""Alertes Telegram de VAULT.

Chaque passage (tâche du matin, ou lancement manuel) :
- repère les nouveautés depuis le passage précédent : changement de tendance d'une crypto détenue,
  règle de risque nouvellement dépassée, stratégie proche de son arrêt ou arrêtée, nouveaux ordres du comité IA ;
- envoie un résumé du jour (une fois par jour) avec ces nouveautés en tête ;
- un lancement supplémentaire le même jour n'envoie un message que s'il y a du nouveau.

Secrets : TELEGRAM_BOT_TOKEN (obligatoire), TELEGRAM_CHAT_ID (facultatif : sinon pris dans le dernier message
envoyé au bot, puis mémorisé), VAULT_KEY (facultatif : règles de risque et positions, via l'instantané que
VAULT envoie au script Google quand tu ouvres le site).
État : data/alerts_state.json (aucune donnée de portefeuille, seulement des drapeaux).
"""
import argparse, html, json, os, re, sys, urllib.parse, urllib.request
from datetime import datetime, timezone

ROOT = os.path.join(os.path.dirname(__file__), "..")
ENV = os.environ
SITE = "https://jcousquersuper10count.github.io/Crypto/"


def jload(p, d=None):
    try:
        return json.load(open(p))
    except Exception:
        return d


def get(url, timeout=30):
    req = urllib.request.Request(url, headers={"User-Agent": "vault-alerts/1.0"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode())


def gas_url():
    if ENV.get("GAS_URL"):
        return ENV["GAS_URL"]
    m = re.search(r"const GAS='([^']+)'", open(os.path.join(ROOT, "app.js")).read())
    return m.group(1) if m else None


def snapshot():
    k, u = ENV.get("VAULT_KEY"), gas_url()
    if not (k and u):
        return None, "Ajoute le secret VAULT_KEY pour recevoir aussi tes règles de risque."
    try:
        d = get(u + "?" + urllib.parse.urlencode({"action": "snapshot", "key": k}), 60)
    except Exception as e:
        return None, f"Script Google injoignable ({type(e).__name__})."
    if d.get("status") == "denied":
        return None, "Clé VAULT refusée par le script Google : vérifie le secret VAULT_KEY."
    if not d.get("snap"):
        return None, "Aucun instantané encore : ouvre VAULT une fois avec ta clé enregistrée."
    return d["snap"], None


def e(s):
    return html.escape(str(s), quote=False)


def eur(v):
    return f"{round(v):,}".replace(",", " ") + " €"


def tg(method, **params):
    tok = ENV["TELEGRAM_BOT_TOKEN"].strip()
    data = json.dumps(params).encode()
    req = urllib.request.Request(f"https://api.telegram.org/bot{tok}/{method}", data=data,
                                 headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read().decode())


def chat_id(state):
    if ENV.get("TELEGRAM_CHAT_ID"):
        return ENV["TELEGRAM_CHAT_ID"]
    if state.get("chat_id"):
        return state["chat_id"]
    try:
        me = tg("getMe").get("result", {})
        print(f"Bot reconnu : @{me.get('username')}")
    except Exception as ex:
        print(f"Jeton Telegram refusé ({ex}) : vérifie le secret TELEGRAM_BOT_TOKEN (copié en entier, sans espace).")
        return None
    try:
        up = tg("getUpdates", limit=50).get("result", [])
    except Exception as ex:
        print(f"Lecture des messages du bot impossible : {ex}")
        up = []
    print(f"{len(up)} message(s) reçu(s) par le bot")
    for u in reversed(up):
        m = u.get("message") or u.get("my_chat_member") or {}
        c = (m.get("chat") or {})
        if c.get("type") == "private" and c.get("id"):
            state["chat_id"] = c["id"]
            return c["id"]
    return None


def build(state, now):
    sig = jload(os.path.join(ROOT, "data/signals.json"), {}) or {}
    ag = jload(os.path.join(ROOT, "data/agent.json"), {}) or {}
    snap, snap_note = snapshot()
    news, lines = [], []
    held = {p["s"]: p for p in (snap or {}).get("positions", []) if p.get("ty") == "crypto"}

    # 1) tendances
    prev = state.get("signaux", {})
    cur = {}
    tl = []
    for s, c in (sig.get("coins") or {}).items():
        t = c.get("trend") or {}
        if c.get("stale"):
            tl.append(f"{e(s)} : suspendu (données anciennes)")
            continue
        above = bool(t.get("above"))
        cur[s] = above
        dist = (t.get("distance") or 0) * 100
        pos = f" · ta position {eur(held[s]['e'])}" if s in held else ""
        tl.append(f"{'🟢' if above else '🔴'} {e(s)} {'favorable' if above else 'défavorable'} ({dist:+.1f} % vs moyenne 50 j){pos}".replace(".", ","))
        if s in prev and prev[s] != above:
            news.append(f"{'🟢' if above else '🔴'} <b>{e(s)}</b> repasse {'au-dessus de' if above else 'sous'} sa moyenne 50 jours : tendance {'favorable' if above else 'défavorable'}.")
    state["signaux"] = cur

    # 2) règles de risque
    rl = []
    if snap:
        prevr = state.get("regles", {})
        curr = {}
        for r in snap.get("etat", []):
            curr[r["id"]] = r["ok"]
            if not r["ok"]:
                rl.append(f"⚠️ {e(r['t'])}" + (f"\n    {e(r['a'])}" if r.get("a") else ""))
                if prevr.get(r["id"], True):
                    news.append(f"⚠️ Règle dépassée : <b>{e(r['t'])}</b>" + (f"\n{e(r['a'])}" if r.get("a") else ""))
        state["regles"] = curr
        ok = sum(1 for v in curr.values() if v)
        age = (now - datetime.fromisoformat(snap["t"].replace("Z", "+00:00"))).days
        head = f"<b>Règles de risque : {ok}/{len(curr)} respectées</b>"
        if age >= 3:
            head += f"\n<i>Positions du {snap['t'][:10]} : ouvre VAULT pour les actualiser.</i>"
        rl.insert(0, head)

    # 3) agent : stratégies proches de l'arrêt, ordres du comité IA
    al = []
    pp = ag.get("papier") or {}
    prof = ag.get("profil") or {}
    cap, stop = prof.get("capital_eur", 0), prof.get("arret", -0.2)
    prevs = state.get("arrets", {})
    curs = {}
    for k, v in pp.items():
        nom = (ag.get("noms") or {}).get(k, k)
        marge = v.get("valeur", 1) - (1 + stop)
        flag = "arret" if v.get("arret") else ("proche" if marge < 0.05 else "ok")
        curs[k] = flag
        if flag != "ok" and prevs.get(k, "ok") != flag:
            news.append(f"🛑 <b>{e(nom)}</b> " + ("a touché l'arrêt : tout en stablecoin." if flag == "arret" else f"est à {marge * 100:.1f} % de son arrêt.".replace(".", ",")))
    state["arrets"] = curs
    ia = pp.get("ia")
    if ia:
        od = ia.get("ordres_du_jour") or []
        sigo = json.dumps(od, sort_keys=True)
        txt = " ; ".join(f"{'acheter' if o['part'] > 0 else 'vendre'} {eur(abs(o['part']) * cap)} de {e(o['actif'])}" for o in od) or "aucun ordre"
        if od and state.get("ordres_ia") != sigo:
            news.append(f"🤖 Nouveaux ordres du comité IA (test, trading fictif) : {txt}.")
        state["ordres_ia"] = sigo
        days = sorted((ag.get("ia_log") or {}).keys())
        dec = ((ag["ia_log"][days[-1]].get("mix") or {}).get("decision") if days else "") or ""
        al.append(f"<b>Comité IA</b> (en test) : {e(txt)}" + (f"\n<i>{e(dec[:280])}</i>" if dec else ""))
    best = sorted(((v.get("valeur", 1), k) for k, v in pp.items()), reverse=True)
    if best:
        al.append("Trading fictif depuis le " + e(prof.get("debut", "?")) + " : " +
                  ", ".join(f"{e((ag.get('noms') or {}).get(k, k))} {(v - 1) * 100:+.1f} %".replace(".", ",") for v, k in best[:4]))

    today = now.strftime("%Y-%m-%d")
    digest = state.get("dernier_resume") != today
    if not news and not digest:
        return None, state
    parts = [f"<b>VAULT · {now.strftime('%d/%m')}</b>"]
    if news:
        parts.append("<b>Nouveau</b>\n" + "\n".join(news))
    if digest:
        if tl:
            parts.append("<b>Tendances (moyenne 50 jours)</b>\n" + "\n".join(tl))
        if rl:
            parts.append("\n".join(rl))
        elif snap_note:
            parts.append(f"<i>{e(snap_note)}</i>")
        if al:
            parts.append("\n".join(al))
        state["dernier_resume"] = today
    parts.append(f'<a href="{SITE}">Ouvrir VAULT</a> · outil d\'aide à la décision, pas un conseil en investissement')
    return "\n\n".join(parts), state


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--state", default=os.path.join(ROOT, "data/alerts_state.json"))
    ap.add_argument("--dry", action="store_true", help="affiche le message sans l'envoyer")
    a = ap.parse_args()
    if not ENV.get("TELEGRAM_BOT_TOKEN") and not a.dry:
        print("TELEGRAM_BOT_TOKEN absent : alertes désactivées.")
        return
    state = jload(a.state, {}) or {}
    now = datetime.now(timezone.utc)
    msg, state = build(state, now)
    if msg is None:
        print("Rien de nouveau.")
    elif a.dry:
        print(msg)
    else:
        cid = chat_id(state)
        if not cid:
            print("Aucune conversation trouvée : envoie /start à ton bot dans Telegram, puis relance.")
            return
        r = tg("sendMessage", chat_id=cid, text=msg[:4000], parse_mode="HTML", disable_web_page_preview=True)
        print("Envoyé." if r.get("ok") else f"Échec Telegram : {r}")
    json.dump(state, open(a.state, "w"), ensure_ascii=False, indent=1)


if __name__ == "__main__":
    main()

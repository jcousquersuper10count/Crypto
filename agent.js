/* VAULT — onglet Agent : profil, ordres du jour des stratégies en test, test sur l'historique, trading fictif. */
(function () {
  const $ = id => document.getElementById(id);
  let D = null, win = 'Historique complet';
  const COL = { garder: 'var(--fg3)', tendance: 'hsl(186 70% 58%)', tendance_vol: 'hsl(258 80% 72%)', elan: 'hsl(36 85% 60%)', ia: 'hsl(330 75% 66%)', ia_groq: 'hsl(14 85% 62%)', ia_gemini: 'hsl(215 85% 66%)', ia_openrouter: 'hsl(100 55% 55%)', ia_claude: 'hsl(25 70% 60%)', ia_local: 'hsl(60 60% 55%)' };
  const eur = v => v.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' €';
  const pct = (v, d = 0) => (v >= 0 ? '+' : '−') + Math.abs(v * 100).toFixed(d).replace('.', ',') + ' %';
  const cls = v => v >= 0 ? 'green' : 'red';
  const fd = s => new Date(s + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  async function load() {
    try { const r = await fetch('data/agent.json?t=' + Date.now(), { cache: 'no-store' }); if (r.ok) D = await r.json(); } catch (e) {}
    render();
  }

  function lines(series, w = 760, h = 230) {
    const all = Object.values(series).flat(); if (!all.length) return '';
    const ts = all.map(p => Date.parse(p[0])), vs = all.map(p => p[1]);
    const t0 = Math.min(...ts), t1 = Math.max(...ts), lo = Math.min(...vs, 1) * 0.97, hi = Math.max(...vs, 1) * 1.03;
    const pad = { l: 44, r: 150, t: 10, b: 22 };
    const X = t => pad.l + (t1 > t0 ? (t - t0) / (t1 - t0) : 0) * (w - pad.l - pad.r), Y = v => pad.t + (hi - v) / (hi - lo) * (h - pad.t - pad.b);
    const ticks = [lo, 1, hi].filter((v, i, a) => a.indexOf(v) === i).map(v => `<g><line x1="${pad.l}" x2="${w - pad.r}" y1="${Y(v)}" y2="${Y(v)}" class="ag-grid${v === 1 ? ' base' : ''}"/><text x="${pad.l - 6}" y="${Y(v) + 3}" text-anchor="end">${pct(v - 1)}</text></g>`).join('');
    const stop = D.profil.arret != null ? `<line x1="${pad.l}" x2="${w - pad.r}" y1="${Y(1 + D.profil.arret)}" y2="${Y(1 + D.profil.arret)}" class="ag-stop"/><text x="${w - pad.r}" y="${Y(1 + D.profil.arret) - 4}" text-anchor="end" class="ag-stopt">arrêt ${pct(D.profil.arret)}</text>` : '';
    const pl = Object.entries(series).map(([k, s]) => `<polyline fill="none" stroke="${COL[k]}" stroke-width="${k === 'garder' ? 1.4 : 2}" ${k === 'garder' ? 'stroke-dasharray="4 3"' : ''} points="${s.map(p => X(Date.parse(p[0])).toFixed(1) + ',' + Y(p[1]).toFixed(1)).join(' ')}"/>`).join('');
    // étiquettes directes en bout de courbe (évite d'aller lire la légende)
    const ends = Object.entries(series).filter(([, s]) => s.length).map(([k, s]) => ({ k, v: s[s.length - 1][1], y: Y(s[s.length - 1][1]) })).sort((a, b) => a.y - b.y);
    for (let i = 1; i < ends.length; i++) if (ends[i].y - ends[i - 1].y < 13) ends[i].y = ends[i - 1].y + 13;
    const lab = ends.map(e => `<text x="${w - pad.r + 6}" y="${(e.y + 3.5).toFixed(1)}" class="ag-end" fill="${COL[e.k]}">${esc((D.noms[e.k] || e.k).replace(/ \(.*\)/, ''))} ${pct(e.v - 1)}</text>`).join('');
    const d0 = new Date(t0), d1 = new Date(t1), fm = d => d.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' });
    return `<svg viewBox="0 0 ${w} ${h}" class="ag-svg" role="img" aria-label="Évolution des stratégies : ${ends.map(e => (D.noms[e.k] || e.k) + ' ' + pct(e.v - 1)).join(', ')}">${ticks}${stop}${pl}${lab}<text x="${pad.l}" y="${h - 4}">${fm(d0)}</text><text x="${w - pad.r}" y="${h - 4}" text-anchor="end">${fm(d1)}</text></svg>`;
  }
  const legend = keys => `<div class="ag-leg">${keys.map(k => `<span><i style="background:${COL[k]}"></i>${esc(D.noms[k] || k)}</span>`).join('')}</div>`;

  function render() {
    const root = $('agRoot'); if (!root) return;
    if (!D) { root.innerHTML = '<p class="hm-empty">Les calculs de l\'agent ne sont pas encore disponibles. Ils sont produits chaque matin par la tâche automatique.</p>'; return; }
    const P = D.profil, cap = P.capital_eur, keys = Object.keys(D.papier);
    $('agMeta').textContent = `Calculé le ${new Date(D.genere).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} · dernière clôture ${fd(D.derniere_cloture)}`;

    /* profil */
    const prof = `<div class="ag-prof">
      <div><span>Capital du test</span><b>${eur(cap)}</b><small>${esc(P.capital_note)}</small></div>
      <div><span>Arrêt</span><b>${pct(P.arret)}</b><small>soit ${eur(cap * (1 + P.arret))} : tout repasse en stablecoin</small></div>
      <div><span>Mode</span><b>Comptant</b><small>pas de levier · ${esc(P.compte)} sans frais · écart estimé ${(P.ecart_estime * 100).toFixed(1).replace('.', ',')} %</small></div>
      <div><span>Objectif ×20 en 1 mois</span><b class="red">Non retenu</b><small>il faudrait +10,5 % par jour, sans jour perdant</small></div>
    </div>`;

    /* ordres du jour */
    const cards = keys.map(k => {
      const s = D.papier[k], val = s.valeur * cap, left = (s.valeur - (1 + P.arret)) / (-P.arret);
      const ord = s.arret ? `<li class="muted">Arrêtée le ${fd(s.arret)} : tout en stablecoin.</li>` :
        s.ordres_du_jour.length ? s.ordres_du_jour.map(o => `<li><span class="mo-side ${o.part > 0 ? 'buy' : 'sell'}">${o.part > 0 ? 'Acheter' : 'Vendre'}</span><b>${eur(Math.abs(o.part) * cap)}</b> de ${esc(o.actif)}</li>`).join('') :
        '<li class="muted">Aucun ordre : la répartition est déjà la bonne.</li>';
      const tgt = Object.entries(s.cible).sort((a, b) => b[1] - a[1]).map(([a, w]) => `${esc(a)} ${Math.round(w * 100)} %`).join(' · ');
      const cash = 1 - Object.values(s.cible).reduce((x, y) => x + y, 0);
      return `<article class="ag-card" style="--c:${COL[k]}">
        <header><i></i><h4>${esc(D.noms[k] || k)}</h4><span class="ag-val">${eur(val)} <em class="${cls(s.rendement)}">${pct(s.rendement, 1)}</em></span></header>
        <ul class="ag-ord">${ord}</ul>
        <p class="ag-tgt">Cible : ${tgt || 'aucune crypto'}${cash > 0.01 ? ` · stablecoin ${Math.round(cash * 100)} %` : ''}</p>
        <div class="ag-gauge" title="Marge avant l'arrêt"><span style="width:${Math.max(0, Math.min(1, left)) * 100}%"></span></div>
        <small class="muted">Marge avant l'arrêt : ${eur(Math.max(0, val - cap * (1 + P.arret)))}</small>
      </article>`;
    }).join('');

    /* historique */
    const H = D.historique[win], hk = Object.keys(H.strategies);
    const rows = hk.map(k => { const s = H.strategies[k], n = s.sans_arret; return `<tr><td><i class="ag-dot" style="background:${COL[k]}"></i>${esc(D.noms[k])}</td><td class="${cls(s.rendement)}">${pct(s.rendement)}</td><td>${s.arret ? 'le ' + fd(s.arret) : '<span class="muted">non</span>'}</td><td class="${cls(n.rendement)}">${pct(n.rendement)}</td><td class="red">${pct(n.recul_max)}</td><td>${n.ordres}</td></tr>`; }).join('');
    const tabs = Object.keys(D.historique).map(w => `<button type="button" class="pbtn${w === win ? ' active' : ''}" onclick="agWin('${w}')">${esc(w)}</button>`).join('');
    const curves = {}; hk.forEach(k => curves[k] = H.strategies[k].courbe_sans_arret);

    /* papier */
    const pc = {}; keys.forEach(k => pc[k] = D.papier[k].courbe);
    const npts = Math.max(...keys.map(k => pc[k].length));
    const paper = npts > 1 ? lines(pc) + legend(keys) : `<p class="muted">Le suivi commence le ${fd(P.debut)}. La courbe apparaîtra après quelques clôtures.</p>`;

    /* IA */
    const days = Object.keys(D.ia_log || {}).sort(), L = days.length ? D.ia_log[days[days.length - 1]] : null;
    const one = (v, title, k) => `<div class="ag-av" style="--c:${COL[k] || 'var(--accent)'}"><h4>${esc(title)}</h4><p class="ag-tgt">${esc(v.modele || v.juge || '')}</p>
      <p><b>Cible :</b> ${Object.entries(v.cible || {}).map(([a, w]) => esc(a) + ' ' + Math.round(w * 100) + ' %').join(' · ') || 'tout en stablecoin'}</p><p>${esc(v.decision)}</p>
      ${v.analyses ? `<dl>${[['Tendance', 'tendance'], ['Risque', 'risque'], ['Pour', 'pour'], ['Contre', 'contre']].map(([l, kk]) => `<dt>${l}</dt><dd>${esc(v.analyses[kk])}</dd>`).join('')}</dl>` : ''}</div>`;
    let ia = '';
    if (L) {
      const mix = L.mix || L, avis = L.avis || {};
      ia = `<div class="ag-ia"><p class="ag-verdict"><b>Verdict du ${fd(days[days.length - 1])} :</b> ${esc(mix.decision)}${mix.accord ? `<br><span class="muted">${esc(mix.accord)}</span>` : ''}</p>
        <p class="ag-tgt">Cible retenue : ${Object.entries(mix.cible || {}).map(([a, w]) => esc(a) + ' ' + Math.round(w * 100) + ' %').join(' · ') || 'tout en stablecoin'} · juge ${esc(mix.juge || mix.modele || '')}</p>
        ${Object.keys(avis).length ? `<div class="ag-avs">${Object.entries(avis).map(([k, v]) => one(v, D.noms['ia_' + k] || k, 'ia_' + k)).join('')}</div>` : (mix.analyses ? one(mix, 'Analyse', 'ia') : '')}
        <small class="muted">${days.length} jour${days.length > 1 ? 's' : ''} de décisions enregistré${days.length > 1 ? 's' : ''}</small></div>`;
    }

    root.innerHTML = `${prof}
      <h3 class="ag-h">Ordres du jour <small>exécution prévue dans la journée, sur Neverless</small></h3>
      <div class="ag-cards">${cards}</div>
      <p class="ag-warn">Ce sont les ordres de stratégies <b>en test</b>, pas des conseils. Aucune n'a encore montré qu'elle gagne de l'argent de façon fiable : le suivi fictif ci-dessous sert à le vérifier avant d'y mettre de l'argent réel.</p>
      <section class="ag-panel"><h3>Trading fictif depuis le ${fd(P.debut)}</h3>${paper}</section>
      <section class="ag-panel"><div class="ag-ph"><h3>Test sur l'historique</h3><div class="ag-tabs">${tabs}</div></div>
        <p class="sub">Du ${fd(H.debut)} au ${fd(H.fin)}, en partant de ta répartition Neverless actuelle. Décision à la clôture, exécution le lendemain, écart achat/vente de 0,1 %. Courbes sans l'arrêt, pour voir le comportement complet.</p>
        ${lines(curves)}${legend(hk)}
        <div class="ag-tw"><table class="ag-t"><thead><tr><th>Stratégie</th><th>Avec ton arrêt</th><th>Arrêt touché</th><th>Sans arrêt</th><th>Pire recul</th><th>Ordres</th></tr></thead><tbody>${rows}</tbody></table></div>
        <p class="sub">Toutes les cryptos de l'univers (${P.univers.join(', ')}) ont fortement baissé sur la période : aucune règle ne transforme ça en gain, elles limitent seulement la casse. Les règles ont été fixées avant le test et ne sont pas ajustées après coup.</p>
      </section>
      <section class="ag-panel"><h3>Comité IA : deux modèles et un juge</h3>${D.ia_note ? `<p class="sub">${esc(D.ia_note)}</p>` : ''}${ia}
        <p class="sub">Inspiré de TradingAgents. Chaque modèle (Groq, Gemini) réunit ses analystes (tendance, risque, pour, contre) et rend sa propre décision ; un juge lit les deux avis et garde la position la plus prudente en cas de désaccord. Chaque avis et le mélange ont leur propre suivi fictif, pour juger lequel fait le mieux. Pas de test sur l'historique : les modèles connaissent déjà les prix passés.</p></section>`;
  }
  window.agWin = w => { win = w; render(); };

  const prevGo = window.go;
  window.go = function (p) { prevGo(p); if (p === 'agent') { D ? render() : load(); } };
  window.reloadAgent = load;
})();

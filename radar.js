/* VAULT — onglet Radar : indications d'achat sur les grosses cryptos disponibles sur Neverless.
   Données : data/screener.json (kronos/screener.py, chaque matin). */
(function () {
  const $ = id => document.getElementById(id);
  let D = null, filt = 'tous', sortK = 'rang', sortDir = 1, q = '', win = '2 ans';
  const NAMES = { C: 'Règle affichée (élan + filtre Bitcoin)', A: 'Élan sans filtre', B: 'Élan ajusté du risque', btc: 'Garder du Bitcoin', panier: "Panier égal de l'univers" };
  const COL = { C: 'var(--accent)', A: 'hsl(258 70% 72%)', B: 'hsl(186 65% 58%)', btc: 'hsl(36 85% 60%)', panier: 'var(--fg3)' };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const pc = (v, d = 1) => v == null ? '—' : (v >= 0 ? '+' : '−') + Math.abs(v * 100).toFixed(d).replace('.', ',') + ' %';
  const cls = v => v == null ? '' : v >= 0 ? 'green' : 'red';
  const usd = v => { if (v == null) return '—'; const e = v / (typeof eurUsd === 'number' && eurUsd > 0 ? eurUsd : 1); const d = e >= 100 ? 0 : e >= 1 ? 2 : e >= 0.01 ? 4 : 6; return e.toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d }) + ' €'; };
  const fd = s => new Date(s + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
  const held = () => { try { return new Set(Object.keys(cryptoH || {})); } catch (e) { return new Set(); } };

  function spark(a, w = 90, h = 26) {
    if (!a || a.length < 2) return '';
    const lo = Math.min(...a), hi = Math.max(...a), X = i => i / (a.length - 1) * w, Y = v => h - 2 - (hi > lo ? (v - lo) / (hi - lo) : .5) * (h - 4);
    const up = a[a.length - 1] >= a[0];
    return `<svg class="rd-spark" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true"><polyline fill="none" stroke="${up ? 'var(--green)' : 'var(--red)'}" stroke-width="1.5" stroke-linejoin="round" points="${a.map((v, i) => X(i).toFixed(1) + ',' + Y(v).toFixed(1)).join(' ')}"/></svg>`;
  }

  function lines(res, w = 760, h = 220) {
    const ks = Object.keys(res), all = ks.flatMap(k => res[k].courbe);
    const ts = all.map(p => Date.parse(p[0])), vs = all.map(p => p[1]);
    const t0 = Math.min(...ts), t1 = Math.max(...ts), lo = Math.min(...vs, 1) * .95, hi = Math.max(...vs, 1) * 1.05;
    const P = { l: 44, r: 170, t: 10, b: 22 }, X = t => P.l + (t - t0) / (t1 - t0) * (w - P.l - P.r), Y = v => P.t + (hi - v) / (hi - lo) * (h - P.t - P.b);
    const grid = [lo, 1, hi].map(v => `<line x1="${P.l}" x2="${w - P.r}" y1="${Y(v)}" y2="${Y(v)}" class="ag-grid${v === 1 ? ' base' : ''}"/><text x="${P.l - 6}" y="${Y(v) + 3}" text-anchor="end">${pc(v - 1, 0)}</text>`).join('');
    const pl = ks.map(k => `<polyline fill="none" stroke="${COL[k]}" stroke-width="${k === 'C' ? 2.4 : 1.4}" ${k === 'panier' || k === 'btc' ? 'stroke-dasharray="4 3"' : ''} points="${res[k].courbe.map(p => X(Date.parse(p[0])).toFixed(1) + ',' + Y(p[1]).toFixed(1)).join(' ')}"/>`).join('');
    const ends = ks.map(k => { const c = res[k].courbe; return { k, v: c[c.length - 1][1], y: Y(c[c.length - 1][1]) }; }).sort((a, b) => a.y - b.y);
    for (let i = 1; i < ends.length; i++) if (ends[i].y - ends[i - 1].y < 13) ends[i].y = ends[i - 1].y + 13;
    const lab = ends.map(e => `<text x="${w - P.r + 6}" y="${(e.y + 3.5).toFixed(1)}" class="ag-end" fill="${COL[e.k]}">${esc(NAMES[e.k].replace(/ \(.*\)/, ''))} ${pc(e.v - 1, 0)}</text>`).join('');
    const fm = t => new Date(t).toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' });
    return `<svg viewBox="0 0 ${w} ${h}" class="ag-svg" role="img" aria-label="Test sur l'historique : ${ends.map(e => NAMES[e.k] + ' ' + pc(e.v - 1, 0)).join(', ')}">${grid}${pl}${lab}<text x="${P.l}" y="${h - 4}">${fm(t0)}</text><text x="${w - P.r}" y="${h - 4}" text-anchor="end">${fm(t1)}</text></svg>`;
  }

  function card(s, c, i) {
    return `<article class="rd-card"><header><span class="rd-n">${i + 1}</span>${c.img ? `<img src="${esc(c.img)}" alt="" loading="lazy" onerror="this.remove()">` : ''}<div><b>${esc(s)}</b><small>${esc(c.nom)} · n° ${c.rang}</small></div>${spark(c.spark)}</header>
      <dl><div><dt>30 jours</dt><dd class="${cls(c.var30)}">${pc(c.var30)}</dd></div><div><dt>vs moyenne 50 j</dt><dd class="${cls(c.ecart50)}">${pc(c.ecart50)}</dd></div>
      <div><dt>Volatilité</dt><dd>${c.vol30 != null ? Math.round(c.vol30 * 100) + ' %/an' : '—'}</dd></div><div><dt>Écart Neverless</dt><dd>${c.ecart_nl != null ? (c.ecart_nl * 100).toFixed(2).replace('.', ',') + ' %' : '—'}</dd></div></dl>
      <p class="rd-w">20 % de l'enveloppe · prix ${usd(c.prix)}</p></article>`;
  }

  function render() {
    const root = $('rdRoot'); if (!root) return;
    if (!D) { root.innerHTML = '<p class="hm-empty">Le radar n\'est pas encore calculé. Il est produit chaque matin par la tâche automatique.</p>'; return; }
    $('rdMeta').textContent = `${D.univers.avec_historique} cryptos du top ${D.univers.top} disponibles sur Neverless · clôture du ${fd(D.derniere_cloture)}`;
    const L = D.listes.C || [], C = D.cryptos, H = held();
    const hero = L.length
      ? `<div class="rd-hero"><h3>${L.length} crypto${L.length > 1 ? 's' : ''} dans la liste d'achat</h3><p>Les plus fortes sur 30 jours parmi celles en tendance favorable, avec un Bitcoin lui-même en tendance favorable. Liste revue chaque lundi.</p></div><div class="rd-cards">${L.map((s, i) => card(s, C[s], i)).join('')}</div>`
      : `<div class="rd-hero empty"><h3>Pas d'indication d'achat aujourd'hui</h3><p>Le Bitcoin est sous sa moyenne 50 jours (${pc(C.BTC && C.BTC.ecart50)}). Dans ce cas, la règle reste en stablecoin : sur les tests, c'est ce filtre qui a évité l'essentiel des baisses.</p>
         ${(D.listes.A || []).length ? `<p class="muted">Sans ce filtre, les 5 plus fortes du moment seraient : ${D.listes.A.map(s => `<b>${esc(s)}</b> ${pc(C[s].var30, 0)}`).join(', ')}. La variante sans filtre a fait moins bien sur 2 ans.</p>` : ''}</div>`;

    const T = D.tests[win], R = T.res;
    const order = ['C', 'A', 'B', 'btc', 'panier'];
    const trows = order.map(k => `<tr${k === 'C' ? ' class="rd-main"' : ''}><td><i class="ag-dot" style="background:${COL[k]}"></i>${esc(NAMES[k])}</td>${Object.keys(D.tests).map(w => `<td class="${cls(D.tests[w].res[k].rendement)}">${pc(D.tests[w].res[k].rendement, 0)}</td>`).join('')}<td class="red">${pc(R[k].recul_max, 0)}</td><td>${R[k].ordres}</td></tr>`).join('');
    const tabs = Object.keys(D.tests).map(w => `<button type="button" class="pbtn${w === win ? ' active' : ''}" onclick="rdWin('${w}')">${esc(w)}</button>`).join('');

    let rows = Object.entries(C);
    if (filt === 'liste') rows = rows.filter(([s, c]) => c.etat === 'liste' || (D.listes.A || []).includes(s));
    if (filt === 'tendance') rows = rows.filter(([, c]) => c.ecart50 > 0);
    if (filt === 'defav') rows = rows.filter(([, c]) => !(c.ecart50 > 0));
    if (filt === 'miens') rows = rows.filter(([s]) => H.has(s));
    if (q) rows = rows.filter(([s, c]) => (s + ' ' + c.nom).toLowerCase().includes(q));
    rows.sort((a, b) => { const x = a[1][sortK], y = b[1][sortK]; return ((x == null) - (y == null)) || (x < y ? -1 : x > y ? 1 : 0) * sortDir; });
    const th = (k, l) => `<th class="${sortK === k ? 'on' : ''}" onclick="rdSort('${k}')">${l}${sortK === k ? (sortDir > 0 ? ' ↑' : ' ↓') : ''}</th>`;
    const st = c => c.etat === 'liste' ? '<span class="rd-st l">Liste d\'achat</span>' : c.etat === 'candidate' ? `<span class="rd-st c">Favorable${c.rang_elan ? ' · ' + c.rang_elan + 'e' : ''}</span>` : '<span class="rd-st d">Défavorable</span>';
    const tr = rows.map(([s, c]) => `<tr><td><div class="rd-a">${c.img ? `<img src="${esc(c.img)}" alt="" loading="lazy" onerror="this.remove()">` : ''}<div><b>${esc(s)}</b>${H.has(s) ? '<span class="rd-mine">détenue</span>' : ''}<small>${esc(c.nom)}</small></div></div></td>
      <td>${c.rang}</td><td>${usd(c.prix)}</td><td class="${cls(c.var7)}">${pc(c.var7)}</td><td class="${cls(c.var30)}">${pc(c.var30)}</td><td class="${cls(c.var90)}">${pc(c.var90)}</td>
      <td class="${cls(c.ecart50)}">${pc(c.ecart50)}</td><td>${c.vol30 != null ? Math.round(c.vol30 * 100) + ' %' : '—'}</td><td class="red">${pc(c.recul1an, 0)}</td>
      <td>${c.ecart_nl != null ? (c.ecart_nl * 100).toFixed(2).replace('.', ',') + ' %' : '—'}</td><td>${spark(c.spark, 70, 22)}</td><td>${st(c)}</td></tr>`).join('');
    const chips = [['tous', 'Toutes'], ['liste', 'Plus fortes du moment'], ['tendance', 'Tendance favorable'], ['defav', 'Défavorables'], ['miens', 'Que je détiens']]
      .map(([k, l]) => `<button type="button" class="pbtn${filt === k ? ' active' : ''}" onclick="rdFilt('${k}')">${l}</button>`).join('');
    const nfav = Object.values(C).filter(c => c.ecart50 > 0).length;

    root.innerHTML = `${hero}
      <p class="ag-warn">Indications d'une règle <b>en test</b>, pas un conseil en investissement. La règle a été fixée avant le test et n'est pas réglée après coup. Sur 2 ans elle a fait mieux que le Bitcoin, mais avec des reculs jusqu'à ${pc(D.tests['2 ans'].res.C.recul_max, 0)} : bien au-delà de ton arrêt à −20 %.</p>
      <section class="ag-panel"><div class="ag-ph"><h3>Test sur l'historique</h3><div class="ag-tabs">${tabs}</div></div>
        <p class="sub">Du ${fd(T.debut)} au ${fd(T.fin)}. Décision le lundi à la clôture, exécution le lendemain, moitié de l'écart Neverless payée à chaque ordre. L'univers est celui d'aujourd'hui : les cryptos disparues entre-temps n'y sont pas, ce qui flatte les résultats (surtout le panier).</p>
        ${lines(R)}
        <div class="ag-tw"><table class="ag-t"><thead><tr><th>Stratégie</th>${Object.keys(D.tests).map(w => `<th>${esc(w)}</th>`).join('')}<th>Pire recul (${esc(win)})</th><th>Ordres (${esc(win)})</th></tr></thead><tbody>${trows}</tbody></table></div>
      </section>
      <section class="ag-panel"><div class="ag-ph"><h3>Toutes les cryptos du radar</h3><input type="search" class="rd-q" placeholder="Chercher (BTC, Solana…)" value="${esc(q)}" oninput="rdQ(this.value)" aria-label="Chercher une crypto"></div>
        <p class="sub">${nfav} sur ${Object.keys(C).length} sont au-dessus de leur moyenne 50 jours. Clique sur un titre de colonne pour trier.</p>
        <div class="ag-tabs rd-chips">${chips}</div>
        <div class="ag-tw"><table class="ag-t rd-t"><thead><tr>${th('nom', 'Crypto')}${th('rang', 'Rang')}${th('prix', 'Prix')}${th('var7', '7 j')}${th('var30', '30 j')}${th('var90', '90 j')}${th('ecart50', 'vs moy. 50 j')}${th('vol30', 'Volatilité')}${th('recul1an', 'Recul 1 an')}${th('ecart_nl', 'Écart')}<th>60 j</th>${th('etat', 'État')}</tr></thead><tbody>${tr || '<tr><td colspan="12" class="muted">Aucune crypto ne correspond.</td></tr>'}</tbody></table></div>
      </section>`;
  }

  async function load() {
    try { const r = await fetch('data/screener.json?t=' + Date.now(), { cache: 'no-store' }); if (r.ok) D = await r.json(); } catch (e) {}
    render();
  }
  window.rdWin = w => { win = w; render(); };
  window.rdFilt = f => { filt = f; render(); };
  window.rdSort = k => { if (sortK === k) sortDir = -sortDir; else { sortK = k; sortDir = ['rang', 'nom', 'ecart_nl', 'vol30', 'etat'].includes(k) ? 1 : -1; } render(); };
  let qt; window.rdQ = v => { clearTimeout(qt); qt = setTimeout(() => { q = v.trim().toLowerCase(); render(); const i = document.querySelector('.rd-q'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }, 200); };
  window.reloadRadar = load;
  const prevGo = window.go;
  window.go = function (p) { prevGo(p); if (p === 'radar') { D ? render() : load(); } };
})();

/* VAULT — règles de risque du portefeuille.
   L'utilisateur fixe ses limites ; VAULT dit si elles sont respectées et propose le rééquilibrage en euros.
   La limite par crypto est réduite pour les cryptos très volatiles (taille ajustée au risque).
   Avec la clé d'accès, un instantané (positions, règles, état) est envoyé au script Google pour que la
   tâche du matin puisse envoyer les alertes Telegram. */
(function () {
  const $ = id => document.getElementById(id);
  const LS = 'vault_rules', DEF = { cryptoMax: 15, lineMax: 5, volRef: 60, etfMax: 30, lossMax: 40, importDays: 45 };
  const STABLE = new Set(['USDC', 'USDT', 'EURC', 'DAI', 'USDE', 'PYUSD']);
  let VOL = null;
  const rules = () => { try { return Object.assign({}, DEF, JSON.parse(localStorage.getItem(LS) || '{}')); } catch (e) { return Object.assign({}, DEF); } };
  const eurOf = usd => usd / (typeof eurUsd === 'number' && eurUsd > 0 ? eurUsd : 1);
  const fe = v => Math.round(v).toLocaleString('fr-FR') + ' €';
  const fp = (v, d = 0) => v.toFixed(d).replace('.', ',') + ' %';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  async function loadVol() {
    if (VOL) return VOL;
    VOL = {};
    try {
      const d = await (await fetch('data/signals.json?t=' + Date.now(), { cache: 'no-store' })).json();
      Object.entries(d.coins || {}).forEach(([s, c]) => {
        const h = (c.history || []).slice(-31).map(p => p[1]);
        if (h.length < 20) return;
        const r = h.slice(1).map((v, i) => Math.log(v / h[i])), m = r.reduce((a, b) => a + b, 0) / r.length;
        VOL[s] = Math.sqrt(r.reduce((a, b) => a + (b - m) ** 2, 0) / (r.length - 1)) * Math.sqrt(365) * 100;
      });
    } catch (e) {}
    return VOL;
  }

  function positions() {
    let items = [];
    try { items = allItems(); } catch (e) { return null; }
    if (!items.length) return null;
    let pru = {}, ep = {};
    try { pru = computePRU(); } catch (e) {}
    try { ep = etfPRU(); } catch (e) {}
    return items.filter(i => i.usd > 0).map(i => {
      let pnl = null;
      if (i.type === 'crypto') { const d = pru[i.sym]; if (d && d.totalQty > 0 && prices[i.sym] && prices[i.sym].p) pnl = (prices[i.sym].p / (d.totalCost / d.totalQty) - 1) * 100; }
      else if (ep[i.sym] && i.priceEUR) pnl = (i.priceEUR / ep[i.sym] - 1) * 100;
      return { sym: i.sym, type: i.sym === 'Espèces' ? 'cash' : STABLE.has(i.sym) ? 'cash' : i.type, eur: eurOf(i.usd), pnl, name: i.name || i.sym };
    });
  }

  function lastDates() {
    const out = {};
    [['Neverless', typeof sbTx !== 'undefined' ? sbTx : []], ['Revolut Crypto', typeof rcTx !== 'undefined' ? rcTx : []], ['Revolut Robo', typeof rrTx !== 'undefined' ? rrTx : []]].forEach(([n, tx]) => {
      let m = 0; (tx || []).forEach(t => { const v = Date.parse(t.Date); if (v > m && v < Date.now() + 864e5) m = v; });
      out[n] = m ? new Date(m).toISOString().slice(0, 10) : null;
    });
    return out;
  }

  /* évaluation : une ligne par règle, avec état et action proposée */
  function evaluate(P, R, vol) {
    const tot = P.reduce((a, p) => a + p.eur, 0), out = [];
    const cr = P.filter(p => p.type === 'crypto'), crTot = cr.reduce((a, p) => a + p.eur, 0), crPct = crTot / tot * 100;
    out.push({ id: 'crypto', ok: crPct <= R.cryptoMax, t: `Part crypto : ${fp(crPct, 1)} (limite ${R.cryptoMax} %)`,
      a: crPct > R.cryptoMax ? `Réduire les cryptos de ${fe(crTot - tot * R.cryptoMax / 100)}` : `Marge : ${fe(tot * R.cryptoMax / 100 - crTot)}` });
    const over = [];
    cr.forEach(p => {
      const v = vol[p.sym], lim = R.lineMax * (v ? Math.min(1, R.volRef / v) : 1), pct = p.eur / tot * 100;
      p.lim = lim; p.vol = v;
      if (pct > lim + 0.05) over.push(`${p.sym} ${fp(pct, 1)} > ${fp(lim, 1)} : vendre ${fe(p.eur - tot * lim / 100)}`);
    });
    out.push({ id: 'line', ok: !over.length, t: over.length ? `${over.length} crypto${over.length > 1 ? 's' : ''} au-dessus de sa limite` : `Chaque crypto sous sa limite (${R.lineMax} % au plus, moins si très volatile)`, a: over.join(' · ') });
    const big = P.filter(p => p.type === 'etf' && p.eur / tot * 100 > R.etfMax);
    out.push({ id: 'etf', ok: !big.length, t: big.length ? `${big.map(p => p.sym).join(', ')} au-dessus de ${R.etfMax} %` : `Aucun ETF au-dessus de ${R.etfMax} %`, a: big.map(p => `${p.sym} : alléger de ${fe(p.eur - tot * R.etfMax / 100)}`).join(' · ') });
    const loss = cr.filter(p => p.pnl != null && p.pnl <= -R.lossMax && p.eur >= 20).sort((a, b) => a.pnl - b.pnl);
    out.push({ id: 'loss', ok: !loss.length, t: loss.length ? `${loss.length} crypto${loss.length > 1 ? 's' : ''} à plus de −${R.lossMax} % de ton prix d'achat` : `Aucune crypto à plus de −${R.lossMax} % de ton prix d'achat`,
      a: loss.length ? loss.map(p => `${p.sym} ${fp(p.pnl)}`).join(' · ') + ' : décider de garder ou couper, plutôt que laisser faire' : '' });
    const ld = lastDates(), late = Object.entries(ld).filter(([, d]) => d && (Date.now() - Date.parse(d)) / 864e5 > R.importDays);
    out.push({ id: 'import', ok: !late.length, t: late.length ? `Import en retard : ${late.map(([n]) => n).join(', ')}` : `Imports à jour (moins de ${R.importDays} jours)`, a: late.map(([n, d]) => `${n} : dernière opération le ${new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}`).join(' · ') });
    return { tot, crPct, rows: out, cr, ld };
  }

  async function render() {
    const box = $('rkBox'); if (!box) return;
    const P = positions();
    if (!P) { box.innerHTML = ''; return; }
    const R = rules(), vol = await loadVol(), E = evaluate(P, R, vol);
    const ko = E.rows.filter(r => !r.ok).length;
    box.innerHTML = `<div class="rk">
      <div class="rk-head"><div class="rk-score ${ko ? 'ko' : 'ok'}"><b>${E.rows.length - ko}/${E.rows.length}</b><span>règles respectées</span></div>
        <button type="button" class="hm-link" onclick="openRules()">Modifier mes règles</button></div>
      <ul class="rk-list">${E.rows.map(r => `<li class="${r.ok ? 'ok' : 'ko'}"><i aria-hidden="true">${r.ok ? '✓' : '!'}</i><div><b>${esc(r.t)}</b>${r.a ? `<small>${esc(r.a)}</small>` : ''}</div></li>`).join('')}</ul></div>`;
    snapshot(P, R, E);
  }

  /* instantané pour la tâche du matin (alertes), au plus toutes les 30 minutes */
  async function snapshot(P, R, E) {
    if (window.dataMode !== 'key' || typeof gasPost !== 'function') return;
    if (!window.nlState) { setTimeout(() => render().catch(() => {}), 3000); return; } // attendre les positions Neverless
    let last = 0; try { last = +localStorage.getItem('vault_snap_t') || 0; } catch (e) {}
    if (Date.now() - last < 30 * 6e4) return;
    if (window.pricesStale && Date.now() - new Date(window.pricesStale).getTime() > 12 * 36e5) return; // prix trop anciens
    const snap = { t: new Date().toISOString(), regles: R, total_eur: Math.round(E.tot),
      positions: P.filter(p => p.eur >= 5).map(p => ({ s: p.sym, ty: p.type, e: Math.round(p.eur * 100) / 100, g: p.pnl == null ? null : Math.round(p.pnl * 10) / 10 })),
      comptes: E.ld, etat: E.rows.map(r => ({ id: r.id, ok: r.ok, t: r.t, a: r.a })) };
    const N = window.nlState;
    if (N && N.env > 0) {
      const k = usd => Math.round(usd / (typeof eurUsd === 'number' && eurUsd > 0 ? eurUsd : 1));
      snap.nl = { env: k(N.env), stable: k(N.stable), garder: k(N.keep || 0), pos: (N.pos || []).map(x => ({ s: x.s, e: k(x.v) })), ordres: (N.orders || []).map(o => ({ k: o.k, s: o.s, e: k(o.v), w: o.why })) };
    }
    try { const j = await gasPost({ action: 'snapshot_save', snap }); if (j && j.status === 'ok') localStorage.setItem('vault_snap_t', String(Date.now())); } catch (e) {}
  }

  /* fenêtre de modification des règles */
  window.openRules = function () {
    let d = $('rkDlg');
    const R = rules();
    if (!d) { d = document.createElement('dialog'); d.id = 'rkDlg'; d.className = 'mo-dlg'; document.body.appendChild(d); }
    const f = (k, l, h, step = 1) => `<label>${l}<input type="number" min="0" step="${step}" name="${k}" value="${R[k]}" required><small>${h}</small></label>`;
    d.innerHTML = `<form method="dialog" onsubmit="return saveRules(event)" style="padding:1.3rem 1.4rem 1.2rem;display:grid;gap:.9rem">
      <div class="mo-head"><h3>Mes règles de risque</h3><button type="button" class="mo-x" onclick="this.closest('dialog').close()" aria-label="Fermer">✕</button></div>
      <p class="muted mo-sub">Tu fixes les limites, VAULT vérifie et t'alerte sur Telegram quand l'une est dépassée.</p>
      <div class="mo-grid rk-grid">
        ${f('cryptoMax', 'Part crypto maximale (%)', 'du portefeuille total')}
        ${f('lineMax', 'Poids max par crypto (%)', 'pour une crypto peu volatile')}
        ${f('volRef', 'Volatilité de référence (%/an)', 'au-delà, la limite par crypto baisse d\'autant')}
        ${f('etfMax', 'Poids max par ETF (%)', 'évite de dépendre d\'un seul fonds')}
        ${f('lossMax', 'Perte max par crypto (%)', 'par rapport à ton prix d\'achat moyen')}
        ${f('importDays', 'Import en retard après (jours)', 'sans nouvelle opération dans un compte')}
      </div>
      <div class="mo-actions"><button type="button" class="hm-link" onclick="resetRules()">Valeurs par défaut</button><button type="submit" class="uz-btn">Enregistrer</button></div></form>`;
    d.showModal();
  };
  window.saveRules = function (ev) {
    ev.preventDefault();
    const fd = new FormData(ev.target), R = {};
    Object.keys(DEF).forEach(k => { const v = parseFloat(String(fd.get(k)).replace(',', '.')); R[k] = isFinite(v) && v >= 0 ? v : DEF[k]; });
    try { localStorage.setItem(LS, JSON.stringify(R)); localStorage.removeItem('vault_snap_t'); } catch (e) {}
    $('rkDlg').close(); render(); return false;
  };
  window.resetRules = function () { try { localStorage.removeItem(LS); localStorage.removeItem('vault_snap_t'); } catch (e) {} $('rkDlg').close(); render(); };
  window.renderRisk = render;

  const prevGo = window.go;
  window.go = function (p) { prevGo(p); if (p === 'home') setTimeout(render, 50); };
  // l'accueil se redessine à chaque rafraîchissement des prix : on suit
  const prevSum = window.renderSum;
  if (prevSum) window.renderSum = function () { prevSum.apply(this, arguments); render().catch(() => {}); };
})();

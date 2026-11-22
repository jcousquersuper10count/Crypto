/* VAULT — ordres du jour sur le compte Neverless (le seul compte géré activement).
   Règle appliquée : celle du Radar (règle C, fixée avant le test) — jusqu'à 5 cryptos de la liste d'achat,
   20 % de l'enveloppe Neverless chacune ; tout le reste en stablecoin ; rien à acheter si le Bitcoin est
   sous sa moyenne 50 jours. Les cryptos détenues hors de la liste sont à vendre.
   Les comptes Revolut sont conservés quoi qu'il arrive : affichés à titre indicatif. */
(function () {
  const $ = id => document.getElementById(id);
  const STABLE = new Set(['USDC', 'USDT', 'EURC', 'DAI', 'USDE', 'PYUSD', 'FDUSD', 'TUSD']);
  const SLOT = 0.2, MIN_ORDER_EUR = 10;
  let RD = null, tried = false, AG = null, agTried = false;
  async function loadAgent() {
    if (AG || agTried) return AG;
    agTried = true;
    try { const r = await fetch('data/agent.json?t=' + Date.now(), { cache: 'no-store' }); if (r.ok) AG = await r.json(); } catch (e) {}
    return AG;
  }
  /* avis du comité IA, traduit en ordres sur le compte réel */
  function iaBlock(S) {
    if (!AG || !AG.ia_log) return '';
    const days = Object.keys(AG.ia_log).sort(); if (!days.length) return '';
    const E = AG.ia_log[days[days.length - 1]], M = E.mix || E, avis = E.avis || {};
    const cible = M.cible || {}, thr = Math.max(MIN_ORDER_EUR * usdPerEur(), S.env * 0.03), ord = [];
    S.pos.forEach(x => { const t = (cible[x.s] || 0) * S.env; if (x.v - t > thr) ord.push({ k: t > 0 ? 'trim' : 'sell', s: x.s, v: x.v - t }); });
    Object.entries(cible).forEach(([s, w]) => { const cur = (S.pos.find(x => x.s === s) || {}).v || 0, t = w * S.env; if (t - cur > thr) ord.push({ k: 'buy', s, v: t - cur }); });
    const lab = { sell: 'Vendre tout', trim: 'Alléger', buy: 'Acheter' };
    const stab = Math.max(0, 1 - Object.values(cible).reduce((a, b) => a + b, 0)) * S.env;
    const prop = ord.length ? ord.map(o => `<div class="od-o ${o.k}"><span class="od-b">${lab[o.k].split(' ')[0]}</span><span class="od-m"><b>${o.k === 'sell' ? 'Tout ' : ''}${esc(o.s)}</b>${costTag(o)}</span><span class="od-v">${fv(o.v)}</span></div>`).join('') + costSum(ord)
      + `<div class="od-o keep"><span class="od-b">Garder</span><span class="od-m"><b>Stablecoin</b></span><span class="od-v">${fv(stab)}</span></div>`
      : `<div class="od-o keep"><span class="od-b">Garder</span><span class="od-m"><b>${Object.keys(cible).length ? 'Positions actuelles' : 'Tout en stablecoin'}</b><small>aucun ordre à passer selon le comité</small></span><span class="od-v">${fv(S.env)}</span></div>`;
    const names = { groq: 'Groq', gemini: 'Gemini', local: 'Modèle local', openrouter: 'OpenRouter', claude: 'Claude' };
    const one = Object.entries(avis).map(([k, v]) => `<li><b>${names[k] || k}</b> : ${esc(v.decision)}</li>`).join('');
    const when = new Date(days[days.length - 1] + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
    return `<div class="od od-ia"><div class="od-iah"><div><b>Avis du comité IA</b><small>clôture du ${when} · ${E.reel ? 'sur ton compte Neverless réel' : 'sur le portefeuille fictif de test'}</small></div><span class="od-tag">en test</span></div>
      <p class="od-ver">${esc(M.decision)}${M.accord ? `<span>${esc(M.accord)}</span>` : ''}</p>
      <div class="od-list">${prop}</div>
      ${one ? `<ul class="od-avis">${one}</ul>` : ''}
      <p class="od-note">Analyse de Groq et Gemini sur les indicateurs de prix, tranchée par un juge prudent. Ce n'est pas un conseil en investissement : son suivi fictif dans l'onglet Agent dira s'il mérite ta confiance. <button type="button" class="hm-link" onclick="go('agent')">Voir le détail</button></p></div>`;
  }
  /* coût estimé d'un ordre sur Neverless : la moitié de l'écart achat/vente affiché (prix payé vs prix moyen).
     Sur les relevés, le coût réel mesuré tombe au même niveau (0,15 % en moyenne). */
  const ECART_DEF = 0.0039, ECART_HAUT = 0.008;
  const ecartOf = s => (STABLE.has(s) ? 0.0004 : (RD && RD.cryptos && RD.cryptos[s] && RD.cryptos[s].ecart_nl) || ECART_DEF);
  const costOf = (s, v) => v * ecartOf(s) / 2;
  const fc = u => { const v = typeof cv === 'function' ? cv(u) : u, n = v.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); return (typeof cur === 'function' && cur() !== 'eur') ? '$' + n : n + '\u00a0€'; };
  const pct2 = x => (x * 100).toLocaleString('fr-FR', { maximumFractionDigits: 2 }) + ' %';
  function costTag(o) {
    const e = ecartOf(o.s), c = costOf(o.s, o.v);
    const warn = o.k === 'buy' && e > ECART_HAUT;
    return `<small class="od-cost${warn ? ' warn' : ''}">coût ≈ ${fc(c)}${warn ? ` · écart élevé : un aller-retour coûte ${pct2(e)}, à ne faire que pour une tendance nette` : ''}</small>`;
  }
  function costSum(list) {
    if (!list.length) return '';
    const c = list.reduce((a, o) => a + costOf(o.s, o.v), 0), v = list.reduce((a, o) => a + o.v, 0);
    return `<p class="od-costsum">Coût estimé de ces ordres : <b>${fc(c)}</b> (${pct2(v > 0 ? c / v : 0)} des montants échangés). Un achat ne rapporte que s'il gagne plus que l'aller-retour : environ ${pct2(ecartOf('BTC'))} sur le Bitcoin, plus sur les petites cryptos.</p>`;
  }
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const pc = v => v == null ? '—' : (v >= 0 ? '+' : '−') + Math.abs(v * 100).toFixed(1).replace('.', ',') + ' %';
  const usdPerEur = () => (typeof eurUsd === 'number' && eurUsd > 0 ? eurUsd : 1);

  async function loadRadar() {
    if (RD || tried) return RD;
    tried = true;
    try { const r = await fetch('data/screener.json?t=' + Date.now(), { cache: 'no-store' }); if (r.ok) RD = await r.json(); } catch (e) {}
    return RD;
  }
  function priceUsd(s) {
    if (s === 'EURC') return usdPerEur();
    if (STABLE.has(s)) return 1;
    if (typeof prices === 'object' && prices[s] && prices[s].p) return prices[s].p;
    if (RD && RD.cryptos[s]) return RD.cryptos[s].prix;
    return null;
  }

  /* état Neverless : positions, enveloppe, cible, ordres */
  function compute() {
    if (typeof compSB !== 'function' || typeof sbTx === 'undefined') return null;
    const q = compSB(sbTx), pos = [];
    let stable = 0, unknown = [];
    Object.entries(q).forEach(([s, n]) => {
      if (!(n > 1e-9)) return;
      const p = priceUsd(s);
      if (p == null) { unknown.push(s); return; }
      const v = n * p;
      if (v < 1) return;
      if (STABLE.has(s)) stable += v; else pos.push({ s, n, v });
    });
    const env = stable + pos.reduce((a, x) => a + x.v, 0);
    if (!(env > 0)) return { env: 0, stable: 0, pos: [], orders: [], list: [], unknown };
    const list = RD ? (RD.listes.C || []) : null;
    const orders = [];
    if (list) {
      const tgt = {}; list.forEach(s => { tgt[s] = env * SLOT; });
      const thr = Math.max(MIN_ORDER_EUR * usdPerEur(), env * 0.03);
      pos.forEach(x => {
        if (!(x.s in tgt)) orders.push({ k: 'sell', s: x.s, v: x.v, why: whyOut(x.s) });
        else if (x.v - tgt[x.s] > thr) orders.push({ k: 'trim', s: x.s, v: x.v - tgt[x.s], why: 'au-dessus de sa part de 20 %' });
      });
      list.forEach((s, i) => {
        const cur = (pos.find(x => x.s === s) || {}).v || 0;
        if (tgt[s] - cur > thr) orders.push({ k: 'buy', s, v: tgt[s] - cur, why: `n° ${i + 1} de la liste d'achat` + (RD.cryptos[s] ? `, ${pc(RD.cryptos[s].var30)} sur 30 jours` : '') });
      });
    }
    const after = stable + orders.filter(o => o.k !== 'buy').reduce((a, o) => a + o.v, 0) - orders.filter(o => o.k === 'buy').reduce((a, o) => a + o.v, 0);
    return { env, stable, pos, orders, list, keep: Math.max(0, after), unknown };
  }
  function whyOut(s) {
    const c = RD && RD.cryptos[s];
    if (RD && !RD.btc_tendance) return 'filtre Bitcoin actif : la règle est tout en stablecoin';
    if (!c) return 'hors de l\'univers du radar';
    return c.ecart50 > 0 ? `tendance favorable mais hors des 5 plus fortes (${c.rang_elan ? c.rang_elan + 'e' : '—'})` : `sous sa moyenne 50 jours (${pc(c.ecart50)})`;
  }

  function revolutBlock() {
    if (typeof compRC !== 'function' || typeof rcTx === 'undefined') return '';
    const q = compRC(rcTx), rows = [];
    Object.entries(q).forEach(([s, n]) => {
      const p = priceUsd(s); if (!(n > 0) || p == null || STABLE.has(s)) return;
      const v = n * p; if (v < 5) return;
      const c = RD && RD.cryptos[s];
      rows.push({ s, v, t: c ? c.ecart50 : null });
    });
    if (!rows.length) return '';
    rows.sort((a, b) => b.v - a.v);
    return `<div class="od-rev"><h4>Revolut Crypto · conservé, à titre indicatif</h4>${rows.map(r => `<div class="od-rv"><b>${esc(r.s)}</b><span>${fv(r.v)}</span><small class="${r.t == null ? 'muted' : r.t >= 0 ? 'green' : 'red'}">${r.t == null ? 'pas de tendance' : (r.t >= 0 ? 'tendance favorable ' : 'tendance défavorable ') + pc(r.t)}</small></div>`).join('')}</div>`;
  }

  function render() {
    if (!$('hmActions') || !$('p-home')) return;
    const S = window.nlState = compute();
    if (!S) return;
    const L = S.list;
    const label = { sell: 'Vendre', trim: 'Alléger', buy: 'Acheter' };
    let body;
    if (!RD) body = '<div class="hm-empty">Chargement du radar…</div>';
    else {
      const rows = S.orders.map(o => `<div class="od-o ${o.k}"><span class="od-b">${label[o.k]}</span><span class="od-m"><b>${o.k === 'sell' ? 'Tout ' : ''}${esc(o.s)}</b><small>${esc(o.why)}</small>${costTag(o)}</span><span class="od-v">${fv(o.v)}</span></div>`).join('');
      const keep = `<div class="od-o keep"><span class="od-b">Garder</span><span class="od-m"><b>Stablecoin</b><small>${L.length ? 'le reste de l\'enveloppe' : (RD.btc_tendance ? 'aucune crypto ne remplit la règle' : 'Bitcoin sous sa moyenne 50 jours : la règle n\'achète rien')}</small></span><span class="od-v">${fv(S.keep)}</span></div>`;
      body = rows + (S.keep >= 1 ? keep : '') + costSum(S.orders);
    }
    const unk = S.unknown.length ? `<details class="od-note od-unk"><summary>${S.unknown.length} petite${S.unknown.length > 1 ? 's' : ''} position${S.unknown.length > 1 ? 's' : ''} sans prix connu, non comptée${S.unknown.length > 1 ? 's' : ''}</summary>${S.unknown.map(esc).join(', ')}</details>` : '';
    $('hmActions').innerHTML = `<div class="od">
      <div class="od-h"><div><span class="od-k">Enveloppe Neverless</span><b>${fv(S.env)}</b></div><div><span class="od-k">Dont stablecoin</span><b>${fv(S.stable)}</b></div><div><span class="od-k">Liste d'achat du radar</span><b>${L ? (L.length ? L.map(esc).join(', ') : 'vide') : '…'}</b></div></div>
      <div class="od-list">${body}</div>${unk}
      <p class="od-note">Règle du radar (en test) : jusqu'à 5 cryptos à 20 % de l'enveloppe, revue chaque lundi ; rien si le Bitcoin est sous sa moyenne 50 jours. Après un achat ou une vente, note-le avec « ＋ Opération » pour que les ordres se mettent à jour.</p>
    </div>${iaBlock(S)}${revolutBlock()}`;
    // titre de l'accueil
    if (RD) {
      const n = S.orders.length;
      $('hmTitle').textContent = n ? `${n} ordre${n > 1 ? 's' : ''} à passer sur Neverless` : `Garder ${fv(S.keep)} en stablecoin`;
      $('hmSub').textContent = n
        ? S.orders.map(o => `${label[o.k].toLowerCase()} ${o.k === 'sell' ? 'tout ' : ''}${o.s} (${fv(o.v)})`).join(', ').replace(/^./, c => c.toUpperCase()) + '. Le reste de l\'enveloppe reste en stablecoin.'
        : (L && L.length ? 'Tes positions Neverless correspondent déjà à la liste d\'achat du radar.' : `Aucune indication d'achat : ${RD.btc_tendance ? 'aucune crypto ne remplit la règle' : 'le Bitcoin est sous sa moyenne 50 jours, la règle reste en stablecoin'}. Tes Bitcoins Revolut sont conservés.`);
    }
  }

  const prevSum = window.renderSum;
  window.renderSum = function () { prevSum.apply(this, arguments); Promise.all([loadRadar(), loadAgent()]).then(() => { try { render(); } catch (e) { console.error(e); } }); };
  const prevGo = window.go;
  window.go = function (p) { prevGo(p); if (p === 'home') Promise.all([loadRadar(), loadAgent()]).then(() => { try { render(); } catch (e) {} }); };
  window.renderOrders = render;
})();

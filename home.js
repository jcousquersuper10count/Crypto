/* Aujourd'hui — page d'accueil : quoi faire, d'après les signaux de tendance et l'état du portefeuille */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pct = (x, d = 0) => (x > 0 ? '+' : '') + (x * 100).toFixed(d).replace('.', ',') + ' %';
  const fdate = d => d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  const MIN_HELD = 10;      // USD: below this a position is dust
  const MIN_UNCOVERED = 50; // USD: positions worth flagging when no signal exists
  let SIG = null, sigTried = false;

  async function loadSig() {
    if (sigTried) return; sigTried = true;
    try { const r = await fetch('data/signals.json?t=' + Date.now()); if (r.ok) SIG = await r.json(); } catch (e) {}
    render();
  }
  const eurToUsd = v => v * (typeof eurUsd === 'number' ? eurUsd : 1);

  function lastDate(tx) {
    let m = 0;
    for (const t of tx) { const d = Date.parse(t.Date); if (d > m) m = d; }
    return m ? new Date(m) : null;
  }

  function render() {
    if (!$('p-home')) return;
    const now = new Date();
    $('hmDate').textContent = now.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
    let items = [];
    try { items = allItems(); } catch (e) { return; }
    const havePrices = typeof prices === 'object' && Object.keys(prices).length > 0;
    const tot = items.reduce((s, i) => s + i.usd, 0);
    if (!items.length) return;
    if (!havePrices) { $('hmTitle').textContent = 'Prix indisponibles pour l\'instant'; $('hmSub').textContent = 'Le fournisseur de prix limite les demandes. Clique sur ↻ en haut à droite dans une minute.'; $('hmActions').innerHTML = '<div class="hm-empty">Les actions s\'affichent dès que les prix sont chargés.</div>'; return; }

    // figures
    $('hmTotal').textContent = fv(tot);
    const stale = window.pricesStale ? ' · prix du ' + new Date(window.pricesStale).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) + ' (fournisseur saturé)' : '';
    const ci = items.filter(i => i.type === 'crypto' && i.usd >= MIN_HELD), ct = ci.reduce((s, i) => s + i.usd, 0);
    if (ct > 0) { const w = ci.reduce((s, i) => s + i.ch24 * i.usd, 0) / ct; $('hmChg').innerHTML = `<span class="${chClass(w)}">${chText(w)} sur 24 h (crypto)</span><span class="muted">${stale}</span>`; }
    $('hmPnl').innerHTML = $('kpiPnl').innerHTML; $('hmInv').innerHTML = $('kpiInv').innerHTML;

    // positions
    const top = items.filter(i => i.usd >= MIN_HELD).sort((a, b) => b.usd - a.usd).slice(0, 6);
    $('hmPos').innerHTML = top.map(i => {
      const al = tot > 0 ? i.usd / tot : 0;
      const img = i.img ? `<img src="${esc(i.img)}" alt="">` : esc(i.sym.slice(0, 2));
      return `<div class="hm-p"><div class="asset-img">${img}</div><div><span class="n">${esc(i.sym)}</span><span class="muted"> ${esc(i.name)}</span><span class="s"><i style="width:${Math.round(al * 100)}%"></i></span></div><div class="v">${fv(i.usd)}<small class="${i.type === 'crypto' ? chClass(i.ch24) : 'muted'}">${i.type === 'crypto' ? chText(i.ch24) : 'ETF'} · ${(al * 100).toFixed(0)} %</small></div></div>`;
    }).join('') || '<div class="hm-empty">Aucune position.</div>';

    // actions
    const todo = [], watch = [], quiet = [];
    const held = {}; items.forEach(i => { if (i.type === 'crypto') held[i.sym] = i; });
    if (SIG) {
      const age = (now - new Date(SIG.generated)) / 36e5;
      if (age > 36) watch.push({ b: 'warn', l: 'Données', t: 'Signaux pas à jour', d: `Dernier calcul le ${fdate(new Date(SIG.generated))}. Relance « Signaux Kronos » dans l'onglet Actions du dépôt GitHub.`, go: 'signals' });
      for (const [sym, c] of Object.entries(SIG.coins)) {
        const t = c.trend, h = held[sym], has = h && h.usd >= MIN_HELD;
        const fresh = t.days <= 3 ? '<span class="new">Nouveau</span>' : '';
        const flip = fv(eurToUsd(t.sma));
        const val = has ? `${fv(h.usd)}<small>${(h.usd / tot * 100).toFixed(0)} % du total</small>` : '';
        if (has && !t.above) todo.push({ w: h.usd, b: 'sell', l: 'Vendre', t: `Alléger ou vendre ${sym}${fresh}`, v: val, go: 'signals', sym,
          d: `Sous sa moyenne 50 jours depuis <b>${t.days} j</b> (${pct(t.distance)}). Le signal repasse à l'achat si ${sym} clôture au-dessus de <b>${flip}</b>.` });
        else if (has && t.above) watch.push({ b: 'keep', l: 'Garder', t: `Garder ${sym}${fresh}`, v: val, go: 'signals', sym,
          d: `Au-dessus de sa moyenne 50 jours depuis ${t.days} j (${pct(t.distance)}). À vendre s'il clôture sous <b>${flip}</b>.` });
        else if (!has && t.above) todo.push({ w: 0, b: 'buy', l: 'Achat', t: `Achat possible : ${sym}${fresh}`, go: 'signals', sym,
          d: `Repassé au-dessus de sa moyenne 50 jours depuis ${t.days} j (${pct(t.distance)}). Tu n'en détiens pas. Sortie prévue sous <b>${flip}</b>.` });
        else quiet.push(`<b>${esc(sym)}</b> : pas d'achat, tendance baissière (achat au-dessus de ${flip}).`);
      }
    } else if (sigTried) watch.push({ b: 'warn', l: 'Données', t: 'Signaux indisponibles', d: 'Le fichier des signaux n\'a pas pu être chargé.', go: 'signals' });

    // concentration
    const big = items.filter(i => tot > 0 && i.usd / tot > 0.4 && i.type === 'crypto');
    big.forEach(i => watch.push({ b: 'warn', l: 'Risque', t: `${i.sym} pèse ${(i.usd / tot * 100).toFixed(0)} % du portefeuille`, d: 'Une seule position concentre une grande part du risque. Une baisse de cette crypto touche tout le portefeuille.', go: 'risk' }));
    // positions without a signal
    if (SIG) {
      const un = items.filter(i => i.type === 'crypto' && i.usd >= MIN_UNCOVERED && !SIG.coins[i.sym] && !['USDC', 'USDT', 'EURC', 'DAI'].includes(i.sym)).sort((a, b) => b.usd - a.usd);
      if (un.length) watch.push({ b: 'warn', l: 'Sans signal', t: `Pas de signal pour ${un.slice(0, 4).map(i => i.sym).join(', ')}${un.length > 4 ? '…' : ''}`, d: `${un.length > 1 ? 'Ces positions ne sont' : 'Cette position n\'est'} pas suivie${un.length > 1 ? 's' : ''} par la page Signaux (${fv(un.reduce((s, i) => s + i.usd, 0))} au total).`, go: 'holdings' });
    }
    // stale accounts
    try {
      [['Neverless', sbTx], ['Revolut Crypto', rcTx], ['Revolut Robo', rrTx]].forEach(([n, tx]) => {
        if (!tx || !tx.length) { watch.push({ b: 'warn', l: 'Données', t: `${n} : aucune donnée`, d: 'L\'onglet de la Google Sheet est vide ou illisible. Réimporte le relevé des transactions.', go: 'import' }); return; }
        const d = lastDate(tx); if (!d) return;
        const days = (now - d) / 864e5;
        if (days > 45) watch.push({ b: 'warn', l: 'Données', t: `${n} : dernière opération le ${fdate(d)}`, d: 'Si tu as acheté ou vendu depuis, réimporte le relevé pour que les montants soient justes.', go: 'import' });
      });
    } catch (e) {}

    todo.sort((a, b) => b.w - a.w);
    const card = a => `<button type="button" class="hm-act" data-go="${a.go}" data-sym="${a.sym || ''}"><span class="hm-badge ${a.b}">${a.l}</span><span class="hm-act-t">${a.t}</span>${a.v ? `<span class="hm-act-v">${a.v}</span>` : ''}<span class="hm-act-d">${a.d}</span></button>`;
    $('hmActions').innerHTML = todo.length ? todo.map(card).join('') : `<div class="hm-empty">${SIG ? 'Aucune action à envisager aujourd\'hui : les signaux ne demandent ni achat ni vente.' : 'Chargement des signaux…'}</div>`;
    $('hmWatch').innerHTML = watch.map(card).join(''); $('hmWatchH').hidden = !watch.length;
    $('hmQuiet').innerHTML = quiet.map(q => `<li>${q}</li>`).join(''); $('hmQuietH').hidden = !quiet.length;
    document.querySelectorAll('#p-home .hm-act').forEach(b => b.onclick = () => go(b.dataset.go));

    // headline
    const sells = todo.filter(a => a.b === 'sell'), buys = todo.filter(a => a.b === 'buy');
    const sellVal = sells.reduce((s, a) => s + a.w, 0);
    let title, sub;
    if (!SIG) { title = 'Ton portefeuille aujourd\'hui'; sub = ''; }
    else if (sells.length) {
      title = `${sells.length} position${sells.length > 1 ? 's' : ''} en signal de vente`;
      sub = `${sells.map(a => a.sym).join(', ')} : ${fv(sellVal)} exposés à une tendance baissière, soit ${(sellVal / tot * 100).toFixed(0)} % du portefeuille.` + (buys.length ? ` ${buys.length} signal${buys.length > 1 ? 'aux' : ''} d'achat par ailleurs.` : '');
    } else if (buys.length) { title = `${buys.length} signal${buys.length > 1 ? 'aux' : ''} d'achat`; sub = `${buys.map(a => a.sym).join(', ')} : tendance repassée à la hausse.`; }
    else { title = 'Rien à faire aujourd\'hui'; sub = 'Aucun signal ne demande d\'acheter ou de vendre. Reviens demain matin, après la mise à jour quotidienne.'; }
    $('hmTitle').textContent = title; $('hmSub').textContent = sub;
  }

  // hooks: re-render when figures are refreshed, and when the page opens
  const prevSum = window.renderSum;
  window.renderSum = function () { prevSum.apply(this, arguments); try { render(); } catch (e) { console.error(e); } };
  const prevGo = window.go;
  window.go = function (p) { prevGo(p); if (p === 'home') { loadSig(); render(); } };
  loadSig();
})();

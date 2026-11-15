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
  let shown = 0, raf = 0, firstDone = false;
  function countTo(el, target) {
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce || Math.abs(target - shown) < 0.5) { shown = target; el.textContent = fv(target); return; }
    cancelAnimationFrame(raf);
    const from = shown, t0 = performance.now(), dur = shown ? 600 : 1100;
    const step = t => { const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 4); shown = from + (target - from) * e; el.textContent = fv(shown); if (k < 1) raf = requestAnimationFrame(step); else shown = target; };
    raf = requestAnimationFrame(step);
  }
  const SEG = [['holdings', 'Tout'], ['neverless', 'Neverless'], ['revcrypto', 'Revolut Crypto'], ['revrobo', 'Revolut Robo']];
  function paintSeg(p) {
    document.querySelectorAll('.seg').forEach(el => {
      el.innerHTML = SEG.map(([k, l]) => `<button type="button" role="tab" aria-selected="${k === p}" data-p="${k}">${l}</button>`).join('');
      el.querySelectorAll('button').forEach(b => b.onclick = () => go(b.dataset.p));
    });
  }
  const eurToUsd = v => v * (typeof eurUsd === 'number' ? eurUsd : 1);

  function lastDate(tx) {
    let m = 0;
    for (const t of tx) { const d = Date.parse(t.Date); if (d > m) m = d; }
    return m ? new Date(m) : null;
  }

  function chips(now) {
    const out = [];
    const fg = ($('kpiFG') ? $('kpiFG').textContent : '').trim().match(/^(\d+)\s*(.*)$/);
    if (fg) { const fr = { 'Extreme Fear': 'peur extrême', 'Fear': 'peur', 'Neutral': 'neutre', 'Greed': 'avidité', 'Extreme Greed': 'avidité extrême' }[fg[2].trim()] || fg[2].trim().toLowerCase(); out.push(`Humeur du marché crypto : <b>${esc(fg[1])}/100</b> ${esc(fr)}`); }
    if (SIG) out.push(`Signaux du <b>${new Date(SIG.generated).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</b>`);
    try { const d = Object.values(etfP).map(e => e.date).filter(Boolean).sort().pop(); if (d) out.push(`Cours ETF du <b>${new Date(d + 'T12:00:00Z').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</b>`); } catch (e) {}
    $('hmChips').innerHTML = out.map((c, i) => `<span class="hm-chip" style="--i:${i}"><i></i><span>${c}</span></span>`).join('');
  }
  // Value of the current positions over the last 7 days (crypto: hourly prices; ETFs: daily closes)
  function curve(items, tot) {
    const N = 56, s = new Array(N).fill(0); let covered = 0;
    const at = (arr, t) => { const x = t * (arr.length - 1), a = Math.floor(x), b = Math.min(arr.length - 1, a + 1); return arr[a] + (arr[b] - arr[a]) * (x - a); };
    items.forEach(i => {
      let sp = i.spark && i.spark.length > 1 ? i.spark : null, k = 1;
      if (sp && i.type === 'etf') { sp = sp.slice(-6); k = eurUsd; }
      const lastP = sp ? sp[sp.length - 1] * k : 0;
      if (sp && lastP > 0) { covered += i.usd; for (let j = 0; j < N; j++) s[j] += i.usd * (at(sp, j / (N - 1)) * k) / lastP; }
      else for (let j = 0; j < N; j++) s[j] += i.usd;
    });
    const el = $('hmCurve');
    if (!(tot > 0) || covered / tot < 0.5) { el.innerHTML = ''; return; }
    const lo = Math.min(...s), hi = Math.max(...s), W = 400, H = 110, pad = 8;
    const X = j => j / (N - 1) * W, Y = v => pad + (hi - v) / ((hi - lo) || 1) * (H - 2 * pad);
    const pts = s.map((v, j) => `${X(j).toFixed(1)},${Y(v).toFixed(1)}`);
    const ch = s[N - 1] / s[0] - 1, col = ch >= 0 ? 'var(--green)' : 'var(--red)';
    el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Valeur de tes positions sur 7 jours"><defs><linearGradient id="hmG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${col}" stop-opacity=".28"/><stop offset="1" stop-color="${col}" stop-opacity="0"/></linearGradient></defs>
      <path class="ar" d="M0,${H} L${pts.join(' L')} L${W},${H} Z" fill="url(#hmG)"/><path class="ln" pathLength="1" d="M${pts.join(' L')}" stroke="${col}" vector-effect="non-scaling-stroke"/></svg>
      <div class="hm-curve-cap"><span>il y a 7 jours · ${fv(s[0])}</span><span class="${chClass(ch)}">${chText(ch * 100)} sur 7 jours, à positions constantes</span></div>`;
  }
  function ring(items, tot) {
    const g = [['Crypto', 'var(--accent)', 0], ['ETF', 'hsl(calc(var(--h) - 75) 75% 66%)', 0], ['Espèces', 'var(--fg3)', 0]];
    items.forEach(i => { g[i.type === 'crypto' ? 0 : i.sym === 'Espèces' ? 2 : 1][2] += i.usd; });
    const parts = g.filter(x => x[2] > 0.5); let off = 0;
    const R = 40, svg = `<svg viewBox="0 0 100 100"><circle class="trk" cx="50" cy="50" r="${R}"/>` + parts.map(p => { const v = p[2] / tot * 100, c = `<circle cx="50" cy="50" r="${R}" pathLength="100" stroke="${p[1]}" stroke-dasharray="0 100" stroke-dashoffset="${-off}" data-v="${Math.max(0, v - 0.8).toFixed(2)}"/>`; off += v; return c; }).join('') + '</svg>';
    const key = parts.map(p => Math.round(p[2])).join('|');
    if ($('hmRing').dataset.k !== key) {
      $('hmRing').dataset.k = key; $('hmRing').innerHTML = svg;
      requestAnimationFrame(() => requestAnimationFrame(() => $('hmRing').querySelectorAll('circle[data-v]').forEach(c => c.setAttribute('stroke-dasharray', c.dataset.v + ' 100'))));
    }
    $('hmRingLeg').innerHTML = parts.map(p => `<div><i style="background:${p[1]}"></i><span>${p[0]}</span><b>${fv(p[2])}</b><small>${(p[2] / tot * 100).toFixed(0)} %</small></div>`).join('');
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
    countTo($('hmTotal'), tot);
    const stale = window.pricesStale ? 'Certains prix datent du ' + new Date(window.pricesStale).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) + '' : '';
    const ci = items.filter(i => i.type === 'crypto' && i.usd >= MIN_HELD), ct = ci.reduce((s, i) => s + i.usd, 0);
    if (ct > 0) { const w = ci.reduce((s, i) => s + i.ch24 * i.usd, 0) / ct; $('hmChg').innerHTML = `<span class="${chClass(w)}">${chText(w)} sur 24 h (crypto)</span><span class="muted">${stale}</span>`; }
    $('hmPnl').innerHTML = $('kpiPnl').innerHTML; $('hmInv').innerHTML = $('kpiInv').innerHTML;
    const numOf = el => parseFloat(el.textContent.replace(/[^\d,.-]/g, '').replace(',', '.'));
    const pv = numOf($('kpiPnl')), iv = numOf($('kpiInv'));
    $('hmPnlPct').innerHTML = iv > 0 && isFinite(pv) ? `<span class="${chClass(pv)}">${chText(pv / iv * 100)}</span> sur le total investi` : '';
    chips(now); curve(items, tot); ring(items, tot);

    // positions
    const top = items.filter(i => i.usd >= MIN_HELD).sort((a, b) => b.usd - a.usd).slice(0, 6);
    $('hmPos').innerHTML = top.map(i => {
      const al = tot > 0 ? i.usd / tot : 0;
      const img = i.img ? `<img src="${esc(i.img)}" alt="">` : esc(i.sym.slice(0, 2));
      return `<div class="hm-p" style="--i:${4 + top.indexOf(i)}"><div class="asset-img">${img}</div><div><span class="n">${esc(i.sym)}</span><span class="muted"> ${esc(i.name)}</span><span class="s"><i style="width:${Math.round(al * 100)}%"></i></span></div><div class="v">${fv(i.usd)}<small class="${i.type === 'crypto' ? chClass(i.ch24) : 'muted'}">${i.type === 'crypto' ? chText(i.ch24) : 'ETF'} · ${(al * 100).toFixed(0)} %</small></div></div>`;
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
        if (has && !t.above) todo.push({ w: h.usd, b: 'sell', l: 'Vendre', t: `Alléger ou vendre ${sym}${fresh}`, v: val, go: 'signals', sym, dist: t.distance,
          d: `Sous sa moyenne 50 jours depuis <b>${t.days} j</b> (${pct(t.distance)}). Le signal repasse à l'achat si ${sym} clôture au-dessus de <b>${flip}</b>.` });
        else if (has && t.above) watch.push({ b: 'keep', l: 'Garder', t: `Garder ${sym}${fresh}`, v: val, go: 'signals', sym, dist: t.distance,
          d: `Au-dessus de sa moyenne 50 jours depuis ${t.days} j (${pct(t.distance)}). À vendre s'il clôture sous <b>${flip}</b>.` });
        else if (!has && t.above) todo.push({ w: 0, b: 'buy', l: 'Achat', t: `Achat possible : ${sym}${fresh}`, go: 'signals', sym, dist: t.distance,
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
    let ci2 = 0; const gauge = a => { if (a.dist == null) return ''; const x = 50 + Math.max(-30, Math.min(30, a.dist * 100)) / 30 * 50; return `<span class="hm-gauge" aria-hidden="true"><i class="mid"></i><i class="dot" style="left:${x.toFixed(1)}%;background:var(${a.dist >= 0 ? '--green' : '--red'})"></i></span><span class="hm-gauge-cap"><span>−30 %</span><span>moyenne 50 jours</span><span>+30 %</span></span>`; };
    const card = a => `<button type="button" class="hm-act" style="--i:${3 + ci2++}" data-go="${a.go}" data-sym="${a.sym || ''}"><span class="hm-badge ${a.b}">${a.l}</span><span class="hm-act-t">${a.t}</span>${a.v ? `<span class="hm-act-v">${a.v}</span>` : ''}<span class="hm-act-d">${a.d}</span>${gauge(a)}</button>`;
    $('hmActions').innerHTML = todo.length ? todo.map(card).join('') : `<div class="hm-empty">${SIG ? 'Aucune action à envisager aujourd\'hui : les signaux ne demandent ni achat ni vente.' : 'Chargement des signaux…'}</div>`;
    $('hmWatch').innerHTML = watch.map(card).join(''); $('hmWatchH').hidden = !watch.length;
    $('hmQuiet').innerHTML = quiet.map(q => `<li>${q}</li>`).join(''); $('hmQuietH').hidden = !quiet.length;
    if (!firstDone) { firstDone = true; const pg = $('p-home'); pg.classList.add('hm-anim'); setTimeout(() => pg.classList.remove('hm-anim'), 1600); }
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
  window.go = function (p) {
    prevGo(p);
    document.documentElement.dataset.page = p;
    const grp = SEG.some(s => s[0] === p);
    if (grp) { paintSeg(p); document.querySelectorAll('.sb-link[data-page]').forEach(l => l.classList.toggle('active', l.dataset.page === 'holdings')); }
    const more = document.querySelector('.sb-more'); if (more && more.querySelector(`[data-page="${p}"]`)) more.open = true;
    if (p === 'home') { loadSig(); render(); }
    window.scrollTo({ top: 0 });
  };
  paintSeg('holdings');
  // wrong password: shake the entry card
  const err = $('gateErr');
  if (err) new MutationObserver(() => { if (err.textContent) { const g = $('gate'); g.classList.remove('shake'); void g.offsetWidth; g.classList.add('shake'); } }).observe(err, { childList: true });
  loadSig();
})();

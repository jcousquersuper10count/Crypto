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

  // One line saying how fresh each data source is
  function dataLine() {
    const parts = [];
    const tm = d => d.toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    parts.push(window.pricesStale ? `Prix crypto du ${tm(new Date(window.pricesStale))}` : `Prix crypto en direct (${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })})`);
    try { const d = Object.values(etfP).map(e => e.date).filter(Boolean).sort().pop(); if (d) parts.push(`ETF : clôture du ${new Date(d + 'T12:00:00Z').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}`); } catch (e) {}
    if (SIG) parts.push(`Signaux du ${new Date(SIG.generated).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}`);
    $('hmData').textContent = parts.join(' · ');
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
      <div class="hm-xh" hidden><i></i><span></span></div>
      <div class="hm-curve-cap"><span>il y a 7 jours · ${fv(s[0])}</span><span class="${chClass(ch)}">${chText(ch * 100)} sur 7 jours, à positions constantes</span></div>`;
    const svg = el.querySelector('svg'), xh = el.querySelector('.hm-xh');
    const move = ev => {
      const r = svg.getBoundingClientRect(), f = Math.max(0, Math.min(1, (ev.clientX - r.left) / r.width)), j = Math.round(f * (N - 1));
      const hrs = Math.round((N - 1 - j) / (N - 1) * 168), when = hrs < 1 ? 'maintenant' : hrs < 24 ? `il y a ${hrs} h` : `il y a ${Math.floor(hrs / 24)} j ${hrs % 24 ? (hrs % 24) + ' h' : ''}`;
      const yv = Y(s[j]) / H * r.height;
      xh.hidden = false; xh.style.left = (j / (N - 1) * r.width) + 'px';
      xh.querySelector('i').style.top = yv + 'px';
      const d = s[j] / s[0] - 1;
      xh.querySelector('span').innerHTML = `<b>${fv(s[j])}</b> ${when}<br><span class="${chClass(d)}">${chText(d * 100)}</span> depuis 7 jours`;
      xh.classList.toggle('left', j > N * 0.6);
    };
    svg.addEventListener('pointermove', move); svg.addEventListener('pointerdown', move);
    svg.addEventListener('pointerleave', () => { xh.hidden = true; });
  }
  /* Carte du portefeuille : une tuile par position, surface = valeur, couleur = variation sur 7 jours */
  function squarify(vals, x, y, w, h) {
    const out = [], tot = vals.reduce((a, v) => a + v.v, 0); if (!(tot > 0)) return out;
    const items = vals.map(v => Object.assign({}, v, { a: v.v / tot * w * h }));
    let row = [], rx = x, ry = y, rw = w, rh = h;
    const worst = (r, side) => { const s = r.reduce((a, i) => a + i.a, 0), mx = Math.max(...r.map(i => i.a)), mn = Math.min(...r.map(i => i.a)); return Math.max(side * side * mx / (s * s), s * s / (side * side * mn)); };
    const lay = r => {
      const s = r.reduce((a, i) => a + i.a, 0);
      if (rw >= rh) { const cw = s / rh; let cy = ry; r.forEach(i => { const ch = i.a / cw; out.push(Object.assign(i, { x: rx, y: cy, w: cw, h: ch })); cy += ch; }); rx += cw; rw -= cw; }
      else { const ch = s / rw; let cx = rx; r.forEach(i => { const cw = i.a / ch; out.push(Object.assign(i, { x: cx, y: ry, w: cw, h: ch })); cx += cw; }); ry += ch; rh -= ch; }
    };
    items.forEach(it => {
      const side = Math.min(rw, rh);
      if (!row.length || worst(row.concat(it), side) <= worst(row, side)) row.push(it);
      else { lay(row); row = [it]; }
    });
    if (row.length) lay(row);
    return out;
  }
  function ring(items, tot) {
    const g = [['Crypto', 'var(--accent)', 0], ['ETF', 'var(--etf)', 0], ['Espèces', 'var(--fg3)', 0]];
    items.forEach(i => { g[i.type === 'crypto' ? 0 : i.sym === 'Espèces' ? 2 : 1][2] += i.usd; });
    const parts = g.filter(x => x[2] > 0.5);
    const strip = `<div class="tm-strip">${parts.map(p => `<span style="flex:${p[2]};background:${p[1]}"></span>`).join('')}</div>
      <div class="tm-leg">${parts.map(p => `<span><i style="background:${p[1]}"></i>${p[0]} <b>${fv(p[2])}</b> <small>${Math.round(p[2] / tot * 100)} %</small></span>`).join('')}</div>`;
    const sorted = items.filter(i => i.usd > 0).sort((a, b) => b.usd - a.usd);
    const big = sorted.filter(i => i.usd / tot >= 0.012).slice(0, 18), rest = sorted.filter(i => !big.includes(i));
    const vals = big.map(i => ({ v: i.usd, sym: i.sym, name: i.type === 'etf' ? (i.name || '') : (i.name || i.sym), ch: i.sym === 'Espèces' || !i.ch7d ? null : i.ch7d, eur: i.usd }));
    if (rest.length) vals.push({ v: rest.reduce((a, i) => a + i.usd, 0), sym: `+${rest.length}`, name: 'autres positions', ch: null, eur: rest.reduce((a, i) => a + i.usd, 0) });
    const cells = squarify(vals, 0, 0, 100, 100).map(c => {
      const k = c.ch == null ? 0 : Math.max(-1, Math.min(1, c.ch / 12)), hue = k >= 0 ? 152 : 358;
      const bg = c.ch == null ? 'var(--bg3)' : `hsl(${hue} ${30 + Math.abs(k) * 40}% ${16 + Math.abs(k) * 14}%)`;
      const small = c.w < 17 || c.h < 17, tiny = c.w < 9 || c.h < 10;
      const pct = c.ch == null ? '' : `${c.ch >= 0 ? '+' : '−'}${Math.abs(c.ch).toFixed(1).replace('.', ',')} %`;
      return `<button type="button" class="tm-c${small ? ' sm' : ''}${tiny ? ' xs' : ''}" style="left:${c.x}%;top:${c.y}%;width:${c.w}%;height:${c.h}%;--tc:${bg}" onclick="go('holdings')" title="${esc(c.sym)} · ${esc(c.name)} · ${fv(c.eur)}${pct ? ' · ' + pct + ' sur 7 jours' : ''}">
        <b>${esc(c.sym)}</b>${tiny || !pct ? "" : `<span>${pct}</span>`}${small || tiny ? '' : `<small>${fv(c.eur)}</small>`}</button>`;
    }).join('');
    const key = vals.map(v => v.sym + Math.round(v.v) + (v.ch || 0).toFixed(1)).join('|');
    if ($('hmRing').dataset.k !== key) { $('hmRing').dataset.k = key; $('hmRing').innerHTML = `<div class="tm">${cells}</div>`; }
    $('hmRingLeg').innerHTML = strip;
  }
  function render() {
    if (!$('p-home')) return;
    const now = new Date();
    $('hmDate').textContent = now.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
    let items = [];
    try { items = allItems(); } catch (e) { return; }
    const havePrices = typeof prices === 'object' && Object.keys(prices).length > 0;
    const tot = items.reduce((s, i) => s + i.usd, 0);
    if (!items.length) {
      if (window.dataMode === 'locked' || window.dataMode === 'denied') { $('hmTitle').textContent = 'Données verrouillées'; $('hmSub').textContent = window.dataMode === 'denied' ? 'La clé d\'accès enregistrée est refusée par le script Google. Saisis la bonne clé dans Importer.' : 'Tes transactions ne sont plus publiques. Saisis ta clé d\'accès dans Importer pour les afficher sur cet appareil.'; $('hmActions').innerHTML = '<button type="button" class="hm-link" onclick="go(\'import\')">Saisir ma clé d\'accès</button>'; }
      return;
    }
    if (!havePrices) { $('hmTitle').textContent = 'Prix indisponibles pour l\'instant'; $('hmSub').textContent = 'Le fournisseur de prix limite les demandes. Clique sur ↻ en haut à droite dans une minute.'; $('hmActions').innerHTML = '<div class="hm-empty">Les actions s\'affichent dès que les prix sont chargés.</div>'; return; }

    // figures
    countTo($('hmTotal'), tot);
    { // a quote counts in "since yesterday" only if it moved since yesterday (no ETF trading on weekends)
      const ystd = new Date(now.getTime() - 864e5).toISOString().slice(0, 10);
      const w = items.filter(i => i.usd >= MIN_HELD && (i.type === 'crypto' || ((etfP[i.sym] || {}).date || '') >= ystd)), wt = w.reduce((s, i) => s + i.usd, 0);
      const d = wt > 0 ? w.reduce((s, i) => s + i.usd * (i.ch24 || 0) / 100 / (1 + (i.ch24 || 0) / 100), 0) : 0;
      const etfOff = items.some(i => i.type === 'etf' && i.sym !== 'Espèces') && !w.some(i => i.type === 'etf');
      $('hmChg').innerHTML = `<span class="${chClass(d)}">${d >= 0 ? '+' : '−'}${fv(Math.abs(d))} (${chText(d / (tot - d) * 100)})</span> <span class="muted">depuis hier${etfOff ? ', bourse fermée pour les ETF' : ''}</span>`; }
    $('hmPnl').innerHTML = $('kpiPnl').innerHTML; $('hmInv').innerHTML = $('kpiInv').innerHTML;
    const numOf = el => parseFloat(el.textContent.replace(/[^\d,.-]/g, '').replace(',', '.'));
    const pv = numOf($('kpiPnl')), iv = numOf($('kpiInv'));
    $('hmPnlPct').innerHTML = iv > 0 && isFinite(pv) ? `<span class="${chClass(pv)}">${chText(pv / iv * 100)}</span> sur le total investi` : '';
    dataLine(); curve(items, tot); ring(items, tot);

    // positions
    const top = items.filter(i => i.usd >= MIN_HELD).sort((a, b) => b.usd - a.usd).slice(0, 6);
    $('hmPos').innerHTML = top.map(i => {
      const al = tot > 0 ? i.usd / tot : 0;
      const img = i.img ? `<img src="${esc(i.img)}" alt="" onerror="this.replaceWith(document.createTextNode('${esc(i.sym.slice(0, 2))}'))">` : esc(i.sym.slice(0, 2));
      return `<div class="hm-p" style="--i:${4 + top.indexOf(i)}"><div class="asset-img">${img}</div><div><span class="n">${esc(i.sym)}</span><span class="muted"> ${esc(i.name)}</span><span class="s"><i style="width:${Math.round(al * 100)}%"></i></span></div><div class="v">${fv(i.usd)}<small class="${i.type === 'crypto' ? chClass(i.ch24) : 'muted'}">${i.type === 'crypto' ? chText(i.ch24) : 'ETF'} · ${(al * 100).toFixed(0)} %</small></div></div>`;
    }).join('') || '<div class="hm-empty">Aucune position.</div>';

    // actions
    const todo = [], watch = [], quiet = [], susp = [];
    const held = {}; items.forEach(i => { if (i.type === 'crypto') held[i.sym] = i; });
    if (SIG) {
      const age = (now - new Date(SIG.generated)) / 36e5;
      const suspendAll = age > 36;
      if (age > 36) watch.push({ b: 'warn', l: 'Données', t: 'Signaux suspendus : calcul pas à jour', d: `Dernier calcul le ${fdate(new Date(SIG.generated))}. Relance « Signaux Kronos » dans l'onglet Actions du dépôt GitHub.`, go: 'signals' });
      for (const [sym, c] of Object.entries(SIG.coins)) {
        const t = c.trend, h = held[sym], has = h && h.usd >= MIN_HELD;
        if (suspendAll || c.stale) { if (has) susp.push(sym); continue; }
        const fresh = t.days <= 3 ? '<span class="new">Nouveau</span>' : '';
        const flip = fv(eurToUsd(t.sma));
        const val = has ? `${fv(h.usd)}<small>${(h.usd / tot * 100).toFixed(0)} % du total</small>` : '';
        if (has && !t.above) todo.push({ flipTxt: `achat au-dessus de ${flip}`, w: h.usd, b: 'sell', l: 'Vendre', t: `Alléger ou vendre ${sym}${fresh}`, v: val, go: 'signals', sym, dist: t.distance,
          d: `Sous sa moyenne 50 jours depuis <b>${t.days} j</b> (${pct(t.distance)}). Le signal repasse à l'achat si ${sym} clôture au-dessus de <b>${flip}</b>.` });
        else if (has && t.above) watch.push({ flipTxt: `vente sous ${flip}`, w: h.usd, b: 'keep', l: 'Garder', t: `Garder ${sym}${fresh}`, v: val, go: 'signals', sym, dist: t.distance,
          d: `Au-dessus de sa moyenne 50 jours depuis ${t.days} j (${pct(t.distance)}). À vendre s'il clôture sous <b>${flip}</b>.` });
        else if (!has && t.above) todo.push({ flipTxt: `sortie sous ${flip}`, w: 0, b: 'buy', l: 'Achat', t: `Achat possible : ${sym}${fresh}`, go: 'signals', sym, dist: t.distance,
          d: `Repassé au-dessus de sa moyenne 50 jours depuis ${t.days} j (${pct(t.distance)}). Tu n'en détiens pas. Sortie prévue sous <b>${flip}</b>.` });
        else quiet.push(`<b>${esc(sym)}</b> : pas détenu, tendance baissière.`);
      }
    } else if (sigTried) watch.push({ b: 'warn', l: 'Données', t: 'Signaux indisponibles', d: 'Le fichier des signaux n\'a pas pu être chargé.', go: 'signals' });

    if (window.dataMode === 'public') watch.unshift({ b: 'warn', l: 'Sécurité', t: 'Tes transactions sont lisibles par tout le monde', d: 'La Google Sheet est en accès public. Installe le script sécurisé et ta clé d\'accès, puis rends la feuille privée (voir Importer).', go: 'import' });
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
    const gauge = a => { if (a.dist == null) return ''; const x = 50 + Math.max(-30, Math.min(30, a.dist * 100)) / 30 * 50; return `<span class="hm-gauge" aria-hidden="true"><i class="mid"></i><i class="dot" style="left:${x.toFixed(1)}%;background:var(${a.dist >= 0 ? '--green' : '--red'})"></i></span>`; };
    const keeps = watch.filter(w => w.b === 'keep'), others = watch.filter(w => w.b !== 'keep');
    const group = (kind, list, head, sub) => {
      if (!list.length) return '';
      const total = list.reduce((s, a) => s + (a.w || 0), 0);
      const rows = list.map((a, i) => {
        const it = held[a.sym], img = it && it.img ? `<img src="${esc(it.img)}" alt="" onerror="this.replaceWith(document.createTextNode('${esc(a.sym.slice(0, 2))}'))">` : esc(a.sym.slice(0, 2));
        return `<button type="button" class="hm-row" data-go="signals" style="--i:${4 + i}"><span class="asset-img">${img}</span><span class="hm-row-m"><b>${esc(a.sym)}</b><span>${a.flipTxt}</span></span><span class="hm-row-g">${gauge(a)}<small>${pct(a.dist)} vs moyenne</small></span><span class="hm-row-v">${a.w ? fv(a.w) : '—'}</span></button>`;
      }).join('');
      return `<div class="hm-dec ${kind}"><div class="hm-dec-h"><span class="hm-badge ${kind}">${head}</span><span class="hm-dec-t">${sub}</span>${total ? `<span class="hm-dec-v">${fv(total)}<small>${(total / tot * 100).toFixed(0)} % du portefeuille</small></span>` : ''}</div><div class="hm-dec-rows">${rows}</div></div>`;
    };
    const sellsL = todo.filter(a => a.b === 'sell'), buysL = todo.filter(a => a.b === 'buy');
    const n = x => x.length > 1 ? `${x.length} cryptos` : x[0] && x[0].sym;
    let html = group('sell', sellsL, 'Défavorable', `Tendance défavorable sur ${n(sellsL)}`) + group('buy', buysL, 'Favorable', `Tendance favorable, non détenu : ${n(buysL)}`) + group('keep', keeps, 'Favorable', `Tendance favorable sur ${n(keeps)}`);
    if (!html) html = `<div class="hm-empty">${SIG ? 'Aucune décision aujourd\'hui : les signaux ne demandent ni achat ni vente.' : 'Chargement des signaux…'}</div>`;
    if (susp.length) html += `<div class="hm-empty">Signal suspendu pour ${susp.join(', ')} : données de prix trop anciennes. Aucune décision n'est proposée sans données fraîches.</div>`;
    $('hmActions').innerHTML = html + (quiet.length ? `<p class="hm-quietline">${quiet.join(' ')}</p>` : '');
    $('hmWatch').innerHTML = others.map((a, i) => `<li><button type="button" class="hm-w" data-go="${a.go}" style="--i:${8 + i}"><span class="hm-w-dot ${a.b}"></span><span><b>${a.t}</b><span>${a.d}</span></span><span class="hm-w-go" aria-hidden="true">›</span></button></li>`).join('');
    $('hmWatchH').hidden = !others.length;
    if (!firstDone) { firstDone = true; const pg = $('p-home'); pg.classList.add('hm-anim'); setTimeout(() => pg.classList.remove('hm-anim'), 1600); }
    document.querySelectorAll('#p-home [data-go]').forEach(b => b.onclick = () => go(b.dataset.go));

    // headline
    const sells = todo.filter(a => a.b === 'sell'), buys = todo.filter(a => a.b === 'buy');
    const sellVal = sells.reduce((s, a) => s + a.w, 0);
    let title, sub;
    const covered = SIG ? items.filter(i => SIG.coins[i.sym]).reduce((s, i) => s + i.usd, 0) : 0;
    const cov = tot > 0 ? Math.round(covered / tot * 100) : 0;
    const caveat = ` Règle expérimentale, qui a surtout servi à limiter les pertes. Les signaux couvrent ${cov} % de ton portefeuille.`;
    if (!SIG) { title = 'Ton portefeuille aujourd\'hui'; sub = ''; }
    else if (sells.length) {
      title = `${sells.length > 1 ? sells.length + ' positions' : sells[0].sym} en tendance défavorable`;
      sub = `${sells.map(a => a.sym).join(', ')} : ${fv(sellVal)}, soit ${(sellVal / tot * 100).toFixed(0)} % du portefeuille, sous leur moyenne 50 jours.` + (buys.length ? ` ${buys.map(a => a.sym).join(', ')} : tendance favorable.` : '') + caveat;
    } else if (buys.length) { title = `Tendance favorable : ${buys.map(a => a.sym).join(', ')}`; sub = `Repassé${buys.length > 1 ? 's' : ''} au-dessus de la moyenne 50 jours, non détenu${buys.length > 1 ? 's' : ''}.` + caveat; }
    else if (susp.length) { title = 'Signaux suspendus'; sub = 'Les données de prix sont trop anciennes pour proposer quoi que ce soit.'; }
    else { title = 'Rien à signaler aujourd\'hui'; sub = 'Aucune tendance n\'a changé de sens.' + caveat; }
    $('hmTitle').textContent = title; $('hmSub').textContent = sub;
  }

  window.renderHome = render;
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

/* Signaux — reads data/signals.json (written daily by the Kronos workflow) */
(function () {
  'use strict';
  const ORDER = ['BTC', 'PLUME', 'ATOM', 'CETUS'];
  const S = { data: null, coin: 'BTC', hz: '1m', loading: false };
  const $ = id => document.getElementById(id);
  const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();

  /* ---------- formatting ---------- */
  function eur(v) {
    if (!isFinite(v)) return '—';
    const a = Math.abs(v), d = a >= 1000 ? 0 : a >= 10 ? 2 : a >= 1 ? 3 : a >= 0.01 ? 4 : 6;
    return v.toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d }) + ' €';
  }
  const pct = (x, d = 1) => (x > 0 ? '+' : '') + (x * 100).toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d }) + ' %';
  const cls = x => x >= 0 ? 'green' : 'red';
  const fdate = (s, y = true) => new Date(s + 'T12:00:00Z').toLocaleDateString('fr-FR', y ? { day: 'numeric', month: 'short', year: 'numeric' } : { day: 'numeric', month: 'short' });
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const short = v => { const a = Math.abs(v); return a >= 1e4 ? (v / 1e3).toLocaleString('fr-FR', { maximumFractionDigits: 1 }) + ' k' : a >= 100 ? v.toLocaleString('fr-FR', { maximumFractionDigits: 0 }) : a >= 1 ? v.toLocaleString('fr-FR', { maximumFractionDigits: 2 }) : v.toLocaleString('fr-FR', { maximumSignificantDigits: 3 }); };

  /* ---------- logic ---------- */
  function verdict(c) {
    // The signal is the trend rule only: it is the one with a measured record. Kronos is shown beside it.
    const t = c.trend, h = c.horizons.find(x => x.key === '1m');
    const k = h.pup >= 0.55 ? 'up' : h.pup <= 0.45 ? 'down' : 'flat';
    const kWord = k === 'up' ? 'haussier' : k === 'down' ? 'baissier' : 'neutre';
    const agree = (t.above && k === 'up') || (!t.above && k === 'down');
    const kTxt = `${kWord} à 1 mois` + (k === 'flat' ? '' : agree ? ', d\'accord' : ', en désaccord');
    return t.above
      ? { c: 'buy', label: 'Achat', head: 'Tendance haussière : acheter ou garder', kTxt }
      : { c: 'sell', label: 'Vente', head: 'Tendance baissière : vendre ou attendre', kTxt };
  }
  function reliability(h) {
    if (!h.track) return ['', 'Non testé'];
    const t = h.track;
    if (t.acc <= t.acc_const || t.ic < 0.05) return ['none', 'Pas d\'avantage'];
    if (t.ic < 0.15 || t.acc < t.acc_const + 0.05) return ['weak', 'Faible'];
    return ['ok', 'Correct'];
  }
  function holding(sym) {
    try { if (typeof cryptoH !== 'undefined' && cryptoH && cryptoH[sym] > 1e-9) return cryptoH[sym]; } catch (e) {}
    return null;
  }

  /* ---------- load ---------- */
  async function load() {
    if (S.loading) return; S.loading = true;
    try {
      const r = await fetch('data/signals.json?t=' + Date.now());
      if (!r.ok) throw new Error(r.status);
      S.data = await r.json();
      if (!S.data.coins[S.coin]) S.coin = ORDER.find(s => S.data.coins[s]) || Object.keys(S.data.coins)[0];
      render();
    } catch (e) {
      $('sgRoot').innerHTML = '<div class="sg-empty">Les signaux ne sont pas encore disponibles. Ils apparaissent après la première exécution quotidienne de Kronos.</div>';
    } finally { S.loading = false; }
  }

  /* ---------- render ---------- */
  function render() {
    const D = S.data;
    $('sgMeta').textContent = 'Mis à jour le ' + new Date(D.generated).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }) + ' · ' + D.model + ' · moyenne mobile ' + D.sma_n + ' jours';
    const syms = ORDER.filter(s => D.coins[s]).concat(Object.keys(D.coins).filter(s => !ORDER.includes(s)));
    $('sgCards').innerHTML = syms.map(sym => {
      const c = D.coins[sym], v = verdict(c), t = c.trend, h1 = c.horizons.find(x => x.key === '1s');
      const q = holding(sym);
      return `<button type="button" class="sg-card" data-sym="${sym}" aria-pressed="${sym === S.coin}">
        <div class="sg-top"><span><span class="sg-sym">${sym}</span><span class="sg-name">${esc(c.name)}</span></span><span class="sg-price">${eur(c.last)}</span></div>
        <span class="sg-pill ${v.c}">${v.label}</span>
        <div class="sg-line">${t.above ? 'Au-dessus' : 'Sous'} sa moyenne 50 j (<b>${pct(t.distance)}</b>) depuis ${t.days} j</div>
        <div class="sg-line">Kronos 1 semaine : <b class="${cls(h1.p50 - 1)}">${pct(h1.p50 - 1)}</b> · hausse ${Math.round(h1.pup * 100)} %</div>
        ${q ? `<div class="sg-line">Ta position : <b>${q.toLocaleString('fr-FR', { maximumFractionDigits: 4 })}</b> ≈ ${eur(q * c.last)}</div>` : ''}
      </button>`;
    }).join('');
    $('sgCards').querySelectorAll('.sg-card').forEach(b => b.onclick = () => { S.coin = b.dataset.sym; render(); });
    renderDetail();
  }

  function renderDetail() {
    const c = S.data.coins[S.coin], v = verdict(c), t = c.trend, r = t.record;
    // verdict panel
    const flip = t.above
      ? `Le signal passe à <b>vente</b> si le prix clôture sous <b>${eur(t.sma)}</b> (${pct(t.sma / c.last - 1)}).`
      : `Le signal passe à <b>achat</b> si le prix clôture au-dessus de <b>${eur(t.sma)}</b> (${pct(t.sma / c.last - 1)}).`;
    $('sgVerdict').innerHTML = `
      <div><span class="sg-pill ${v.c}">${v.label}</span></div>
      <div class="big">${esc(v.head)}</div>
      <p class="sg-line">${flip} La moyenne bouge chaque jour : ce seuil est mis à jour à chaque calcul.</p>
      <dl class="sg-kv">
        <dt>Dernier signal</dt><dd>${t.above ? 'achat' : 'vente'} le ${fdate(t.since)}</dd>
        <dt>Prix à ce moment</dt><dd>${eur(t.price_at_switch)} (${pct(c.last / t.price_at_switch - 1)})</dd>
        <dt>Avis de Kronos</dt><dd>${esc(v.kTxt)}</dd>
        <dt>RSI 14 j</dt><dd>${Math.round(t.rsi)}</dd>
      </dl>
      <div class="sg-sep"></div>
      <div class="sub" style="margin:0">Si tu avais suivi ce signal depuis le ${fdate(r.from)} (frais de 0,25 % par changement inclus) :</div>
      <div class="sg-rec">
        <div><div class="lbl">Suivre le signal</div><div class="v ${cls(r.strategy)}">${pct(r.strategy, 0)}</div><div class="dd">pire recul ${pct(r.strategy_dd, 0)} · investi ${Math.round(r.time_in * 100)} % du temps</div></div>
        <div><div class="lbl">Garder sans bouger</div><div class="v ${cls(r.hold)}">${pct(r.hold, 0)}</div><div class="dd">pire recul ${pct(r.hold_dd, 0)}</div></div>
      </div>`;
    // tabs
    $('sgTabs').innerHTML = c.horizons.map(h => `<button type="button" role="tab" aria-selected="${h.key === S.hz}" data-k="${h.key}">${h.label}</button>`).join('');
    $('sgTabs').querySelectorAll('button').forEach(b => b.onclick = () => { S.hz = b.dataset.k; renderDetail(); });
    $('sgChartTitle').textContent = `${S.coin} · ${c.horizons.find(h => h.key === S.hz).label}`;
    // table
    $('sgTbody').innerHTML = c.horizons.map(h => {
      const [rc, rt] = reliability(h);
      const tr = h.track ? `<span class="muted" style="font-size:.7rem;display:block">sens juste ${Math.round(h.track.acc * 100)} % (référence ${Math.round(h.track.acc_const * 100)} %)</span>` : '';
      const target = new Date(new Date(c.last_date + 'T12:00:00Z').getTime() + h.days * 864e5).toISOString().slice(0, 10);
      return `<tr data-k="${h.key}" class="${h.key === S.hz ? 'sel' : ''}" tabindex="0">
        <td><b>${h.label}</b><span class="muted" style="font-size:.7rem;display:block">${fdate(target)}</span></td>
        <td class="num">${eur(c.last * h.p50)}<span class="${cls(h.p50 - 1)}" style="font-size:.72rem;display:block">${pct(h.p50 - 1)}</span></td>
        <td class="num">${eur(c.last * h.p10)} – ${eur(c.last * h.p90)}<span class="muted" style="font-size:.7rem;display:block">${pct(h.p10 - 1, 0)} / ${pct(h.p90 - 1, 0)}</span></td>
        <td class="num"><span class="sg-pbar"><span class="b"><i style="width:${Math.round(h.pup * 100)}%"></i></span>${Math.round(h.pup * 100)} %</span></td>
        <td><span class="sg-rel ${rc}">${rt}</span>${tr}</td></tr>`;
    }).join('');
    $('sgTbody').querySelectorAll('tr').forEach(tr => {
      tr.onclick = () => { S.hz = tr.dataset.k; renderDetail(); };
      tr.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); S.hz = tr.dataset.k; renderDetail(); } };
    });
    // events
    $('sgEvents').innerHTML = t.events.slice().reverse().map(e => `<li><span>${fdate(e.date)}</span><span class="${e.type === 'achat' ? 't-buy' : 't-sell'}">${e.type}</span><span class="mono">${eur(e.price)}</span><span class="mv ${e.type === 'achat' ? cls(e.move_after) : cls(-e.move_after)}">${pct(e.move_after, 0)}${e.open ? ' (en cours)' : ''}</span></li>`).join('');
    $('sgSource').textContent = `Prix : ${c.source}, convertis en euros. Dernière clôture le ${fdate(c.last_date)}.` + (c.days_of_history < 730 ? ` Historique court (${c.days_of_history} jours) : les fourchettes longues reposent sur peu de données.` : '');
    drawChart();
  }

  /* ---------- chart ---------- */
  function drawChart() {
    const c = S.data.coins[S.coin], h = c.horizons.find(x => x.key === S.hz);
    const cv = $('sgChart'); if (!cv || !cv.clientWidth) return;
    const dpr = window.devicePixelRatio || 1, W = cv.clientWidth, H = cv.clientHeight;
    cv.width = W * dpr; cv.height = H * dpr;
    const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
    const histDays = Math.min(c.history.length, Math.max(90, h.days * 2));
    const hist = c.history.slice(-histDays), sma = c.sma.slice(-histDays);
    const t0 = new Date(c.last_date + 'T00:00:00Z').getTime();
    const tOf = s => (new Date(s + 'T00:00:00Z').getTime() - t0) / 864e5;
    const fan = c.fan.filter(f => f[0] <= h.days + 0.1);
    let lo = Infinity, hi = -Infinity;
    hist.forEach(p => { lo = Math.min(lo, p[1]); hi = Math.max(hi, p[1]); });
    sma.forEach(v => { if (v) { lo = Math.min(lo, v); hi = Math.max(hi, v); } });
    fan.forEach(f => { lo = Math.min(lo, c.last * f[1]); hi = Math.max(hi, c.last * f[5]); });
    const pad = (hi - lo) * 0.07; lo -= pad; hi += pad;
    const xMin = tOf(hist[0][0]), xMax = h.days;
    const mL = 6, mR = 62, mT = 10, mB = 24;
    const X = t => mL + (t - xMin) / (xMax - xMin) * (W - mL - mR);
    const Y = p => mT + (hi - p) / (hi - lo) * (H - mT - mB);
    g.font = "11px 'Geist Mono', monospace"; g.fillStyle = css('--fg3'); g.textBaseline = 'middle';
    nice(lo, hi, 5).forEach(v => { const y = Y(v); g.strokeStyle = css('--border'); g.lineWidth = 1; g.beginPath(); g.moveTo(mL, y); g.lineTo(W - mR, y); g.stroke(); g.textAlign = 'left'; g.fillText(short(v), W - mR + 6, y); });
    g.textAlign = 'center'; g.textBaseline = 'alphabetic';
    const span = xMax - xMin;
    nice(xMin, xMax, Math.max(3, Math.floor(W / 110))).forEach(t => {
      const x = X(t); if (x < mL + 24 || x > W - mR - 24) return;
      const d = new Date(t0 + t * 864e5);
      g.fillText(span <= 200 ? d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : d.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' }), x, H - 6);
    });
    const x0 = X(0);
    g.strokeStyle = css('--fg3'); g.setLineDash([3, 4]); g.beginPath(); g.moveTo(x0, mT); g.lineTo(x0, H - mB); g.stroke(); g.setLineDash([]);
    // bands
    const accent = css('--accent') || '#4f6ef7';
    const band = (a, b, alpha) => {
      g.globalAlpha = alpha; g.fillStyle = accent; g.beginPath();
      g.moveTo(x0, Y(c.last)); fan.forEach(f => g.lineTo(X(f[0]), Y(c.last * f[a])));
      for (let i = fan.length - 1; i >= 0; i--) g.lineTo(X(fan[i][0]), Y(c.last * fan[i][b]));
      g.lineTo(x0, Y(c.last)); g.fill(); g.globalAlpha = 1;
    };
    band(1, 5, 0.14); band(2, 4, 0.22);
    // SMA
    g.strokeStyle = css('--orange'); g.lineWidth = 1.4; g.beginPath(); let st = false;
    hist.forEach((p, i) => { const v = sma[i]; if (!v) return; const x = X(tOf(p[0])), y = Y(v); st ? g.lineTo(x, y) : (g.moveTo(x, y), st = true); }); g.stroke();
    // price
    g.strokeStyle = css('--fg'); g.lineWidth = 1.6; g.lineJoin = 'round'; g.beginPath();
    hist.forEach((p, i) => { const x = X(tOf(p[0])), y = Y(p[1]); i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.stroke();
    // median
    g.strokeStyle = accent; g.lineWidth = 2; g.setLineDash([6, 4]); g.beginPath(); g.moveTo(x0, Y(c.last));
    fan.forEach(f => g.lineTo(X(f[0]), Y(c.last * f[3]))); g.stroke(); g.setLineDash([]);
    const e = fan[fan.length - 1];
    g.fillStyle = accent; g.beginPath(); g.arc(X(e[0]), Y(c.last * e[3]), 4, 0, 7); g.fill();
    g.fillStyle = css('--fg'); g.beginPath(); g.arc(x0, Y(c.last), 3, 0, 7); g.fill();
  }
  function nice(a, b, n) {
    const sp = b - a; if (!(sp > 0)) return [a];
    const s0 = sp / n, mag = Math.pow(10, Math.floor(Math.log10(s0))), r = s0 / mag;
    const step = (r < 1.5 ? 1 : r < 3 ? 2 : r < 7 ? 5 : 10) * mag, out = [];
    for (let v = Math.ceil(a / step) * step; v <= b + 1e-12; v += step) out.push(+v.toPrecision(12));
    return out;
  }

  /* ---------- hook into VAULT navigation ---------- */
  const prevGo = window.go;
  window.go = function (p) { prevGo(p); if (p === 'signals') { S.data ? render() : load(); } };
  let rz; window.addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(() => { if (S.data && $('p-signals').classList.contains('active')) drawChart(); }, 150); });
  new MutationObserver(() => { if (S.data) drawChart(); }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  window.reloadSignals = load;
})();

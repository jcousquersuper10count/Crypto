/* VAULT — page « Frais » : ce que t'ont coûté tes mouvements et la gestion, compte par compte.
   - Neverless : frais facturés (colonne Fee : dépôts, certains échanges payés en jetons)
     + écart achat/vente réellement payé : valeur envoyée − valeur reçue de chaque échange,
       aux prix en dollars que Neverless inscrit sur la ligne (c'est le « sans frais » qui coûte quand même).
   - Revolut Crypto : colonne Fees (achats, ventes, envois).
   - Revolut Robo : lignes ROBO MANAGEMENT FEE (frais de gestion mensuels).
   Non visibles dans les relevés : l'écart de prix de Revolut Crypto et les frais annuels internes des ETF.
   Montants calculés en dollars, affichés dans la devise choisie (fv). */
(function () {
  const ACC = [['nev', 'Neverless', 'var(--crypto, var(--accent))'], ['rc', 'Revolut Crypto', 'var(--orange)'], ['rr', 'Revolut Robo', 'var(--etf, var(--accent))']];
  const month = d => (d || '').slice(0, 7);
  const isoRC = s => { // « 26 janv. 2025, 09:30:26 » → 2025-01
    const M = { 'janv': '01', 'févr': '02', 'mars': '03', 'avr': '04', 'mai': '05', 'juin': '06', 'juil': '07', 'août': '08', 'sept': '09', 'oct': '10', 'nov': '11', 'déc': '12' };
    const m = String(s || '').match(/(\d{1,2})\s+([a-zéû]+)\.?\s+(\d{4})/i);
    return m ? `${m[3]}-${M[m[2].toLowerCase()] || '01'}` : '';
  };

  function compute() {
    const r = { nev: { billed: 0, spread: 0, vol: 0, trades: 0, deposits: 0 }, rc: { billed: 0, trade: 0, send: 0, vol: 0 }, rr: { billed: 0, n: 0 }, months: {} };
    const add = (m, k, v) => { if (!m) return; (r.months[m] = r.months[m] || { nev: 0, rc: 0, rr: 0 })[k] += v; };
    (sbTx || []).forEach(t => {
      const m = month(t.Date);
      const fa = pn(t['Fee']), fs = (t['Asset of the fee'] || '').trim();
      if (fa) {
        let p = pn(t['USD price of fee asset']);
        if (!p) p = fs === 'EUR' ? eurUsd : ['USD', 'USDT', 'USDC'].includes(fs) ? 1 : 0;
        const v = fa * p; r.nev.billed += v; add(m, 'nev', v);
        if (t.Type === 'Deposit') r.nev.deposits += v;
      }
      if (t.Type === 'Trade') {
        const s = pn(t['Amount sent']) * pn(t['USD price of asset sent']), g = pn(t['Amount received']) * pn(t['USD price of asset received']);
        if (s > 0 && g > 0) { r.nev.spread += s - g; r.nev.vol += s; r.nev.trades++; add(m, 'nev', s - g); }
      }
    });
    (rcTx || []).forEach(t => {
      const f = pn(String(t.Fees || '').replace(/[^0-9.,]/g, '')) * eurUsd; const m = isoRC(t.Date);
      if (/Achat|Vente/.test(t.Type || '')) r.rc.vol += pn(String(t.Value || '').replace(/[^0-9.,]/g, '')) * eurUsd;
      if (!f) return;
      r.rc.billed += f; add(m, 'rc', f);
      if (/Envoi/.test(t.Type || '')) r.rc.send += f; else r.rc.trade += f;
    });
    (rrTx || []).forEach(t => {
      if (!/MANAGEMENT FEE/i.test(t.Type || '')) return;
      const v = Math.abs(pn(String(t['Total Amount'] || '').replace(/[A-Z]/g, ''))) * eurUsd;
      r.rr.billed += v; r.rr.n++; add(month(t.Date), 'rr', v);
    });
    r.total = r.nev.billed + r.nev.spread + r.rc.billed + r.rr.billed;
    return r;
  }

  function bars(r) {
    const ms = Object.keys(r.months).sort(); if (!ms.length) return '';
    const W = 760, H = 200, P = 64, bw = Math.max(4, (W - P - 10) / ms.length - 3);
    const tot = m => r.months[m].nev + r.months[m].rc + r.months[m].rr;
    const mx = Math.max(...ms.map(tot)) || 1;
    const col = { nev: '#4ce8c8', rc: '#ffcf85', rr: '#8f74ff' };
    let x = P + 4, g = '';
    ms.forEach(m => {
      let y = H - 22;
      ['nev', 'rc', 'rr'].forEach(k => { const h = r.months[m][k] / mx * (H - 40); if (h > 0) { y -= h; g += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}" height="${Math.max(h, 1).toFixed(1)}" rx="2" fill="${col[k]}"><title>${m} · ${k === 'nev' ? 'Neverless' : k === 'rc' ? 'Revolut Crypto' : 'Revolut Robo'} : ${fv(r.months[m][k])}</title></rect>`; } });
      x += bw + 3;
    });
    const lab = [ms[0], ms[Math.floor(ms.length / 2)], ms[ms.length - 1]].map((m, i) => `<text x="${[P + 4, (P + W) / 2, W - 10][i]}" y="${H - 4}" text-anchor="${['start', 'middle', 'end'][i]}" font-size="11" fill="var(--fg3)">${m.slice(5)}/${m.slice(2, 4)}</text>`).join('');
    const peak = ms.reduce((a, m) => tot(m) > tot(a) ? m : a, ms[0]);
    return `<svg viewBox="0 0 ${W} ${H}" class="fe-svg" role="img" aria-label="Frais par mois de ${ms[0]} à ${ms[ms.length - 1]} ; mois le plus cher : ${peak}, ${fv(tot(peak))}">
      <line x1="${P}" y1="${H - 22}" x2="${W}" y2="${H - 22}" stroke="var(--line)"/><text x="${P - 6}" y="${22}" text-anchor="end" font-size="11" fill="var(--fg3)">${fv(mx).replace(/,\d+/, '')}</text>${g}${lab}</svg>`;
  }

  function render() {
    const el = document.getElementById('feesBody'); if (!el) return;
    if (!(sbTx.length || rcTx.length || rrTx.length)) { el.innerHTML = '<p class="fe-note">Chargement des relevés…</p>'; return; }
    const r = compute();
    const pct = (a, b) => b > 0 ? (a / b * 100).toLocaleString('fr-FR', { maximumFractionDigits: 2 }) + ' %' : '–';
    const ms = Object.keys(r.months).sort(), first = ms[0] ? new Date(ms[0] + '-01').toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }) : '';
    el.innerHTML = `
      <div class="fe-hero">
        <div><p class="fe-k">Total des frais${first ? ' depuis ' + first : ''}</p><p class="fe-v">${fv(r.total)}</p>
        <p class="fe-s">dont <b>${fv(r.nev.spread)}</b> d'écart achat/vente sur Neverless, que les relevés n'affichent pas comme des frais</p></div>
        <div class="fe-legend">${ACC.map(([k, l, c]) => { const v = k === 'nev' ? r.nev.billed + r.nev.spread : r[k].billed; return `<span><i style="background:${c}"></i>${l} <b>${fv(v)}</b> <small>${pct(v, r.total)}</small></span>`; }).join('')}</div>
      </div>
      <div class="fe-chart"><h3>Par mois</h3>${bars(r)}</div>
      <div class="fe-grid">
        <div class="fe-card"><h3>Neverless</h3>
          <dl><dt>Écart achat/vente payé</dt><dd>${fv(r.nev.spread)}</dd>
          <dt>Frais facturés</dt><dd>${fv(r.nev.billed)} <small>dont dépôts ${fv(r.nev.deposits)}</small></dd>
          <dt>Échanges</dt><dd>${r.nev.trades.toLocaleString('fr-FR')} pour ${fv(r.nev.vol)} échangés</dd>
          <dt>Coût moyen</dt><dd>${pct(r.nev.spread, r.nev.vol)} par échange</dd></dl>
          <p class="fe-note">« Sans frais » veut dire sans commission : chaque échange paie quand même l'écart entre prix d'achat et de vente. Calculé ligne par ligne : valeur envoyée moins valeur reçue, aux prix inscrits par Neverless.</p></div>
        <div class="fe-card"><h3>Revolut Crypto</h3>
          <dl><dt>Frais facturés</dt><dd>${fv(r.rc.billed)}</dd>
          <dt>Sur achats et ventes</dt><dd>${fv(r.rc.trade)} <small>pour ${fv(r.rc.vol)} échangés</small></dd>
          <dt>Sur envois</dt><dd>${fv(r.rc.send)}</dd></dl>
          <p class="fe-note">L'écart de prix que Revolut prend sur les cryptos n'apparaît pas dans le relevé : il n'est pas compté.</p></div>
        <div class="fe-card"><h3>Revolut Robo</h3>
          <dl><dt>Frais de gestion</dt><dd>${fv(r.rr.billed)}</dd><dt>Prélèvements</dt><dd>${r.rr.n} mensuels</dd></dl>
          <p class="fe-note">Les frais annuels propres aux ETF sont déjà déduits de leur cours : ils ne figurent pas ici.</p></div>
      </div>
      ${r.nev.vol > 0 ? `<div class="fe-lesson"><b>À retenir.</b> Sur Neverless, ${fv(r.nev.vol)} ont été échangés pour une enveloppe qui tourne autour de quelques centaines d'euros : c'est le nombre d'échanges, pas leur taille, qui fait le coût. Moins d'allers-retours, c'est autant de frais en moins.</div>` : ''}`;
  }

  window.renderFees = render;
  const prev = window.go;
  window.go = function (p) { prev(p); if (p === 'fees') render(); };
})();

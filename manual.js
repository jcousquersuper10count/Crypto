/* VAULT — opérations saisies à la main, en attente d'import.
   Chaque saisie est ajoutée aux transactions du compte choisi, au format de ce compte,
   pour compter partout (positions, prix de revient, accueil, points sur les graphiques).
   Quand un import contient la même opération (même actif, même sens, quantité à 3 % près,
   datée entre 2 jours avant et 10 jours après), la saisie est retirée automatiquement.
   Stockage : le script Google (si la clé est enregistrée) et ce navigateur. */
(function () {
  const LS = 'vault_manual', DAY = 864e5;
  let list = [];
  const $ = id => document.getElementById(id);
  const num = v => { v = String(v == null ? '' : v).replace(/[\s €]/g, '').replace(',', '.'); const n = parseFloat(v); return isFinite(n) ? n : NaN; };
  const loadLocal = () => { try { const v = JSON.parse(localStorage.getItem(LS) || '[]'); return Array.isArray(v) ? v : []; } catch (e) { return []; } };
  const saveLocal = () => { try { localStorage.setItem(LS, JSON.stringify(list)); } catch (e) {} };
  async function saveServer() {
    if (window.dataMode !== 'key') return { status: 'ok', local: true };
    return await gasPost({ action: 'manual_save', list });
  }
  const ACCT = { Neverless: 'Neverless', Revolut_Crypto: 'Revolut Crypto', Revolut_Robo: 'Revolut Robo' };
  const fe = n => n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
  const fqty = n => n.toLocaleString('fr-FR', { maximumFractionDigits: 8 });

  /* opérations réelles déjà importées, par compte */
  function realTrades(acct) {
    const o = [];
    if (acct === 'Neverless') sbTx.forEach(t => {
      if (t._manual || t.Type !== 'Trade') return; const d = Date.parse(t.Date);
      if (t['Asset received']) o.push({ sym: t['Asset received'].trim(), side: 'buy', qty: pn(t['Amount received']), t: d });
      if (t['Asset sent']) o.push({ sym: t['Asset sent'].trim(), side: 'sell', qty: pn(t['Amount sent']), t: d });
    });
    if (acct === 'Revolut_Crypto') rcTx.forEach(t => {
      if (t._manual) return; const tp = (t.Type || '').replace(/ /g, ' ').trim();
      if (tp === 'Achat' || tp === 'Vente') o.push({ sym: (t.Symbol || '').trim(), side: tp === 'Achat' ? 'buy' : 'sell', qty: pn(t.Quantity), t: Date.parse(t.Date) });
    });
    if (acct === 'Revolut_Robo') rrTx.forEach(t => {
      if (t._manual) return; const tp = (t.Type || '').toUpperCase();
      if (tp.includes('BUY') || tp.includes('SELL')) o.push({ sym: (t.Ticker || '').trim(), side: tp.includes('BUY') ? 'buy' : 'sell', qty: pn(t.Quantity), t: Date.parse(t.Date) });
    });
    return o;
  }
  function absorbed(entries) {
    const used = new Set(), gone = [];
    const byAcct = {};
    entries.forEach(e => {
      const r = byAcct[e.acct] = byAcct[e.acct] || realTrades(e.acct);
      const t0 = Date.parse(e.date);
      const i = r.findIndex((x, k) => !used.has(e.acct + k) && x.sym === e.sym && x.side === e.side && Math.abs(x.qty - e.qty) <= 0.03 * e.qty && x.t >= t0 - 2 * DAY && x.t <= t0 + 10 * DAY);
      if (i >= 0) { used.add(e.acct + i); gone.push(e.id); }
    });
    return new Set(gone);
  }

  /* une saisie → une ligne au format du compte */
  function toRow(e) {
    const q = +e.qty, p = +e.price, f = +e.fee || 0, v = q * p, s = n => String(+n.toPrecision(12)), r = window.eurUsd || eurUsd;
    if (e.acct === 'Revolut_Crypto') return ['rc', { Symbol: e.sym, Type: e.side === 'buy' ? 'Achat' : 'Vente', Quantity: s(q), Price: s(p) + '€', Value: s(v) + '€', Fees: s(f) + '€', Date: e.date, _manual: e.id }];
    if (e.acct === 'Revolut_Robo') return ['rr', { Date: e.date, Ticker: e.sym, Type: e.side === 'buy' ? 'BUY - MARKET' : 'SELL - MARKET', Quantity: s(q), 'Price per share': 'EUR ' + s(p), 'Total Amount': 'EUR ' + s(e.side === 'buy' ? v + f : v - f), Currency: 'EUR', 'FX Rate': '', _manual: e.id }];
    // Neverless : l'enveloppe est en stablecoin, achats payés et ventes encaissées en USDC
    const buy = e.side === 'buy', usdc = v * eurUsd, fu = f * eurUsd;
    return ['sb', { Type: 'Trade', Date: e.date, Description: 'Saisi à la main',
      'Amount received': s(buy ? q : usdc - fu), 'Asset received': buy ? e.sym : 'USDC',
      'Amount sent': s(buy ? usdc + fu : q), 'Asset sent': buy ? 'USDC' : e.sym,
      Fee: '', 'Asset of the fee': '',
      'USD price of asset received': s(buy ? p * eurUsd : 1), 'USD price of asset sent': s(buy ? 1 : p * eurUsd), 'USD price of fee asset': '', _manual: e.id }];
  }

  /* appelé par loadSheets, juste avant le calcul des positions */
  window.applyManual = function () {
    sbTx = sbTx.filter(t => !t._manual); rcTx = rcTx.filter(t => !t._manual); rrTx = rrTx.filter(t => !t._manual);
    const local = loadLocal();
    let push = false;
    if (window.dataMode === 'key' && Array.isArray(window.serverManual)) {
      list = window.serverManual.slice();
      if (!list.length && local.length && !window._manualPushed) { list = local; push = true; window._manualPushed = true; }
      window.serverManual = null;
    } else if (!list.length) list = local;
    const gone = absorbed(list);
    if (gone.size) { list = list.filter(e => !gone.has(e.id)); push = true; window.manualAbsorbed = gone.size; }
    list.forEach(e => { const [k, row] = toRow(e); if (k === 'rc') rcTx.push(row); else if (k === 'rr') rrTx.push(row); else sbTx.push(row); });
    saveLocal();
    if (push) saveServer();
    renderList();
  };

  function renderList() {
    const n = list.length, c = $('moCount');
    if (c) { c.hidden = !n; c.textContent = n; }
    const sorted = list.slice().sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
    const li = sorted.map(e => `<li><span class="mo-side ${e.side}">${e.side === 'buy' ? 'Achat' : 'Vente'}</span><span><b>${fqty(+e.qty)} ${e.sym}</b> à ${fe(+e.price)}<small>${ACCT[e.acct]} · ${new Date(e.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</small></span><button type="button" class="mo-del" onclick="delManual('${e.id}')" aria-label="Supprimer cette saisie">Supprimer</button></li>`).join('');
    const ul = $('moList'); if (ul) ul.innerHTML = li || '<li class="muted">Aucune opération en attente.</li>';
    const imp = $('moImp');
    if (imp) {
      const ab = window.manualAbsorbed ? ` ${window.manualAbsorbed} saisie${window.manualAbsorbed > 1 ? 's ont' : ' a'} été retrouvée${window.manualAbsorbed > 1 ? 's' : ''} dans le dernier import et retirée${window.manualAbsorbed > 1 ? 's' : ''}.` : '';
      imp.innerHTML = (n ? `<b>${n}</b> opération${n > 1 ? 's' : ''} en attente, comptée${n > 1 ? 's' : ''} dans tes positions. Elles disparaissent d'elles-mêmes quand l'import les contient. <button type="button" class="imp-cancel" onclick="openManual()">Voir</button>` : 'Aucune opération en attente.') + ab
        + (window.dataMode === 'key' ? '' : ' <span class="muted">Sans clé, elles ne sont gardées que dans ce navigateur.</span>');
    }
  }

  function heldQty(acct, sym) {
    const b = acct === 'Neverless' ? compSBraw(sbTx) : acct === 'Revolut_Crypto' ? compRC(rcTx) : compRR(rrTx);
    return b[sym] || 0;
  }
  function eurPrice(sym) {
    if (typeof etfP !== 'undefined' && etfP[sym] && etfP[sym].eur) return etfP[sym].eur;
    if (typeof prices !== 'undefined' && prices[sym] && prices[sym].p) return prices[sym].p / eurUsd;
    return 0;
  }

  window.openManual = function () {
    const d = $('moDlg'); if (!d) return;
    const syms = new Set([...Object.keys(cryptoH || {}), ...Object.keys(etfH || {}), ...Object.keys(CGM)]);
    $('moSyms').innerHTML = [...syms].sort().map(s => `<option value="${s}">`).join('');
    const now = new Date(); now.setSeconds(0, 0);
    $('moDate').value = new Date(now - now.getTimezoneOffset() * 6e4).toISOString().slice(0, 16);
    try { const a = localStorage.getItem('vault_manual_acct'); if (a) $('moAcct').value = a; } catch (e) {}
    $('moErr').textContent = ''; renderList(); moTot();
    d.showModal(); $('moSym').focus();
  };
  window.closeManual = () => $('moDlg').close();
  window.moFill = function () {
    const s = $('moSym').value.trim().toUpperCase(); const p = eurPrice(s);
    if (p) $('moPx').value = String(+p.toPrecision(6)).replace('.', ',');
    if (typeof ETFY !== 'undefined' && ETFY[s]) $('moAcct').value = 'Revolut_Robo';
    else if ($('moAcct').value === 'Revolut_Robo' && CGM[s]) $('moAcct').value = 'Revolut_Crypto';
    moTot();
  };
  window.moTot = function () {
    const q = num($('moQty').value), p = num($('moPx').value), f = num($('moFee').value) || 0;
    const side = document.querySelector('input[name=moSide]:checked').value;
    $('moTot').innerHTML = q > 0 && p > 0 ? `${side === 'buy' ? 'Tu paies' : 'Tu reçois'} <b>${fe(side === 'buy' ? q * p + f : q * p - f)}</b>` : '';
  };
  document.addEventListener('change', e => { if (e.target && e.target.name === 'moSide') moTot(); });

  window.addManual = async function (ev) {
    ev.preventDefault();
    const err = t => { $('moErr').textContent = t; return false; };
    const sym = $('moSym').value.trim().toUpperCase(), acct = $('moAcct').value;
    const side = document.querySelector('input[name=moSide]:checked').value;
    const qty = num($('moQty').value), price = num($('moPx').value), fee = num($('moFee').value) || 0;
    const dt = new Date($('moDate').value);
    if (!/^[A-Z0-9.]{1,15}$/.test(sym)) return err('Actif invalide.');
    if (!(qty > 0)) return err('Quantité invalide.');
    if (!(price > 0)) return err('Prix invalide.');
    if (isNaN(dt) || dt > Date.now() + 36e5) return err('Date invalide (pas dans le futur).');
    if (side === 'sell') {
      const h = heldQty(acct, sym);
      if (qty > h * 1.0001 + 1e-9) return err(`Tu ne détiens que ${fqty(Math.max(0, h))} ${sym} sur ${ACCT[acct]}.`);
    }
    const e = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), acct, side, sym, qty: +qty.toPrecision(12), price: +price.toPrecision(12), fee: +fee.toPrecision(8), date: dt.toISOString() };
    const before = list.slice();
    list.push(e); saveLocal();
    const j = await saveServer();
    if (!j || j.status !== 'ok') { list = before; saveLocal(); return err('Non enregistré : ' + ((j && j.message) || 'script injoignable') + '.'); }
    try { localStorage.setItem('vault_manual_acct', acct); } catch (x) {}
    $('moQty').value = ''; $('moFee').value = '0'; $('moSym').value = ''; $('moTot').innerHTML = '';
    await recompute();
    $('moErr').textContent = '';
    closeManual();
    if (typeof setS === 'function') setS(`${side === 'buy' ? 'Achat' : 'Vente'} ${sym} ajouté${side === 'sell' ? 'e' : ''}`, true);
    return false;
  };
  window.delManual = async function (id) {
    const before = list.slice();
    list = list.filter(e => e.id !== id); saveLocal();
    const j = await saveServer();
    if (!j || j.status !== 'ok') { list = before; saveLocal(); $('moErr').textContent = 'Suppression non enregistrée.'; renderList(); return; }
    await recompute();
  };

  async function recompute() {
    window.applyManual(); merge(); popFilter(); renderHist();
    try { await loadPrices(); } catch (e) { renderH(); renderSum(); }
    try { const ap = document.querySelector('.page.active'); if (ap && ap.id === 'p-performance' && typeof renderPerf === 'function') renderPerf(); } catch (e) {}
    try { window.renderHome && window.renderHome(); } catch (e) {}
    try { window.renderSignals && window.renderSignals(); } catch (e) {}
    renderList();
  }
  document.addEventListener('DOMContentLoaded', renderList);
})();

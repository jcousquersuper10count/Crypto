// ============================================================
// VAULT — Crypto + ETF Portfolio Dashboard
// ============================================================

// ===== Configuration =====
const SHEET_ID = '18VynzaZPeJTbdn4Hwxeslre1A8_H7_zdBQu9OWd7E_8';
const PUB_ID = '2PACX-1vQHtSe6vE3WSfSsoW15kEaKv75UYpRGM0QJ26_MJlys7ML1NPid2b_Ys6jII04owAH9v4NfOelpVsAm';

// Sheet URLs — each tab published as CSV
// User must "Publish to Web" each sheet tab individually or the whole document
// The gid parameter selects the sheet tab (0 = first tab)
// For named sheets, we use the gviz endpoint
const SHEET_URLS_SWISSBORG = [
    `https://docs.google.com/spreadsheets/d/e/${PUB_ID}/pub?output=csv&gid=0`,
    `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=Sheet1`,
    `https://api.allorigins.win/raw?url=${encodeURIComponent(`https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=0`)}`,
];

// Revolut tabs — user will create these tabs and paste their CSV data
const SHEET_URLS_REVOLUT_CRYPTO = [
    `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=Revolut_Crypto`,
    `https://docs.google.com/spreadsheets/d/e/${PUB_ID}/pub?output=csv&sheet=Revolut_Crypto`,
];

const SHEET_URLS_REVOLUT_ROBO = [
    `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=Revolut_Robo`,
    `https://docs.google.com/spreadsheets/d/e/${PUB_ID}/pub?output=csv&sheet=Revolut_Robo`,
];

// CoinGecko
const CG_BASE = 'https://api.coingecko.com/api/v3';

// Apps Script for portfolio logging
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwJbGQ9SqkQQ5nVhGU_vW5oDWbtb0uEJpaQVf0TtUy0gRRLBdSrJmymlRBhls7O4rot/exec';

// CoinGecko ID map
const COINGECKO_MAP = {
    'BTC': 'bitcoin', 'ETH': 'ethereum', 'SOL': 'solana', 'XRP': 'ripple',
    'ADA': 'cardano', 'DOGE': 'dogecoin', 'AVAX': 'avalanche-2', 'LINK': 'chainlink',
    'UNI': 'uniswap', 'AAVE': 'aave', 'COMP': 'compound-governance-token',
    'RENDER': 'render-token', 'FET': 'artificial-superintelligence-alliance',
    'ARB': 'arbitrum', 'OP': 'optimism', 'POL': 'polygon-ecosystem-token',
    'HBAR': 'hedera-hashgraph', 'ALGO': 'algorand', 'SUI': 'sui',
    'TAO': 'bittensor', 'PEPE': 'pepe', 'BONK': 'bonk', 'FLOKI': 'floki',
    'NOT': 'notcoin', 'JUP': 'jupiter-exchange-solana', 'PYTH': 'pyth-network',
    'S': 'sonic-svm', 'W': 'wormhole', 'USDC': 'usd-coin', 'USDT': 'tether',
    'EURC': 'euro-coin', 'MOODENG': 'moo-deng', 'ACT': 'act-i-the-ai-prophecy',
    'POPCAT': 'popcat', 'L3': 'layer3', 'DEGEN': 'degen-base',
    'GRASS': 'grass', 'ENA': 'ethena', 'ANKR': 'ankr', 'CKB': 'nervos-network',
    'RSR': 'reserve-rights-token', 'TURBO': 'turbo', 'NMR': 'numeraire',
    'TON': 'the-open-network', 'CFX': 'conflux-token', 'MNT': 'mantle',
    'CORE': 'coredaoorg', 'JASMY': 'jasmycoin', 'WLD': 'worldcoin-wld',
    'VIRTUAL': 'virtuals-protocol', 'AIOZ': 'aioz-network', 'PENDLE': 'pendle',
    'ASTER': 'aster-defi', 'LTC': 'litecoin', 'BCH': 'bitcoin-cash',
    'CAKE': 'pancakeswap-token', 'STEEM': 'steem', 'XAU': 'pax-gold',
    'BABYDOGE': 'baby-doge-coin', 'CHILLGUY': 'just-a-chill-guy',
    'ELON': 'dogelon-mars', 'VET': 'vechain', 'SUPER': 'superfarm',
    'AERO': 'aerodrome-finance', 'PI': 'pi-network', 'AR': 'arweave',
    'LUNA': 'terra-luna-2', 'RECALL': 'recall', 'GOAT': 'goatseus-maximus',
    'SAMO': 'samoyedcoin', 'CTXC': 'cortex', 'MOG': 'mog-coin',
    'API3': 'api3', 'IO': 'io-net', 'FORTH': 'ampleforth-governance-token',
    'TAI': 'tars-protocol', 'AMP': 'amp-token', 'IQ': 'everipedia',
    'HMSTR': 'hamster-kombat', 'MDToken': 'measurable-data-token',
    'BMT': 'bmt-token', 'HIFI': 'hifi-finance', 'MXC': 'mxc',
    'IDEX': 'aurora-dao', 'CAT': 'simon-s-cat', 'SATS': '1000sats',
    'QI': 'benqi', 'DUCK': 'duck-chain',
    'ai16z': 'ai16z', 'CETUS': 'cetus-protocol',
    '$WIF': 'dogwifcoin', '$COLLAT': null, 'FLOYDAI': null, 'X': null,
    'ATOM': 'cosmos', 'MEW': 'cat-in-a-dogs-world', 'DOT': 'polkadot',
    'SEI': 'sei-network', 'CRO': 'crypto-com-chain', 'ROSE': 'oasis-network',
    'LMWR': 'limewire-token', 'ZKJ': 'polyhedra-network'
};

// ETF name map (ticker -> full name)
const ETF_NAMES = {
    '2B72': 'Amundi MSCI Emerging Markets II', 'WELK': 'Amundi MSCI World Climate Paris',
    'EBUY': 'Amundi MSCI World Ex-Europe', 'AMEL': 'Amundi MSCI Emerging Markets III',
    'LYMS': 'Amundi MSCI EM Asia', 'LEMA': 'Amundi MSCI EM Latin America',
    'XDWI': 'Xtrackers MSCI World IT', 'PRAJ': 'Amundi Prime Japan',
    '79U0': 'Amundi MSCI USA', 'LYP5': 'Amundi MSCI World',
    'UBUD': 'UBS MSCI Japan SF', 'LYP6': 'Amundi Stoxx Europe 600',
    'LGQK': 'L&G Quality Equity Dividends ESG', 'EXW1': 'iShares EURO STOXX 50',
    'EXI2': 'iShares DJ Global Titans 50', 'XUCD': 'Xtrackers MSCI USA Consumer',
    'IS3Q': 'iShares MSCI World Quality', 'IS3K': 'iShares High Yield Corp Bond',
    'XDWT': 'Xtrackers MSCI World IT', 'AMEM': 'Amundi MSCI Emerging Markets',
    'DBXJ': 'Xtrackers MSCI Japan',
};

// ===== State =====
let swissborgTx = [];
let revolutCryptoTx = [];
let revolutRoboTx = [];
let cryptoHoldings = {};  // merged crypto holdings
let etfHoldings = {};     // ETF holdings {ticker: qty}
let prices = {};
let etfPrices = {};
let marketData = [];
let portfolioHistory = [];
let selectedPeriod = 7;
let fearGreedData = null;
let currentSort = { col: 'value', dir: 'desc' };

// ===== CSV Parsing =====
function parseCSV(text) {
    const lines = text.split('\n');
    if (lines.length < 2) return [];
    const headers = parseCSVLine(lines[0]);
    const rows = [];
    for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;
        const values = parseCSVLine(lines[i]);
        const row = {};
        headers.forEach((h, idx) => { row[h.trim()] = (values[idx] || '').trim(); });
        rows.push(row);
    }
    return rows;
}

function parseCSVLine(line) {
    const result = [];
    let current = '', inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') inQuotes = !inQuotes;
        else if (ch === ',' && !inQuotes) { result.push(current); current = ''; }
        else current += ch;
    }
    result.push(current);
    return result;
}

function parseNum(s) {
    if (!s) return 0;
    s = s.trim().replace(/"/g, '').replace(/\xa0/g, '').replace(/\s/g, '').replace(/€/g, '').replace(/\$/g, '');
    if (s.includes('E+') || s.includes('E-') || s.includes('e+') || s.includes('e-')) {
        s = s.replace(',', '.');
        return parseFloat(s) || 0;
    }
    // French format: space as thousands, comma as decimal
    if (s.includes(',') && !s.includes('.')) s = s.replace(',', '.');
    return parseFloat(s) || 0;
}

// ===== Fetch CSV with fallbacks =====
async function fetchCSV(urls, label) {
    for (const url of urls) {
        try {
            const resp = await fetch(url);
            if (!resp.ok) continue;
            const text = await resp.text();
            if (text.length > 50 && !text.includes('<!DOCTYPE')) {
                console.log(`✓ ${label} loaded`);
                return text;
            }
        } catch(e) { }
    }
    console.warn(`✗ ${label}: all URLs failed`);
    return null;
}

// ===== Compute Holdings =====
function computeSwissborgHoldings(txns) {
    const bal = {};
    const fiat = new Set(['EUR', 'USD']);
    txns.forEach(tx => {
        const ra = parseNum(tx['Amount received']), rs = tx['Asset received'] || '';
        const sa = parseNum(tx['Amount sent']), ss = tx['Asset sent'] || '';
        const fa = parseNum(tx['Fee']), fs = tx['Asset of the fee'] || '';
        if (ra && rs && !fiat.has(rs)) bal[rs] = (bal[rs] || 0) + ra;
        if (sa && ss && !fiat.has(ss)) bal[ss] = (bal[ss] || 0) - sa;
        if (fa && fs && !fiat.has(fs)) bal[fs] = (bal[fs] || 0) - fa;
    });
    return bal;
}

function computeRevolutCryptoHoldings(txns) {
    const bal = {};
    txns.forEach(tx => {
        const sym = (tx['Symbol'] || '').trim();
        const typ = (tx['Type'] || '').trim();
        const qty = parseNum(tx['Quantity']);
        if (!sym || !qty) return;
        if (['Achat', 'Récompense de staking', 'Récompense Apprendre'].includes(typ)) {
            bal[sym] = (bal[sym] || 0) + qty;
        } else if (typ === 'Vente') {
            bal[sym] = (bal[sym] || 0) - qty;
        }
        // 'Mise en staking' and 'Envoi' don't change balance (internal move)
    });
    return bal;
}

function computeRevolutRoboHoldings(txns) {
    const bal = {};
    txns.forEach(tx => {
        const ticker = (tx['Ticker'] || '').trim();
        const typ = (tx['Type'] || '').trim();
        const qty = parseNum(tx['Quantity']);
        if (!ticker || !qty) return;
        if (typ.includes('BUY')) bal[ticker] = (bal[ticker] || 0) + qty;
        else if (typ.includes('SELL')) bal[ticker] = (bal[ticker] || 0) - qty;
    });
    return bal;
}

function mergeHoldings() {
    cryptoHoldings = {};
    const sb = computeSwissborgHoldings(swissborgTx);
    const rc = computeRevolutCryptoHoldings(revolutCryptoTx);

    // Merge
    for (const [sym, qty] of Object.entries(sb)) {
        cryptoHoldings[sym] = (cryptoHoldings[sym] || 0) + qty;
    }
    for (const [sym, qty] of Object.entries(rc)) {
        cryptoHoldings[sym] = (cryptoHoldings[sym] || 0) + qty;
    }

    // Filter dust
    for (const sym of Object.keys(cryptoHoldings)) {
        if (Math.abs(cryptoHoldings[sym]) < 0.0000001) delete cryptoHoldings[sym];
    }

    // ETFs
    etfHoldings = {};
    const robo = computeRevolutRoboHoldings(revolutRoboTx);
    for (const [ticker, qty] of Object.entries(robo)) {
        if (qty > 0.0001) etfHoldings[ticker] = qty;
    }
}

// ===== Source detection =====
function getSource(sym) {
    const inSB = computeSwissborgHoldings(swissborgTx)[sym] > 0.0000001;
    const inRC = computeRevolutCryptoHoldings(revolutCryptoTx)[sym] > 0.0000001;
    if (inSB && inRC) return 'Multi';
    if (inRC) return 'Revolut';
    return 'SwissBorg';
}

// ===== Fetch Prices =====
async function fetchPrices(assetList) {
    const ids = [], idToSym = {};
    assetList.forEach(sym => {
        const id = COINGECKO_MAP[sym];
        if (id) { ids.push(id); idToSym[id] = sym; }
    });
    if (!ids.length) return {};

    const priceData = {};
    for (let i = 0; i < ids.length; i += 50) {
        const batch = ids.slice(i, i + 50);
        try {
            const resp = await fetch(`${CG_BASE}/coins/markets?vs_currency=usd&ids=${batch.join(',')}&order=market_cap_desc&sparkline=false&price_change_percentage=24h,7d,30d,1y`);
            if (resp.ok) {
                const data = await resp.json();
                data.forEach(c => {
                    const sym = idToSym[c.id];
                    if (sym) priceData[sym] = {
                        price: c.current_price || 0,
                        change24h: c.price_change_percentage_24h || 0,
                        change7d: c.price_change_percentage_7d_in_currency || 0,
                        change30d: c.price_change_percentage_30d_in_currency || 0,
                        change1y: c.price_change_percentage_1y_in_currency || 0,
                        marketCap: c.market_cap || 0,
                        image: c.image || '', name: c.name || sym,
                        rank: c.market_cap_rank || 999
                    };
                });
            }
            if (i + 50 < ids.length) await sleep(1500);
        } catch(e) { console.warn('CG error:', e); }
    }
    return priceData;
}

async function fetchETFPrices() {
    etfPrices = {};
    const tickers = Object.keys(etfHoldings);
    for (const ticker of tickers) {
        for (const suffix of ['.DE', '.PA', '.AS', '.L']) {
            try {
                const url = `https://api.allorigins.win/raw?url=${encodeURIComponent(`https://query1.finance.yahoo.com/v8/finance/chart/${ticker}${suffix}?interval=1d&range=5d`)}`;
                const resp = await fetch(url);
                if (resp.ok) {
                    const data = await resp.json();
                    const p = data?.chart?.result?.[0]?.meta?.regularMarketPrice;
                    const cur = data?.chart?.result?.[0]?.meta?.currency || 'EUR';
                    if (p) { etfPrices[ticker] = { price: p, currency: cur, name: ETF_NAMES[ticker] || ticker }; break; }
                }
            } catch(e) {}
        }
        if (!etfPrices[ticker]) etfPrices[ticker] = { price: 0, currency: 'EUR', name: ETF_NAMES[ticker] || ticker };
    }
}

async function fetchMarketData() {
    try {
        // Fetch top 50 + explicitly include GRASS
        const grassId = 'grass';
        const resp = await fetch(`${CG_BASE}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=50&page=1&sparkline=false&price_change_percentage=24h,7d,30d,1y`);
        if (!resp.ok) return [];
        const data = await resp.json();

        // Check if GRASS is already in top 50
        const hasGrass = data.some(c => c.id === grassId);
        if (!hasGrass) {
            try {
                const resp2 = await fetch(`${CG_BASE}/coins/markets?vs_currency=usd&ids=${grassId}&sparkline=false&price_change_percentage=24h,7d,30d,1y`);
                if (resp2.ok) {
                    const extra = await resp2.json();
                    data.push(...extra);
                }
            } catch(e) {}
        }

        // Also add any held crypto not in the list
        const inList = new Set(data.map(c => c.id));
        const missing = Object.keys(cryptoHoldings)
            .filter(sym => cryptoHoldings[sym] > 0.0000001)
            .map(sym => COINGECKO_MAP[sym])
            .filter(id => id && !inList.has(id));

        if (missing.length > 0) {
            try {
                await sleep(1200);
                const resp3 = await fetch(`${CG_BASE}/coins/markets?vs_currency=usd&ids=${missing.join(',')}&sparkline=false&price_change_percentage=24h,7d,30d,1y`);
                if (resp3.ok) {
                    const extra2 = await resp3.json();
                    data.push(...extra2);
                }
            } catch(e) {}
        }

        return data;
    } catch(e) { return []; }
}

async function fetchFearGreed() {
    try {
        const resp = await fetch('https://api.alternative.me/fng/?limit=1');
        if (resp.ok) {
            const data = await resp.json();
            if (data.data && data.data[0]) {
                fearGreedData = { value: parseInt(data.data[0].value), label: data.data[0].value_classification };
            }
        }
    } catch(e) { console.warn('F&G error:', e); }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ===== Build unified items =====
function getAllItems() {
    const items = [];

    // Crypto
    for (const [sym, qty] of Object.entries(cryptoHoldings)) {
        if (qty <= 0.0000001) continue;
        const p = prices[sym] || {};
        items.push({
            sym, qty, price: p.price || 0, value: qty * (p.price || 0),
            change24h: p.change24h || 0, change7d: p.change7d || 0,
            change30d: p.change30d || 0, change1y: p.change1y || 0,
            image: p.image || '', name: p.name || sym,
            type: 'crypto', source: getSource(sym)
        });
    }

    // ETFs
    for (const [ticker, qty] of Object.entries(etfHoldings)) {
        const ep = etfPrices[ticker] || {};
        const priceUSD = ep.currency === 'EUR' ? (ep.price || 0) * 1.09 : (ep.price || 0);
        items.push({
            sym: ticker, qty, price: priceUSD, value: qty * priceUSD,
            change24h: 0, change7d: 0, change30d: 0, change1y: 0,
            image: '', name: ep.name || ETF_NAMES[ticker] || ticker,
            type: 'etf', source: 'Robo-Advisor'
        });
    }

    return items;
}

// ===== Rendering =====
function renderHoldings() {
    const tbody = document.getElementById('holdingsBody');
    let items = getAllItems().filter(i => i.value >= 10);

    // Sort
    items.sort((a, b) => {
        let va, vb;
        switch (currentSort.col) {
            case 'name': va = a.sym.toLowerCase(); vb = b.sym.toLowerCase(); return currentSort.dir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
            case 'qty': va = a.qty; vb = b.qty; break;
            case 'price': va = a.price; vb = b.price; break;
            case 'value': va = a.value; vb = b.value; break;
            case 'change24h': va = a.change24h; vb = b.change24h; break;
            case 'change7d': va = a.change7d; vb = b.change7d; break;
            case 'change30d': va = a.change30d; vb = b.change30d; break;
            case 'change1y': va = a.change1y; vb = b.change1y; break;
            case 'alloc': va = a.value; vb = b.value; break;
            default: va = a.value; vb = b.value;
        }
        return currentSort.dir === 'asc' ? va - vb : vb - va;
    });

    const totalValue = items.reduce((s, i) => s + i.value, 0);

    if (!items.length) {
        tbody.innerHTML = '<tr><td colspan="9" class="loading-cell">Aucune position ≥ 10$ trouvée</td></tr>';
        return;
    }

    function fmtCh(val, isEtf) {
        if (isEtf) return '<td class="change-na">—</td>';
        const cls = val >= 0 ? 'change-positive' : 'change-negative';
        return `<td class="${cls}">${val >= 0 ? '+' : ''}${val.toFixed(2)}%</td>`;
    }

    function srcTag(s) {
        const c = { SwissBorg: '#06d6a0', Revolut: '#0075eb', Multi: '#8b5cf6', 'Robo-Advisor': '#ea580c' }[s] || '#94a3b8';
        return `<span style="font-size:0.6rem;font-family:var(--font-mono);background:${c}15;color:${c};padding:0.1rem 0.4rem;border-radius:3px;margin-left:0.3rem">${s}</span>`;
    }

    tbody.innerHTML = items.map(item => {
        const alloc = totalValue > 0 ? (item.value / totalValue * 100) : 0;
        const isEtf = item.type === 'etf';
        return `<tr>
            <td><div class="asset-cell">
                <div class="asset-icon" ${isEtf ? 'style="background:#ea580c15;color:#ea580c;border-color:#ea580c30"' : ''}>
                    ${item.image ? `<img src="${item.image}" alt="${item.sym}" onerror="this.parentElement.textContent='${item.sym.slice(0,2)}'">` : item.sym.slice(0,2)}
                </div>
                <div>
                    <div class="asset-name">${isEtf ? item.sym : item.name} ${srcTag(item.source)}</div>
                    <div class="asset-symbol">${isEtf ? item.name.substring(0,35) : item.sym}</div>
                </div>
            </div></td>
            <td class="qty-cell">${formatQty(item.qty)}</td>
            <td class="price-cell">${item.price > 0 ? formatUSD(item.price) : '—'}</td>
            <td class="value-cell">${item.value > 0 ? formatUSD(item.value) : '—'}</td>
            ${fmtCh(item.change24h, isEtf)}
            ${fmtCh(item.change7d, isEtf)}
            ${fmtCh(item.change30d, isEtf)}
            ${fmtCh(item.change1y, isEtf)}
            <td><div class="alloc-bar-wrap">
                <div class="alloc-bar"><div class="alloc-bar-fill" style="width:${Math.min(alloc,100)}%"></div></div>
                <span class="alloc-pct">${alloc.toFixed(1)}%</span>
            </div></td>
        </tr>`;
    }).join('');
}

function sortTable(col) {
    if (currentSort.col === col) currentSort.dir = currentSort.dir === 'desc' ? 'asc' : 'desc';
    else { currentSort.col = col; currentSort.dir = 'desc'; }
    // Update header arrows
    document.querySelectorAll('.holdings-table th').forEach(th => th.classList.remove('sort-asc','sort-desc'));
    const th = document.querySelector(`.holdings-table th[data-col="${col}"]`);
    if (th) th.classList.add(currentSort.dir === 'asc' ? 'sort-asc' : 'sort-desc');
    renderHoldings();
}

function renderSummary() {
    const items = getAllItems();
    const totalValue = items.reduce((s, i) => s + i.value, 0);
    const cryptoValue = items.filter(i => i.type === 'crypto').reduce((s, i) => s + i.value, 0);
    const etfValue = items.filter(i => i.type === 'etf').reduce((s, i) => s + i.value, 0);
    const positiveCount = items.filter(i => i.value >= 10).length;

    document.getElementById('totalValue').textContent = formatUSD(totalValue);
    document.getElementById('assetCount').textContent = positiveCount;

    // Crypto vs ETF breakdown
    const breakdownEl = document.getElementById('breakdown');
    if (breakdownEl) {
        breakdownEl.innerHTML = `<span style="color:var(--accent)">Crypto ${formatUSD(cryptoValue)}</span> · <span style="color:#ea580c">ETF ${formatUSD(etfValue)}</span>`;
    }

    // Weighted 24h change (crypto only)
    const cryptoItems = items.filter(i => i.type === 'crypto' && i.value >= 10);
    const cryptoTotal = cryptoItems.reduce((s, i) => s + i.value, 0);
    if (cryptoTotal > 0) {
        const wavg = cryptoItems.reduce((s, i) => s + (i.change24h * i.value), 0) / cryptoTotal;
        const el = document.getElementById('totalChange');
        el.textContent = `${wavg >= 0 ? '▲' : '▼'} ${wavg >= 0 ? '+' : ''}${wavg.toFixed(2)}% (24h crypto)`;
        el.className = `total-change ${wavg >= 0 ? 'change-positive' : 'change-negative'}`;
    }

    // Total invested
    let inv = 0;
    swissborgTx.forEach(tx => {
        if (tx.Type === 'Deposit' && ['EUR','USD'].includes(tx['Asset received'])) inv += parseNum(tx['Amount received']);
    });
    // Add Revolut Robo cash top-ups
    revolutRoboTx.forEach(tx => {
        if ((tx['Type']||'').includes('CASH TOP-UP')) {
            const amt = (tx['Total Amount']||'').replace(/[^0-9.,]/g,'');
            inv += parseNum(amt);
        }
    });
    document.getElementById('totalInvested').textContent = `€${inv.toFixed(0)}`;

    const pnl = totalValue - inv;
    const pnlEl = document.getElementById('totalPnl');
    pnlEl.textContent = `${pnl >= 0 ? '+' : ''}${formatUSD(pnl)}`;
    pnlEl.className = `summary-card-value ${pnl >= 0 ? 'change-positive' : 'change-negative'}`;

    // Best asset
    const best = cryptoItems.sort((a, b) => b.change24h - a.change24h)[0];
    if (best) {
        const el = document.getElementById('bestAsset');
        el.textContent = `${best.sym} ${best.change24h >= 0 ? '+' : ''}${best.change24h.toFixed(1)}%`;
        el.className = `summary-card-value ${best.change24h >= 0 ? 'change-positive' : 'change-negative'}`;
    }

    // Fear & Greed
    renderFearGreed();
}

function renderFearGreed() {
    const el = document.getElementById('fearGreed');
    if (!el || !fearGreedData) return;
    const v = fearGreedData.value;
    let color = '#ef4444';
    if (v > 75) color = '#16a34a';
    else if (v > 55) color = '#22c55e';
    else if (v > 45) color = '#f59e0b';
    else if (v > 25) color = '#f97316';
    el.innerHTML = `
        <div style="text-align:center">
            <div style="font-size:2.2rem;font-weight:700;color:${color};font-family:var(--font-display)">${v}</div>
            <div style="font-size:0.75rem;color:${color};font-family:var(--font-mono);font-weight:600">${fearGreedData.label}</div>
            <div style="width:100%;height:6px;background:var(--bg-secondary);border-radius:3px;margin-top:0.5rem;overflow:hidden">
                <div style="width:${v}%;height:100%;background:${color};border-radius:3px"></div>
            </div>
        </div>`;
}

function renderMarket() {
    const grid = document.getElementById('marketGrid');
    if (!marketData.length) { grid.innerHTML = '<div class="loading-cell">Données non disponibles</div>'; return; }

    const ownedSyms = new Set(Object.entries(cryptoHoldings).filter(([s,q]) => q > 0.0000001).map(([s]) => s.toUpperCase()));

    const sorted = [...marketData].sort((a, b) => {
        const ao = ownedSyms.has(a.symbol.toUpperCase()) ? 0 : 1;
        const bo = ownedSyms.has(b.symbol.toUpperCase()) ? 0 : 1;
        if (ao !== bo) return ao - bo;
        return (a.market_cap_rank || 999) - (b.market_cap_rank || 999);
    });

    grid.innerHTML = sorted.map(c => {
        const ch = c.price_change_percentage_24h || 0;
        const cls = ch >= 0 ? 'change-positive' : 'change-negative';
        const owned = ownedSyms.has(c.symbol.toUpperCase());
        return `<div class="market-card ${owned ? 'owned' : ''}" data-name="${c.name.toLowerCase()} ${c.symbol}">
            <div class="market-card-top">
                <div class="market-card-asset">
                    <div class="asset-icon"><img src="${c.image}" alt="${c.symbol}" onerror="this.parentElement.textContent='${c.symbol.slice(0,2).toUpperCase()}'"></div>
                    <div><div class="asset-name">${c.symbol.toUpperCase()}</div><div class="asset-symbol">${c.name}</div></div>
                </div>
                ${owned ? '<span class="market-card-owned-badge">EN PORTEFEUILLE</span>' : ''}
                <span class="market-card-rank">#${c.market_cap_rank || '--'}</span>
            </div>
            <div class="market-card-price">${formatUSD(c.current_price)}</div>
            <div class="market-card-bottom">
                <span class="${cls}">${ch >= 0 ? '+' : ''}${ch.toFixed(2)}%</span>
                <span class="market-card-mcap">MCap: ${formatCompact(c.market_cap)}</span>
            </div>
        </div>`;
    }).join('');
}

function renderHistory() {
    const list = document.getElementById('historyList');
    const typeFilter = document.getElementById('historyType').value;
    const assetFilter = document.getElementById('historyAsset').value;

    // Unify all transactions into a common format
    let allTx = [];

    // SwissBorg
    swissborgTx.forEach(tx => {
        const d = tx.Date ? new Date(tx.Date) : null;
        allTx.push({
            date: d, type: tx.Type || '', source: 'SwissBorg',
            recvQty: parseNum(tx['Amount received']), recvAsset: tx['Asset received'] || '',
            sentQty: parseNum(tx['Amount sent']), sentAsset: tx['Asset sent'] || '',
            desc: tx.Description || ''
        });
    });

    // Revolut Crypto
    revolutCryptoTx.forEach(tx => {
        const dateStr = (tx['Date'] || '').trim();
        let d = null;
        // Parse French date format: "26 janv. 2025, 09:30:26"
        try {
            const months = {janv:'Jan',févr:'Feb',mars:'Mar',avr:'Apr',mai:'May',juin:'Jun',juil:'Jul',août:'Aug',sept:'Sep',oct:'Oct',nov:'Nov',déc:'Dec'};
            let s = dateStr;
            for (const [fr, en] of Object.entries(months)) s = s.replace(fr + '.', en).replace(fr, en);
            d = new Date(s);
            if (isNaN(d)) d = null;
        } catch(e) {}

        const typ = (tx['Type'] || '').trim();
        const sym = (tx['Symbol'] || '').trim();
        const qty = parseNum(tx['Quantity']);

        if (typ.includes('Achat') || typ.includes('Récompense') || typ.includes('staking')) {
            allTx.push({ date: d, type: typ.includes('Achat') ? 'Trade' : 'Deposit', source: 'Revolut', recvQty: qty, recvAsset: sym, sentQty: 0, sentAsset: '', desc: typ });
        } else if (typ === 'Vente') {
            allTx.push({ date: d, type: 'Trade', source: 'Revolut', recvQty: 0, recvAsset: '', sentQty: qty, sentAsset: sym, desc: 'Vente' });
        }
    });

    // Revolut Robo
    revolutRoboTx.forEach(tx => {
        const d = tx.Date ? new Date(tx.Date) : null;
        const ticker = (tx['Ticker'] || '').trim();
        const typ = (tx['Type'] || '').trim();
        const qty = parseNum(tx['Quantity']);
        if (!ticker) return;
        if (typ.includes('BUY')) {
            allTx.push({ date: d, type: 'Trade', source: 'Robo-Advisor', recvQty: qty, recvAsset: ticker, sentQty: 0, sentAsset: '', desc: 'Achat ETF' });
        } else if (typ.includes('SELL')) {
            allTx.push({ date: d, type: 'Trade', source: 'Robo-Advisor', recvQty: 0, recvAsset: '', sentQty: qty, sentAsset: ticker, desc: 'Vente ETF' });
        }
    });

    // Filter
    let filtered = allTx.filter(tx => tx.date).sort((a, b) => b.date - a.date);
    if (typeFilter !== 'all') filtered = filtered.filter(tx => tx.type === typeFilter);
    if (assetFilter !== 'all') filtered = filtered.filter(tx => tx.recvAsset === assetFilter || tx.sentAsset === assetFilter);

    filtered = filtered.slice(0, 150);

    if (!filtered.length) { list.innerHTML = '<div class="loading-cell">Aucune transaction</div>'; return; }

    list.innerHTML = filtered.map(tx => {
        const ds = tx.date.toLocaleDateString('fr-FR', { day:'2-digit', month:'2-digit', year:'2-digit' });
        const ts = tx.date.toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit' });
        const tc = tx.type === 'Trade' ? 'trade' : 'deposit';
        const srcColors = { SwissBorg: '#06d6a0', Revolut: '#0075eb', 'Robo-Advisor': '#ea580c' };
        const sc = srcColors[tx.source] || '#94a3b8';
        return `<div class="history-item">
            <div class="history-date">${ds}<br>${ts}</div>
            <div class="history-type ${tc}">${tx.type}</div>
            <div class="history-received">${tx.recvQty ? `+${formatQty(tx.recvQty)} ${tx.recvAsset}` : '—'}</div>
            <div class="history-sent">${tx.sentQty ? `-${formatQty(tx.sentQty)} ${tx.sentAsset}` : '—'}</div>
            <div class="history-desc"><span style="color:${sc};font-size:0.65rem;font-weight:600">${tx.source}</span> ${tx.desc}</div>
        </div>`;
    }).join('');
}

function populateAssetFilter() {
    const select = document.getElementById('historyAsset');
    select.innerHTML = '<option value="all">Tous les actifs</option>';
    const assets = new Set();
    swissborgTx.forEach(tx => { if (tx['Asset received']) assets.add(tx['Asset received']); if (tx['Asset sent']) assets.add(tx['Asset sent']); });
    revolutCryptoTx.forEach(tx => { if (tx['Symbol']) assets.add(tx['Symbol']); });
    revolutRoboTx.forEach(tx => { if (tx['Ticker']) assets.add(tx['Ticker']); });
    [...assets].filter(a => !['EUR','USD'].includes(a)).sort().forEach(a => {
        const opt = document.createElement('option');
        opt.value = a; opt.textContent = a;
        select.appendChild(opt);
    });
}

// ===== Analytics =====
function renderAnalytics() {
    const canvas = document.getElementById('allocationChart');
    canvas.width = 500; canvas.height = 400;
    const ctx = canvas.getContext('2d');

    const items = getAllItems().filter(i => i.value >= 10).sort((a, b) => b.value - a.value);
    const total = items.reduce((s, i) => s + i.value, 0);
    if (total <= 0) return;

    const colors = ['#1e3a8a','#2563eb','#3b82f6','#60a5fa','#1d4ed8','#7c3aed','#0891b2','#0d9488','#059669','#d97706','#dc2626','#e11d48'];
    const cx = canvas.width / 2, cy = canvas.height / 2, radius = 140, innerR = radius * 0.5;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    let startAngle = -Math.PI / 2;
    const top = items.slice(0, 10);
    const otherVal = items.slice(10).reduce((s, i) => s + i.value, 0);
    if (otherVal > 0) top.push({ sym: 'Autres', value: otherVal, type: 'other' });

    top.forEach((item, i) => {
        const slice = (item.value / total) * Math.PI * 2;
        ctx.beginPath();
        ctx.arc(cx, cy, radius, startAngle, startAngle + slice);
        ctx.arc(cx, cy, innerR, startAngle + slice, startAngle, true);
        ctx.closePath();
        ctx.fillStyle = colors[i % colors.length];
        ctx.fill();

        const pct = item.value / total;
        if (pct >= 0.03) {
            const mid = startAngle + slice / 2;
            const lr = (radius + innerR) / 2;
            const lx = cx + Math.cos(mid) * lr, ly = cy + Math.sin(mid) * lr;
            ctx.save(); ctx.fillStyle = '#fff'; ctx.font = 'bold 11px "Space Grotesk"';
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText(item.sym, lx, ly - 6);
            ctx.font = '9px "JetBrains Mono"'; ctx.fillStyle = 'rgba(255,255,255,0.8)';
            ctx.fillText((pct * 100).toFixed(1) + '%', lx, ly + 7);
            ctx.restore();
        }
        startAngle += slice;
    });

    ctx.fillStyle = '#1e293b'; ctx.font = 'bold 18px "Space Grotesk"';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(formatUSD(total), cx, cy - 5);
    ctx.font = '11px "JetBrains Mono"'; ctx.fillStyle = '#94a3b8';
    ctx.fillText('TOTAL', cx, cy + 12);

    // Legend
    let leg = canvas.parentElement.querySelector('.donut-legend');
    if (!leg) { leg = document.createElement('div'); leg.className = 'donut-legend'; canvas.parentElement.appendChild(leg); }
    leg.innerHTML = top.map((item, i) =>
        `<div class="donut-legend-item"><div class="donut-legend-dot" style="background:${colors[i % colors.length]}"></div>${item.sym} ${formatUSD(item.value)} (${(item.value / total * 100).toFixed(1)}%)</div>`
    ).join('');

    renderActivityChart();
    renderStats();
}

function renderActivityChart() {
    const canvas = document.getElementById('activityChart');
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const monthly = {};
    const allTx = [...swissborgTx, ...revolutCryptoTx, ...revolutRoboTx];
    allTx.forEach(tx => {
        const d = tx.Date ? new Date(tx.Date) : null;
        if (!d || isNaN(d)) return;
        const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
        monthly[key] = (monthly[key] || 0) + 1;
    });

    const months = Object.keys(monthly).sort().slice(-12);
    const values = months.map(m => monthly[m]);
    const max = Math.max(...values, 1);
    const pad = 40, w = canvas.width - pad*2, h = canvas.height - pad*2;
    const barW = w / months.length * 0.7, gap = w / months.length * 0.3;

    ctx.strokeStyle = '#cbd5e1'; ctx.lineWidth = 0.5;
    for (let i = 0; i <= 4; i++) { const y = pad + (h*i/4); ctx.beginPath(); ctx.moveTo(pad,y); ctx.lineTo(canvas.width-pad,y); ctx.stroke(); }

    months.forEach((m, i) => {
        const x = pad + i*(barW+gap) + gap/2;
        const bh = (values[i]/max)*h, y = pad+h-bh;
        const g = ctx.createLinearGradient(x,y,x,pad+h);
        g.addColorStop(0,'#1e3a8a'); g.addColorStop(1,'rgba(37,99,235,0.15)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(x,y,barW,bh,[3,3,0,0]); ctx.fill();
        ctx.fillStyle = '#64748b'; ctx.font = '9px "JetBrains Mono"'; ctx.textAlign = 'center';
        ctx.fillText(m.slice(5), x+barW/2, pad+h+15);
        ctx.fillStyle = '#94a3b8'; ctx.font = '10px "JetBrains Mono"';
        ctx.fillText(values[i], x+barW/2, y-5);
    });
}

function renderStats() {
    const grid = document.getElementById('statsGrid');
    const trades = swissborgTx.filter(t => t.Type === 'Trade').length + revolutCryptoTx.filter(t => ['Achat','Vente'].includes((t.Type||'').trim())).length;
    const roboTrades = revolutRoboTx.filter(t => (t.Type||'').includes('BUY') || (t.Type||'').includes('SELL')).length;
    const assets = new Set([...Object.keys(cryptoHoldings), ...Object.keys(etfHoldings)]);
    const stats = [
        { value: trades, label: 'Trades crypto' },
        { value: roboTrades, label: 'Trades ETF' },
        { value: assets.size, label: 'Actifs total' },
        { value: Object.keys(cryptoHoldings).filter(s => cryptoHoldings[s] > 0.0000001).length, label: 'Cryptos détenues' },
        { value: Object.keys(etfHoldings).length, label: 'ETFs détenus' },
        { value: swissborgTx.length + revolutCryptoTx.length + revolutRoboTx.length, label: 'Total opérations' },
    ];
    grid.innerHTML = stats.map(s => `<div class="stat-item"><div class="stat-value">${s.value.toLocaleString()}</div><div class="stat-label">${s.label}</div></div>`).join('');
}

// ===== Tabs =====
function switchTab(tabId) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.querySelector(`[data-tab="${tabId}"]`).classList.add('active');
    document.getElementById(`tab-${tabId}`).classList.add('active');
    if (tabId === 'analytics') renderAnalytics();
    if (tabId === 'market' && !marketData.length) loadMarketData();
    if (tabId === 'evolution') renderEvolution();
}

function filterMarket() {
    const q = document.getElementById('marketSearch').value.toLowerCase();
    document.querySelectorAll('.market-card').forEach(c => { c.style.display = (c.dataset.name || '').includes(q) ? '' : 'none'; });
}

// ===== Status =====
function setStatus(t, live) {
    document.querySelector('.status-text').textContent = t;
    const d = document.querySelector('.status-dot');
    live ? d.classList.add('live') : d.classList.remove('live');
}
function updateLastRefresh() {
    document.getElementById('lastUpdate').textContent = 'Maj: ' + new Date().toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit' });
}

// ===== Utility =====
function formatUSD(v) {
    if (!v) return '$0.00';
    if (Math.abs(v) >= 1000) return '$' + v.toLocaleString('en-US', { minimumFractionDigits:2, maximumFractionDigits:2 });
    if (Math.abs(v) >= 1) return '$' + v.toFixed(2);
    if (Math.abs(v) >= 0.01) return '$' + v.toFixed(4);
    return '$' + v.toFixed(8);
}
function formatQty(v) {
    if (v >= 1e6) return (v/1e6).toFixed(2)+'M';
    if (v >= 1000) return v.toLocaleString('en-US', { maximumFractionDigits:2 });
    if (v >= 1) return v.toFixed(4);
    if (v >= 0.0001) return v.toFixed(6);
    return v.toFixed(8);
}
function formatCompact(v) {
    if (!v) return '--';
    if (v >= 1e12) return '$'+(v/1e12).toFixed(1)+'T';
    if (v >= 1e9) return '$'+(v/1e9).toFixed(1)+'B';
    if (v >= 1e6) return '$'+(v/1e6).toFixed(1)+'M';
    return '$'+v.toLocaleString();
}

// ===== Portfolio Evolution =====
function isAppsScriptConfigured() { return APPS_SCRIPT_URL && !APPS_SCRIPT_URL.includes('COLLE_TON_URL'); }

async function logPortfolioValue(valueUSD, nbAssets) {
    if (!isAppsScriptConfigured()) return;
    try {
        await fetch(APPS_SCRIPT_URL, { method:'POST', headers:{'Content-Type':'text/plain'}, body:JSON.stringify({valueUSD, valueEUR: valueUSD*0.92, nbAssets}), mode:'no-cors' });
    } catch(e) {}
}

async function fetchPortfolioHistory() {
    if (!isAppsScriptConfigured()) { document.getElementById('evolutionStatus').textContent = '⚠ Apps Script non configuré'; return []; }
    try {
        const r = await fetch(APPS_SCRIPT_URL);
        if (!r.ok) return [];
        const j = await r.json();
        if (j.status === 'ok' && j.data) return j.data.map(d => ({ date: new Date(d.date), valueUSD: d.valueUSD, valueEUR: d.valueEUR, nbAssets: d.nbAssets })).sort((a,b) => a.date - b.date);
    } catch(e) {}
    return [];
}

function selectPeriod(days) {
    selectedPeriod = days;
    document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
    document.querySelector(`.period-btn[data-period="${days}"]`).classList.add('active');
    renderEvolution();
}

function renderEvolution() {
    const canvas = document.getElementById('evolutionChart');
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (portfolioHistory.length < 2) {
        ctx.fillStyle = '#94a3b8'; ctx.font = '14px "DM Sans"'; ctx.textAlign = 'center';
        ctx.fillText('Pas assez de données. Revenez dans quelques jours !', canvas.width/2, canvas.height/2-10);
        ctx.font = '12px "JetBrains Mono"';
        ctx.fillText(`${portfolioHistory.length} point(s)`, canvas.width/2, canvas.height/2+15);
        document.getElementById('evolutionStats').innerHTML = '';
        return;
    }

    let data = [...portfolioHistory];
    if (selectedPeriod > 0) { const cut = new Date(); cut.setDate(cut.getDate()-selectedPeriod); data = data.filter(d => d.date >= cut); }
    if (data.length < 2) { ctx.fillStyle='#94a3b8'; ctx.font='14px "DM Sans"'; ctx.textAlign='center'; ctx.fillText('Pas assez de données sur cette période.',canvas.width/2,canvas.height/2); return; }

    const pad = {top:30,right:30,bottom:50,left:80};
    const w = canvas.width-pad.left-pad.right, h = canvas.height-pad.top-pad.bottom;
    const vals = data.map(d => d.valueUSD);
    const mn = Math.min(...vals)*0.95, mx = Math.max(...vals)*1.05, rng = mx-mn||1;
    const xS = i => pad.left+(i/(data.length-1))*w;
    const yS = v => pad.top+h-((v-mn)/rng)*h;

    // Grid
    ctx.strokeStyle='#e2e8f0'; ctx.lineWidth=0.5;
    for (let i=0;i<=5;i++){const y=pad.top+(h*i/5);const v=mx-(i/5)*rng;ctx.beginPath();ctx.moveTo(pad.left,y);ctx.lineTo(pad.left+w,y);ctx.stroke();ctx.fillStyle='#94a3b8';ctx.font='10px "JetBrains Mono"';ctx.textAlign='right';ctx.fillText('$'+v.toFixed(0),pad.left-8,y+4);}

    // X labels
    const lc=Math.min(data.length,8),st=Math.max(1,Math.floor(data.length/lc));
    ctx.fillStyle='#94a3b8';ctx.font='10px "JetBrains Mono"';ctx.textAlign='center';
    for(let i=0;i<data.length;i+=st)ctx.fillText(data[i].date.toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit'}),xS(i),pad.top+h+20);

    const isUp=vals[vals.length-1]>=vals[0];
    // Area
    const g=ctx.createLinearGradient(0,pad.top,0,pad.top+h);
    g.addColorStop(0,isUp?'rgba(30,58,138,0.2)':'rgba(220,38,38,0.15)');
    g.addColorStop(1,isUp?'rgba(37,99,235,0.02)':'rgba(220,38,38,0.02)');
    ctx.beginPath();ctx.moveTo(xS(0),pad.top+h);
    data.forEach((d,i)=>ctx.lineTo(xS(i),yS(d.valueUSD)));
    ctx.lineTo(xS(data.length-1),pad.top+h);ctx.closePath();ctx.fillStyle=g;ctx.fill();

    // Line
    ctx.beginPath();data.forEach((d,i)=>{const x=xS(i),y=yS(d.valueUSD);i===0?ctx.moveTo(x,y):ctx.lineTo(x,y);});
    ctx.strokeStyle=isUp?'#1e3a8a':'#dc2626';ctx.lineWidth=2.5;ctx.lineJoin='round';ctx.stroke();

    // Dots
    [0,data.length-1].forEach(i=>{const x=xS(i),y=yS(data[i].valueUSD);ctx.beginPath();ctx.arc(x,y,5,0,Math.PI*2);ctx.fillStyle=isUp?'#1e3a8a':'#dc2626';ctx.fill();ctx.strokeStyle='#fff';ctx.lineWidth=2;ctx.stroke();ctx.fillStyle='#1e293b';ctx.font='bold 11px "Space Grotesk"';ctx.textAlign=i===0?'left':'right';ctx.fillText('$'+data[i].valueUSD.toFixed(0),x+(i===0?10:-10),y-10);});

    // Stats
    renderEvolutionStats(data);
}

function renderEvolutionStats(data) {
    const c = document.getElementById('evolutionStats');
    if (data.length<2){c.innerHTML='';return;}
    const last=data[data.length-1].valueUSD;
    const high=Math.max(...data.map(d=>d.valueUSD)), low=Math.min(...data.map(d=>d.valueUSD)), avg=data.reduce((s,d)=>s+d.valueUSD,0)/data.length;

    function findAgo(days){const cut=new Date();cut.setDate(cut.getDate()-days);let cl=null,md=Infinity;portfolioHistory.forEach(d=>{const dd=Math.abs(d.date-cut);if(dd<md){md=dd;cl=d;}});return cl?cl.valueUSD:null;}
    const periods=[{l:'1j',d:1},{l:'7j',d:7},{l:'30j',d:30},{l:'3m',d:90},{l:'6m',d:180},{l:'1an',d:365},{l:'2ans',d:730},{l:'3ans',d:1095}];
    let html='';
    periods.forEach(p=>{const pv=findAgo(p.d);if(pv&&pv>0){const ch=((last-pv)/pv)*100;const cls=ch>=0?'change-positive':'change-negative';html+=`<div class="evo-stat"><div class="evo-stat-label">${p.l}</div><div class="evo-stat-value ${cls}">${ch>=0?'+':''}${ch.toFixed(2)}%</div></div>`;}});
    html+=`<div class="evo-stat"><div class="evo-stat-label">Plus haut</div><div class="evo-stat-value">$${high.toFixed(0)}</div></div>`;
    html+=`<div class="evo-stat"><div class="evo-stat-label">Plus bas</div><div class="evo-stat-value">$${low.toFixed(0)}</div></div>`;
    html+=`<div class="evo-stat"><div class="evo-stat-label">Moyenne</div><div class="evo-stat-value">$${avg.toFixed(0)}</div></div>`;
    c.innerHTML=html;
}

// ===== Data Loading =====
async function loadAllSheets() {
    setStatus('Chargement données...');

    // SwissBorg
    const sbCSV = await fetchCSV(SHEET_URLS_SWISSBORG, 'SwissBorg');
    if (sbCSV) swissborgTx = parseCSV(sbCSV);

    // Revolut Crypto
    const rcCSV = await fetchCSV(SHEET_URLS_REVOLUT_CRYPTO, 'Revolut Crypto');
    if (rcCSV) revolutCryptoTx = parseCSV(rcCSV);

    // Revolut Robo
    const rrCSV = await fetchCSV(SHEET_URLS_REVOLUT_ROBO, 'Revolut Robo');
    if (rrCSV) revolutRoboTx = parseCSV(rrCSV);

    console.log(`Loaded: ${swissborgTx.length} SB, ${revolutCryptoTx.length} RC, ${revolutRoboTx.length} RR`);

    mergeHoldings();
    populateAssetFilter();
    renderHistory();
    return swissborgTx.length > 0;
}

async function loadPrices() {
    setStatus('Chargement prix...');
    const assets = Object.entries(cryptoHoldings).filter(([s,q])=>q>0.0000001).map(([s])=>s);
    prices = await fetchPrices(assets);
    await fetchETFPrices();
    renderHoldings();
    renderSummary();
}

async function loadMarketData() {
    setStatus('Marché...');
    marketData = await fetchMarketData();
    renderMarket();
}

async function refreshAll() {
    const btn = document.querySelector('.btn-refresh');
    btn.classList.add('spinning');
    await loadAllSheets();
    await loadPrices();
    await loadMarketData();
    setStatus('En direct', true);
    updateLastRefresh();
    btn.classList.remove('spinning');
}

// ===== Init =====
async function init() {
    setStatus('Initialisation...');
    await fetchFearGreed();
    const ok = await loadAllSheets();
    if (ok) {
        await loadPrices();
        const items = getAllItems();
        const total = items.reduce((s,i) => s+i.value, 0);
        const nb = items.filter(i => i.value >= 10).length;
        if (total > 0) logPortfolioValue(total, nb);
        portfolioHistory = await fetchPortfolioHistory();
        if (portfolioHistory.length > 0) {
            document.getElementById('evolutionStatus').textContent = `${portfolioHistory.length} points · Depuis le ${portfolioHistory[0].date.toLocaleDateString('fr-FR')}`;
        }
    }
    setStatus('En direct', true);
    updateLastRefresh();
    setInterval(async () => { await loadPrices(); updateLastRefresh(); }, 60000);
}

document.addEventListener('DOMContentLoaded', init);

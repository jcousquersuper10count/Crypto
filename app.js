// ===== Configuration =====
const SHEET_ID = '18VynzaZPeJTbdn4Hwxeslre1A8_H7_zdBQu9OWd7E_8';
const PUB_ID = '2PACX-1vQHtSe6vE3WSfSsoW15kEaKv75UYpRGM0QJ26_MJlys7ML1NPid2b_Ys6jII04owAH9v4NfOelpVsAm';

// Multiple endpoints to try (CORS can be tricky with Google Sheets)
const SHEET_URLS = [
    // 1. Published CSV via pub ID (most reliable for CORS)
    `https://docs.google.com/spreadsheets/d/e/${PUB_ID}/pub?output=csv`,
    // 2. gviz endpoint
    `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv`,
    // 3. CORS proxy fallback
    `https://api.allorigins.win/raw?url=${encodeURIComponent(`https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv`)}`,
];

// Google Apps Script URL for portfolio value logging
// INSTRUCTIONS: Remplace cette URL par celle de ton déploiement Apps Script
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwJbGQ9SqkQQ5nVhGU_vW5oDWbtb0uEJpaQVf0TtUy0gRRLBdSrJmymlRBhls7O4rot/exec';

// CoinGecko free API (no key needed)
const CG_BASE = 'https://api.coingecko.com/api/v3';

// Map of asset symbols to CoinGecko IDs
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
    'USDC': 'usd-coin', 'USDT': 'tether',
    'SAMO': 'samoyedcoin', 'CTXC': 'cortex', 'MOG': 'mog-coin',
    'API3': 'api3', 'IO': 'io-net', 'FORTH': 'ampleforth-governance-token',
    'TAI': 'tars-protocol', 'AMP': 'amp-token', 'IQ': 'everipedia',
    'HMSTR': 'hamster-kombat', 'MDToken': 'measurable-data-token',
    'BMT': 'bmt-token', 'HIFI': 'hifi-finance', 'MXC': 'mxc',
    'IDEX': 'aurora-dao', 'CAT': 'simon-s-cat', 'SATS': '1000sats',
    'QI': 'benqi', 'DUCK': 'duck-chain',
    'ai16z': 'ai16z', 'CETUS': 'cetus-protocol', 
    '$WIF': 'dogwifcoin', '$COLLAT': null, 'FLOYDAI': null,
    'RECALL': 'recall', 'X': null
};

// ===== State =====
let transactions = [];
let holdings = {};
let prices = {};
let marketData = [];
let portfolioHistory = [];
let selectedPeriod = 7;

// ===== Parse CSV from Google Sheets =====
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
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
            inQuotes = !inQuotes;
        } else if (ch === ',' && !inQuotes) {
            result.push(current);
            current = '';
        } else {
            current += ch;
        }
    }
    result.push(current);
    return result;
}

function parseNumber(s) {
    if (!s) return 0;
    s = s.trim().replace(/"/g, '').replace(/\xa0/g, '');
    // Handle scientific notation with comma: 1,00E+12
    if (s.includes('E+') || s.includes('E-') || s.includes('e+') || s.includes('e-')) {
        s = s.replace(',', '.');
        return parseFloat(s) || 0;
    }
    // Handle comma as decimal separator
    if (s.includes(',') && !s.includes('.')) {
        s = s.replace(',', '.');
    }
    return parseFloat(s) || 0;
}

// ===== Compute Holdings =====
function computeHoldings(txns) {
    const balances = {};
    const fiat = new Set(['EUR', 'USD']);
    
    txns.forEach(tx => {
        const recvAmt = parseNumber(tx['Amount received']);
        const recvAsset = tx['Asset received'] || '';
        const sentAmt = parseNumber(tx['Amount sent']);
        const sentAsset = tx['Asset sent'] || '';
        const feeAmt = parseNumber(tx['Fee']);
        const feeAsset = tx['Asset of the fee'] || '';
        
        if (recvAmt && recvAsset && !fiat.has(recvAsset)) {
            balances[recvAsset] = (balances[recvAsset] || 0) + recvAmt;
        }
        if (sentAmt && sentAsset && !fiat.has(sentAsset)) {
            balances[sentAsset] = (balances[sentAsset] || 0) - sentAmt;
        }
        if (feeAmt && feeAsset && !fiat.has(feeAsset)) {
            balances[feeAsset] = (balances[feeAsset] || 0) - feeAmt;
        }
    });
    
    // Filter out near-zero balances
    const result = {};
    for (const [asset, bal] of Object.entries(balances)) {
        if (Math.abs(bal) > 0.0000001) {
            result[asset] = bal;
        }
    }
    return result;
}

// ===== Fetch Prices from CoinGecko =====
async function fetchPrices(assetList) {
    // Get CoinGecko IDs for our assets
    const ids = [];
    const idToSymbol = {};
    
    assetList.forEach(sym => {
        const cgId = COINGECKO_MAP[sym];
        if (cgId) {
            ids.push(cgId);
            idToSymbol[cgId] = sym;
        }
    });
    
    if (ids.length === 0) return {};
    
    // Batch in groups of 50
    const priceData = {};
    for (let i = 0; i < ids.length; i += 50) {
        const batch = ids.slice(i, i + 50);
        try {
            const url = `${CG_BASE}/coins/markets?vs_currency=usd&ids=${batch.join(',')}&order=market_cap_desc&sparkline=false&price_change_percentage=24h,7d,30d,1y`;
            const resp = await fetch(url);
            if (resp.ok) {
                const data = await resp.json();
                data.forEach(coin => {
                    const sym = idToSymbol[coin.id];
                    if (sym) {
                        priceData[sym] = {
                            price: coin.current_price || 0,
                            change24h: coin.price_change_percentage_24h || 0,
                            change7d: coin.price_change_percentage_7d_in_currency || 0,
                            change30d: coin.price_change_percentage_30d_in_currency || 0,
                            change1y: coin.price_change_percentage_1y_in_currency || 0,
                            marketCap: coin.market_cap || 0,
                            image: coin.image || '',
                            name: coin.name || sym,
                            rank: coin.market_cap_rank || 999
                        };
                    }
                });
            }
            // Rate limiting - wait between batches
            if (i + 50 < ids.length) await sleep(1500);
        } catch (e) {
            console.warn('CoinGecko batch fetch error:', e);
        }
    }
    
    return priceData;
}

// ===== Fetch Top Market Data =====
async function fetchMarketData() {
    try {
        const url = `${CG_BASE}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=50&page=1&sparkline=false&price_change_percentage=24h,7d,30d,1y`;
        const resp = await fetch(url);
        if (resp.ok) {
            return await resp.json();
        }
    } catch (e) {
        console.warn('Market data fetch error:', e);
    }
    return [];
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ===== Rendering =====
function renderHoldings() {
    const tbody = document.getElementById('holdingsBody');
    const sortBy = document.getElementById('sortBy').value;
    
    // Build display data — auto-hide values under $10
    let items = Object.entries(holdings)
        .filter(([sym, qty]) => qty > 0.0000001)
        .map(([sym, qty]) => {
            const p = prices[sym] || {};
            const value = qty * (p.price || 0);
            return { sym, qty, price: p.price || 0, value, change24h: p.change24h || 0, change7d: p.change7d || 0, change30d: p.change30d || 0, change1y: p.change1y || 0, image: p.image || '', name: p.name || sym };
        })
        .filter(i => i.value >= 10);
    
    // Sort
    if (sortBy === 'value') items.sort((a, b) => b.value - a.value);
    else if (sortBy === 'name') items.sort((a, b) => a.sym.localeCompare(b.sym));
    else if (sortBy === 'change') items.sort((a, b) => b.change24h - a.change24h);
    
    const totalValue = items.reduce((s, i) => s + i.value, 0);
    
    if (items.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" class="loading-cell">Aucune position ≥ 10$ trouvée</td></tr>';
        return;
    }
    
    function fmtChange(val) {
        const cls = val >= 0 ? 'change-positive' : 'change-negative';
        return `<td class="${cls}">${val >= 0 ? '+' : ''}${val.toFixed(2)}%</td>`;
    }
    
    tbody.innerHTML = items.map(item => {
        const alloc = totalValue > 0 ? (item.value / totalValue * 100) : 0;
        
        return `<tr>
            <td>
                <div class="asset-cell">
                    <div class="asset-icon">
                        ${item.image ? `<img src="${item.image}" alt="${item.sym}" onerror="this.parentElement.textContent='${item.sym.slice(0,2)}'">` : item.sym.slice(0, 2)}
                    </div>
                    <div>
                        <div class="asset-name">${item.name}</div>
                        <div class="asset-symbol">${item.sym}</div>
                    </div>
                </div>
            </td>
            <td class="qty-cell">${formatQty(item.qty)}</td>
            <td class="price-cell">${formatUSD(item.price)}</td>
            <td class="value-cell">${formatUSD(item.value)}</td>
            ${fmtChange(item.change24h)}
            ${fmtChange(item.change7d)}
            ${fmtChange(item.change30d)}
            ${fmtChange(item.change1y)}
            <td>
                <div class="alloc-bar-wrap">
                    <div class="alloc-bar"><div class="alloc-bar-fill" style="width:${Math.min(alloc, 100)}%"></div></div>
                    <span class="alloc-pct">${alloc.toFixed(1)}%</span>
                </div>
            </td>
        </tr>`;
    }).join('');
}

function renderSummary() {
    const items = Object.entries(holdings)
        .filter(([s, q]) => q > 0.0000001)
        .map(([sym, qty]) => {
            const p = prices[sym] || {};
            return { sym, qty, value: qty * (p.price || 0), change24h: p.change24h || 0 };
        });
    
    const totalValue = items.reduce((s, i) => s + i.value, 0);
    const positiveCount = items.filter(i => i.value >= 0.01).length;
    
    document.getElementById('totalValue').textContent = formatUSD(totalValue);
    document.getElementById('assetCount').textContent = positiveCount;
    
    // Weighted average 24h change
    if (totalValue > 0) {
        const wavg = items.reduce((s, i) => s + (i.change24h * i.value), 0) / totalValue;
        const changeEl = document.getElementById('totalChange');
        changeEl.textContent = `${wavg >= 0 ? '▲' : '▼'} ${wavg >= 0 ? '+' : ''}${wavg.toFixed(2)}% (24h)`;
        changeEl.className = `total-change ${wavg >= 0 ? 'change-positive' : 'change-negative'}`;
    }
    
    // Compute total invested from EUR/USD deposits
    let totalInvested = 0;
    transactions.forEach(tx => {
        if (tx.Type === 'Deposit' && ['EUR', 'USD'].includes(tx['Asset received'])) {
            totalInvested += parseNumber(tx['Amount received']);
        }
    });
    document.getElementById('totalInvested').textContent = `€${totalInvested.toFixed(0)}`;
    
    // P&L
    const pnl = totalValue - totalInvested;
    const pnlEl = document.getElementById('totalPnl');
    pnlEl.textContent = `${pnl >= 0 ? '+' : ''}${formatUSD(pnl)}`;
    pnlEl.className = `summary-card-value ${pnl >= 0 ? 'change-positive' : 'change-negative'}`;
    
    // Best asset
    const best = items.filter(i => i.value >= 1).sort((a, b) => b.change24h - a.change24h)[0];
    if (best) {
        const bestEl = document.getElementById('bestAsset');
        bestEl.textContent = `${best.sym} ${best.change24h >= 0 ? '+' : ''}${best.change24h.toFixed(1)}%`;
        bestEl.className = `summary-card-value ${best.change24h >= 0 ? 'change-positive' : 'change-negative'}`;
    }
}

function renderMarket() {
    const grid = document.getElementById('marketGrid');
    
    if (marketData.length === 0) {
        grid.innerHTML = '<div class="loading-cell">Données non disponibles</div>';
        return;
    }
    
    // Build reverse map: coingecko symbol -> our holding symbol
    const ownedSymbols = new Set(
        Object.entries(holdings)
            .filter(([s, q]) => q > 0.0000001 && (q * ((prices[s]||{}).price||0)) >= 10)
            .map(([s]) => s.toUpperCase())
    );
    
    // Sort: owned first, then by market cap rank
    const sorted = [...marketData].sort((a, b) => {
        const aOwned = ownedSymbols.has(a.symbol.toUpperCase()) ? 0 : 1;
        const bOwned = ownedSymbols.has(b.symbol.toUpperCase()) ? 0 : 1;
        if (aOwned !== bOwned) return aOwned - bOwned;
        return (a.market_cap_rank || 999) - (b.market_cap_rank || 999);
    });
    
    grid.innerHTML = sorted.map(coin => {
        const ch24 = coin.price_change_percentage_24h || 0;
        const chClass = ch24 >= 0 ? 'change-positive' : 'change-negative';
        const isOwned = ownedSymbols.has(coin.symbol.toUpperCase());
        
        return `<div class="market-card ${isOwned ? 'owned' : ''}" data-name="${coin.name.toLowerCase()} ${coin.symbol.toLowerCase()}">
            <div class="market-card-top">
                <div class="market-card-asset">
                    <div class="asset-icon"><img src="${coin.image}" alt="${coin.symbol}" onerror="this.parentElement.textContent='${coin.symbol.slice(0,2).toUpperCase()}'"></div>
                    <div>
                        <div class="asset-name">${coin.symbol.toUpperCase()}</div>
                        <div class="asset-symbol">${coin.name}</div>
                    </div>
                </div>
                ${isOwned ? '<span class="market-card-owned-badge">EN PORTEFEUILLE</span>' : ''}
                <span class="market-card-rank">#${coin.market_cap_rank || '--'}</span>
            </div>
            <div class="market-card-price">${formatUSD(coin.current_price)}</div>
            <div class="market-card-bottom">
                <span class="${chClass}">${ch24 >= 0 ? '+' : ''}${ch24.toFixed(2)}%</span>
                <span class="market-card-mcap">MCap: ${formatCompact(coin.market_cap)}</span>
            </div>
        </div>`;
    }).join('');
}

function renderHistory() {
    const list = document.getElementById('historyList');
    const typeFilter = document.getElementById('historyType').value;
    const assetFilter = document.getElementById('historyAsset').value;
    
    let filtered = [...transactions].reverse(); // newest first
    
    if (typeFilter !== 'all') {
        filtered = filtered.filter(tx => tx.Type === typeFilter);
    }
    
    if (assetFilter !== 'all') {
        filtered = filtered.filter(tx =>
            tx['Asset received'] === assetFilter || tx['Asset sent'] === assetFilter
        );
    }
    
    // Show last 100
    filtered = filtered.slice(0, 100);
    
    if (filtered.length === 0) {
        list.innerHTML = '<div class="loading-cell">Aucune transaction</div>';
        return;
    }
    
    list.innerHTML = filtered.map(tx => {
        const date = tx.Date ? new Date(tx.Date) : null;
        const dateStr = date ? date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '--';
        const timeStr = date ? date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '';
        const typeClass = tx.Type === 'Trade' ? 'trade' : 'deposit';
        
        const recv = parseNumber(tx['Amount received']);
        const recvAsset = tx['Asset received'] || '';
        const sent = parseNumber(tx['Amount sent']);
        const sentAsset = tx['Asset sent'] || '';
        const desc = tx.Description || '';
        
        return `<div class="history-item">
            <div class="history-date">${dateStr}<br>${timeStr}</div>
            <div class="history-type ${typeClass}">${tx.Type}</div>
            <div class="history-received">${recv ? `+${formatQty(recv)} ${recvAsset}` : '--'}</div>
            <div class="history-sent">${sent ? `-${formatQty(sent)} ${sentAsset}` : '--'}</div>
            <div class="history-desc" title="${desc}">${desc || '--'}</div>
        </div>`;
    }).join('');
}

function renderAnalytics() {
    const canvas = document.getElementById('allocationChart');
    // Make canvas bigger for labels
    canvas.width = 500;
    canvas.height = 400;
    const ctx = canvas.getContext('2d');
    
    const items = Object.entries(holdings)
        .filter(([s, q]) => q > 0.0000001)
        .map(([sym, qty]) => ({ sym, value: qty * ((prices[sym] || {}).price || 0) }))
        .filter(i => i.value >= 10)
        .sort((a, b) => b.value - a.value);
    
    const total = items.reduce((s, i) => s + i.value, 0);
    
    if (total <= 0) return;
    
    const colors = ['#1e3a8a', '#2563eb', '#3b82f6', '#60a5fa', '#1d4ed8', '#7c3aed', '#0891b2', '#0d9488', '#059669', '#d97706', '#dc2626', '#e11d48'];
    
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const radius = 140;
    const innerRadius = radius * 0.5;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    let startAngle = -Math.PI / 2;
    const topItems = items.slice(0, 10);
    const otherValue = items.slice(10).reduce((s, i) => s + i.value, 0);
    if (otherValue > 0) topItems.push({ sym: 'Autres', value: otherValue });
    
    // Draw slices
    topItems.forEach((item, i) => {
        const sliceAngle = (item.value / total) * Math.PI * 2;
        ctx.beginPath();
        ctx.arc(cx, cy, radius, startAngle, startAngle + sliceAngle);
        ctx.arc(cx, cy, innerRadius, startAngle + sliceAngle, startAngle, true);
        ctx.closePath();
        ctx.fillStyle = colors[i % colors.length];
        ctx.fill();
        
        // Draw label on each slice
        const pct = item.value / total;
        if (pct >= 0.03) { // Only label slices >= 3%
            const midAngle = startAngle + sliceAngle / 2;
            const labelRadius = (radius + innerRadius) / 2;
            const lx = cx + Math.cos(midAngle) * labelRadius;
            const ly = cy + Math.sin(midAngle) * labelRadius;
            
            ctx.save();
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 11px "Space Grotesk"';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(item.sym, lx, ly - 6);
            ctx.font = '9px "JetBrains Mono"';
            ctx.fillStyle = 'rgba(255,255,255,0.8)';
            ctx.fillText((pct * 100).toFixed(1) + '%', lx, ly + 7);
            ctx.restore();
        }
        
        // Draw line + external label for small slices
        if (pct < 0.03 && pct >= 0.005) {
            const midAngle = startAngle + sliceAngle / 2;
            const outerX = cx + Math.cos(midAngle) * (radius + 8);
            const outerY = cy + Math.sin(midAngle) * (radius + 8);
            const farX = cx + Math.cos(midAngle) * (radius + 35);
            const farY = cy + Math.sin(midAngle) * (radius + 35);
            
            ctx.save();
            ctx.strokeStyle = colors[i % colors.length];
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(outerX, outerY);
            ctx.lineTo(farX, farY);
            ctx.stroke();
            
            ctx.fillStyle = '#475569';
            ctx.font = '9px "JetBrains Mono"';
            ctx.textAlign = midAngle > Math.PI / 2 && midAngle < Math.PI * 1.5 ? 'right' : 'left';
            ctx.textBaseline = 'middle';
            ctx.fillText(`${item.sym} ${(pct * 100).toFixed(1)}%`, farX + (ctx.textAlign === 'left' ? 3 : -3), farY);
            ctx.restore();
        }
        
        startAngle += sliceAngle;
    });
    
    // Center text
    ctx.fillStyle = '#1e293b';
    ctx.font = 'bold 18px "Space Grotesk"';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(formatUSD(total), cx, cy - 5);
    ctx.font = '11px "JetBrains Mono"';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('TOTAL', cx, cy + 12);
    
    // Legend below
    const legendContainer = canvas.parentElement;
    let legendEl = legendContainer.querySelector('.donut-legend');
    if (!legendEl) {
        legendEl = document.createElement('div');
        legendEl.className = 'donut-legend';
        legendContainer.appendChild(legendEl);
    }
    legendEl.innerHTML = topItems.map((item, i) => 
        `<div class="donut-legend-item">
            <div class="donut-legend-dot" style="background:${colors[i % colors.length]}"></div>
            ${item.sym} ${formatUSD(item.value)} (${(item.value / total * 100).toFixed(1)}%)
        </div>`
    ).join('');
    
    // Activity chart
    renderActivityChart();
    
    // Stats
    renderStats();
}

function renderActivityChart() {
    const canvas = document.getElementById('activityChart');
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Count trades per month
    const monthly = {};
    transactions.forEach(tx => {
        if (tx.Type === 'Trade' && tx.Date) {
            const d = new Date(tx.Date);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            monthly[key] = (monthly[key] || 0) + 1;
        }
    });
    
    const months = Object.keys(monthly).sort().slice(-12);
    const values = months.map(m => monthly[m]);
    const max = Math.max(...values, 1);
    
    const padding = 40;
    const w = canvas.width - padding * 2;
    const h = canvas.height - padding * 2;
    const barW = w / months.length * 0.7;
    const gap = w / months.length * 0.3;
    
    // Grid lines
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= 4; i++) {
        const y = padding + (h * i / 4);
        ctx.beginPath();
        ctx.moveTo(padding, y);
        ctx.lineTo(canvas.width - padding, y);
        ctx.stroke();
    }
    
    // Bars
    months.forEach((month, i) => {
        const x = padding + i * (barW + gap) + gap / 2;
        const barH = (values[i] / max) * h;
        const y = padding + h - barH;
        
        // Gradient bar
        const gradient = ctx.createLinearGradient(x, y, x, padding + h);
        gradient.addColorStop(0, '#1e3a8a');
        gradient.addColorStop(1, 'rgba(37, 99, 235, 0.15)');
        
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.roundRect(x, y, barW, barH, [3, 3, 0, 0]);
        ctx.fill();
        
        // Label
        ctx.fillStyle = '#64748b';
        ctx.font = '9px "JetBrains Mono"';
        ctx.textAlign = 'center';
        ctx.fillText(month.slice(5), x + barW / 2, padding + h + 15);
        
        // Value
        ctx.fillStyle = '#94a3b8';
        ctx.font = '10px "JetBrains Mono"';
        ctx.fillText(values[i], x + barW / 2, y - 5);
    });
}

function renderStats() {
    const grid = document.getElementById('statsGrid');
    
    const trades = transactions.filter(tx => tx.Type === 'Trade');
    const deposits = transactions.filter(tx => tx.Type === 'Deposit');
    
    // Unique assets traded
    const assetsTraded = new Set();
    trades.forEach(tx => {
        if (tx['Asset received']) assetsTraded.add(tx['Asset received']);
        if (tx['Asset sent']) assetsTraded.add(tx['Asset sent']);
    });
    
    // Trading period
    const dates = transactions.filter(tx => tx.Date).map(tx => new Date(tx.Date));
    const firstDate = new Date(Math.min(...dates));
    const lastDate = new Date(Math.max(...dates));
    const daysDiff = Math.ceil((lastDate - firstDate) / (1000 * 60 * 60 * 24));
    
    const stats = [
        { value: trades.length, label: 'Trades exécutés' },
        { value: deposits.length, label: 'Dépôts reçus' },
        { value: assetsTraded.size, label: 'Actifs différents' },
        { value: daysDiff, label: 'Jours d\'activité' },
        { value: Math.round(trades.length / Math.max(daysDiff / 30, 1)), label: 'Trades / mois' },
        { value: transactions.length, label: 'Total transactions' },
    ];
    
    grid.innerHTML = stats.map(s => `
        <div class="stat-item">
            <div class="stat-value">${typeof s.value === 'number' ? s.value.toLocaleString() : s.value}</div>
            <div class="stat-label">${s.label}</div>
        </div>
    `).join('');
}

// Populate asset filter for history
function populateAssetFilter() {
    const select = document.getElementById('historyAsset');
    const assets = new Set();
    transactions.forEach(tx => {
        if (tx['Asset received']) assets.add(tx['Asset received']);
        if (tx['Asset sent']) assets.add(tx['Asset sent']);
    });
    const sorted = [...assets].filter(a => !['EUR', 'USD'].includes(a)).sort();
    sorted.forEach(a => {
        const opt = document.createElement('option');
        opt.value = a;
        opt.textContent = a;
        select.appendChild(opt);
    });
}

// ===== Utility Functions =====
function formatUSD(val) {
    if (val === 0 || val === undefined) return '$0.00';
    if (Math.abs(val) >= 1000) return '$' + val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (Math.abs(val) >= 1) return '$' + val.toFixed(2);
    if (Math.abs(val) >= 0.01) return '$' + val.toFixed(4);
    return '$' + val.toFixed(8);
}

function formatQty(val) {
    if (val >= 1000000) return (val / 1000000).toFixed(2) + 'M';
    if (val >= 1000) return val.toLocaleString('en-US', { maximumFractionDigits: 2 });
    if (val >= 1) return val.toFixed(4);
    if (val >= 0.0001) return val.toFixed(6);
    return val.toFixed(8);
}

function formatCompact(val) {
    if (!val) return '--';
    if (val >= 1e12) return '$' + (val / 1e12).toFixed(1) + 'T';
    if (val >= 1e9) return '$' + (val / 1e9).toFixed(1) + 'B';
    if (val >= 1e6) return '$' + (val / 1e6).toFixed(1) + 'M';
    return '$' + val.toLocaleString();
}

// ===== Tab Management =====
function switchTab(tabId) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.querySelector(`[data-tab="${tabId}"]`).classList.add('active');
    document.getElementById(`tab-${tabId}`).classList.add('active');
    
    if (tabId === 'analytics') renderAnalytics();
    if (tabId === 'market' && marketData.length === 0) loadMarketData();
    if (tabId === 'evolution') renderEvolution();
}

function filterMarket() {
    const query = document.getElementById('marketSearch').value.toLowerCase();
    document.querySelectorAll('.market-card').forEach(card => {
        const name = card.dataset.name || '';
        card.style.display = name.includes(query) ? '' : 'none';
    });
}

// ===== Status Updates =====
function setStatus(text, live = false) {
    document.querySelector('.status-text').textContent = text;
    const dot = document.querySelector('.status-dot');
    if (live) dot.classList.add('live');
    else dot.classList.remove('live');
}

function updateLastRefresh() {
    document.getElementById('lastUpdate').textContent = 
        'Maj: ' + new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

// ===== Main Data Loading =====
async function loadSheetData() {
    setStatus('Chargement Sheet...');
    
    let csv = null;
    let lastError = null;
    
    // Try each URL until one works
    for (const url of SHEET_URLS) {
        try {
            console.log('Trying:', url.substring(0, 80) + '...');
            const resp = await fetch(url);
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            const text = await resp.text();
            
            // Validate it looks like CSV (should contain "Type" and "Date" headers)
            if (text.includes('Type') && text.includes('Date')) {
                csv = text;
                console.log('✓ Sheet loaded from:', url.substring(0, 60));
                break;
            } else {
                throw new Error('Response is not valid CSV');
            }
        } catch (e) {
            lastError = e;
            console.warn('✗ Failed:', url.substring(0, 60), e.message);
        }
    }
    
    if (!csv) {
        console.error('All Sheet URLs failed. Last error:', lastError);
        setStatus('Erreur Sheet');
        document.getElementById('holdingsBody').innerHTML = `
            <tr><td colspan="7" class="loading-cell">
                <div class="error-msg">
                    Impossible de charger Google Sheets.<br><br>
                    <strong>Solution :</strong> Dans Google Sheets, allez dans :<br>
                    Fichier → Partager → Publier sur le Web → Publier (format CSV)<br><br>
                    Et vérifiez aussi que le fichier est partagé en "Accessible à tous avec le lien".<br><br>
                    Erreur: ${lastError?.message || 'Inconnue'}
                </div>
            </td></tr>`;
        return false;
    }
    
    try {
        transactions = parseCSV(csv);
        holdings = computeHoldings(transactions);
        console.log(`Parsed ${transactions.length} transactions, ${Object.keys(holdings).length} assets`);
        
        populateAssetFilter();
        renderHistory();
        return true;
    } catch (e) {
        console.error('CSV parse error:', e);
        setStatus('Erreur parsing');
        return false;
    }
}

async function loadPriceData() {
    setStatus('Chargement prix...');
    
    const positiveAssets = Object.entries(holdings)
        .filter(([s, q]) => q > 0.0000001)
        .map(([s]) => s);
    
    prices = await fetchPrices(positiveAssets);
    
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
    
    const success = await loadSheetData();
    if (success) {
        await loadPriceData();
        await loadMarketData();
    }
    
    setStatus('En direct', true);
    updateLastRefresh();
    btn.classList.remove('spinning');
}

// ===== Portfolio Evolution =====
function isAppsScriptConfigured() {
    return APPS_SCRIPT_URL && !APPS_SCRIPT_URL.includes('COLLE_TON_URL');
}

async function logPortfolioValue(valueUSD, nbAssets) {
    if (!isAppsScriptConfigured()) return;
    
    // Estimate EUR value (rough)
    const valueEUR = valueUSD * 0.92;
    
    try {
        await fetch(APPS_SCRIPT_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify({ valueUSD, valueEUR, nbAssets }),
            mode: 'no-cors' // Apps Script redirects, so we use no-cors for POST
        });
        console.log('✓ Portfolio value logged');
    } catch (e) {
        console.warn('Portfolio log error:', e);
    }
}

async function fetchPortfolioHistory() {
    if (!isAppsScriptConfigured()) {
        document.getElementById('evolutionStatus').textContent = '⚠ Apps Script non configuré (voir README)';
        return [];
    }
    
    try {
        const resp = await fetch(APPS_SCRIPT_URL);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const json = await resp.json();
        if (json.status === 'ok' && json.data) {
            return json.data.map(d => ({
                date: new Date(d.date),
                valueUSD: d.valueUSD,
                valueEUR: d.valueEUR,
                nbAssets: d.nbAssets
            })).sort((a, b) => a.date - b.date);
        }
    } catch (e) {
        console.warn('Fetch history error:', e);
        document.getElementById('evolutionStatus').textContent = '⚠ Erreur de chargement';
    }
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
        ctx.fillStyle = '#94a3b8';
        ctx.font = '14px "DM Sans"';
        ctx.textAlign = 'center';
        ctx.fillText('Pas assez de données. Revenez dans quelques jours !', canvas.width / 2, canvas.height / 2 - 10);
        ctx.font = '12px "JetBrains Mono"';
        ctx.fillText(`${portfolioHistory.length} point(s) enregistré(s)`, canvas.width / 2, canvas.height / 2 + 15);
        renderEvolutionStats([]);
        return;
    }
    
    // Filter by period
    let data = [...portfolioHistory];
    if (selectedPeriod > 0) {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - selectedPeriod);
        data = data.filter(d => d.date >= cutoff);
    }
    
    if (data.length < 2) {
        ctx.fillStyle = '#94a3b8';
        ctx.font = '14px "DM Sans"';
        ctx.textAlign = 'center';
        ctx.fillText('Pas assez de données sur cette période.', canvas.width / 2, canvas.height / 2);
        renderEvolutionStats([]);
        return;
    }
    
    // Chart dimensions
    const pad = { top: 30, right: 30, bottom: 50, left: 80 };
    const w = canvas.width - pad.left - pad.right;
    const h = canvas.height - pad.top - pad.bottom;
    
    const values = data.map(d => d.valueUSD);
    const minVal = Math.min(...values) * 0.95;
    const maxVal = Math.max(...values) * 1.05;
    const range = maxVal - minVal || 1;
    
    // X/Y mapping
    const xScale = (i) => pad.left + (i / (data.length - 1)) * w;
    const yScale = (v) => pad.top + h - ((v - minVal) / range) * h;
    
    // Grid lines
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 0.5;
    const gridLines = 5;
    for (let i = 0; i <= gridLines; i++) {
        const y = pad.top + (h * i / gridLines);
        const val = maxVal - (i / gridLines) * range;
        ctx.beginPath();
        ctx.moveTo(pad.left, y);
        ctx.lineTo(pad.left + w, y);
        ctx.stroke();
        
        ctx.fillStyle = '#94a3b8';
        ctx.font = '10px "JetBrains Mono"';
        ctx.textAlign = 'right';
        ctx.fillText('$' + val.toFixed(0), pad.left - 8, y + 4);
    }
    
    // X axis labels
    const labelCount = Math.min(data.length, 8);
    const step = Math.max(1, Math.floor(data.length / labelCount));
    ctx.fillStyle = '#94a3b8';
    ctx.font = '10px "JetBrains Mono"';
    ctx.textAlign = 'center';
    for (let i = 0; i < data.length; i += step) {
        const x = xScale(i);
        const d = data[i].date;
        const label = d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
        ctx.fillText(label, x, pad.top + h + 20);
    }
    
    // Area fill
    const gradient = ctx.createLinearGradient(0, pad.top, 0, pad.top + h);
    const isUp = values[values.length - 1] >= values[0];
    if (isUp) {
        gradient.addColorStop(0, 'rgba(30, 58, 138, 0.2)');
        gradient.addColorStop(1, 'rgba(37, 99, 235, 0.02)');
    } else {
        gradient.addColorStop(0, 'rgba(220, 38, 38, 0.15)');
        gradient.addColorStop(1, 'rgba(220, 38, 38, 0.02)');
    }
    
    ctx.beginPath();
    ctx.moveTo(xScale(0), pad.top + h);
    data.forEach((d, i) => ctx.lineTo(xScale(i), yScale(d.valueUSD)));
    ctx.lineTo(xScale(data.length - 1), pad.top + h);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();
    
    // Line
    ctx.beginPath();
    data.forEach((d, i) => {
        const x = xScale(i);
        const y = yScale(d.valueUSD);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = isUp ? '#1e3a8a' : '#dc2626';
    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'round';
    ctx.stroke();
    
    // Dots at first and last
    [0, data.length - 1].forEach(i => {
        const x = xScale(i);
        const y = yScale(data[i].valueUSD);
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, Math.PI * 2);
        ctx.fillStyle = isUp ? '#1e3a8a' : '#dc2626';
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // Value label
        ctx.fillStyle = '#1e293b';
        ctx.font = 'bold 11px "Space Grotesk"';
        ctx.textAlign = i === 0 ? 'left' : 'right';
        ctx.fillText('$' + data[i].valueUSD.toFixed(2), x + (i === 0 ? 10 : -10), y - 10);
    });
    
    renderEvolutionStats(data);
}

function renderEvolutionStats(data) {
    const container = document.getElementById('evolutionStats');
    
    if (data.length < 2) {
        container.innerHTML = '';
        return;
    }
    
    const first = data[0].valueUSD;
    const last = data[data.length - 1].valueUSD;
    const diff = last - first;
    const pct = first > 0 ? ((diff / first) * 100) : 0;
    const high = Math.max(...data.map(d => d.valueUSD));
    const low = Math.min(...data.map(d => d.valueUSD));
    const avg = data.reduce((s, d) => s + d.valueUSD, 0) / data.length;
    
    const cls = diff >= 0 ? 'change-positive' : 'change-negative';
    
    // Compute period-specific changes
    const now = last;
    function findValueDaysAgo(days) {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - days);
        // Find closest entry to cutoff
        let closest = null;
        let minDiff = Infinity;
        portfolioHistory.forEach(d => {
            const dd = Math.abs(d.date - cutoff);
            if (dd < minDiff) { minDiff = dd; closest = d; }
        });
        return closest ? closest.valueUSD : null;
    }
    
    const periods = [
        { label: '1 jour', days: 1 },
        { label: '7 jours', days: 7 },
        { label: '30 jours', days: 30 },
        { label: '3 mois', days: 90 },
        { label: '6 mois', days: 180 },
        { label: '1 an', days: 365 },
        { label: '2 ans', days: 730 },
        { label: '3 ans', days: 1095 },
    ];
    
    let html = '';
    periods.forEach(p => {
        const pastVal = findValueDaysAgo(p.days);
        if (pastVal !== null && pastVal > 0) {
            const ch = ((now - pastVal) / pastVal) * 100;
            const chCls = ch >= 0 ? 'change-positive' : 'change-negative';
            html += `<div class="evo-stat">
                <div class="evo-stat-label">${p.label}</div>
                <div class="evo-stat-value ${chCls}">${ch >= 0 ? '+' : ''}${ch.toFixed(2)}%</div>
            </div>`;
        }
    });
    
    // Add high/low/avg
    html += `<div class="evo-stat">
        <div class="evo-stat-label">Plus haut</div>
        <div class="evo-stat-value">$${high.toFixed(0)}</div>
    </div>`;
    html += `<div class="evo-stat">
        <div class="evo-stat-label">Plus bas</div>
        <div class="evo-stat-value">$${low.toFixed(0)}</div>
    </div>`;
    html += `<div class="evo-stat">
        <div class="evo-stat-label">Moyenne</div>
        <div class="evo-stat-value">$${avg.toFixed(0)}</div>
    </div>`;
    
    container.innerHTML = html;
}

// ===== Init =====
async function init() {
    setStatus('Initialisation...');
    
    const success = await loadSheetData();
    if (success) {
        await loadPriceData();
        
        // Log current portfolio value
        const totalValue = Object.entries(holdings)
            .filter(([s, q]) => q > 0.0000001)
            .reduce((sum, [sym, qty]) => sum + qty * ((prices[sym] || {}).price || 0), 0);
        const nbAssets = Object.entries(holdings)
            .filter(([s, q]) => q > 0.0000001 && q * ((prices[s]||{}).price||0) >= 10)
            .length;
        
        if (totalValue > 0) {
            logPortfolioValue(totalValue, nbAssets);
        }
        
        // Load portfolio history
        portfolioHistory = await fetchPortfolioHistory();
        if (portfolioHistory.length > 0) {
            document.getElementById('evolutionStatus').textContent = 
                `${portfolioHistory.length} points · Depuis le ${portfolioHistory[0].date.toLocaleDateString('fr-FR')}`;
        }
    }
    
    setStatus('En direct', true);
    updateLastRefresh();
    
    // Auto-refresh every 60 seconds
    setInterval(async () => {
        await loadPriceData();
        updateLastRefresh();
    }, 60000);
}

// Start
document.addEventListener('DOMContentLoaded', init);

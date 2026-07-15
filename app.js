// VAULT v4
const SID='18VynzaZPeJTbdn4Hwxeslre1A8_H7_zdBQu9OWd7E_8',PID='2PACX-1vQHtSe6vE3WSfSsoW15kEaKv75UYpRGM0QJ26_MJlys7ML1NPid2b_Ys6jII04owAH9v4NfOelpVsAm';
const GAS='https://script.google.com/macros/s/AKfycbwJbGQ9SqkQQ5nVhGU_vW5oDWbtb0uEJpaQVf0TtUy0gRRLBdSrJmymlRBhls7O4rot/exec';
const CG='https://api.coingecko.com/api/v3';
const PWD_HASH='cbca90cb9b376770bdd907ce7f989ff150c621a69ccd1283015b0d21183ee86c';
const SHEET_URLS={
sb:[`https://docs.google.com/spreadsheets/d/${SID}/gviz/tq?tqx=out:csv&sheet=Neverless`,`https://docs.google.com/spreadsheets/d/e/${PID}/pub?output=csv&gid=0`],
rc:[`https://docs.google.com/spreadsheets/d/${SID}/gviz/tq?tqx=out:csv&sheet=Revolut_Crypto`],
rr:[`https://docs.google.com/spreadsheets/d/${SID}/gviz/tq?tqx=out:csv&sheet=Revolut_Robo`]};
const CGM={BTC:'bitcoin',ETH:'ethereum',SOL:'solana',XRP:'ripple',ADA:'cardano',DOGE:'dogecoin',AVAX:'avalanche-2',LINK:'chainlink',UNI:'uniswap',AAVE:'aave',RENDER:'render-token',FET:'artificial-superintelligence-alliance',ARB:'arbitrum',OP:'optimism',SUI:'sui',TAO:'bittensor',PEPE:'pepe',BONK:'bonk',FLOKI:'floki',JUP:'jupiter-exchange-solana',PYTH:'pyth-network',USDC:'usd-coin',USDT:'tether',GRASS:'grass',ENA:'ethena',TON:'the-open-network',VIRTUAL:'virtuals-protocol',PENDLE:'pendle',LTC:'litecoin',ATOM:'cosmos',MEW:'cat-in-a-dogs-world',DOT:'polkadot',VET:'vechain',PI:'pi-network',HBAR:'hedera-hashgraph',ALGO:'algorand',MNT:'mantle',WLD:'worldcoin-wld',JASMY:'jasmycoin',CORE:'coredaoorg',AIOZ:'aioz-network',CRO:'crypto-com-chain',ZKJ:'polyhedra-network',SEI:'sei-network',DEGEN:'degen-base',ANKR:'ankr',NMR:'numeraire',TURBO:'turbo',CKB:'nervos-network',RSR:'reserve-rights-token',POPCAT:'popcat',MOODENG:'moo-deng',ACT:'act-i-the-ai-prophecy',CAT:'simon-s-cat',SATS:'1000sats',STEEM:'steem',API3:'api3',MOG:'mog-coin',BABYDOGE:'baby-doge-coin',AR:'arweave',AERO:'aerodrome-finance',CAKE:'pancakeswap-token',BCH:'bitcoin-cash',XAU:'pax-gold',COMP:'compound-governance-token',POL:'polygon-ecosystem-token',LUNA:'terra-luna-2',NOT:'notcoin',S:'sonic-svm',W:'wormhole',CFX:'conflux-token',SUPER:'superfarm',L3:'layer3',ELON:'dogelon-mars',RECALL:'recall',GOAT:'goatseus-maximus',CTXC:'cortex',SAMO:'samoyedcoin'};
const ETFY={WELK:'WELK.DE',XDWI:'XDWI.DE',EBUY:'EBUY.DE',AMEL:'AMEL.DE',LYMS:'LYMS.DE',LEMA:'LEMA.DE',PRAJ:'PRAJ.DE',LGQK:'LGQK.DE',LYP5:'LYP5.DE',LYP6:'LYP6.F','79U0':'MUSA.PA',EXW1:'EXW1.DE',EXI2:'EXI2.DE',IS3Q:'IS3Q.DE',IS3K:'IS3K.DE'};
const ETFN={'2B72':'Amundi MSCI EM II',WELK:'Amundi MSCI World Climate',EBUY:'Amundi World Ex-EU',AMEL:'Amundi MSCI EM III',LYMS:'Amundi EM Asia',LEMA:'Amundi EM LatAm',XDWI:'Xtrackers World IT',PRAJ:'Amundi Prime Japan','79U0':'Amundi MSCI USA',LYP5:'Amundi MSCI World',UBUD:'UBS MSCI Japan',LYP6:'Amundi Stoxx EU600',LGQK:'L&G Quality Div'};

// State
let sbTx=[],rcTx=[],rrTx=[],cryptoH={},etfH={},prices={},etfP={},mktData=[],pHist=[],fgData=null;
let sort={col:'value',dir:'desc'},selPer=7,eurUsd=1.16;
const cur=()=>document.documentElement.dataset.currency||'eur';
const isDark=()=>document.documentElement.dataset.theme==='dark';

// Password
async function sha256(s){const d=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s));return[...new Uint8Array(d)].map(b=>b.toString(16).padStart(2,'0')).join('');}
async function checkPwd(){const v=document.getElementById('gatePwd').value;if(await sha256(v)===PWD_HASH){localStorage.setItem('vault_auth','1');document.getElementById('gate').style.display='none';document.getElementById('app').style.display='flex';init();}else{document.getElementById('gateErr').textContent='Mot de passe incorrect';}}
document.addEventListener('DOMContentLoaded',()=>{document.getElementById('gatePwd').addEventListener('keydown',e=>{if(e.key==='Enter')checkPwd();});if(localStorage.getItem('vault_auth')==='1'){document.getElementById('gate').style.display='none';document.getElementById('app').style.display='flex';init();}});

// Theme & Currency
function toggleTheme(){const t=isDark()?'light':'dark';document.documentElement.dataset.theme=t;document.getElementById('btnTheme').textContent=t==='dark'?'🌙':'☀️';localStorage.setItem('vault_theme',t);}
function toggleCurrency(){const c=cur()==='eur'?'usd':'eur';document.documentElement.dataset.currency=c;document.getElementById('btnCur').textContent=c==='eur'?'€':'$';localStorage.setItem('vault_cur',c);renderH();renderSum();}
function toggleSidebar(){document.getElementById('sidebar').classList.toggle('collapsed');localStorage.setItem('vault_sb',document.getElementById('sidebar').classList.contains('collapsed')?'1':'0');}
function restorePrefs(){const t=localStorage.getItem('vault_theme')||'dark';document.documentElement.dataset.theme=t;document.getElementById('btnTheme').textContent=t==='dark'?'🌙':'☀️';const c=localStorage.getItem('vault_cur')||'eur';document.documentElement.dataset.currency=c;document.getElementById('btnCur').textContent=c==='eur'?'€':'$';if(localStorage.getItem('vault_sb')==='1')document.getElementById('sidebar').classList.add('collapsed');}

// Navigation
function go(p){document.querySelectorAll('.sb-link').forEach(l=>l.classList.toggle('active',l.dataset.page===p));document.querySelectorAll('.page').forEach(pg=>pg.classList.toggle('active',pg.id==='p-'+p));if(p==='analytics')renderAna();if(p==='market'&&!mktData.length)loadMkt();if(p==='evolution')renderEvo();}

// CSV
function parseCSV(t){const ls=t.split('\n');if(ls.length<2)return[];const h=csvL(ls[0]);return ls.slice(1).filter(l=>l.trim()).map(l=>{const v=csvL(l);const o={};h.forEach((k,i)=>{o[k.trim()]=(v[i]||'').trim();});return o;});}
function csvL(l){const r=[];let c='',q=false;for(const ch of l){if(ch==='"')q=!q;else if(ch===','&&!q){r.push(c);c='';}else c+=ch;}r.push(c);return r;}
function pn(s){if(!s)return 0;s=s.replace(/["\u00a0€$ ]/g,'');if(/[eE][+-]/.test(s))return parseFloat(s.replace(',','.'))||0;if(s.includes(',')&&!s.includes('.'))s=s.replace(',','.');return parseFloat(s)||0;}
async function getCSV(urls,lbl){for(const u of urls){try{const r=await fetch(u);if(!r.ok)continue;const t=await r.text();if(t.length>30&&!t.includes('<!DOCTYPE'))return t;}catch(e){}}return null;}

// Holdings
function compSB(tx){const b={},F=new Set(['EUR','USD']);tx.forEach(t=>{const ra=pn(t['Amount received']),rs=t['Asset received']||'';const sa=pn(t['Amount sent']),ss=t['Asset sent']||'';const fa=pn(t['Fee']),fs=t['Asset of the fee']||'';if(ra&&rs&&!F.has(rs))b[rs]=(b[rs]||0)+ra;if(sa&&ss&&!F.has(ss))b[ss]=(b[ss]||0)-sa;if(fa&&fs&&!F.has(fs))b[fs]=(b[fs]||0)-fa;});return b;}
function compRC(tx){const b={};tx.forEach(t=>{const s=(t.Symbol||'').trim(),tp=(t.Type||'').trim(),q=pn(t.Quantity);if(!s||!q)return;if(tp==='Achat'||tp.includes('compense'))b[s]=(b[s]||0)+q;else if(tp==='Vente'||tp==='Envoi')b[s]=(b[s]||0)-q;});return b;}
function compRR(tx){const b={};tx.forEach(t=>{const tk=(t.Ticker||'').trim(),tp=(t.Type||'').trim(),q=pn(t.Quantity);if(!tk||!q)return;if(tp.includes('BUY'))b[tk]=(b[tk]||0)+q;else if(tp.includes('SELL'))b[tk]=(b[tk]||0)-q;});return b;}
function merge(){cryptoH={};[compSB(sbTx),compRC(rcTx)].forEach(b=>{for(const[s,q]of Object.entries(b))cryptoH[s]=(cryptoH[s]||0)+q;});for(const s of Object.keys(cryptoH))if(Math.abs(cryptoH[s])<1e-7)delete cryptoH[s];etfH={};for(const[t,q]of Object.entries(compRR(rrTx)))if(q>1e-4)etfH[t]=q;}
function getSrc(s){const a=(compSB(sbTx)[s]||0)>1e-7,b=(compRC(rcTx)[s]||0)>1e-7;return a&&b?'Multi':b?'Revolut':'SwissBorg';}

// Prices
async function fetchEurUsd(){try{const r=await fetch(`${CG}/simple/price?ids=tether&vs_currencies=eur`);if(r.ok){const d=await r.json();if(d.tether?.eur)eurUsd=1/d.tether.eur;}}catch(e){}}
async function fetchPrices(a){const ids=[],m={};a.forEach(s=>{const id=CGM[s];if(id){ids.push(id);m[id]=s;}});if(!ids.length)return{};const pd={};for(let i=0;i<ids.length;i+=50){try{const r=await fetch(`${CG}/coins/markets?vs_currency=usd&ids=${ids.slice(i,i+50).join(',')}&order=market_cap_desc&sparkline=true&price_change_percentage=24h,7d,30d,1y`);if(r.ok)(await r.json()).forEach(c=>{const s=m[c.id];if(s)pd[s]={p:c.current_price||0,ch24:c.price_change_percentage_24h||0,ch7d:c.price_change_percentage_7d_in_currency||0,ch30d:c.price_change_percentage_30d_in_currency||0,ch1y:c.price_change_percentage_1y_in_currency||0,mc:c.market_cap||0,img:c.image||'',name:c.name||s,rank:c.market_cap_rank||999,ath:c.ath||0,athD:c.ath_date||'',spark:c.sparkline_in_7d?.price||[]};});if(i+50<ids.length)await sleep(1500);}catch(e){}}return pd;}
async function fetchETF(){etfP={};const lp={};rrTx.forEach(t=>{const tk=(t.Ticker||'').trim(),p=pn((t['Price per share']||'').replace('EUR',''));if(tk&&p>0)lp[tk]=p;});for(const tk of Object.keys(etfH)){const y=ETFY[tk];if(y){try{const ctrl=new AbortController();const tm=setTimeout(()=>ctrl.abort(),4000);const r=await fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(`https://query1.finance.yahoo.com/v8/finance/chart/${y}?interval=1d&range=5d`)}`,{signal:ctrl.signal});clearTimeout(tm);if(r.ok){const d=await r.json();const p=d?.chart?.result?.[0]?.meta?.regularMarketPrice;if(p){etfP[tk]={eur:p,name:ETFN[tk]||tk};continue;}}}catch(e){}}etfP[tk]={eur:lp[tk]||0,name:ETFN[tk]||tk};}}
async function fetchMkt(){try{const r=await fetch(`${CG}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=50&page=1&sparkline=false&price_change_percentage=24h,7d,30d,1y`);if(!r.ok)return[];const d=await r.json();const has=new Set(d.map(c=>c.id));const ex=[...new Set(Object.keys(cryptoH).filter(s=>cryptoH[s]>1e-7).map(s=>CGM[s]).filter(id=>id&&!has.has(id)))];if(!has.has('grass'))ex.push('grass');if(ex.length){await sleep(1200);try{const r2=await fetch(`${CG}/coins/markets?vs_currency=usd&ids=${ex.join(',')}&sparkline=false&price_change_percentage=24h,7d,30d,1y`);if(r2.ok)d.push(...await r2.json());}catch(e){}}return d;}catch(e){return[];}}
async function fetchFG(){try{const r=await fetch('https://api.alternative.me/fng/?limit=1');if(r.ok){const d=await r.json();if(d.data?.[0])fgData={v:parseInt(d.data[0].value),l:d.data[0].value_classification};}}catch(e){}}
function sleep(ms){return new Promise(r=>setTimeout(r,ms));}

// Display helpers
function cv(usd){return cur()==='eur'?usd/eurUsd:usd;}
function fv(usd){const v=cv(usd);const s=cur()==='eur'?'€':'$';if(Math.abs(v)>=1000)return s+v.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});if(Math.abs(v)>=1)return s+v.toFixed(2);if(Math.abs(v)>=0.01)return s+v.toFixed(4);return s+v.toFixed(6);}
function fq(v){if(v>=1e6)return(v/1e6).toFixed(2)+'M';if(v>=1000)return v.toLocaleString('en-US',{maximumFractionDigits:2});if(v>=1)return v.toFixed(4);return v.toFixed(6);}
function fmc(v){if(!v)return'--';if(v>=1e12)return'$'+(v/1e12).toFixed(1)+'T';if(v>=1e9)return'$'+(v/1e9).toFixed(1)+'B';if(v>=1e6)return'$'+(v/1e6).toFixed(1)+'M';return'$'+v.toLocaleString();}
function chClass(v){return v>=0?'green':'red';}
function chText(v){return(v>=0?'+':'')+v.toFixed(2)+'%';}

// Sparkline SVG
function sparkSVG(data,w=80,h=28){if(!data||data.length<2)return'';const mn=Math.min(...data),mx=Math.max(...data),rng=mx-mn||1;const pts=data.map((v,i)=>`${(i/(data.length-1))*w},${h-((v-mn)/rng)*h}`);const up=data[data.length-1]>=data[0];const col=up?'var(--green)':'var(--red)';return`<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><polyline points="${pts.join(' ')}" fill="none" stroke="${col}" stroke-width="1.5" stroke-linejoin="round"/></svg>`;}

// All items
function allItems(){const it=[];for(const[s,q]of Object.entries(cryptoH)){if(q<=1e-7)continue;const p=prices[s]||{};it.push({sym:s,qty:q,usd:q*(p.p||0),ch24:p.ch24||0,ch7d:p.ch7d||0,ch30d:p.ch30d||0,ch1y:p.ch1y||0,img:p.img||'',name:p.name||s,type:'crypto',src:getSrc(s),spark:p.spark||[]});}
for(const[tk,q]of Object.entries(etfH)){const e=etfP[tk]||{};it.push({sym:tk,qty:q,usd:q*(e.eur||0)*eurUsd,eur:q*(e.eur||0),priceEUR:e.eur||0,ch24:0,ch7d:0,ch30d:0,ch1y:0,img:'',name:e.name||ETFN[tk]||tk,type:'etf',src:'Robo',spark:[]});}
return it;}

// Render Holdings
function renderH(){const tb=document.getElementById('holdBody');let it=allItems().filter(i=>i.usd>=10);
it.sort((a,b)=>{let va,vb;switch(sort.col){case'name':return sort.dir==='asc'?a.sym.localeCompare(b.sym):b.sym.localeCompare(a.sym);case'qty':va=a.qty;vb=b.qty;break;case'price':va=a.type==='etf'?(a.priceEUR||0)*eurUsd:(prices[a.sym]?.p||0);vb=b.type==='etf'?(b.priceEUR||0)*eurUsd:(prices[b.sym]?.p||0);break;case'value':va=a.usd;vb=b.usd;break;case'ch24':va=a.ch24;vb=b.ch24;break;case'ch7d':va=a.ch7d;vb=b.ch7d;break;case'ch30d':va=a.ch30d;vb=b.ch30d;break;case'ch1y':va=a.ch1y;vb=b.ch1y;break;default:va=a.usd;vb=b.usd;}return sort.dir==='asc'?va-vb:vb-va;});
const tot=it.reduce((s,i)=>s+i.usd,0);
if(!it.length){tb.innerHTML='<tr><td colspan="10" class="muted center">Aucune position ≥ 10$</td></tr>';return;}
const sc={SwissBorg:'#22c55e',Revolut:'#3b82f6',Multi:'#8b5cf6',Robo:'#f97316'};
tb.innerHTML=it.map(i=>{const al=tot>0?(i.usd/tot*100):0;const e=i.type==='etf';const pr=e?`€${i.priceEUR.toFixed(2)}`:fv(prices[i.sym]?.p||0);
const fc=(v,isE)=>isE?'<td class="muted">—</td>':`<td class="${chClass(v)}">${chText(v)}</td>`;
const c=sc[i.src]||'#888';
return`<tr>
<td><div class="asset-cell"><div class="asset-img">${i.img?`<img src="${i.img}" onerror="this.parentElement.textContent='${i.sym.slice(0,2)}'">`:i.sym.slice(0,2)}</div><div class="asset-info"><div class="name">${e?i.sym:i.name}<span class="src-tag" style="background:${c}20;color:${c}">${i.src}</span></div><div class="sym">${e?i.name.substring(0,28):i.sym}</div></div></div></td>
<td class="mono">${fq(i.qty)}</td><td class="mono">${pr}</td><td class="mono" style="font-weight:600">${fv(i.usd)}</td>
${fc(i.ch24,e)}${fc(i.ch7d,e)}${fc(i.ch30d,e)}${fc(i.ch1y,e)}
<td class="spark-cell">${sparkSVG(i.spark)}</td>
<td><div class="alloc-wrap"><div class="alloc-bar"><div class="alloc-fill" style="width:${Math.min(al,100)}%"></div></div><span class="alloc-pct">${al.toFixed(1)}%</span></div></td>
</tr>`;}).join('');}

function sortCol(c){if(sort.col===c)sort.dir=sort.dir==='desc'?'asc':'desc';else{sort.col=c;sort.dir='desc';}document.querySelectorAll('.htable th').forEach(t=>{t.classList.remove('sorted','asc','desc');});const th=document.querySelector(`.htable th[data-col="${c}"]`);if(th){th.classList.add('sorted',sort.dir);}renderH();}

function renderSum(){const it=allItems();const tot=it.reduce((s,i)=>s+i.usd,0);
const cryptoUSD=it.filter(i=>i.type==='crypto').reduce((s,i)=>s+i.usd,0);
const etfEUR=it.filter(i=>i.type==='etf').reduce((s,i)=>s+(i.eur||0),0);
document.getElementById('kpiTotal').textContent=fv(tot);
document.getElementById('kpiBreak').innerHTML=`${fv(cryptoUSD)}<span style="font-size:0.75rem;color:var(--fg3)"> / €${etfEUR.toFixed(0)}</span>`;
// 24h change
const ci=it.filter(i=>i.type==='crypto'&&i.usd>=10);const ct=ci.reduce((s,i)=>s+i.usd,0);
if(ct>0){const w=ci.reduce((s,i)=>s+(i.ch24*i.usd),0)/ct;document.getElementById('kpiChange').innerHTML=`<span class="${chClass(w)}">${w>=0?'▲':'▼'} ${chText(w)}</span>`;}
// Invested
let inv=0;sbTx.forEach(t=>{if(t.Type==='Deposit'&&['EUR','USD'].includes(t['Asset received']))inv+=pn(t['Amount received'])*(t['Asset received']==='EUR'?eurUsd:1);});
rrTx.forEach(t=>{if((t.Type||'').includes('CASH TOP-UP'))inv+=pn((t['Total Amount']||'').replace(/[^0-9.,]/g,''))*eurUsd;});
rcTx.forEach(t=>{if((t.Type||'').trim()==='Achat')inv+=pn((t.Value||'').replace(/[^0-9.,]/g,''))*eurUsd;});
document.getElementById('kpiInv').textContent=fv(inv);
const pnl=tot-inv;document.getElementById('kpiPnl').innerHTML=`<span class="${chClass(pnl)}">${fv(pnl)}</span>`;
// Best
const best=ci.sort((a,b)=>b.ch24-a.ch24)[0];if(best)document.getElementById('kpiTotal').title=`Best: ${best.sym} ${chText(best.ch24)}`;
// F&G
if(fgData){let c=fgData.v>55?'var(--green)':fgData.v>25?'var(--orange)':'var(--red)';document.getElementById('kpiFG').innerHTML=`<span style="color:${c}">${fgData.v}</span><span style="font-size:0.7rem;color:${c};display:block">${fgData.l}</span>`;}}

// Market
function renderMkt(){const g=document.getElementById('mktGrid');if(!mktData.length){g.innerHTML='<p class="muted center">Non disponible</p>';return;}
const owned=new Set(Object.entries(cryptoH).filter(([s,q])=>q>1e-7).map(([s])=>s.toUpperCase()));
const sorted=[...mktData].sort((a,b)=>{const ao=owned.has(a.symbol.toUpperCase())?0:1,bo=owned.has(b.symbol.toUpperCase())?0:1;if(ao!==bo)return ao-bo;return(a.market_cap_rank||999)-(b.market_cap_rank||999);});
g.innerHTML=sorted.map(c=>{const ow=owned.has(c.symbol.toUpperCase());const athD=c.ath_date?new Date(c.ath_date).toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit',year:'numeric'}):'';
const ch=(k)=>{const v=c['price_change_percentage_'+k+'_in_currency']||(k==='24h'?c.price_change_percentage_24h:0)||0;return`<span class="lbl">${k}</span><span class="${chClass(v)}">${chText(v)}</span>`;};
return`<div class="mkt-card ${ow?'owned':''}" data-name="${c.name.toLowerCase()} ${c.symbol}">
<div class="mkt-top"><div class="mkt-asset"><div class="asset-img"><img src="${c.image}" onerror="this.parentElement.textContent='${c.symbol.slice(0,2).toUpperCase()}'"></div><div><div style="font-weight:600">${c.symbol.toUpperCase()}</div><div style="font-size:0.72rem;color:var(--fg3)">${c.name}</div></div></div><div>${ow?'<span class="mkt-owned">Détenu</span>':''}<span class="mkt-rank">#${c.market_cap_rank||'--'}</span></div></div>
<div class="mkt-price">${fv(c.current_price)}</div>
<div class="mkt-changes">${ch('24h')}${ch('7d')}${ch('30d')}${ch('1y')}</div>
<div class="mkt-ath">ATH: ${fv(c.ath||0)} — ${athD}</div>
<div class="mkt-mcap">MCap: ${fmc(c.market_cap)}</div>
</div>`;}).join('');}
function filterMkt(){const q=document.getElementById('mktSearch').value.toLowerCase();document.querySelectorAll('.mkt-card').forEach(c=>{c.style.display=(c.dataset.name||'').includes(q)?'':'none';});}

// History
function renderHist(){const list=document.getElementById('histList');const tf=document.getElementById('hType').value,af=document.getElementById('hAsset').value;
let all=[];
sbTx.forEach(t=>{const d=t.Date?new Date(t.Date):null;all.push({date:d,type:t.Type||'',src:'SB',rq:pn(t['Amount received']),ra:t['Asset received']||'',sq:pn(t['Amount sent']),sa:t['Asset sent']||'',desc:t.Description||''});});
rcTx.forEach(t=>{let d=null;try{const mo={janv:'Jan','févr':'Feb',mars:'Mar',avr:'Apr',mai:'May',juin:'Jun',juil:'Jul','août':'Aug',sept:'Sep',oct:'Oct',nov:'Nov','déc':'Dec'};let s=(t.Date||'');for(const[f,e]of Object.entries(mo))s=s.replace(f+'.',e).replace(f,e);d=new Date(s);if(isNaN(d))d=null;}catch(e){}const tp=(t.Type||'').trim(),sym=(t.Symbol||'').trim(),q=pn(t.Quantity);if(tp==='Achat')all.push({date:d,type:'Trade',src:'RC',rq:q,ra:sym,sq:0,sa:'',desc:'Achat'});else if(tp==='Vente')all.push({date:d,type:'Trade',src:'RC',rq:0,ra:'',sq:q,sa:sym,desc:'Vente'});else if(tp.includes('compense'))all.push({date:d,type:'Deposit',src:'RC',rq:q,ra:sym,sq:0,sa:'',desc:tp});else if(tp==='Envoi')all.push({date:d,type:'Trade',src:'RC',rq:0,ra:'',sq:q,sa:sym,desc:'Envoi'});});
rrTx.forEach(t=>{const d=t.Date?new Date(t.Date):null;const tk=(t.Ticker||'').trim(),tp=(t.Type||'').trim(),q=pn(t.Quantity);if(!tk)return;if(tp.includes('BUY'))all.push({date:d,type:'Trade',src:'RR',rq:q,ra:tk,sq:0,sa:'',desc:'Achat ETF'});else if(tp.includes('SELL'))all.push({date:d,type:'Trade',src:'RR',rq:0,ra:'',sq:q,sa:tk,desc:'Vente ETF'});else if(tp.includes('DIVIDEND'))all.push({date:d,type:'Deposit',src:'RR',rq:0,ra:tk,sq:0,sa:'',desc:'Dividende'});});
let f=all.filter(t=>t.date).sort((a,b)=>b.date-a.date);
if(tf!=='all')f=f.filter(t=>t.type===tf);if(af!=='all')f=f.filter(t=>t.ra===af||t.sa===af);f=f.slice(0,200);
if(!f.length){list.innerHTML='<p class="muted center">Aucune transaction</p>';return;}
const sc={SB:'#22c55e',RC:'#3b82f6',RR:'#f97316'};
list.innerHTML=f.map(t=>{const ds=t.date.toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit',year:'2-digit'});const ts=t.date.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'});const tc=t.type==='Trade'?'trade':'deposit';const c=sc[t.src]||'#888';
return`<div class="hist-item"><div class="hist-date">${ds}<br>${ts}</div><div class="hist-type ${tc}">${t.type}</div><div class="hist-recv">${t.rq?'+'+fq(t.rq)+' '+t.ra:'—'}</div><div class="hist-sent">${t.sq?'-'+fq(t.sq)+' '+t.sa:'—'}</div><div class="hist-desc"><span style="color:${c};font-size:0.6rem;font-weight:600">${t.src}</span> ${t.desc}</div></div>`;}).join('');}
function popFilter(){const sel=document.getElementById('hAsset');sel.innerHTML='<option value="all">Tous</option>';const a=new Set();sbTx.forEach(t=>{if(t['Asset received'])a.add(t['Asset received']);if(t['Asset sent'])a.add(t['Asset sent']);});rcTx.forEach(t=>{if(t.Symbol)a.add(t.Symbol);});rrTx.forEach(t=>{if(t.Ticker)a.add(t.Ticker);});[...a].filter(x=>!['EUR','USD'].includes(x)).sort().forEach(x=>{const o=document.createElement('option');o.value=x;o.textContent=x;sel.appendChild(o);});}

// Analytics
function renderAna(){const cv=document.getElementById('donutChart');cv.width=460;cv.height=380;const ctx=cv.getContext('2d');
const it=allItems().filter(i=>i.usd>=10).sort((a,b)=>b.usd-a.usd);const tot=it.reduce((s,i)=>s+i.usd,0);if(!tot)return;
const cols=['#4f6ef7','#6c8aff','#22c55e','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#ec4899','#f97316','#14b8a6','#e11d48','#6366f1'];
const cx=cv.width/2,cy=cv.height/2,R=130,iR=R*0.45;ctx.clearRect(0,0,cv.width,cv.height);
let sa=-Math.PI/2;const top=it.slice(0,10);const ov=it.slice(10).reduce((s,i)=>s+i.usd,0);if(ov>0)top.push({sym:'Autres',usd:ov});
top.forEach((i,j)=>{const sl=(i.usd/tot)*Math.PI*2;ctx.beginPath();ctx.arc(cx,cy,R,sa,sa+sl);ctx.arc(cx,cy,iR,sa+sl,sa,true);ctx.closePath();ctx.fillStyle=cols[j%cols.length];ctx.fill();
const p=i.usd/tot;if(p>=0.04){const mid=sa+sl/2,lr=(R+iR)/2;ctx.save();ctx.fillStyle='#fff';ctx.font='bold 10px Inter';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(i.sym,cx+Math.cos(mid)*lr,cy+Math.sin(mid)*lr-5);ctx.font='9px "JetBrains Mono"';ctx.fillText((p*100).toFixed(1)+'%',cx+Math.cos(mid)*lr,cy+Math.sin(mid)*lr+8);ctx.restore();}
sa+=sl;});
const tCol=isDark()?'#e4e6f0':'#1a1d26';ctx.fillStyle=tCol;ctx.font='bold 16px "JetBrains Mono"';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(fv(tot),cx,cy);
const leg=document.getElementById('donutLeg');leg.innerHTML=top.map((i,j)=>`<span><i style="background:${cols[j%cols.length]}"></i>${i.sym} ${fv(i.usd)}</span>`).join('');
// Activity
const cv2=document.getElementById('actChart');const c2=cv2.getContext('2d');c2.clearRect(0,0,cv2.width,cv2.height);const mo={};[...sbTx,...rcTx,...rrTx].forEach(t=>{const d=t.Date?new Date(t.Date):null;if(!d||isNaN(d))return;const k=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;mo[k]=(mo[k]||0)+1;});const ms=Object.keys(mo).sort().slice(-12);const vs=ms.map(m=>mo[m]);const mx=Math.max(...vs,1);const p=40,w=cv2.width-p*2,h=cv2.height-p*2;const bw=w/ms.length*0.7,gp=w/ms.length*0.3;
const gridC=isDark()?'#252a3a':'#e0e3ec';c2.strokeStyle=gridC;c2.lineWidth=0.5;for(let i=0;i<=4;i++){const y=p+(h*i/4);c2.beginPath();c2.moveTo(p,y);c2.lineTo(cv2.width-p,y);c2.stroke();}
const lblC=isDark()?'#5f6580':'#9298b0';ms.forEach((m,i)=>{const x=p+i*(bw+gp)+gp/2;const bh=(vs[i]/mx)*h,y=p+h-bh;const g=c2.createLinearGradient(x,y,x,p+h);g.addColorStop(0,'#4f6ef7');g.addColorStop(1,isDark()?'rgba(79,110,247,0.1)':'rgba(79,110,247,0.15)');c2.fillStyle=g;c2.beginPath();c2.roundRect(x,y,bw,bh,[3,3,0,0]);c2.fill();c2.fillStyle=lblC;c2.font='9px "JetBrains Mono"';c2.textAlign='center';c2.fillText(m.slice(5),x+bw/2,p+h+15);c2.fillText(vs[i],x+bw/2,y-5);});
// Stats
document.getElementById('statGrid').innerHTML=[{v:sbTx.filter(t=>t.Type==='Trade').length+rcTx.filter(t=>['Achat','Vente'].includes((t.Type||'').trim())).length,l:'Trades crypto'},{v:rrTx.filter(t=>(t.Type||'').includes('BUY')||(t.Type||'').includes('SELL')).length,l:'Trades ETF'},{v:Object.keys(cryptoH).filter(s=>cryptoH[s]>1e-7).length,l:'Cryptos'},{v:Object.keys(etfH).length,l:'ETFs'},{v:sbTx.length+rcTx.length+rrTx.length,l:'Opérations'}].map(s=>`<div class="stat-item"><div class="sv">${s.v.toLocaleString()}</div><div class="sl">${s.l}</div></div>`).join('');}

// Upload
async function doUpload(tab,input){const f=input.files[0];if(!f)return;const sid={Neverless:'sNev',Revolut_Crypto:'sRC',Revolut_Robo:'sRR'}[tab];const el=document.getElementById(sid);el.textContent='⏳ Envoi...';el.style.color='var(--orange)';
const text=await f.text();const lines=text.split('\n').filter(l=>l.trim());const csvData=lines.map(l=>csvL(l));
try{await fetch(GAS,{method:'POST',headers:{'Content-Type':'text/plain'},body:JSON.stringify({action:'upload_csv',tabName:tab,csvData}),mode:'no-cors'});el.textContent=`✅ ${csvData.length} lignes envoyées`;el.style.color='var(--green)';setTimeout(()=>refreshAll(),3000);}catch(e){el.textContent='❌ '+e.message;el.style.color='var(--red)';}}

// Evolution
async function logVal(v,n){try{await fetch(GAS,{method:'POST',headers:{'Content-Type':'text/plain'},body:JSON.stringify({action:'log_value',valueUSD:v,valueEUR:v/eurUsd,nbAssets:n}),mode:'no-cors'});}catch(e){}}
async function fetchHist(){try{const r=await fetch(GAS);if(!r.ok)return[];const j=await r.json();if(j.status==='ok'&&j.data)return j.data.map(d=>({date:new Date(d.date),v:d.valueUSD})).sort((a,b)=>a.date-b.date);}catch(e){}return[];}
function setPeriod(d){selPer=d;document.querySelectorAll('.pbtn').forEach(b=>b.classList.remove('active'));event.target.classList.add('active');renderEvo();}
function renderEvo(){const cv=document.getElementById('evoChart');const ctx=cv.getContext('2d');ctx.clearRect(0,0,cv.width,cv.height);
const tCol=isDark()?'#e4e6f0':'#1a1d26';const mutCol=isDark()?'#5f6580':'#9298b0';const gridCol=isDark()?'#252a3a':'#e0e3ec';
if(pHist.length<2){ctx.fillStyle=mutCol;ctx.font='14px Inter';ctx.textAlign='center';ctx.fillText('Pas assez de données. Revenez régulièrement.',cv.width/2,cv.height/2-10);ctx.font='12px "JetBrains Mono"';ctx.fillText(`${pHist.length} point(s)`,cv.width/2,cv.height/2+15);document.getElementById('evoStats').innerHTML='';return;}
let data=[...pHist];if(selPer>0){const cut=new Date();cut.setDate(cut.getDate()-selPer);data=data.filter(d=>d.date>=cut);}
if(data.length<2){ctx.fillStyle=mutCol;ctx.font='14px Inter';ctx.textAlign='center';ctx.fillText('Pas assez de données sur cette période.',cv.width/2,cv.height/2);return;}
const pad={t:30,r:20,b:45,l:70};const w=cv.width-pad.l-pad.r,h=cv.height-pad.t-pad.b;
const vs=data.map(d=>d.v);const mn=Math.min(...vs)*0.95,mx=Math.max(...vs)*1.05,rn=mx-mn||1;
const xS=i=>pad.l+(i/(data.length-1))*w;const yS=v=>pad.t+h-((v-mn)/rn)*h;
ctx.strokeStyle=gridCol;ctx.lineWidth=0.5;for(let i=0;i<=5;i++){const y=pad.t+(h*i/5);const v=mx-(i/5)*rn;ctx.beginPath();ctx.moveTo(pad.l,y);ctx.lineTo(pad.l+w,y);ctx.stroke();ctx.fillStyle=mutCol;ctx.font='10px "JetBrains Mono"';ctx.textAlign='right';ctx.fillText(fv(v),pad.l-6,y+4);}
const lc=Math.min(data.length,8),sp=Math.max(1,Math.floor(data.length/lc));ctx.fillStyle=mutCol;ctx.font='10px "JetBrains Mono"';ctx.textAlign='center';for(let i=0;i<data.length;i+=sp)ctx.fillText(data[i].date.toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit'}),xS(i),pad.t+h+18);
const up=vs[vs.length-1]>=vs[0];const lineC=up?'#22c55e':'#ef4444';
const g=ctx.createLinearGradient(0,pad.t,0,pad.t+h);g.addColorStop(0,(up?'rgba(34,197,94,':'rgba(239,68,68,')+'0.15)');g.addColorStop(1,(up?'rgba(34,197,94,':'rgba(239,68,68,')+'0.02)');
ctx.beginPath();ctx.moveTo(xS(0),pad.t+h);data.forEach((d,i)=>ctx.lineTo(xS(i),yS(d.v)));ctx.lineTo(xS(data.length-1),pad.t+h);ctx.closePath();ctx.fillStyle=g;ctx.fill();
ctx.beginPath();data.forEach((d,i)=>{i===0?ctx.moveTo(xS(i),yS(d.v)):ctx.lineTo(xS(i),yS(d.v));});ctx.strokeStyle=lineC;ctx.lineWidth=2;ctx.lineJoin='round';ctx.stroke();
[0,data.length-1].forEach(i=>{const x=xS(i),y=yS(data[i].v);ctx.beginPath();ctx.arc(x,y,4,0,Math.PI*2);ctx.fillStyle=lineC;ctx.fill();ctx.strokeStyle=isDark()?'#151821':'#fff';ctx.lineWidth=2;ctx.stroke();ctx.fillStyle=tCol;ctx.font='bold 11px Inter';ctx.textAlign=i===0?'left':'right';ctx.fillText(fv(data[i].v),x+(i===0?8:-8),y-8);});
// Stats
const el=document.getElementById('evoStats');const last=data[data.length-1].v;
function ago(d){const cut=new Date();cut.setDate(cut.getDate()-d);let cl=null,md=Infinity;pHist.forEach(p=>{const dd=Math.abs(p.date-cut);if(dd<md){md=dd;cl=p;}});return cl?.v;}
let html='';[{l:'1j',d:1},{l:'7j',d:7},{l:'30j',d:30},{l:'3m',d:90},{l:'6m',d:180},{l:'1an',d:365},{l:'2ans',d:730}].forEach(p=>{const pv=ago(p.d);if(pv&&pv>0){const ch=((last-pv)/pv)*100;html+=`<div class="evo-stat"><div class="ev-label">${p.l}</div><div class="ev-val ${chClass(ch)}">${chText(ch)}</div></div>`;}});
html+=`<div class="evo-stat"><div class="ev-label">Plus haut</div><div class="ev-val">${fv(Math.max(...vs))}</div></div>`;
html+=`<div class="evo-stat"><div class="ev-label">Plus bas</div><div class="ev-val">${fv(Math.min(...vs))}</div></div>`;
el.innerHTML=html;}

// Status
function setS(t,live){document.getElementById('statusTxt').textContent=t;document.querySelector('.dot').classList.toggle('live',!!live);}
function updTime(){document.getElementById('lastUpd').textContent=new Date().toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'});}

// Loading
async function loadSheets(){setS('Données...');const sb=await getCSV(SHEET_URLS.sb,'SB');if(sb)sbTx=parseCSV(sb);const rc=await getCSV(SHEET_URLS.rc,'RC');if(rc)rcTx=parseCSV(rc);const rr=await getCSV(SHEET_URLS.rr,'RR');if(rr)rrTx=parseCSV(rr);merge();popFilter();renderHist();return sbTx.length>0;}
async function loadPrices(){setS('Prix...');const a=Object.entries(cryptoH).filter(([s,q])=>q>1e-7).map(([s])=>s);prices=await fetchPrices(a);setS('ETF...');await fetchETF();renderH();renderSum();setS('En direct',true);}
async function loadMkt(){setS('Marché...');mktData=await fetchMkt();renderMkt();setS('En direct',true);}
async function refreshAll(){const b=document.querySelector('.topbar-refresh');b.classList.add('spin');await loadSheets();await loadPrices();if(mktData.length)await loadMkt();setS('En direct',true);updTime();b.classList.remove('spin');}

async function init(){restorePrefs();setS('Initialisation...');await Promise.all([fetchFG(),fetchEurUsd()]);
const ok=await loadSheets();if(ok){await loadPrices();const it=allItems();const tot=it.reduce((s,i)=>s+i.usd,0);if(tot>0)logVal(tot,it.filter(i=>i.usd>=10).length);
pHist=await fetchHist();if(pHist.length)document.getElementById('evoStatus').textContent=`${pHist.length} points · Depuis ${pHist[0].date.toLocaleDateString('fr-FR')}`;}
setS('En direct',true);updTime();setInterval(async()=>{await loadPrices();updTime();},60000);}

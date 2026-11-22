/* VAULT — journal technique.
   Petite fenêtre type terminal, sur toutes les pages, qui montre ce que fait l'app :
   - « Navigateur » : chaque appel réseau (fetch) en direct, avec méthode, adresse, statut, durée, taille
     et un aperçu de la réponse ; les actions (navigation, actualisation) ; les erreurs JavaScript.
   - « Serveur » : la dernière exécution GitHub Actions (étapes, durées) et les appels IA du comité
     (modèles, décision), qui tournent sur GitHub et non dans le navigateur.
   Les secrets (clé VAULT, jetons) sont masqués avant affichage. Chargé avant app.js. */
(function () {
  const MAX = 400, REPO = 'jcousquersuper10count/Crypto';
  const lines = [];
  let pending = 0, box = null, body = null, tab = 'nav', srvLoaded = false;
  const t0 = performance.now();
  const ts = () => new Date().toLocaleTimeString('fr-FR', { hour12: false });
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const mask = s => String(s)
    .replace(/([?&#](?:key|cle|token|apikey|api_key)=)[^&#\s"]+/gi, '$1••••')
    .replace(/("(?:key|cle|token|vault_key)"\s*:\s*")[^"]+/gi, '$1••••');
  const kb = n => n < 1024 ? n + ' o' : (n / 1024).toFixed(1).replace('.', ',') + ' ko';
  const nativeFetch = window.fetch.bind(window);

  function where(u) {
    if (/script\.google(usercontent)?\.com/.test(u)) return 'Google Sheet · Apps Script';
    if (/api\.github\.com/.test(u)) return 'GitHub API';
    if (/(^|\/)data\/[^/]+\.json/.test(u)) return 'données VAULT · GitHub Pages';
    if (/coingecko/.test(u)) return 'API prix · CoinGecko';
    if (/neverless/.test(u)) return 'API Neverless';
    if (/frankfurter|ecb|exchangerate/.test(u)) return 'API change €/$';
    if (/yahoo|stooq|boursorama|justetf/.test(u)) return 'API cours ETF';
    try { return new URL(u, location.href).host; } catch (e) { return ''; }
  }
  function short(u) {
    try { const x = new URL(u, location.href); return (x.host === location.host ? '' : x.host) + x.pathname + x.search; } catch (e) { return u; }
  }

  function log(kind, html) {
    lines.push({ kind, html: `<span class="vc-t">${ts()}</span> ${html}` });
    if (lines.length > MAX) lines.shift();
    if (body && tab === 'nav') { body.insertAdjacentHTML('beforeend', `<div class="vc-l vc-${kind}">${lines[lines.length - 1].html}</div>`); if (body.children.length > MAX) body.firstChild.remove(); stick(); }
    badge();
  }
  function stick() { if (body) body.scrollTop = body.scrollHeight; }
  function badge() {
    const b = document.getElementById('vcBtn'); if (!b) return;
    b.classList.toggle('busy', pending > 0);
    b.querySelector('.vc-n').textContent = pending > 0 ? `${pending} en cours` : 'Journal';
  }

  // --- appels réseau ---
  window.fetch = async function (input, init) {
    const url = typeof input === 'string' ? input : (input && input.url) || String(input);
    const method = ((init && init.method) || (input && input.method) || 'GET').toUpperCase();
    let extra = '';
    if (init && init.body && typeof init.body === 'string') {
      let a = '';
      try { a = JSON.parse(init.body).action || ''; } catch (e) { try { a = new URLSearchParams(init.body).get('action') || ''; } catch (e2) { } }
      extra = ` <span class="vc-d">body: ${a ? `{action: "${esc(a)}", …}` : ''} ${kb(init.body.length)}</span>`;
    }
    const act = (url.match(/[?&]action=([^&]+)/) || [])[1];
    pending++;
    log('req', `<span class="vc-k">await</span> fetch(<span class="vc-s">"${esc(mask(short(url)))}"</span>${method !== 'GET' ? `, {method: <span class="vc-s">"${method}"</span>}` : ''}) <span class="vc-d">// ${esc(where(url))}${act ? ' · action=' + esc(act) : ''}</span>${extra}`);
    const t = performance.now();
    try {
      const r = await nativeFetch(input, init);
      const ms = Math.round(performance.now() - t);
      pending--;
      r.clone().text().then(txt => {
        const prev = txt.length > 0 ? mask(txt.slice(0, 110).replace(/\s+/g, ' ')) + (txt.length > 110 ? '…' : '') : '';
        log(r.ok ? 'ok' : 'err', `<span class="vc-a">←</span> ${r.status} ${r.ok ? 'OK' : esc(r.statusText || 'erreur')} · ${ms} ms · ${kb(txt.length)} <span class="vc-d">${esc(short(url).split('?')[0].split('/').pop() || '')}</span>${prev ? `<div class="vc-p">${esc(prev)}</div>` : ''}`);
      }).catch(() => log(r.ok ? 'ok' : 'err', `<span class="vc-a">←</span> ${r.status} · ${ms} ms`));
      return r;
    } catch (e) {
      pending--;
      log('err', `<span class="vc-a">✕</span> échec réseau · ${Math.round(performance.now() - t)} ms · ${esc(e.message || e)}`);
      throw e;
    }
  };

  // --- erreurs ---
  window.addEventListener('error', e => log('err', `<span class="vc-k">Error</span> ${esc(e.message)} <span class="vc-d">${esc((e.filename || '').split('/').pop().split('?')[0])}:${e.lineno || ''}</span>`));
  window.addEventListener('unhandledrejection', e => log('err', `<span class="vc-k">Promise rejetée</span> ${esc((e.reason && e.reason.message) || e.reason)}`));

  // --- actions (enveloppées une fois tous les scripts chargés) ---
  function wrapActions() {
    const names = { go: 'navigation', refreshAll: 'actualisation complète', toggleTheme: 'thème', toggleCurrency: 'devise', openManual: 'saisie d\'une opération', saveKey: 'clé VAULT enregistrée' };
    Object.keys(names).forEach(n => {
      const f = window[n]; if (typeof f !== 'function' || f.__vc) return;
      const w = function (...a) { log('act', `<span class="vc-k">${n}</span>(${a.filter(x => typeof x === 'string').map(x => `<span class="vc-s">"${esc(x)}"</span>`).join(', ')}) <span class="vc-d">// ${names[n]}</span>`); return f.apply(this, a); };
      w.__vc = true; window[n] = w;
    });
    log('act', `<span class="vc-k">ready</span> · page chargée en ${Math.round(performance.now() - t0)} ms`);
  }

  // --- côté serveur ---
  async function loadServer() {
    const out = [];
    const L = (k, h) => out.push(`<div class="vc-l vc-${k}">${h}</div>`);
    body.innerHTML = '<div class="vc-l vc-d">chargement…</div>';
    try {
      const runs = await (await nativeFetch(`https://api.github.com/repos/${REPO}/actions/workflows/signals.yml/runs?per_page=1`)).json();
      const run = runs.workflow_runs && runs.workflow_runs[0];
      if (run) {
        const when = new Date(run.run_started_at || run.created_at).toLocaleString('fr-FR');
        L('req', `<span class="vc-k">$</span> gh run view ${run.id} <span class="vc-d"># workflow « ${esc(run.name)} », lancé ${esc(when)} (${run.event === 'schedule' ? 'automatique' : run.event})</span>`);
        L(run.conclusion === 'success' ? 'ok' : run.status === 'completed' ? 'err' : 'act', `statut : ${esc(run.status)}${run.conclusion ? ' · ' + esc(run.conclusion) : ''}`);
        const jobs = await (await nativeFetch(run.jobs_url)).json();
        (jobs.jobs || []).forEach(j => (j.steps || []).forEach(s => {
          const d = s.started_at && s.completed_at ? Math.round((new Date(s.completed_at) - new Date(s.started_at)) / 1000) : null;
          const ic = s.conclusion === 'success' ? '✓' : s.conclusion === 'skipped' ? '–' : s.conclusion ? '✕' : '…';
          L(s.conclusion === 'success' ? 'ok' : s.conclusion === 'skipped' ? 'd' : s.conclusion ? 'err' : 'act', `  ${ic} ${esc(s.name)}${d != null ? ` <span class="vc-d">${d >= 60 ? Math.floor(d / 60) + ' min ' + (d % 60) + ' s' : d + ' s'}</span>` : ''}`);
        }));
      }
    } catch (e) { L('err', `GitHub API indisponible : ${esc(e.message || e)}`); }
    try {
      const ag = await (await nativeFetch('data/agent.json?t=' + Date.now())).json();
      const lg = ag.ia_log || {}, k = Object.keys(lg).sort().pop();
      if (k) {
        const e = lg[k];
        L('req', `<span class="vc-k">$</span> python kronos/paper.py <span class="vc-d"># comité IA, clôture du ${esc(k)}, calculé ${esc(new Date(ag.genere).toLocaleString('fr-FR'))}</span>`);
        if (e.reel) L('act', `reel = {env_eur: ${e.reel.env_eur}, repartition: ${esc(JSON.stringify(e.reel.repartition))}}`);
        Object.entries(e.avis || {}).forEach(([p, v]) => {
          L('req', `<span class="vc-k">POST</span> ${p === 'groq' ? 'api.groq.com/openai/v1/chat/completions' : p === 'gemini' ? 'generativelanguage.googleapis.com/…:generateContent' : esc(p)} <span class="vc-d">// modèle ${esc(v.modele || '?')}</span>`);
          L('ok', `  ← cible = ${esc(JSON.stringify(v.cible || {}))}`);
          L('d', `  « ${esc(String(v.decision || '').slice(0, 160))}${String(v.decision || '').length > 160 ? '…' : ''} »`);
        });
        if (e.mix) L('act', `juge → cible retenue = ${esc(JSON.stringify(e.mix.cible || {}))}${e.mix.juge ? ' <span class="vc-d">// ' + esc(e.mix.juge) + '</span>' : ''}`);
        Object.entries(e.erreurs || {}).forEach(([p, m]) => L('err', `✕ ${esc(p)} : ${esc(m)}`));
      }
    } catch (e) { L('err', `agent.json illisible : ${esc(e.message || e)}`); }
    L('d', '<span class="vc-d"># les clés d\'API restent dans les secrets GitHub : elles ne transitent jamais par ton navigateur</span>');
    body.innerHTML = out.join('');
    srvLoaded = true;
  }

  // --- fenêtre ---
  function render() {
    if (tab === 'nav') { body.innerHTML = lines.map(l => `<div class="vc-l vc-${l.kind}">${l.html}</div>`).join(''); stick(); }
    else loadServer();
    box.querySelectorAll('[data-vt]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.vt === tab)));
  }
  function open(v) {
    box.hidden = !v; document.getElementById('vcBtn').setAttribute('aria-expanded', String(v));
    try { localStorage.setItem('vault_console', v ? '1' : '0'); } catch (e) { }
    if (v) render();
  }
  function build() {
    const btn = document.createElement('button');
    btn.id = 'vcBtn'; btn.type = 'button'; btn.className = 'vc-btn'; btn.setAttribute('aria-controls', 'vcBox');
    btn.innerHTML = '<span aria-hidden="true">&lt;/&gt;</span> <span class="vc-n">Journal</span>';
    box = document.createElement('section');
    box.id = 'vcBox'; box.className = 'vc-box'; box.hidden = true; box.setAttribute('aria-label', 'Journal technique');
    box.innerHTML = `<header class="vc-h"><div class="vc-tabs" role="tablist"><button type="button" role="tab" data-vt="nav">Navigateur</button><button type="button" role="tab" data-vt="srv">Serveur et IA</button></div>
      <div class="vc-tools"><button type="button" data-vc="clear" title="Effacer">Effacer</button><button type="button" data-vc="close" aria-label="Fermer le journal">✕</button></div></header>
      <div class="vc-body" role="log" aria-live="off"></div>`;
    document.body.append(btn, box);
    body = box.querySelector('.vc-body');
    btn.onclick = () => open(box.hidden);
    box.querySelector('[data-vc="close"]').onclick = () => open(false);
    box.querySelector('[data-vc="clear"]').onclick = () => { if (tab === 'nav') { lines.length = 0; body.innerHTML = ''; } else loadServer(); };
    box.querySelectorAll('[data-vt]').forEach(b => b.onclick = () => { tab = b.dataset.vt; render(); });
    badge();
    let saved = '0'; try { saved = localStorage.getItem('vault_console') || '0'; } catch (e) { }
    if (saved === '1') open(true);
  }
  log('act', '<span class="vc-k">boot</span> · VAULT démarre');
  document.addEventListener('DOMContentLoaded', build);
  window.addEventListener('load', wrapActions);
})();

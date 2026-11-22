/* VAULT — navigation et accessibilité.
   - Liens de la barre latérale atteignables au clavier (href).
   - Sur téléphone : barre d'onglets en bas (tab-bars.md › « Prefer a tab bar for navigation »),
     4 sections fréquentes + « Plus » qui ouvre la liste complète. Les onglets naviguent, ils n'agissent pas. */
(function () {
  const TABS = [['home', 'Aujourd\'hui'], ['holdings', 'Portefeuille'], ['radar', 'Radar'], ['signals', 'Signaux']];
  const DESK = TABS.concat([['agent', 'Agent']]);
  const iconOf = p => { const a = document.querySelector(`.sidebar .sb-link[data-page="${p}"] .sb-i`); return a ? a.innerHTML : ''; };
  const labelOf = p => { const a = document.querySelector(`.sidebar .sb-link[data-page="${p}"] span`); return a ? a.textContent.trim() : p; };

  function init() {
    document.querySelectorAll('.sidebar a.sb-link[data-page]').forEach(a => {
      a.setAttribute('href', '#' + a.dataset.page);
      a.addEventListener('click', ev => ev.preventDefault());
    });
    const bar = document.createElement('nav');
    bar.className = 'tabbar'; bar.setAttribute('aria-label', 'Sections');
    bar.innerHTML = TABS.map(([p, l]) => `<a href="#${p}" data-tab="${p}"><i aria-hidden="true">${iconOf(p)}</i><span>${l}</span></a>`).join('')
      + `<button type="button" data-tab="more" aria-haspopup="dialog"><i aria-hidden="true"><svg viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/></svg></i><span>Plus</span></button>`;
    document.body.appendChild(bar);
    bar.querySelectorAll('a[data-tab]').forEach(a => a.onclick = ev => { ev.preventDefault(); go(a.dataset.tab); });
    bar.querySelector('[data-tab="more"]').onclick = openMore;
    // ordinateur : logo + barre de pastilles dans l'en-tête (direction B)
    const top = document.querySelector('.topbar');
    if (top) {
      const tn = document.createElement('nav');
      tn.className = 'topnav'; tn.setAttribute('aria-label', 'Sections');
      tn.innerHTML = `<span class="tn-logo"><svg viewBox="0 0 28 28" aria-hidden="true"><defs><linearGradient id="tnlg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8f74ff"/><stop offset="1" stop-color="#4ce8c8"/></linearGradient></defs><rect x="3" y="3" width="22" height="22" rx="7" fill="none" stroke="url(#tnlg)" stroke-width="2"/><circle cx="14" cy="14" r="4" fill="url(#tnlg)"/></svg>VAULT</span>
        <div class="tn-pills">${DESK.map(([p, l]) => `<a href="#${p}" data-tab="${p}">${l}</a>`).join('')}<button type="button" data-tab="more" aria-haspopup="dialog">Plus</button></div>`;
      top.prepend(tn);
      tn.querySelectorAll('a[data-tab]').forEach(a => a.onclick = ev => { ev.preventDefault(); go(a.dataset.tab); });
      tn.querySelector('[data-tab="more"]').onclick = openMore;
    }
    sync(document.documentElement.dataset.page || 'home');
  }

  function openMore() {
    let d = document.getElementById('moreDlg');
    if (!d) { d = document.createElement('dialog'); d.id = 'moreDlg'; d.className = 'mo-dlg more-dlg'; document.body.appendChild(d); }
    const pages = [...document.querySelectorAll('.sidebar .sb-link[data-page]')].map(a => a.dataset.page).filter(p => !(innerWidth > 760 ? DESK : TABS).some(t => t[0] === p));
    d.innerHTML = `<div class="mo-head" style="padding:1.1rem 1.2rem .4rem"><h3>Toutes les sections</h3><button type="button" class="mo-x" onclick="this.closest('dialog').close()" aria-label="Fermer">✕</button></div>
      <div class="more-grid">${pages.map(p => `<button type="button" data-p="${p}"><i aria-hidden="true">${iconOf(p)}</i><span>${labelOf(p)}</span></button>`).join('')}
      <button type="button" data-theme-toggle><i aria-hidden="true">◐</i><span>Thème clair / sombre</span></button></div>`;
    d.querySelectorAll('[data-p]').forEach(b => b.onclick = () => { d.close(); go(b.dataset.p); });
    d.querySelector('[data-theme-toggle]').onclick = () => { d.close(); toggleTheme(); };
    d.showModal();
  }

  function sync(p) {
    document.querySelectorAll('.tabbar [data-tab], .topnav [data-tab]').forEach(a => {
      const on = a.dataset.tab === p || (a.dataset.tab === 'more' && !(a.closest('.topnav') ? DESK : TABS).some(t => t[0] === p));
      a.classList.toggle('on', on);
      if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
  }

  const prevGo = window.go;
  window.go = function (p) { prevGo(p); sync(p); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();

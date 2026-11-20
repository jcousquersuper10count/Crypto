/**
 * VAULT — script Google de la feuille « Crypto neverless »
 * À coller dans : Google Sheet > Extensions > Apps Script (remplace tout le code existant).
 *
 * Sécurité : chaque lecture et chaque écriture exige la clé VAULT_KEY, rangée dans les
 * propriétés du script (jamais dans le code ni sur GitHub). Pour la créer ou la changer :
 * sélectionner la fonction creerCle puis cliquer sur Exécuter ; la clé s'affiche dans le journal.
 *
 * Déploiement : Déployer > Gérer les déploiements > modifier > Nouvelle version,
 * « Exécuter en tant que : Moi », « Qui a accès : Tout le monde ».
 * L'accès « Tout le monde » est nécessaire pour que le site appelle le script ;
 * c'est la clé qui protège les données.
 */

const TABS = ['Neverless', 'Revolut_Crypto', 'Revolut_Robo'];
const HIST_SHEET = 'Historique_valeur';
const BACKUP_PREFIX = '_svg_';
const KEEP_BACKUPS = 5;           // sauvegardes conservées par onglet
const MAX_ROWS = 50000;

/* ---------- clé d'accès ---------- */

function creerCle() {
  const key = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
  PropertiesService.getScriptProperties().setProperty('VAULT_KEY', key);
  Logger.log('Nouvelle clé VAULT (à saisir une fois dans VAULT > Importer) : ' + key);
}

function authed_(k) {
  const key = PropertiesService.getScriptProperties().getProperty('VAULT_KEY');
  if (!key || typeof k !== 'string' || k.length !== key.length) return false;
  let d = 0;
  for (let i = 0; i < k.length; i++) d |= k.charCodeAt(i) ^ key.charCodeAt(i);
  return d === 0;
}

/* ---------- utilitaires ---------- */

function book_() { return SpreadsheetApp.getActiveSpreadsheet(); }
function out_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

function histSheet_() {
  const ss = book_();
  let sh = ss.getSheetByName(HIST_SHEET);
  if (sh) return sh;
  // reprendre une feuille d'historique existante (en-tête contenant valueUSD)
  for (const s of ss.getSheets()) {
    if (s.getLastRow() > 0 && s.getLastColumn() > 1) {
      const head = s.getRange(1, 1, 1, s.getLastColumn()).getDisplayValues()[0];
      if (head.indexOf('valueUSD') >= 0) return s;
    }
  }
  sh = ss.insertSheet(HIST_SHEET);
  sh.getRange(1, 1, 1, 4).setValues([['date', 'valueUSD', 'valueEUR', 'nbAssets']]);
  return sh;
}

function backups_(tab) {
  return book_().getSheets().map(s => s.getName())
    .filter(n => n.indexOf(BACKUP_PREFIX + tab + '_') === 0).sort().reverse();
}

/* ---------- lecture ---------- */

function doGet(e) {
  const p = (e && e.parameter) || {};
  if (!authed_(p.key)) return out_({ status: 'denied' });
  const ss = book_();
  if (p.action === 'ping') return out_({ status: 'ok' });
  if (p.action === 'read') {
    const tabs = {};
    TABS.forEach(t => { const sh = ss.getSheetByName(t); tabs[t] = sh && sh.getLastRow() > 0 ? sh.getDataRange().getDisplayValues() : []; });
    const bk = {};
    TABS.forEach(t => { bk[t] = backups_(t); });
    return out_({ status: 'ok', tabs: tabs, backups: bk, manual: manualList_() });
  }
  if (p.action === 'history') {
    const sh = histSheet_();
    const v = sh.getLastRow() > 1 ? sh.getRange(2, 1, sh.getLastRow() - 1, 4).getValues() : [];
    const data = v.filter(r => r[0] && isFinite(+r[1])).map(r => ({
      date: r[0] instanceof Date ? r[0].toISOString() : String(r[0]), valueUSD: +r[1], valueEUR: +r[2], nbAssets: +r[3]
    }));
    return out_({ status: 'ok', data: data });
  }
  return out_({ status: 'error', message: 'action inconnue' });
}

/* ---------- écriture ---------- */

function doPost(e) {
  let b;
  try { b = JSON.parse(e.postData.contents); } catch (x) { return out_({ status: 'error', message: 'requête illisible' }); }
  if (!authed_(b.key)) return out_({ status: 'denied' });
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) return out_({ status: 'error', message: 'occupé, réessaie' });
  try {
    if (b.action === 'upload_csv') return out_(upload_(b.tabName, b.csvData));
    if (b.action === 'restore_backup') return out_(restore_(b.tabName, b.backup));
    if (b.action === 'log_value') return out_(logValue_(b));
    if (b.action === 'manual_save') return out_(manualSave_(b.list));
    return out_({ status: 'error', message: 'action inconnue' });
  } finally {
    lock.releaseLock();
  }
}

function writeTab_(sh, rows) {
  const w = rows.reduce((m, r) => Math.max(m, r.length), 0);
  const data = rows.map(r => { const x = r.map(v => (v == null ? '' : String(v))); while (x.length < w) x.push(''); return x; });
  sh.clearContents();
  const rg = sh.getRange(1, 1, data.length, w);
  rg.setNumberFormat('@');   // texte brut : Sheets ne réinterprète ni dates ni nombres
  rg.setValues(data);
}

function backup_(tab) {
  const ss = book_();
  const sh = ss.getSheetByName(tab);
  if (!sh || sh.getLastRow() === 0) return null;
  const name = BACKUP_PREFIX + tab + '_' + Utilities.formatDate(new Date(), 'Europe/Paris', 'yyyyMMdd_HHmmss');
  const copy = sh.copyTo(ss).setName(name);
  copy.hideSheet();
  backups_(tab).slice(KEEP_BACKUPS).forEach(n => ss.deleteSheet(ss.getSheetByName(n)));
  return name;
}

function upload_(tab, rows) {
  if (TABS.indexOf(tab) < 0) return { status: 'error', message: 'onglet inconnu' };
  if (!Array.isArray(rows) || rows.length < 2) return { status: 'error', message: 'fichier vide' };
  if (rows.length > MAX_ROWS) return { status: 'error', message: 'fichier trop grand' };
  const ss = book_();
  const saved = backup_(tab);
  const sh = ss.getSheetByName(tab) || ss.insertSheet(tab);
  writeTab_(sh, rows);
  return { status: 'ok', rows: rows.length - 1, backup: saved };
}

function restore_(tab, name) {
  if (TABS.indexOf(tab) < 0 || backups_(tab).indexOf(name) < 0) return { status: 'error', message: 'sauvegarde introuvable' };
  const ss = book_();
  const rows = ss.getSheetByName(name).getDataRange().getDisplayValues();
  const saved = backup_(tab);
  writeTab_(ss.getSheetByName(tab), rows);
  return { status: 'ok', rows: rows.length - 1, backup: saved };
}

function logValue_(b) {
  const usd = +b.valueUSD, eur = +b.valueEUR, n = +b.nbAssets;
  if (!(usd > 0) || !isFinite(usd) || !isFinite(eur)) return { status: 'error', message: 'valeur invalide' };
  histSheet_().appendRow([new Date().toISOString(), usd, eur, n]);
  return { status: 'ok' };
}

/* ---------- opérations saisies à la main (en attente d'import) ---------- */

function manualList_() {
  try { const v = JSON.parse(PropertiesService.getScriptProperties().getProperty('VAULT_MANUAL') || '[]'); return Array.isArray(v) ? v : []; }
  catch (x) { return []; }
}

function manualSave_(list) {
  if (!Array.isArray(list) || list.length > 300) return { status: 'error', message: 'liste invalide' };
  const ok = list.every(e => e && typeof e.id === 'string' && /^(Neverless|Revolut_Crypto|Revolut_Robo)$/.test(e.acct)
    && (e.side === 'buy' || e.side === 'sell') && /^[A-Z0-9.]{1,15}$/.test(e.sym) && +e.qty > 0 && +e.price >= 0 && !isNaN(Date.parse(e.date)));
  if (!ok) return { status: 'error', message: 'opération invalide' };
  const txt = JSON.stringify(list);
  if (txt.length > 8500) return { status: 'error', message: 'trop d\'opérations en attente : importe tes relevés' };
  PropertiesService.getScriptProperties().setProperty('VAULT_MANUAL', txt);
  return { status: 'ok', n: list.length };
}

// ============================================================
// CHIAVI DI ACCESSO — chiave completa (APP_KEY) e di sola lettura (APP_KEY_RO)
// ============================================================
// Proprietà dello script (Impostazioni progetto → Proprietà dello script):
//   APP_KEY     = la chiave già in uso (non cambia)
//   APP_KEY_RO  = la chiave di sola lettura (si crea con impostaChiaveSolaLettura)
// Le chiavi NON vanno scritte nel codice né nel repository.
// ============================================================

// Restituisce 'admin', 'ro' oppure '' se la chiave è assente o sbagliata
function roleOf_(p) {
  var k = String((p && p.key) || '');
  if (!k) return '';
  var props = PropertiesService.getScriptProperties();
  var admin = props.getProperty('APP_KEY');
  if (admin && k === admin) return 'admin';
  var ro = props.getProperty('APP_KEY_RO');
  if (ro && k === ro) return 'ro';
  return '';
}

// Prima istruzione della doGet: lascia passare entrambe le chiavi
function guardia_(e) {
  var p = (e && e.parameter) || {};
  if (roleOf_(p)) return null;

  var cb = String(p.callback || '').replace(/[^\w.]/g, '');
  var corpo = JSON.stringify({ ok: false, error: 'unauthorized' });
  return ContentService
    .createTextOutput(cb ? cb + '(' + corpo + ')' : corpo)
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}

// Esegui UNA volta, poi riporta il testo a 'SCRIVI-QUI-...' (la chiave non deve restare nel codice)
function impostaChiaveSolaLettura() {
  PropertiesService.getScriptProperties().setProperty('APP_KEY_RO', 'SCRIVI-QUI-LA-CHIAVE-DI-SOLA-LETTURA');
}

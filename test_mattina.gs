// ============================================================
// test_mattina.gs
// COME USARE:
//   1) In Apps Script seleziona "scheduleTest_" e clicca Esegui
//   2) Lo script si programma per le 8:15 di domani
//   3) Il risultato appare nel Log con codice TEST_RESULT
// ============================================================

// --- Funzione principale visibile nel menu a tendina ---
function scheduleTest_() {
  // Cancella test precedenti
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (t.getHandlerFunction() === 'runMorningTest_') ScriptApp.deleteTrigger(t);
  });

  var when = new Date();
  when.setDate(when.getDate() + 1);
  when.setHours(8, 15, 0, 0);

  ScriptApp.newTrigger('runMorningTest_').timeBased().at(when).create();
  logEvent('TEST_SCHEDULED', 'runMorningTest_', when.toISOString());

  SpreadsheetApp.getUi().alert(
    'Test programmato per: ' + when.toLocaleString('it-IT') + '\n\n' +
    'Cosa verificherà alle 8:15:\n' +
    '• Tutti fuori casa?\n' +
    '• Stato = SECURITY_DAY?\n' +
    '• SSID lock scaduti?\n' +
    '• Clima OFF, termostati OFF, cam ON?\n\n' +
    'Risultato → Log con codice TEST_RESULT'
  );
}

// --- Esegui test immediato (per debug) ---
function runMorningTestNow_() {
  runMorningTest_();
  SpreadsheetApp.getUi().alert('Test eseguito — controlla il Log per TEST_RESULT');
}

// --- Il test vero (chiamato dal trigger) ---
function runMorningTest_() {
  try {
    var now = new Date();
    var tz = Session.getScriptTimeZone();
    var ppl = _getAllPeopleRaw_();
    var stato = getStatoCorrente_();
    var lines = [];
    var allOut = true;
    var problems = [];

    // 1) Controlla ogni persona
    ppl.forEach(function(p) {
      var nm = p.name;
      var online = p.online;
      var ssid = hasSsidLock_(nm.toLowerCase());
      var lifeAgo = p.lifeMs ? Math.round((now.getTime() - p.lifeMs) / 60000) : null;
      if (online) { allOut = false; problems.push(nm + ' ancora IN'); }
      if (ssid)   { problems.push(nm + ' SSID lock attivo'); }
      lines.push(
        nm + ': ' + (online ? 'IN ⚠️' : 'OUT ✅') +
        (ssid ? ' | SSID lock ⚠️' : '') +
        (lifeAgo !== null ? ' | ping ' + lifeAgo + 'min fa' : '')
      );
    });

    // 2) Stato casa
    var statoOk = (stato === 'SECURITY_DAY' || stato === 'SECURITY_NIGHT');
    if (!statoOk) problems.push('Stato ' + stato + ' invece di SECURITY');
    lines.push('');
    lines.push('Stato: ' + stato + (statoOk ? ' ✅' : ' ⚠️'));
    lines.push('Tutti OUT: ' + (allOut ? 'SI ✅' : 'NO ⚠️'));
    lines.push('Ora: ' + Utilities.formatDate(now, tz, 'dd/MM HH:mm:ss'));

    var esito = problems.length === 0 ? 'OK' : 'PROBLEMI: ' + problems.join(', ');

    // 3) Log
    logEvent('TEST_RESULT', esito, lines.join(' | ').substring(0, 500));

    // 4) Foglio Diagnosi
    try {
      var ss = SpreadsheetApp.getActiveSpreadsheet();
      var sh = ss.getSheetByName('Diagnosi') || ss.insertSheet('Diagnosi');
      if (sh.getLastRow() === 0) sh.appendRow(['Timestamp','Esito','Stato','Tutti OUT','Dettaglio']);
      sh.appendRow([now, esito, stato, allOut ? 'SI' : 'NO', lines.join('\n').substring(0, 300)]);
    } catch(_) {}

    // 5) Auto-cancella trigger
    ScriptApp.getProjectTriggers().forEach(function(t) {
      if (t.getHandlerFunction() === 'runMorningTest_') ScriptApp.deleteTrigger(t);
    });

  } catch(e) {
    logEvent('TEST_ERR', String(e), '');
  }
}

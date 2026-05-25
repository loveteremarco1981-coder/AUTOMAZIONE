// ============================================================
// test_mattina.gs — Test automatico ore 8:15
// Esegui "scheduleTest_" UNA VOLTA dalla console Apps Script
// Si auto-cancella dopo l'esecuzione
// ============================================================

function scheduleTest_() {
  // Cancella eventuali test precedenti
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (t.getHandlerFunction() === 'runMorningTest_') ScriptApp.deleteTrigger(t);
  });

  // Programma per domani 26/05 alle 8:15
  var when = new Date();
  when.setDate(when.getDate() + 1);
  when.setHours(8, 15, 0, 0);

  ScriptApp.newTrigger('runMorningTest_').timeBased().at(when).create();
  logEvent('TEST_SCHEDULED', 'runMorningTest_', when.toISOString());

  SpreadsheetApp.getUi().alert(
    'Test programmato per: ' + when.toLocaleString('it-IT') + '\n\n' +
    'Cosa farà alle 8:15:\n' +
    '1. Snapshot stato persone\n' +
    '2. Verifica che tutti siano OUT\n' +
    '3. Verifica stato SECURITY_DAY\n' +
    '4. Verifica SSID lock scaduti\n' +
    '5. Scrive risultato nel log con codice TEST_RESULT'
  );
}

function runMorningTest_() {
  try {
    var now = new Date();
    var tz = Session.getScriptTimeZone();
    var ppl = _getAllPeopleRaw_();
    var results = [];
    var allOut = true;
    var stato = getStatoCorrente_();

    // 1) Controlla ogni persona
    ppl.forEach(function(p) {
      var nm = p.name;
      var online = p.online;
      var ssid = hasSsidLock_(nm.toLowerCase());
      var lifeAgo = p.lifeMs ? Math.round((now.getTime() - p.lifeMs) / 60000) : null;

      if (online) allOut = false;

      results.push(
        nm +
        ': ' + (online ? '🔴 IN (PROBLEMA!)' : '✅ OUT') +
        (ssid ? ' | ⚠️ SSID lock attivo' : ' | SSID ok') +
        (lifeAgo !== null ? ' | ping ' + lifeAgo + 'min fa' : '')
      );
    });

    // 2) Controlla stato casa
    var statoOk = (stato === 'SECURITY_DAY' || stato === 'SECURITY_NIGHT');
    results.push('');
    results.push('Stato casa: ' + stato + (statoOk ? ' ✅' : ' 🔴 PROBLEMA!'));
    results.push('Tutti fuori: ' + (allOut ? '✅ SI' : '🔴 NO'));
    results.push('Ora test: ' + Utilities.formatDate(now, tz, 'dd/MM HH:mm:ss'));

    var summary = results.join('\n');
    var esito = (allOut && statoOk) ? 'OK' : 'PROBLEMI';

    // 3) Scrivi nel log
    logEvent('TEST_RESULT', esito, summary.substring(0, 500));

    // 4) Scrivi anche nel foglio Diagnosi
    try {
      var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Diagnosi') ||
               SpreadsheetApp.getActiveSpreadsheet().insertSheet('Diagnosi');
      sh.appendRow([now, esito, stato, allOut ? 'SI' : 'NO', summary.substring(0, 300)]);
    } catch(_) {}

    // 5) Auto-cancella questo trigger
    ScriptApp.getProjectTriggers().forEach(function(t) {
      if (t.getHandlerFunction() === 'runMorningTest_') ScriptApp.deleteTrigger(t);
    });

  } catch(e) {
    logEvent('TEST_ERR', String(e), '');
  }
}

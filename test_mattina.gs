// ============================================================
// test_mattina.gs
// ============================================================

function scheduleTest_() {
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (t.getHandlerFunction() === 'runMorningTest_') ScriptApp.deleteTrigger(t);
  });
  var when = new Date();
  when.setDate(when.getDate() + 1);
  when.setHours(8, 15, 0, 0);
  ScriptApp.newTrigger('runMorningTest_').timeBased().at(when).create();
  logEvent('TEST_SCHEDULED', 'runMorningTest_', when.toISOString());
  SpreadsheetApp.getUi().alert(
    'Test programmato per: ' + when.toLocaleString('it-IT') + '\n\n'+
    'Verificherà alle 8:15:\n'+
    '• Tutti fuori casa?\n• Stato = SECURITY_DAY?\n• SSID lock scaduti?\n'+
    '• isNight corretto?\n\nRisultato → Log con codice TEST_RESULT'
  );
}

function runMorningTestNow_() {
  runMorningTest_();
  SpreadsheetApp.getUi().alert('Test eseguito — controlla il Log per TEST_RESULT');
}

function runMorningTest_() {
  try {
    var now = new Date();
    var tz = Session.getScriptTimeZone();
    var ppl = _getAllPeopleRaw_();
    var stato = getStatoCorrente_();
    var night = isNight();
    var lines = [];
    var allOut = true;
    var problems = [];

    ppl.forEach(function(p) {
      var nm = p.name;
      var online = p.online;
      var ssid = hasSsidLock_(nm.toLowerCase());
      var lifeAgo = p.lifeMs ? Math.round((now.getTime() - p.lifeMs) / 60000) : null;
      if (online) { allOut = false; problems.push(nm + ' ancora IN'); }
      if (ssid)   { problems.push(nm + ' SSID lock attivo'); }
      lines.push(nm+': '+(online?'IN ⚠️':'OUT ✅')+(ssid?' | SSID ⚠️':'')+
        (lifeAgo!==null?' | ping '+lifeAgo+'m fa':''));
    });

    var statoOk = (stato === 'SECURITY_DAY' || stato === 'SECURITY_NIGHT');
    if (!statoOk) problems.push('Stato '+stato+' invece di SECURITY');
    if (night) problems.push('isNight=true alle 8:15 - controlla night buffer');

    lines.push('');
    lines.push('Stato: '+stato+(statoOk?' ✅':' ⚠️'));
    lines.push('isNight: '+(night?'SI ⚠️':'NO ✅'));
    lines.push('Tutti OUT: '+(allOut?'SI ✅':'NO ⚠️'));
    lines.push('Ora: '+Utilities.formatDate(now, tz, 'dd/MM HH:mm:ss'));

    var esito = problems.length === 0 ? 'OK' : 'PROBLEMI: '+problems.join(', ');
    logEvent('TEST_RESULT', esito, lines.join(' | ').substring(0, 500));

    try {
      var ss2 = SpreadsheetApp.getActiveSpreadsheet();
      var sh2 = ss2.getSheetByName('Diagnosi') || ss2.insertSheet('Diagnosi');
      if (sh2.getLastRow() === 0) sh2.appendRow(['Timestamp','Esito','Stato','Tutti OUT','isNight','Dettaglio']);
      sh2.appendRow([now, esito, stato, allOut?'SI':'NO', night?'SI':'NO', lines.join('\n').substring(0,300)]);
    } catch(_) {}

    ScriptApp.getProjectTriggers().forEach(function(t) {
      if (t.getHandlerFunction() === 'runMorningTest_') ScriptApp.deleteTrigger(t);
    });

  } catch(e) { logEvent('TEST_ERR', String(e), ''); }
}

// 08_triggers.gs — trigger fissi
// Nessun morningKeepAlive, nessun KA, nessun timeout

function ensureTriggers(){
  // Elimina tutto
  ScriptApp.getProjectTriggers().forEach(function(t){
    try{ ScriptApp.deleteTrigger(t); }catch(_){}
  });

  // 1. evaluateStateNow ogni 5min
  try{
    ScriptApp.newTrigger('evaluateStateNow').timeBased().everyMinutes(5).create();
    logEvent('TRG_ADD','evaluateStateNow','every 5m');
  }catch(e){ logEvent('TRG_ERR','evaluateStateNow',String(e)); }

  // 2. pendingOutSweep_ ogni 5min (conferma OUT dopo guard)
  try{
    ScriptApp.newTrigger('pendingOutSweep_').timeBased().everyMinutes(5).create();
    logEvent('TRG_ADD','pendingOutSweep_','every 5m');
  }catch(e){ logEvent('TRG_ERR','pendingOutSweep_',String(e)); }

  // 3. scheduleSunEventsForToday ogni giorno all'1:00
  try{
    ScriptApp.newTrigger('scheduleSunEventsForToday').timeBased().atHour(1).everyDays(1).create();
    logEvent('TRG_ADD','scheduleSunEventsForToday','daily @1:00');
  }catch(e){ logEvent('TRG_ERR','scheduleSunEventsForToday',String(e)); }

  // 3. pruneOldLogs_ ogni giorno alle 3:30
  try{
    ScriptApp.newTrigger('pruneOldLogs_').timeBased().atHour(3).nearMinute(30).everyDays(1).create();
    logEvent('TRG_ADD','pruneOldLogs_','daily @3:30');
  }catch(e){ logEvent('TRG_ERR','pruneOldLogs_',String(e)); }

  // 4. Tapparelle 23:00 feriali
  try{
    ScriptApp.newTrigger('closeShuttersAt23IfPeopleHome_').timeBased().atHour(23).nearMinute(0).everyDays(1).create();
    logEvent('TRG_ADD','closeShuttersAt23IfPeopleHome_','daily @23:00');
  }catch(e){ logEvent('TRG_ERR','closeShutters@23',String(e)); }

  // 5. Tapparelle 00:05 festivi/weekend
  try{
    ScriptApp.newTrigger('closeShuttersAt23IfPeopleHome_').timeBased().atHour(0).nearMinute(5).everyDays(1).create();
    logEvent('TRG_ADD','closeShuttersAt23IfPeopleHome_','daily @00:05');
  }catch(e){ logEvent('TRG_ERR','closeShutters@00:05',String(e)); }

  logEvent('ENSURE_DONE','6 trigger attivi','no KA no timeout');
}

function _LAUNCH_RESET_AND_ENSURE_(){
  try{
    ScriptApp.getProjectTriggers().forEach(function(t){ try{ ScriptApp.deleteTrigger(t); }catch(_){} });
    ensureTriggers();
    evaluateStateNow();
    try{ SpreadsheetApp.getActiveSpreadsheet().toast('✅ Reset + Ensure + Eval OK','Sistema',5); }catch(_){}
  }catch(e){
    logEvent('ENSURE_ERR',String(e),'');
    try{ SpreadsheetApp.getActiveSpreadsheet().toast('❌ ERR: '+e,'Sistema',8); }catch(_){}
  }
}

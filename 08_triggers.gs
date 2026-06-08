// 08_triggers.gs — trigger fissi
// Nessun morningKeepAlive, nessun KA, nessun timeout

function ensureTriggers(){
  // Elimina tutto
  ScriptApp.getProjectTriggers().forEach(function(t){
    try{ScriptApp.deleteTrigger(t);}catch(_){}
  });

  function add(fn,desc){
    try{return fn();logEvent('TRG_ADD',desc,'');}
    catch(e){logEvent('TRG_ERR',desc,String(e));}
  }

  // evaluateStateNow ogni 5min
  add(function(){
    ScriptApp.newTrigger('evaluateStateNow').timeBased().everyMinutes(5).create();
  },'evaluateStateNow 5m');

  // scheduleSunEventsForToday ogni giorno all'1:00
  add(function(){
    ScriptApp.newTrigger('scheduleSunEventsForToday').timeBased().atHour(1).everyDays(1).create();
  },'sunEvents @1:00');

  // pruneOldLogs alle 3:30
  add(function(){
    ScriptApp.newTrigger('pruneOldLogs_').timeBased().atHour(3).nearMinute(30).everyDays(1).create();
  },'pruneLogs @3:30');

  // Tapparelle 23:00 (feriali)
  add(function(){
    ScriptApp.newTrigger('closeShuttersAt23IfPeopleHome_').timeBased().atHour(23).nearMinute(0).everyDays(1).create();
  },'shutters @23:00');

  // Tapparelle 00:05 (festivi/weekend)
  add(function(){
    ScriptApp.newTrigger('closeShuttersAt23IfPeopleHome_').timeBased().atHour(0).nearMinute(5).everyDays(1).create();
  },'shutters @00:05');

  logEvent('ENSURE_DONE','5 trigger attivi','no KA no timeout');
}

function _LAUNCH_RESET_AND_ENSURE_(){
  try{
    ScriptApp.getProjectTriggers().forEach(function(t){try{ScriptApp.deleteTrigger(t);}catch(_){}});
    ensureTriggers();
    evaluateStateNow();
    try{SpreadsheetApp.getActiveSpreadsheet().toast('✅ Reset + Ensure + Eval OK','Sistema',5);}catch(_){}
  }catch(e){
    logEvent('ENSURE_ERR',String(e),'');
    try{SpreadsheetApp.getActiveSpreadsheet().toast('❌ ERR: '+e,'Sistema',8);}catch(_){}
  }
}

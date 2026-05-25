// ============================================================
// 08_triggers.gs — bootstrap trigger
// ============================================================

function ensureTriggers(){
  var toDelete=['evaluateStateNow','pendingOutSweep_','scheduleSunEventsForToday',
                'pruneOldLogs_','closeShuttersAt23IfPeopleHome_',
                'nightWindowRunner_','onDaily0100','onDaily2300'];
  toDelete.forEach(function(h){
    ScriptApp.getProjectTriggers().forEach(function(t){
      try{ if(t.getHandlerFunction&&t.getHandlerFunction()===h)ScriptApp.deleteTrigger(t); }catch(_){}
    });
  });

  function addTrigger(fn,desc,creator){
    try{
      if(typeof this[fn]==='function'){ creator(); logEvent('TRIGGER_ON',fn,desc); }
      else logEvent('ENSURE_SKIP',fn,'missing');
    }catch(e){ logEvent('ENSURE_ERR',fn,String(e)); }
  }

  // evaluateStateNow ogni 5 min
  try{
    ScriptApp.newTrigger('evaluateStateNow').timeBased().everyMinutes(5).create();
    logEvent('TRIGGER_ON','evaluateStateNow','every 5m');
  }catch(e){ logEvent('ENSURE_ERR','evaluateStateNow',String(e)); }

  // pendingOutSweep_ ogni 5 min
  try{
    ScriptApp.newTrigger('pendingOutSweep_').timeBased().everyMinutes(5).create();
    logEvent('TRIGGER_ON','pendingOutSweep_','every 5m');
  }catch(e){ logEvent('ENSURE_ERR','pendingOutSweep_',String(e)); }

  // scheduleSunEventsForToday ogni giorno all'1:00
  try{
    ScriptApp.newTrigger('scheduleSunEventsForToday').timeBased().atHour(1).everyDays(1).create();
    logEvent('TRIGGER_ON','scheduleSunEventsForToday','daily @1:00');
  }catch(e){ logEvent('ENSURE_ERR','scheduleSunEventsForToday',String(e)); }

  // pruneOldLogs_ ogni giorno alle 3:30
  try{
    ScriptApp.newTrigger('pruneOldLogs_').timeBased().atHour(3).nearMinute(30).everyDays(1).create();
    logEvent('TRIGGER_ON','pruneOldLogs_','daily @3:30');
  }catch(e){ logEvent('ENSURE_ERR','pruneOldLogs_',String(e)); }

  // closeShuttersAt23 ogni giorno alle 23:00
  try{
    ScriptApp.newTrigger('closeShuttersAt23IfPeopleHome_').timeBased().atHour(23).nearMinute(0).everyDays(1).create();
    logEvent('TRIGGER_ON','closeShuttersAt23IfPeopleHome_','daily @23:00');
  }catch(e){ logEvent('ENSURE_ERR','closeShuttersAt23IfPeopleHome_',String(e)); }

  logEvent('ENSURE_DONE','core triggers','');
}

function _LAUNCH_RESET_AND_ENSURE_(){
  try{
    ScriptApp.getProjectTriggers().forEach(function(t){ try{ ScriptApp.deleteTrigger(t); }catch(_){} });
    ensureTriggers();
    evaluateStateNow();
    SpreadsheetApp.getUi().alert('Reset + Ensure + Eval → OK');
  }catch(e){ logEvent('ENSURE_ERR',String(e),''); SpreadsheetApp.getUi().alert('ERR: '+e); }
}

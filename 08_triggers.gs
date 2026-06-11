// 08_triggers.gs — trigger fissi
// 5 trigger: evaluateStateNow, scheduleSunEventsForToday,
//            pruneOldLogs_, closeShuttersAt23 x2
// RIMOSSO: pendingOutSweep_

function ensureTriggers(){
  var all = ScriptApp.getProjectTriggers();
  for(var i=0;i<all.length;i++){
    try{ ScriptApp.deleteTrigger(all[i]); }catch(_){}
  }
  Utilities.sleep(1000);

  try{ ScriptApp.newTrigger('evaluateStateNow').timeBased().everyMinutes(5).create();
    logEvent('TRG_ADD','evaluateStateNow','every 5m'); }catch(e){ logEvent('TRG_ERR','evaluateStateNow',String(e)); }

  try{ ScriptApp.newTrigger('scheduleSunEventsForToday').timeBased().atHour(1).everyDays(1).create();
    logEvent('TRG_ADD','scheduleSunEventsForToday','daily @1:00'); }catch(e){ logEvent('TRG_ERR','scheduleSunEventsForToday',String(e)); }

  try{ ScriptApp.newTrigger('pruneOldLogs_').timeBased().atHour(3).nearMinute(30).everyDays(1).create();
    logEvent('TRG_ADD','pruneOldLogs_','daily @3:30'); }catch(e){ logEvent('TRG_ERR','pruneOldLogs_',String(e)); }

  try{ ScriptApp.newTrigger('closeShuttersAt23IfPeopleHome_').timeBased().atHour(23).nearMinute(0).everyDays(1).create();
    logEvent('TRG_ADD','closeShuttersAt23IfPeopleHome_','daily @23:00'); }catch(e){ logEvent('TRG_ERR','closeShutters@23',String(e)); }

  try{ ScriptApp.newTrigger('closeShuttersAt23IfPeopleHome_').timeBased().atHour(0).nearMinute(5).everyDays(1).create();
    logEvent('TRG_ADD','closeShuttersAt23IfPeopleHome_','daily @00:05'); }catch(e){ logEvent('TRG_ERR','closeShutters@00:05',String(e)); }

  try{ scheduleSunEventsForToday(); }catch(_){}

  logEvent('ENSURE_DONE','5 trigger fissi','no pending, no KA, no timeout');
}

// ── Pulizia completa Script Properties ──────────────────────
function purgeAllProperties_(){
  try{
    var props = PropertiesService.getScriptProperties();
    var all = props.getProperties();
    var count = 0;
    Object.keys(all).forEach(function(k){
      // Rimuovi tutto ciò che riguarda presenza/pending/lock/cooldown
      if(/^(PENDING_OUT_|SSID_LOCK_|OUT_COOLDOWN_|KA_|KEEPALIVE_|CONFIRM_OUT_|LIFE_LAST_|PLANTS_LAST)/.test(k)){
        props.deleteProperty(k);
        count++;
      }
    });
    logEvent('PROPS_PURGE', count + ' proprietà rimosse', '');
  }catch(e){ logEvent('PROPS_PURGE_ERR',String(e),''); }
}

// ── Reset completo: trigger + properties + stato persone ────
function _LAUNCH_RESET_AND_ENSURE_(){
  try{
    // Step 1: elimina TUTTI i trigger
    var all = ScriptApp.getProjectTriggers();
    for(var i=0;i<all.length;i++){
      try{ ScriptApp.deleteTrigger(all[i]); }catch(_){}
    }
    Utilities.sleep(2000);

    // Step 2: pulisce TUTTE le Script Properties residue
    purgeAllProperties_();

    // Step 3: ricrea 5 trigger fissi
    ensureTriggers();

    // Step 4: eval immediata
    evaluateStateNow();

    try{ SpreadsheetApp.getActiveSpreadsheet().toast(
      '✅ Reset OK — 5 trigger, proprietà pulite\nOra fai FORZA IN per chi è in casa',
      'Sistema', 8);
    }catch(_){}

    logEvent('RESET_FULL','trigger+properties pulite','esegui FORZA IN');
  }catch(e){
    logEvent('ENSURE_ERR',String(e),'');
    try{ SpreadsheetApp.getActiveSpreadsheet().toast('❌ ERR: '+e,'Sistema',8); }catch(_){}
  }
}

// ============================================================
// 07_jobs.gs — alba/tramonto, piante, log prune
// Regole piante all'alba:
//   Casa occupata:  alba+60min → piante (no alza tapparelle)
//   Casa vuota:     alba+60min → piante (no alza)
//   Vacanza:        alba+60min → piante
//   Orario minimo:  feriale 07:30 / festivo 09:30
// Piante post-uscita:
//   uscita reale di giorno → piante dopo 2min
// ============================================================

// ---------- Orario minimo piante ----------
function _pianteMinTime_(d){
  d = d || new Date();
  var base = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  if(isFeriale_(d)){
    base.setHours(7, 30, 0, 0);
  } else {
    base.setHours(9, 30, 0, 0);
  }
  return base;
}

function _pianteScheduleTime_(alba){
  // alba + 60 minuti
  var withDelay = new Date(alba.getTime() + 60*60000);
  // mai prima dell'orario minimo
  var minTime = _pianteMinTime_(withDelay);
  var when = (withDelay > minTime) ? withDelay : minTime;
  logEvent('PIANTE_WINDOW',
    'alba=' + Utilities.formatDate(alba, Session.getScriptTimeZone(), 'HH:mm') +
    ' +60min=' + Utilities.formatDate(withDelay, Session.getScriptTimeZone(), 'HH:mm') +
    ' min=' + Utilities.formatDate(minTime, Session.getScriptTimeZone(), 'HH:mm') +
    ' → ' + Utilities.formatDate(when, Session.getScriptTimeZone(), 'HH:mm'),
    isFeriale_(alba) ? 'feriale' : 'festivo/weekend'
  );
  return when;
}

// ---------- Alba / Tramonto ----------
function scheduleSunEventsForToday(){
  try{
    var G=sh('Geo');
    var lat=Number(G.getRange('A2').getValue());
    var lon=Number(G.getRange('B2').getValue());
    var tz=String(G.getRange('C2').getValue()||Session.getScriptTimeZone());
    if(!isFinite(lat)||!isFinite(lon)) throw new Error('Geo sheet non valido');

    var todayLocal=Utilities.formatDate(new Date(),tz,'yyyy-MM-dd');
    var url='https://api.sunrise-sunset.org/json?lat='+lat+'&lng='+lon+'&date='+todayLocal+'&formatted=0';
    var resp=UrlFetchApp.fetch(url,{muteHttpExceptions:true});
    if(resp.getResponseCode()!==200) throw new Error('HTTP '+resp.getResponseCode());
    var js=JSON.parse(resp.getContentText());
    if(!js||js.status!=='OK') throw new Error('status '+js.status);

    var alba=new Date(js.results.sunrise);
    var tram=new Date(js.results.sunset);
    s('Stato','B3',alba); s('Stato','B4',tram);

    ScriptApp.getProjectTriggers().forEach(function(t){
      var f=t.getHandlerFunction?t.getHandlerFunction():null;
      if(f==='onSunrise'||f==='onSunset') ScriptApp.deleteTrigger(t);
    });
    ScriptApp.newTrigger('onSunrise').timeBased().at(alba).create();
    ScriptApp.newTrigger('onSunset').timeBased().at(tram).create();

    try{ planPianteAtAlba_(alba); }catch(_){}
    logEvent('SCHEDULE_OK','Alba/Tramonto aggiornati',
      'alba='+Utilities.formatDate(alba,tz,'HH:mm')+
      ' tram='+Utilities.formatDate(tram,tz,'HH:mm'));
  }catch(e){ logEvent('SCHEDULE_ERR',String(e),''); }
}

function onSunrise(){
  try{ if(!isOverride_()) evaluateStateNow(); }catch(_){}
}

// ---------- Piante — pianificazione ----------
function planPianteAtAlba_(alba){
  ScriptApp.getProjectTriggers().forEach(function(t){
    if(t.getHandlerFunction && t.getHandlerFunction()==='startPianteAtAlbaOnce_')
      ScriptApp.deleteTrigger(t);
  });

  if(!(alba instanceof Date)){ logEvent('PIANTE_PLAN_ERR','alba non valida',''); return; }

  var when = _pianteScheduleTime_(alba);

  ScriptApp.newTrigger('startPianteAtAlbaOnce_').timeBased().at(when).create();
  setProp_('PLANTS_NEXT_ISO', when.toISOString());
  logEvent('PIANTE_PLAN','pianificato', Utilities.formatDate(when, Session.getScriptTimeZone(), 'dd/MM HH:mm'));
}

// ---------- Piante — esecuzione one-shot all'alba ----------
// Regola: piante sempre (casa occupata o vuota), solo NO alza tapparelle
function startPianteAtAlbaOnce_(){
  try{
    var now = new Date();

    // Controllo orario minimo
    var minTime = _pianteMinTime_(now);
    if(now < minTime){
      ScriptApp.getProjectTriggers().forEach(function(t){
        if(t.getHandlerFunction && t.getHandlerFunction()==='startPianteAtAlbaOnce_')
          ScriptApp.deleteTrigger(t);
      });
      ScriptApp.newTrigger('startPianteAtAlbaOnce_').timeBased().at(minTime).create();
      setProp_('PLANTS_NEXT_ISO', minTime.toISOString());
      logEvent('PIANTE_REPLAN','troppo presto',
        Utilities.formatDate(minTime, Session.getScriptTimeZone(), 'HH:mm'));
      return;
    }

    if(isOverride_()){ logEvent('PIANTE_SKIP','override','startPianteAtAlbaOnce_'); return; }

    // Avvia piante — sempre, sia casa occupata che vuota
    startPiante_('alba');

  }catch(e){ logEvent('PIANTE_ERR',String(e),'alba'); }
}

// ---------- Piante — avvio effettivo ----------
function startPiante_(origin){
  try{
    if(!getPianteEnabled_()){ logEvent('PIANTE_SKIP','disabled',''); return false; }
    if(isOverride_()){ logEvent('PIANTE_SKIP','override',''); return false; }

    var lastMs = Number(getProp_('PLANTS_LAST_RUN_MS','0'))||0;
    var gapMin = (Date.now()-lastMs)/60000;
    if(lastMs && gapMin < getPianteMinIntervalMin_()){
      logEvent('PIANTE_SKIP','min-interval',Math.round(gapMin)+'m'); return false;
    }

    _iftttSafe_('piante', {when:new Date().toISOString(), origin:String(origin||'')});
    setProp_('PLANTS_LAST_RUN_MS', String(Date.now()));
    s('Stato','B10', new Date());
    logEvent('PIANTE_START','ok',String(origin||''));
    logEvent('PIANTE_ALZA','via applet piante','');
    return true;
  }catch(e){ logEvent('PIANTE_ERR',String(e),String(origin||'')); return false; }
}

// ---------- Log prune ----------
function pruneOldLogs_(){
  try{
    var keepDays = getLogRetentionDays_();
    var sheet = sh('Log'), last = sheet.getLastRow(); if(last<2) return;
    var cutoff = new Date(Date.now()-keepDays*24*60*60*1000);
    var vals = sheet.getRange(2,1,last-1,1).getValues();
    var toDel = [];
    for(var i=0;i<vals.length;i++){
      var r=vals[i][0]; var d=(r instanceof Date)?r:new Date(String(r));
      if(!isNaN(d)&&d<cutoff) toDel.push(2+i);
    }
    if(!toDel.length) return;
    toDel.sort(function(a,b){return b-a;});
    toDel.forEach(function(rn){ sh('Log').deleteRow(rn); });
    logEvent('LOG_PRUNE','righe eliminate: '+toDel.length,'keep='+keepDays+'d');
  }catch(e){ logEvent('LOG_PRUNE_ERR',String(e),''); }
}

// ---------- Menu helpers ----------
function pianteStartNow_(){
  var ok=startPiante_('manual');
  SpreadsheetApp.getUi().alert('PIANTE → '+(ok?'avviate':'saltate (disabled/min-interval)'));
}
function pianteCancelPlanned_(){
  var cnt=0;
  ScriptApp.getProjectTriggers().forEach(function(t){
    if(t.getHandlerFunction&&t.getHandlerFunction()==='startPianteAtAlbaOnce_'){
      try{ ScriptApp.deleteTrigger(t); cnt++; }catch(_){}
    }
  });
  setProp_('PLANTS_NEXT_ISO','');
  SpreadsheetApp.getUi().alert('Pianificazioni piante annullate: '+cnt);
}
function pianteDiagNext_(){
  var iso  = String(getProp_('PLANTS_NEXT_ISO',''));
  var last = new Date(Number(getProp_('PLANTS_LAST_RUN_MS','0')));
  var alba = v('Stato','B3');
  var oggi = new Date();
  var min  = _pianteMinTime_(oggi);
  SpreadsheetApp.getUi().alert(
    'Prossimo run: ' + (iso||'(nessuno)') + '\n' +
    'Ultimo run:   ' + last.toISOString() + '\n\n' +
    'Alba oggi:    ' + (alba instanceof Date ? Utilities.formatDate(alba, Session.getScriptTimeZone(), 'HH:mm') : '—') + '\n' +
    'Orario min:   ' + Utilities.formatDate(min, Session.getScriptTimeZone(), 'HH:mm') +
    ' (' + (isFeriale_(oggi) ? 'feriale' : 'festivo/weekend') + ')'
  );
}

// ---------- Piante delayed (2min dopo abbassa_tutto post-uscita) ----------
function startPianteDelayed_(){
  try{
    ScriptApp.getProjectTriggers().forEach(function(t){
      if(t.getHandlerFunction && t.getHandlerFunction()==='startPianteDelayed_')
        ScriptApp.deleteTrigger(t);
    });

    var now = new Date();
    var minTime = _pianteMinTime_(now);
    if(now < minTime){
      logEvent('PIANTE_DELAYED_SKIP','troppo presto',
        Utilities.formatDate(minTime, Session.getScriptTimeZone(), 'HH:mm'));
      return;
    }

    var effettiva = v('Config','B6');
    if(String(effettiva).toUpperCase()==='TRUE' || effettiva===true){
      logEvent('PIANTE_DELAYED_SKIP','casa occupata di nuovo','');
      return;
    }

    if(isNight()){
      logEvent('PIANTE_DELAYED_SKIP','notte','');
      return;
    }

    startPiante_('delayed_security');
  }catch(e){ logEvent('PIANTE_DELAYED_ERR',String(e),''); }
}

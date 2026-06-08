// 07_jobs.gs — alba/tramonto, piante, log prune

// Orario minimo piante: 07:30 feriale / 09:30 festivo
function _pianteMinTime_(d){
  d = d||new Date();
  var base = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  base.setHours(isFeriale_(d)?7:9, isFeriale_(d)?30:30, 0, 0);
  return base;
}

// Calcola orario piante = alba+60min, mai prima del minimo
function _pianteScheduleTime_(alba){
  var withDelay = new Date(alba.getTime() + 60*60000);
  var minTime   = _pianteMinTime_(withDelay);
  var when      = (withDelay > minTime) ? withDelay : minTime;
  var tz        = Session.getScriptTimeZone();
  logEvent('PIANTE_CALC',
    'alba='+Utilities.formatDate(alba,tz,'HH:mm')+
    ' +60m='+Utilities.formatDate(withDelay,tz,'HH:mm')+
    ' min='+Utilities.formatDate(minTime,tz,'HH:mm')+
    ' →'+Utilities.formatDate(when,tz,'HH:mm'),
    isFeriale_(alba)?'feriale':'festivo');
  return when;
}

// scheduleSunEventsForToday: chiama API alba/tramonto, pianifica trigger
function scheduleSunEventsForToday(){
  try{
    var G   = sh('Geo');
    var lat = Number(G.getRange('A2').getValue());
    var lon = Number(G.getRange('B2').getValue());
    var tz  = String(G.getRange('C2').getValue()||Session.getScriptTimeZone());
    if(!isFinite(lat)||!isFinite(lon)) throw new Error('Geo sheet non valido lat='+lat+' lon='+lon);

    var today = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');
    var url   = 'https://api.sunrise-sunset.org/json?lat='+lat+'&lng='+lon+'&date='+today+'&formatted=0';
    var resp  = UrlFetchApp.fetch(url, {muteHttpExceptions:true});
    if(resp.getResponseCode()!==200) throw new Error('HTTP '+resp.getResponseCode());
    var js = JSON.parse(resp.getContentText());
    if(!js||js.status!=='OK') throw new Error('API status: '+js.status);

    var alba = new Date(js.results.sunrise);
    var tram = new Date(js.results.sunset);
    s('Stato','B3', alba);
    s('Stato','B4', tram);

    // Rimuovi vecchi trigger alba/tramonto/piante
    ScriptApp.getProjectTriggers().forEach(function(t){
      var fn = t.getHandlerFunction?t.getHandlerFunction():'';
      if(fn==='onSunrise'||fn==='onSunset'||fn==='startPianteAtAlbaOnce_')
        ScriptApp.deleteTrigger(t);
    });

    ScriptApp.newTrigger('onSunrise').timeBased().at(alba).create();
    ScriptApp.newTrigger('onSunset').timeBased().at(tram).create();

    // Pianifica piante
    var when = _pianteScheduleTime_(alba);
    ScriptApp.newTrigger('startPianteAtAlbaOnce_').timeBased().at(when).create();
    setProp_('PLANTS_NEXT_ISO', when.toISOString());
    s('Stato','B10', when);

    logEvent('SUN_OK',
      'alba='+Utilities.formatDate(alba,tz,'HH:mm')+
      ' tram='+Utilities.formatDate(tram,tz,'HH:mm')+
      ' piante='+Utilities.formatDate(when,tz,'HH:mm'), today);
  }catch(e){ logEvent('SUN_ERR',String(e),''); }
}

function onSunrise(){
  try{ if(!isOverride_()) evaluateStateNow(); }catch(_){}
}

// Piante one-shot all'alba
function startPianteAtAlbaOnce_(){
  try{
    // Auto-cancella questo trigger
    ScriptApp.getProjectTriggers().forEach(function(t){
      if((t.getHandlerFunction?t.getHandlerFunction():'')===('startPianteAtAlbaOnce_'))
        ScriptApp.deleteTrigger(t);
    });

    var now     = new Date();
    var minTime = _pianteMinTime_(now);

    // Troppo presto? Ripianifica
    if(now < minTime){
      ScriptApp.newTrigger('startPianteAtAlbaOnce_').timeBased().at(minTime).create();
      setProp_('PLANTS_NEXT_ISO', minTime.toISOString());
      s('Stato','B10', minTime);
      logEvent('PIANTE_REPLAN','troppo presto →'+Utilities.formatDate(minTime,Session.getScriptTimeZone(),'HH:mm'),'');
      return;
    }

    if(isOverride_()){ logEvent('PIANTE_SKIP','override',''); return; }

    startPiante_('alba');
  }catch(e){ logEvent('PIANTE_ERR',String(e),'alba'); }
}

// Piante effettive
function startPiante_(origin){
  try{
    if(!getPianteEnabled_()){ logEvent('PIANTE_SKIP','disabled',''); return false; }
    if(isOverride_()){ logEvent('PIANTE_SKIP','override',''); return false; }

    var lastMs  = Number(getProp_('PLANTS_LAST_RUN_MS','0'))||0;
    var gapMin  = (Date.now()-lastMs)/60000;
    var minGap  = getPianteMinIntervalMin_();
    if(lastMs && gapMin < minGap){
      logEvent('PIANTE_SKIP','min-interval '+Math.round(gapMin)+'m < '+minGap+'m',''); return false;
    }

    _iftttSafe_('piante');
    setProp_('PLANTS_LAST_RUN_MS', String(Date.now()));
    s('Stato','B10', new Date());
    logEvent('PIANTE_OK', origin||'', '');
    return true;
  }catch(e){ logEvent('PIANTE_ERR',String(e),origin||''); return false; }
}

// Piante delayed 2min dopo uscita (da applySecurityDay)
function startPianteDelayed_(){
  try{
    ScriptApp.getProjectTriggers().forEach(function(t){
      if((t.getHandlerFunction?t.getHandlerFunction():'')===('startPianteDelayed_'))
        ScriptApp.deleteTrigger(t);
    });
    if(isNight()){ logEvent('PIANTE_SKIP','notte','delayed'); return; }
    // Se nel frattempo qualcuno è rientrato non innaffiare
    if(!everyoneOutNow_()){ logEvent('PIANTE_SKIP','casa occupata','delayed'); return; }
    startPiante_('post_uscita');
  }catch(e){ logEvent('PIANTE_DELAYED_ERR',String(e),''); }
}

// Log prune
function pruneOldLogs_(){
  try{
    var keep = getLogRetentionDays_();
    var sheet = sh('Log'), last = sheet.getLastRow(); if(last<2)return;
    var cutoff = new Date(Date.now()-keep*86400000);
    var vals = sheet.getRange(2,1,last-1,1).getValues();
    var toDel = [];
    for(var i=0;i<vals.length;i++){
      var d = vals[i][0] instanceof Date ? vals[i][0] : new Date(String(vals[i][0]));
      if(!isNaN(d)&&d<cutoff) toDel.push(2+i);
    }
    if(!toDel.length)return;
    toDel.sort(function(a,b){return b-a;}).forEach(function(r){ sh('Log').deleteRow(r); });
    logEvent('LOG_PRUNE',toDel.length+' righe','keep='+keep+'d');
  }catch(e){ logEvent('LOG_PRUNE_ERR',String(e),''); }
}

// Menu helpers
function pianteStartNow_(){
  try{
    var ok = startPiante_('manual');
    try{ SpreadsheetApp.getActiveSpreadsheet().toast(ok?'🌿 Avviate':'⚠️ Saltate','Piante',5); }catch(_){}
  }catch(e){ logEvent('PIANTE_MANUAL_ERR',String(e),''); }
}

function pianteCancelPlanned_(){
  try{
    var cnt=0;
    ScriptApp.getProjectTriggers().forEach(function(t){
      var fn = t.getHandlerFunction?t.getHandlerFunction():'';
      if(fn==='startPianteAtAlbaOnce_'||fn==='startPianteDelayed_'){
        try{ ScriptApp.deleteTrigger(t); cnt++; }catch(_){}
      }
    });
    setProp_('PLANTS_NEXT_ISO','');
    s('Stato','B10','');
    logEvent('PIANTE_CANCEL',cnt+' trigger','');
    try{ SpreadsheetApp.getActiveSpreadsheet().toast('✅ '+cnt+' trigger piante annullati','Piante',5); }catch(_){}
  }catch(e){ logEvent('PIANTE_CANCEL_ERR',String(e),''); }
}

function pianteDiagNext_(){
  try{
    var iso   = getProp_('PLANTS_NEXT_ISO','');
    var lastMs = Number(getProp_('PLANTS_LAST_RUN_MS','0'))||0;
    var alba  = v('Stato','B3');
    var tz    = Session.getScriptTimeZone();
    var oggi  = new Date();
    var msg   =
      'Prossimo: '+(iso||'nessuno')+'\n'+
      'Ultimo: '+(lastMs?Utilities.formatDate(new Date(lastMs),tz,'dd/MM HH:mm'):'mai')+'\n'+
      'Alba: '+(alba instanceof Date?Utilities.formatDate(alba,tz,'HH:mm'):'—')+'\n'+
      'Min oggi: '+Utilities.formatDate(_pianteMinTime_(oggi),tz,'HH:mm')+
      ' ('+(isFeriale_(oggi)?'feriale':'festivo')+')';
    logEvent('PIANTE_DIAG',msg,'');
    try{ SpreadsheetApp.getActiveSpreadsheet().toast(msg,'Piante diag',10); }catch(_){}
  }catch(e){ logEvent('PIANTE_DIAG_ERR',String(e),''); }
}

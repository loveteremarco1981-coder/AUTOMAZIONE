// ============================================================
// 07_jobs.gs — alba/tramonto, piante, log prune
// ============================================================

// ---------- Alba / Tramonto ----------
function scheduleSunEventsForToday(){
  try{
    var G=sh('Geo');
    var lat=Number(G.getRange('A2').getValue());
    var lon=Number(G.getRange('B2').getValue());
    var tz=String(G.getRange('C2').getValue()||Session.getScriptTimeZone());
    if(!isFinite(lat)||!isFinite(lon))throw new Error('Geo sheet non valido');

    var todayLocal=Utilities.formatDate(new Date(),tz,'yyyy-MM-dd');
    var url='https://api.sunrise-sunset.org/json?lat='+lat+'&lng='+lon+'&date='+todayLocal+'&formatted=0';
    var resp=UrlFetchApp.fetch(url,{muteHttpExceptions:true});
    if(resp.getResponseCode()!==200)throw new Error('HTTP '+resp.getResponseCode());
    var js=JSON.parse(resp.getContentText());
    if(!js||js.status!=='OK')throw new Error('status '+js.status);

    var alba=new Date(js.results.sunrise);
    var tram=new Date(js.results.sunset);
    s('Stato','B3',alba); s('Stato','B4',tram);

    ScriptApp.getProjectTriggers().forEach(function(t){
      var f=t.getHandlerFunction?t.getHandlerFunction():null;
      if(f==='onSunrise'||f==='onSunset')ScriptApp.deleteTrigger(t);
    });
    ScriptApp.newTrigger('onSunrise').timeBased().at(alba).create();
    ScriptApp.newTrigger('onSunset').timeBased().at(tram).create();

    try{ if(typeof planPianteAtAlba_==='function')planPianteAtAlba_(alba); }catch(_){}
    logEvent('SCHEDULE_OK','Alba/Tramonto aggiornati','');
  }catch(e){ logEvent('SCHEDULE_ERR',String(e),''); }
}

function onSunrise(){
  try{ if(!isOverride_())evaluateStateNow(); }catch(_){}
}
function onSunset(){
  try{
    if(!isOverride_()){
      if(!v('Config','B6'))actRaiseAll_&&actRaiseAll_('Tramonto: casa vuota');
      evaluateStateNow();
    }
  }catch(e){ logEvent('ERROR_SUNSET',String(e),''); }
}

// ---------- Piante ----------
function planPianteAtAlba_(alba){
  ScriptApp.getProjectTriggers().forEach(function(t){
    if(t.getHandlerFunction&&t.getHandlerFunction()==='startPianteAtAlbaOnce_')ScriptApp.deleteTrigger(t);
  });
  if(!(alba instanceof Date)){ logEvent('PIANTE_PLAN_ERR','alba non valida',''); return; }
  var when=new Date(alba);
  for(var i=0;i<480&&isQuietHours_(when);i++) when=new Date(when.getTime()+60000);
  ScriptApp.newTrigger('startPianteAtAlbaOnce_').timeBased().at(when).create();
  setProp_('PLANTS_NEXT_ISO',when.toISOString());
  logEvent('PIANTE_PLAN','pianificato',when.toISOString());
}

function startPianteAtAlbaOnce_(){
  try{
    var now=new Date();
    if(isQuietHours_(now)){
      var re=new Date(now.getTime()+60000);
      for(var i=0;i<480&&isQuietHours_(re);i++) re=new Date(re.getTime()+60000);
      ScriptApp.getProjectTriggers().forEach(function(t){
        if(t.getHandlerFunction&&t.getHandlerFunction()==='startPianteAtAlbaOnce_')ScriptApp.deleteTrigger(t);
      });
      ScriptApp.newTrigger('startPianteAtAlbaOnce_').timeBased().at(re).create();
      setProp_('PLANTS_NEXT_ISO',re.toISOString());
      logEvent('PIANTE_REPLAN','post-quiet',re.toISOString());
      return;
    }
    startPiante_('alba');
  }catch(e){ logEvent('PIANTE_ERR',String(e),'alba'); }
}

function startPiante_(origin){
  try{
    if(!getPianteEnabled_()){ logEvent('PIANTE_SKIP','disabled',''); return false; }
    var lastMs=Number(getProp_('PLANTS_LAST_RUN_MS','0'))||0;
    var gapMin=(Date.now()-lastMs)/60000;
    if(lastMs&&gapMin<getPianteMinIntervalMin_()){
      logEvent('PIANTE_SKIP','min-interval',Math.round(gapMin)+'m'); return false;
    }
    _iftttSafe_('piante',{when:new Date().toISOString(),origin:String(origin||'')});
    setProp_('PLANTS_LAST_RUN_MS',String(Date.now()));
    s('Stato','B10',new Date());
    logEvent('PIANTE_START','ok',String(origin||''));
    if(getAlzaCon_()==='PIANTE'){ try{ actRaiseAll_('Piante'); }catch(_){} }
    return true;
  }catch(e){ logEvent('PIANTE_ERR',String(e),String(origin||'')); return false; }
}

// ---------- Log prune ----------
function pruneOldLogs_(){
  try{
    var keepDays=getLogRetentionDays_();
    var sheet=sh('Log'), last=sheet.getLastRow(); if(last<2)return;
    var cutoff=new Date(Date.now()-keepDays*24*60*60*1000);
    var vals=sheet.getRange(2,1,last-1,1).getValues();
    var toDel=[];
    for(var i=0;i<vals.length;i++){
      var r=vals[i][0]; var d=(r instanceof Date)?r:new Date(String(r));
      if(!isNaN(d)&&d<cutoff) toDel.push(2+i);
    }
    if(!toDel.length)return;
    toDel.sort(function(a,b){return b-a;});
    toDel.forEach(function(rn){ sh('Log').deleteRow(rn); });
    logEvent('LOG_PRUNE','righe eliminate: '+toDel.length,'keep='+keepDays+'d');
  }catch(e){ logEvent('LOG_PRUNE_ERR',String(e),''); }
}

// ---------- Menu helpers ----------
function pianteStartNow_(){ var ok=startPiante_('manual'); SpreadsheetApp.getUi().alert('PIANTE → '+(ok?'avviate':'saltate')); }
function pianteCancelPlanned_(){
  var cnt=0;
  ScriptApp.getProjectTriggers().forEach(function(t){
    if(t.getHandlerFunction&&t.getHandlerFunction()==='startPianteAtAlbaOnce_'){ try{ScriptApp.deleteTrigger(t);cnt++;}catch(_){} }
  });
  setProp_('PLANTS_NEXT_ISO','');
  SpreadsheetApp.getUi().alert('Pianificazioni piante annullate: '+cnt);
}
function pianteDiagNext_(){
  var iso=String(getProp_('PLANTS_NEXT_ISO',''));
  var last=new Date(Number(getProp_('PLANTS_LAST_RUN_MS','0')));
  SpreadsheetApp.getUi().alert('Prossimo: '+(iso||'(nessuno)')+'\nUltimo: '+last.toISOString());
}

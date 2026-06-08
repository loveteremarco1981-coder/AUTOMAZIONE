// 03_people.gs — PRESENZA: SOLO 3 SHORTCUT iOS
// ssid_on  → IN immediato + trigger one-shot cancella pending
// ssid_off → trigger one-shot OUT dopo guard (Config B12, default 20min)
// geofence → trigger one-shot OUT dopo guard
// Nessun KA, nessun timeout, nessun debounce, nessun grace, nessun sweep

function _ssidKey_(nm){ return 'SSID_LOCK_'+String(nm||'').toUpperCase(); }

function hasSsidLock_(nm){
  var until = Number(getProp_(_ssidKey_(nm),'0'))||0;
  return until > 0 && Date.now() <= until;
}

// ssid_on → IN immediato, cancella eventuale trigger out pendente
function ssidOn_(nm, holdMin){
  var n = String(nm||'').toLowerCase();
  var hold = Number(holdMin)||480;
  setProp_(_ssidKey_(n), String(Date.now() + hold*60000));
  // Cancella trigger out pendente per questa persona
  _cancelOutTrigger_(n);
  setPersonIn_(n, 'SSID_ON');
  logEvent('SSID_ON', n, 'hold='+hold+'m');
  return {ok:true, hold:hold};
}

// ssid_off → programma trigger one-shot OUT tra guard minuti
function ssidOff_(nm){
  var n = String(nm||'').toLowerCase();
  var guard = getExitGuardMin_();
  setProp_(_ssidKey_(n), '0'); // rimuove lock
  _scheduleOutTrigger_(n, guard, 'ssid_off');
  logEvent('SSID_OFF', n, 'out_trigger tra '+guard+'m');
  return {ok:true, guard:guard};
}

// geofence → programma trigger one-shot OUT tra guard minuti
function markOut_geofence_(nm){
  var n = String(nm||'').toLowerCase();
  if(hasSsidLock_(n)){
    // Wi-Fi ancora connesso: ignora geofence
    logEvent('GEO_IGNORED', n, 'ssid_lock attivo');
    return;
  }
  var guard = getExitGuardMin_();
  _scheduleOutTrigger_(n, guard, 'geofence');
  logEvent('GEO_OUT', n, 'out_trigger tra '+guard+'m');
}

// Programma trigger one-shot: confirmOut_NOME tra N minuti
function _scheduleOutTrigger_(nm, guardMin, src){
  var n = String(nm||'').toLowerCase();
  // Salva source per la funzione callback
  setProp_('OUT_SRC_'+n.toUpperCase(), src||'');
  // Cancella eventuale trigger precedente
  _cancelOutTrigger_(n);
  var when = new Date(Date.now() + guardMin*60000);
  ScriptApp.newTrigger('confirmOut_'+n).timeBased().at(when).create();
  logEvent('OUT_SCHED', n, src+' tra '+guardMin+'m alle '+Utilities.formatDate(when,Session.getScriptTimeZone(),'HH:mm'));
}

// Cancella trigger out pendente per questa persona
function _cancelOutTrigger_(nm){
  var n = String(nm||'').toLowerCase();
  var fn = 'confirmOut_'+n;
  ScriptApp.getProjectTriggers().forEach(function(t){
    if((t.getHandlerFunction?t.getHandlerFunction():'')===fn){
      try{ ScriptApp.deleteTrigger(t); }catch(_){}
    }
  });
}

// Funzioni callback one-shot per ogni persona (devono esistere con nome esatto)
function confirmOut_marco(){  _doConfirmOut_('marco');  }
function confirmOut_silvia(){ _doConfirmOut_('silvia'); }
function confirmOut_viola(){  _doConfirmOut_('viola');  }
function confirmOut_samuele(){ _doConfirmOut_('samuele'); }

function _doConfirmOut_(nm){
  try{
    // Se nel frattempo è arrivato ssid_on → annulla
    if(hasSsidLock_(nm)){
      logEvent('OUT_ABORT', nm, 'ssid_on arrivato durante guard');
      return;
    }
    var src = getProp_('OUT_SRC_'+nm.toUpperCase(),'');
    setPersonOut_(nm, 'USCITA');
    logEvent('OUT_OK', nm, src);
    evaluateStateNow();
  }catch(e){ logEvent('OUT_ERR',String(e),nm); }
}

// Force in/out manuali
function forceIn_(nm){
  var n = String(nm||'').toLowerCase();
  setProp_(_ssidKey_(n), String(Date.now()+480*60000));
  _cancelOutTrigger_(n);
  setPersonIn_(n, 'FORCE_IN');
  logEvent('FORCE_IN', n, '');
  return {ok:true, name:n};
}
function forceOut_(nm){
  var n = String(nm||'').toLowerCase();
  setProp_(_ssidKey_(n), '0');
  _cancelOutTrigger_(n);
  setPersonOut_(n, 'FORCE_OUT');
  logEvent('FORCE_OUT', n, '');
  return {ok:true};
}

// Helpers foglio Persone
function setPersonIn_(nm, evt){
  try{
    var P=sh('Persone'), last=P.getLastRow(); if(last<2)return;
    var rows=P.getRange(2,1,last-1,1).getValues();
    for(var i=0;i<rows.length;i++){
      if(String(rows[i][0]||'').trim().toLowerCase()===String(nm).toLowerCase()){
        var now=new Date();
        P.getRange(2+i,3).setValue(now);
        P.getRange(2+i,4).setValue(String(evt||'IN'));
        P.getRange(2+i,5).setValue(now);
        P.getRange(2+i,6).setValue('IN');
        break;
      }
    }
  }catch(e){ logEvent('SET_IN_ERR',String(e),nm); }
}

function setPersonOut_(nm, evt){
  try{
    var P=sh('Persone'), last=P.getLastRow(); if(last<2)return;
    var rows=P.getRange(2,1,last-1,1).getValues();
    for(var i=0;i<rows.length;i++){
      if(String(rows[i][0]||'').trim().toLowerCase()===String(nm).toLowerCase()){
        P.getRange(2+i,4).setValue(String(evt||'USCITA'));
        P.getRange(2+i,6).setValue('OUT');
        break;
      }
    }
  }catch(e){ logEvent('SET_OUT_ERR',String(e),nm); }
}

function _getAllPeopleRaw_(){
  try{
    var P=sh('Persone'), last=P.getLastRow();
    if(last<2) return [];
    var rows=P.getRange(2,1,last-1,7).getValues();
    return rows.filter(function(r){return String(r[0]||'').trim();}).map(function(r){
      var lm=null;
      if(r[2] instanceof Date) lm=r[2].getTime();
      else if(r[2]){var d=new Date(r[2]);if(!isNaN(d))lm=d.getTime();}
      return {name:String(r[0]||'').trim(), online:String(r[5]||'').toUpperCase()==='IN', lastEvent:String(r[3]||''), lifeMs:lm};
    });
  }catch(e){ logEvent('PPL_ERR',String(e),''); return []; }
}

function everyoneOutNow_(){
  try{ return !_getAllPeopleRaw_().some(function(p){return p.online;}); }
  catch(_){ return false; }
}
function everyoneOutWithGrace_(){ return everyoneOutNow_(); }

// Purge trigger KA legacy rimasti da versioni precedenti
function purgeKATriggers_(){
  try{
    ScriptApp.getProjectTriggers().forEach(function(t){
      var fn = t.getHandlerFunction?t.getHandlerFunction():'';
      if(/^(ka|keepalive|morning_ka|kaoff|katrg|pendingOutSweep)/i.test(fn)){
        ScriptApp.deleteTrigger(t);
        logEvent('LEGACY_PURGE', fn, 'rimosso');
      }
    });
  }catch(e){ logEvent('PURGE_ERR',String(e),''); }
}

// STUB compatibilità
function autoOutByLifeTimeout_(){}
function morningKeepAlive_(){}
function lifePingNow_(nm){ return {ok:false,err:'disabled'}; }
function pendingOutSweep_(){}
function disableKAIfOut_(){}
function applyPresenceDebounce_(raw){ return {reported:!!raw}; }
function getPeople_(){ return {people:_getAllPeopleRaw_()}; }
function getCooldown_(nm){ return 0; }
function setCooldown_(nm,u){}
function clearCooldown_(nm){}

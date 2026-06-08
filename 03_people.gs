// 03_people.gs — PRESENZA: SOLO 3 SHORTCUT iOS
// ssid_on  → IN immediato
// ssid_off → OUT dopo guard (20min default)
// geofence → OUT dopo guard
// Nessun KA, nessun timeout, nessun debounce, nessun grace

function _ssidKey_(nm){ return 'SSID_LOCK_'+String(nm||'').toUpperCase(); }
function _pendingKey_(nm){ return 'PENDING_OUT_'+String(nm||'').toUpperCase(); }

function hasSsidLock_(nm){
  var until = Number(getProp_(_ssidKey_(nm),'0'))||0;
  return until > 0 && Date.now() <= until;
}

function ssidOn_(nm, holdMin){
  var hold = Number(holdMin)||480;
  setProp_(_ssidKey_(nm), String(Date.now() + hold*60000));
  setProp_(_pendingKey_(nm), '');
  setPersonIn_(nm, 'SSID_ON');
  return {ok:true, hold:hold};
}

function ssidOff_(nm){
  var guard = getExitGuardMin_();
  setProp_(_pendingKey_(nm), JSON.stringify({fireAt: Date.now()+guard*60000, src:'ssid_off'}));
  logEvent('SSID_OFF', nm, 'guard='+guard+'m');
  return {ok:true, guard:guard};
}

function markOut_geofence_(nm){
  var guard = getExitGuardMin_();
  setProp_(_pendingKey_(nm), JSON.stringify({fireAt: Date.now()+guard*60000, src:'geofence'}));
  logEvent('GEO_OUT', nm, 'guard='+guard+'m');
}

// Sweep ogni 5min: conferma OUT dopo guard solo se ssid_on non è arrivato
function pendingOutSweep_(){
  try{
    var now = Date.now(), changed = false;
    _getAllPeopleRaw_().forEach(function(p){
      var nm = p.name.toLowerCase();
      var raw = getProp_(_pendingKey_(nm),'');
      if(!raw) return;
      var pend; try{ pend=JSON.parse(raw); }catch(_){ return; }
      if(!pend || !pend.fireAt) return;
      if(hasSsidLock_(nm)){
        setProp_(_pendingKey_(nm),'');
        logEvent('OUT_ABORT', nm, 'ssid_on durante guard'); return;
      }
      if(now >= pend.fireAt){
        setProp_(_pendingKey_(nm),'');
        setProp_(_ssidKey_(nm),'0');
        setPersonOut_(nm,'USCITA');
        logEvent('OUT_OK', nm, pend.src||'');
        changed = true;
      }
    });
    if(changed) evaluateStateNow();
  }catch(e){ logEvent('SWEEP_ERR',String(e),''); }
}

function forceIn_(nm){
  var n=String(nm||'').toLowerCase();
  setProp_(_ssidKey_(n), String(Date.now()+480*60000));
  setProp_(_pendingKey_(n),'');
  setPersonIn_(n,'FORCE_IN');
  logEvent('FORCE_IN',n,'');
  return {ok:true,name:n};
}

function forceOut_(nm){
  var n=String(nm||'').toLowerCase();
  setProp_(_ssidKey_(n),'0');
  setProp_(_pendingKey_(n),'');
  setPersonOut_(n,'FORCE_OUT');
  logEvent('FORCE_OUT',n,'');
  return {ok:true};
}

function setPersonIn_(nm,evt){
  try{
    var P=sh('Persone'),last=P.getLastRow(); if(last<2)return;
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

function setPersonOut_(nm,evt){
  try{
    var P=sh('Persone'),last=P.getLastRow(); if(last<2)return;
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
    var P=sh('Persone'),last=P.getLastRow();
    if(last<2)return[];
    var rows=P.getRange(2,1,last-1,7).getValues();
    return rows.filter(function(r){return String(r[0]||'').trim();}).map(function(r){
      var lm=null;
      if(r[2] instanceof Date)lm=r[2].getTime();
      else if(r[2]){var d=new Date(r[2]);if(!isNaN(d))lm=d.getTime();}
      return{name:String(r[0]||'').trim(),online:String(r[5]||'').toUpperCase()==='IN',lastEvent:String(r[3]||''),lifeMs:lm};
    });
  }catch(e){logEvent('PPL_ERR',String(e),'');return[];}
}

function everyoneOutNow_(){
  try{return!_getAllPeopleRaw_().some(function(p){return p.online;});}catch(_){return false;}
}
function everyoneOutWithGrace_(){ return everyoneOutNow_(); }

// STUB — rimasti per compatibilità con chiamate sparse
function autoOutByLifeTimeout_(){}
function morningKeepAlive_(){}
function lifePingNow_(nm){return{ok:false,err:'disabled'};}
function disableKAIfOut_(){}
function purgeKATriggers_(){
  try{
    ScriptApp.getProjectTriggers().forEach(function(t){
      var fn=t.getHandlerFunction?t.getHandlerFunction():'';
      if(/ka|keepalive|morning_ka|kaoff|katrg/i.test(fn)){
        ScriptApp.deleteTrigger(t);
        logEvent('KA_PURGE',fn,'rimosso');
      }
    });
  }catch(e){logEvent('KA_PURGE_ERR',String(e),'');}
}
function applyPresenceDebounce_(raw){return{reported:!!raw};}
function getPeople_(){return{people:_getAllPeopleRaw_()};}
function getCooldown_(nm){return Number(getProp_('CD_'+String(nm).toUpperCase(),'0'))||0;}
function setCooldown_(nm,u){setProp_('CD_'+String(nm).toUpperCase(),String(u));}
function clearCooldown_(nm){setProp_('CD_'+String(nm).toUpperCase(),'0');}

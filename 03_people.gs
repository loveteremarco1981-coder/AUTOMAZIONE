// 03_people.gs — PRESENZA: SOLO 4 SHORTCUT iOS
// 1. wifi_on  (ssid_on):  iPhone connesso al WiFi → IN immediato
// 2. wifi_off (ssid_off): iPhone disconnesso dal WiFi → pending OUT (guard 20min)
// 3. geo_out  (mark_out): Geofence uscita → rinforza OUT pending
// 4. geo_in   (mark_in):  Geofence rientro → IN immediato (prima del WiFi)
//
// Protezione flapping: dopo ssid_off, ssid_on ignorato per EXIT_COOLDOWN_MIN (default 5min)
// Questo evita che l'ultimo ping WiFi del router annulli l'uscita

function _ssidKey_(nm)    { return 'SSID_LOCK_'+String(nm||'').toUpperCase(); }
function _pendingKey_(nm) { return 'PENDING_OUT_'+String(nm||'').toUpperCase(); }
function _cooldownKey_(nm){ return 'OUT_COOLDOWN_'+String(nm||'').toUpperCase(); }

function hasSsidLock_(nm){
  var until = Number(getProp_(_ssidKey_(nm),'0'))||0;
  return until > 0 && Date.now() <= until;
}

function _inCooldown_(nm){
  var until = Number(getProp_(_cooldownKey_(nm),'0'))||0;
  return until > 0 && Date.now() < until;
}

// 1. WIFI ON → IN, ma solo se non in cooldown uscita
function ssidOn_(nm, holdMin){
  var n = String(nm||'').toLowerCase();
  var hold = Number(holdMin)||480;

  if(_inCooldown_(n)){
    var until = new Date(Number(getProp_(_cooldownKey_(n),'0')));
    logEvent('SSID_ON_IGNORED', n, 'cooldown uscita attivo fino '+Utilities.formatDate(until,Session.getScriptTimeZone(),'HH:mm'));
    return {ok:true, ignored:true, reason:'cooldown'};
  }

  setProp_(_ssidKey_(n), String(Date.now() + hold*60000));
  setProp_(_pendingKey_(n), '');
  setPersonIn_(n, 'SSID_ON');
  return {ok:true, hold:hold};
}

// 2. WIFI OFF → pending OUT + cooldown (blocca ssid_on spurio per N min)
function ssidOff_(nm){
  var n = String(nm||'').toLowerCase();
  var guard    = getExitGuardMin_();       // Config B12, default 20min
  var cooldown = getExitCooldownMin_();    // Config B26, default 5min
  setProp_(_ssidKey_(n), '0');
  setProp_(_pendingKey_(n), JSON.stringify({fireAt: Date.now()+guard*60000, src:'ssid_off'}));
  setProp_(_cooldownKey_(n), String(Date.now() + cooldown*60000));
  logEvent('SSID_OFF', n, 'guard='+guard+'m cooldown='+cooldown+'m');
  return {ok:true, guard:guard};
}

// 3. GEO OUT → rinforza pending (o crea se non c'era)
function markOut_geofence_(nm){
  var n = String(nm||'').toLowerCase();
  var guard = getExitGuardMin_();
  // Se ha ssid lock ancora attivo, rimuovilo — geofence è più affidabile
  setProp_(_ssidKey_(n), '0');
  setProp_(_pendingKey_(n), JSON.stringify({fireAt: Date.now()+guard*60000, src:'geofence'}));
  setProp_(_cooldownKey_(n), String(Date.now() + getExitCooldownMin_()*60000));
  logEvent('GEO_OUT', n, 'guard='+guard+'m');
}

// 4. GEO IN → IN immediato, azzera cooldown
function markIn_geofence_(nm){
  var n = String(nm||'').toLowerCase();
  setProp_(_cooldownKey_(n), '0');
  setProp_(_pendingKey_(n), '');
  setPersonIn_(n, 'GEO_IN');
  logEvent('GEO_IN', n, 'geofence arrivo');
}

// Sweep ogni 5min: conferma OUT se guard scaduto
function pendingOutSweep_(){
  try{
    var now = Date.now(), changed = false;
    _getAllPeopleRaw_().forEach(function(p){
      var nm = p.name.toLowerCase();
      var raw = getProp_(_pendingKey_(nm),'');
      if(!raw) return;
      var pend; try{ pend=JSON.parse(raw); }catch(_){ return; }
      if(!pend || !pend.fireAt) return;
      if(now >= pend.fireAt){
        setProp_(_pendingKey_(nm),'');
        setProp_(_ssidKey_(nm),'0');
        setPersonOut_(nm, 'USCITA');
        logEvent('OUT_OK', nm, pend.src||'');
        changed = true;
      }
    });
    if(changed) evaluateStateNow();
  }catch(e){ logEvent('SWEEP_ERR',String(e),''); }
}

// Force in/out manuali (app/menu)
function forceIn_(nm){
  var n = String(nm||'').toLowerCase();
  setProp_(_ssidKey_(n), String(Date.now()+480*60000));
  setProp_(_pendingKey_(n), '');
  setProp_(_cooldownKey_(n), '0');
  setPersonIn_(n, 'FORCE_IN');
  logEvent('FORCE_IN', n, '');
  return {ok:true, name:n};
}
function forceOut_(nm){
  var n = String(nm||'').toLowerCase();
  setProp_(_ssidKey_(n), '0');
  setProp_(_pendingKey_(n), '');
  setProp_(_cooldownKey_(n), '0');
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

function purgeKATriggers_(){
  try{
    ScriptApp.getProjectTriggers().forEach(function(t){
      var fn = t.getHandlerFunction?t.getHandlerFunction():'';
      if(/^(ka|keepalive|morning_ka|kaoff|katrg|morningKeepAlive)/i.test(fn)){
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
function disableKAIfOut_(){}
function applyPresenceDebounce_(raw){ return {reported:!!raw}; }
function getPeople_(){ return {people:_getAllPeopleRaw_()}; }
function getCooldown_(nm){ return 0; }
function setCooldown_(nm,u){}
function clearCooldown_(nm){}

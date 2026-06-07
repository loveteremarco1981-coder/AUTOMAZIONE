// ============================================================
// 03_people.gs — PRESENZA SEMPLIFICATA
// IN  = ssid_on ricevuto (lock 8h)
// OUT = ssid_off confermato (guard 20m) o geofence o force_out
// MAI auto-out di giorno per timeout
// Di notte: auto-out solo dopo 8h di silenzio assoluto
// ============================================================

// ---------- SSID lock ----------
function _ssidKey_(nm){ return 'SSID_LOCK_'+String(nm||'').toUpperCase(); }
function _ssidUntil_(nm){ return Number(getProp_(_ssidKey_(nm),'0'))||0; }

function ssidOn_(nm, holdMin){
  var hold = Number(holdMin)||480;
  var until = Date.now() + hold*60000;
  setProp_(_ssidKey_(nm), String(until));
  _clearPendingOut_(nm);
  setPersonIn_(nm, 'SSID_ON');
  logEvent('SSID_ON', nm, 'hold='+hold+'m');
  return {ok:true, hold:hold, until:until};
}

function ssidOff_(nm){
  var guard = getExitGuardMin_();
  _setPendingOut_(nm, 'ssid_off', guard);
  logEvent('SSID_OFF', nm, 'guard='+guard+'m');
  return {ok:true, guard:guard};
}

function hasSsidLock_(nm){
  var until = _ssidUntil_(nm);
  if(!until) return false;
  if(Date.now() <= until) return true;
  setProp_(_ssidKey_(nm), '0');
  return false;
}

// ---------- Pending OUT ----------
function _pendingKey_(nm){ return 'PENDING_OUT_'+String(nm||'').toUpperCase(); }
function _pendingOutKey_(nm){ return _pendingKey_(nm); }

function _setPendingOut_(nm, source, guardMin){
  var fireAt = Date.now() + (Number(guardMin)||20)*60000;
  setProp_(_pendingKey_(nm), JSON.stringify({ fireAt:fireAt, source:String(source||'') }));
}

function _clearPendingOut_(nm){
  setProp_(_pendingKey_(nm), '');
}

// Sweep ogni 5 min
function pendingOutSweep_(){
  try{
    var ppl = _getAllPeopleRaw_();
    var now = Date.now();
    ppl.forEach(function(p){
      var nm = p.name.toLowerCase();
      var raw = getProp_(_pendingKey_(nm),'');
      if(!raw) return;
      var pending;
      try{ pending = JSON.parse(raw); }catch(_){ return; }
      if(!pending || !pending.fireAt) return;
      if(hasSsidLock_(nm)){
        _clearPendingOut_(nm);
        logEvent('OUT_PENDING_ABORT','ssid_reconnected',nm);
        return;
      }
      if(now >= pending.fireAt){
        _clearPendingOut_(nm);
        markOutNow_(nm, true);
        logEvent('OUT_CONFIRMED','pending_sweep',nm);
        try{ evaluateStateNow(); }catch(_){}
      }
    });
  }catch(e){ logEvent('SWEEP_ERR',String(e),''); }
}

// ---------- Segnali presenza ----------
function markInNow_(nm, source){
  setPersonIn_(nm, source||'IN');
  logEvent('ARRIVO', nm, source||'');
}

function markOutNow_(nm, force){
  if(!force && !isNight()){
    logEvent('OUT_BLOCKED', nm, 'bloccato di giorno - usa force=true');
    return {ok:false, blocked:true};
  }
  setPersonOut_(nm, 'USCITA');
  setProp_(_ssidKey_(nm), '0');
  _clearPendingOut_(nm);
  return {ok:true};
}

function markAutoOut_(nm){
  setPersonOut_(nm, 'AUTO_OUT');
  setProp_(_ssidKey_(nm), '0');
  _clearPendingOut_(nm);
  logEvent('AUTO_OUT', 'timeout', nm);
}

function markOut_geofence_(nm){
  if(hasSsidLock_(nm)){
    _setPendingOut_(nm, 'geofence', getExitGuardMin_());
    logEvent('OUT_PENDING','geofence','guard='+getExitGuardMin_()+'m '+nm);
  } else {
    markOutNow_(nm, true);
    logEvent('OUT','geofence',nm);
    try{ evaluateStateNow(); }catch(_){}
  }
}

// ---------- Auto-OUT di notte ----------
function autoOutByLifeTimeout_(){
  try{
    if(!isNight()) return;
    var now = Date.now();
    var ppl = _getAllPeopleRaw_();
    ppl.forEach(function(p){
      if(!p.online) return;
      if(hasSsidLock_(p.name.toLowerCase())) return;
      if(!p.lifeMs) return;
      var ageMin = (now - p.lifeMs) / 60000;
      if(ageMin >= 480){
        markAutoOut_(p.name.toLowerCase());
      }
    });
  }catch(e){ logEvent('AUTO_OUT_ERR',String(e),''); }
}

// ---------- morningKeepAlive (opzionale, conservato per compatibilità) ----------
function morningKeepAlive_(){
  try{
    var ppl = _getAllPeopleRaw_();
    var any = false;
    ppl.forEach(function(p){
      var nm = p.name.toLowerCase();
      if(hasSsidLock_(nm)){
        var until = Date.now() + 480*60000;
        setProp_(_ssidKey_(nm), String(until));
        setPersonIn_(nm, 'MORNING_KA');
        logEvent('MORNING_KA', nm, 'ssid_lock rinnovato');
        any = true;
      }
    });
    if(any) try{ evaluateStateNow(); }catch(_){}
  }catch(e){ logEvent('MORNING_KA_ERR',String(e),''); }
}

// ---------- lifePingNow_ ----------
function lifePingNow_(nm){
  try{
    var name = String(nm||'').toLowerCase();
    var P = sh('Persone'), last = P.getLastRow();
    if(last < 2) return {ok:false,err:'no_rows'};
    var rows = P.getRange(2,1,last-1,1).getValues();
    for(var i=0; i<rows.length; i++){
      if(String(rows[i][0]||'').trim().toLowerCase() === name){
        var now = new Date();
        P.getRange(2+i,3).setValue(now);
        P.getRange(2+i,5).setValue(now);
        var online = String(P.getRange(2+i,6).getValue()||'').toUpperCase();
        if(online !== 'IN'){
          P.getRange(2+i,4).setValue('ARRIVO');
          P.getRange(2+i,6).setValue('IN');
          logEvent('ARRIVO', name, 'life_ping');
        }
        return {ok:true};
      }
    }
    return {ok:false,err:'not_found'};
  }catch(e){ return {ok:false,err:String(e)}; }
}

// ---------- Helpers foglio Persone ----------
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
    if(last<2)return[];
    var rows=P.getRange(2,1,last-1,7).getValues();
    return rows.filter(function(r){return String(r[0]||'').trim();}).map(function(r){
      var lifeVal=r[2]; var lifeMs=null;
      if(lifeVal instanceof Date)lifeMs=lifeVal.getTime();
      else if(lifeVal){var d=new Date(lifeVal);if(!isNaN(d))lifeMs=d.getTime();}
      return{
        name: String(r[0]||'').trim(),
        online: String(r[5]||'').toUpperCase()==='IN',
        lastEvent: String(r[3]||''),
        lifeMs: lifeMs,
        ka: Number(r[6])||0
      };
    });
  }catch(e){logEvent('PPL_ERR',String(e),'');return[];}
}

// ---------- Alias e compatibilità ----------
function forceIn_(nm){
  var name = String(nm||'').toLowerCase();
  var res = ssidOn_(name, 480);
  _clearPendingOut_(name);
  logEvent('FORCE_IN', name, 'ssid_lock+clear_pending');
  return {ok:true, name:name};
}
function forceOut_(nm){ var r=markOutNow_(nm, true); logEvent('FORCE_OUT', nm, ''); return r; }
function disableKAIfOut_(){ }
function _ensurePendingSweep_(){}
function everyoneOutNow_(){
  try{ return !_getAllPeopleRaw_().some(function(p){ return p.online; }); }
  catch(_){ return false; }
}
function everyoneOutWithGrace_(){ return everyoneOutNow_(); }

function purgeKATriggers_(){
  try{
    ScriptApp.getProjectTriggers().forEach(function(t){
      var fn = t.getHandlerFunction ? t.getHandlerFunction() : '';
      if(/^(ka|KA|keepalive|checkKA|kaTimer|kaOff|kaCheck)/i.test(fn) ||
         fn.indexOf('keepalive') >= 0 || fn.indexOf('Keepalive') >= 0){
        ScriptApp.deleteTrigger(t);
        logEvent('KA_PURGE', fn, 'vecchio trigger eliminato');
      }
    });
  }catch(e){ logEvent('KA_PURGE_ERR', String(e), ''); }
}

// Cooldown helpers (usati da 09_menu diagnostica)
function getCooldown_(nm){ return Number(getProp_('COOLDOWN_'+String(nm).toUpperCase(),'0'))||0; }
function setCooldown_(nm,until){ setProp_('COOLDOWN_'+String(nm).toUpperCase(),String(until)); }
function clearCooldown_(nm){ setProp_('COOLDOWN_'+String(nm).toUpperCase(),'0'); }

// getPeople_ alias usato da 09_menu
function getPeople_(){ return { people: _getAllPeopleRaw_() }; }

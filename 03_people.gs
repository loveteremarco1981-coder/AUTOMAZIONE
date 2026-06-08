// ============================================================
// 03_people.gs — PRESENZA SOLO DA 3 SHORTCUT iOS
// ssid_on  → IN (lock 8h)
// ssid_off → pending OUT (guard 20min)
// geofence → pending OUT (guard 20min)
// force_in / force_out → override manuale
// NON ESISTE auto-out per timeout — mai, né di giorno né di notte
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
  logEvent('SSID_OFF', nm, 'guard='+guard+'m pending');
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

function _setPendingOut_(nm, source, guardMin){
  var fireAt = Date.now() + (Number(guardMin)||20)*60000;
  setProp_(_pendingKey_(nm), JSON.stringify({fireAt:fireAt, source:String(source||'')}));
}

function _clearPendingOut_(nm){
  setProp_(_pendingKey_(nm), '');
}

// Sweep ogni 5 min — conferma OUT solo dopo guard
function pendingOutSweep_(){
  try{
    var ppl = _getAllPeopleRaw_();
    var now = Date.now();
    var changed = false;
    ppl.forEach(function(p){
      var nm = p.name.toLowerCase();
      var raw = getProp_(_pendingKey_(nm),'');
      if(!raw) return;
      var pending;
      try{ pending = JSON.parse(raw); }catch(_){ return; }
      if(!pending || !pending.fireAt) return;
      // Se nel frattempo è arrivato ssid_on → annulla
      if(hasSsidLock_(nm)){
        _clearPendingOut_(nm);
        logEvent('OUT_ABORT', nm, 'ssid_on ricevuto durante guard');
        return;
      }
      if(now >= pending.fireAt){
        _clearPendingOut_(nm);
        setPersonOut_(nm, 'USCITA');
        setProp_(_ssidKey_(nm), '0');
        logEvent('OUT_CONFIRMED', nm, 'dopo guard '+pending.source);
        changed = true;
      }
    });
    if(changed){ try{ evaluateStateNow(); }catch(_){} }
  }catch(e){ logEvent('SWEEP_ERR',String(e),''); }
}

// ---------- Segnali presenza ----------
function markInNow_(nm, source){
  _clearPendingOut_(nm);
  setPersonIn_(nm, source||'IN');
  logEvent('ARRIVO', nm, source||'');
}

function markOutNow_(nm, force){
  // Di giorno blocca sempre tranne force=true
  if(!force && !isNight()){
    logEvent('OUT_BLOCKED', nm, 'giorno senza force');
    return {ok:false, blocked:true};
  }
  setPersonOut_(nm, 'USCITA');
  setProp_(_ssidKey_(nm), '0');
  _clearPendingOut_(nm);
  return {ok:true};
}

function markOut_geofence_(nm){
  if(hasSsidLock_(nm)){
    _setPendingOut_(nm, 'geofence', getExitGuardMin_());
    logEvent('OUT_PENDING','geofence+ssid','guard='+getExitGuardMin_()+'m '+nm);
  } else {
    _setPendingOut_(nm, 'geofence', getExitGuardMin_());
    logEvent('OUT_PENDING','geofence','guard='+getExitGuardMin_()+'m '+nm);
  }
}

// ---------- AUTO-OUT DISABILITATO ----------
// Non esiste più auto-out per timeout — stub vuoto
function autoOutByLifeTimeout_(){ /* DISABILITATO */ }
function morningKeepAlive_(){ /* DISABILITATO */ }

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
    if(last<2) return [];
    var rows=P.getRange(2,1,last-1,7).getValues();
    return rows.filter(function(r){ return String(r[0]||'').trim(); }).map(function(r){
      var lifeVal=r[2], lifeMs=null;
      if(lifeVal instanceof Date) lifeMs=lifeVal.getTime();
      else if(lifeVal){ var d=new Date(lifeVal); if(!isNaN(d)) lifeMs=d.getTime(); }
      return {
        name:      String(r[0]||'').trim(),
        online:    String(r[5]||'').toUpperCase()==='IN',
        lastEvent: String(r[3]||''),
        lifeMs:    lifeMs,
        ka:        Number(r[6])||0
      };
    });
  }catch(e){ logEvent('PPL_ERR',String(e),''); return []; }
}

// ---------- Presenza: IN se colonna F = IN ----------
function everyoneOutNow_(){
  try{ return !_getAllPeopleRaw_().some(function(p){ return p.online; }); }
  catch(_){ return false; }
}
function everyoneOutWithGrace_(){ return everyoneOutNow_(); }

// ---------- Force in/out ----------
function forceIn_(nm){
  var name = String(nm||'').toLowerCase();
  ssidOn_(name, 480);
  logEvent('FORCE_IN', name, 'ssid_lock 8h');
  return {ok:true, name:name};
}
function forceOut_(nm){
  var name = String(nm||'').toLowerCase();
  setPersonOut_(name, 'FORCE_OUT');
  setProp_(_ssidKey_(name), '0');
  _clearPendingOut_(name);
  logEvent('FORCE_OUT', name, '');
  return {ok:true};
}

// ---------- Purge trigger KA legacy ----------
function purgeKATriggers_(){
  try{
    ScriptApp.getProjectTriggers().forEach(function(t){
      var fn = t.getHandlerFunction ? t.getHandlerFunction() : '';
      if(/ka|keepalive|morning_ka|kaoff|katrg/i.test(fn)){
        ScriptApp.deleteTrigger(t);
        logEvent('KA_PURGE', fn, 'rimosso');
      }
    });
  }catch(e){ logEvent('KA_PURGE_ERR',String(e),''); }
}

// ---------- lifePingNow_ (stub — non usato ma richiamato da endpoint legacy) ----------
function lifePingNow_(nm){ return {ok:false, err:'life_ping_disabled'}; }

// ---------- Alias ----------
function disableKAIfOut_(){ }
function _ensurePendingSweep_(){}
function getPeople_(){ return {people: _getAllPeopleRaw_()}; }
function getCooldown_(nm){ return Number(getProp_('COOLDOWN_'+String(nm).toUpperCase(),'0'))||0; }
function setCooldown_(nm,until){ setProp_('COOLDOWN_'+String(nm).toUpperCase(),String(until)); }
function clearCooldown_(nm){ setProp_('COOLDOWN_'+String(nm).toUpperCase(),'0'); }

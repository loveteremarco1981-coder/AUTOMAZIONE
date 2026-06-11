// 03_people.gs — PRESENZA: SOLO 4 SHORTCUT iOS
//
// 1. ssid_on  → IN immediato (hold=480min)
// 2. ssid_off → solo log, NESSUN pending, NESSUN auto-out
// 3. mark_out → OUT immediato (geofence conferma uscita)
// 4. mark_in  → IN immediato (geofence rientro)
//
// NESSUN timeout, NESSUN auto-out, NESSUN EXIT_GUARD, NESSUN KA

function _ssidKey_(nm)    { return 'SSID_LOCK_'+String(nm||'').toUpperCase(); }
function _pendingKey_(nm) { return 'PENDING_OUT_'+String(nm||'').toUpperCase(); }

function hasSsidLock_(nm){
  var until = Number(getProp_(_ssidKey_(nm),'0'))||0;
  return until > 0 && Date.now() <= until;
}

// ── 1. WIFI ON ──────────────────────────────────────────────
function ssidOn_(nm, holdMin){
  var n    = String(nm||'').toLowerCase();
  var hold = Number(holdMin)||480;
  setProp_(_ssidKey_(n), String(Date.now()+hold*60000));
  setProp_(_pendingKey_(n), '');
  setPersonIn_(n, 'SSID_ON');
  logEvent('SSID_ON', n, 'hold='+hold+'m');
  return {ok:true, hold:hold};
}

// ── 2. WIFI OFF → solo log, nessun pending ──────────────────
function ssidOff_(nm){
  var n = String(nm||'').toLowerCase();
  setProp_(_ssidKey_(n), '0');
  // NON tocca lo stato IN/OUT — serve il geofence mark_out per uscire
  logEvent('SSID_OFF', n, 'solo log — attesa mark_out geofence');
  return {ok:true};
}

// ── 3. GEO OUT → OUT immediato ──────────────────────────────
function markOut_geofence_(nm){
  var n = String(nm||'').toLowerCase();
  setProp_(_ssidKey_(n), '0');
  setProp_(_pendingKey_(n), '');
  setPersonOut_(n, 'USCITA');
  logEvent('GEO_OUT', n, 'geofence');
  evaluateStateNow();
}

// ── 4. GEO IN → IN immediato ────────────────────────────────
function markIn_geofence_(nm){
  var n = String(nm||'').toLowerCase();
  setProp_(_pendingKey_(n), '');
  setPersonIn_(n, 'GEO_IN');
  logEvent('GEO_IN', n, '');
  evaluateStateNow();
}

// ── SWEEP ogni 5min ─────────────────────────────────────────
// Non fa più OUT. Pulisce solo pending residui da versioni vecchie.
function pendingOutSweep_(){
  try{
    _getAllPeopleRaw_().forEach(function(p){
      var nm  = p.name.toLowerCase();
      var raw = getProp_(_pendingKey_(nm),'');
      if(raw){
        setProp_(_pendingKey_(nm),'');
        logEvent('SWEEP_CLEAN', nm, 'pending legacy rimosso');
      }
    });
  }catch(e){ logEvent('SWEEP_ERR',String(e),''); }
}

// ── Force in/out manuali ─────────────────────────────────────
function forceIn_(nm){
  var n = String(nm||'').toLowerCase();
  setProp_(_ssidKey_(n), String(Date.now()+480*60000));
  setProp_(_pendingKey_(n),'');
  setPersonIn_(n,'FORCE_IN');
  logEvent('FORCE_IN',n,'');
  return {ok:true, name:n};
}
function forceOut_(nm){
  var n = String(nm||'').toLowerCase();
  setProp_(_ssidKey_(n),'0');
  setProp_(_pendingKey_(n),'');
  setPersonOut_(n,'FORCE_OUT');
  logEvent('FORCE_OUT',n,'');
  return {ok:true};
}
function markOutNow_(nm, force){
  return forceOut_(nm);
}

// ── Helpers foglio Persone ───────────────────────────────────
function setPersonIn_(nm, evt){
  try{
    var P=sh('Persone'), last=P.getLastRow(); if(last<2) return;
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
    var P=sh('Persone'), last=P.getLastRow(); if(last<2) return;
    var rows=P.getRange(2,1,last-1,1).getValues();
    for(var i=0;i<rows.length;i++){
      if(String(rows[i][0]||'').trim().toLowerCase()===String(nm).toLowerCase()){
        P.getRange(2+i,4).setValue(String(evt||'USCITA'));
        P.getRange(2+i,5).setValue(new Date());
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
      var lm=null;
      if(r[2] instanceof Date) lm=r[2].getTime();
      else if(r[2]){ var d=new Date(r[2]); if(!isNaN(d)) lm=d.getTime(); }
      return {
        name:      String(r[0]||'').trim(),
        online:    String(r[5]||'').toUpperCase()==='IN',
        lastEvent: String(r[3]||''),
        lifeMs:    lm
      };
    });
  }catch(e){ logEvent('PPL_ERR',String(e),''); return []; }
}

function everyoneOutNow_(){
  try{ return !_getAllPeopleRaw_().some(function(p){ return p.online; }); }
  catch(_){ return false; }
}
function everyoneOutWithGrace_(){ return everyoneOutNow_(); }

function purgeKATriggers_(){
  try{
    ScriptApp.getProjectTriggers().forEach(function(t){
      var fn = t.getHandlerFunction ? t.getHandlerFunction() : '';
      if(/^(ka|keepalive|morning_ka|kaoff|katrg|morningKeepAlive|confirmOut_)/i.test(fn)){
        ScriptApp.deleteTrigger(t);
        logEvent('LEGACY_PURGE', fn, 'rimosso');
      }
    });
  }catch(e){ logEvent('PURGE_ERR',String(e),''); }
}

// STUB compatibilità
function autoOutByLifeTimeout_(){}
function morningKeepAlive_(){}
function lifePingNow_(nm){ return {ok:false, err:'disabled'}; }
function disableKAIfOut_(){}
function applyPresenceDebounce_(raw){ return {reported:!!raw}; }
function getPeople_(){ return {people:_getAllPeopleRaw_()}; }
function getCooldown_(nm){ return 0; }
function setCooldown_(nm,u){}
function clearCooldown_(nm){}

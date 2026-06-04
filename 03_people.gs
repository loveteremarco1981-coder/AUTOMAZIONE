// ============================================================
// 03_people.gs — PRESENZA SEMPLIFICATA E BLINDATA
//
// REGOLE:
//   IN  = ssid_on ricevuto (lock attivo per 8h)
//         o morningKeepAlive alle 6:30
//   OUT = ssid_off confermato (nessun ricollegamento in EXIT_GUARD min)
//         o geofence uscita confermata
//         o force_out manuale
//   MAI auto-out durante il giorno per timeout
//   Di notte: auto-out solo dopo 8h di silenzio completo
// ============================================================

// ---------- SSID lock ----------
function _ssidKey_(nm){ return 'SSID_LOCK_'+String(nm||'').toUpperCase(); }
function _ssidUntil_(nm){ return Number(getProp_(_ssidKey_(nm),'0'))||0; }

function ssidOn_(nm, holdMin){
  var hold = Number(holdMin)||480; // default 8h
  var until = Date.now() + hold*60000;
  setProp_(_ssidKey_(nm), String(until));
  setPersonIn_(nm, 'SSID_ON');
  logEvent('SSID_ON', nm, 'hold='+hold+'m');
  return true;
}

function ssidOff_(nm){
  var guard = getExitGuardMin_();
  _setPendingOut_(nm, 'ssid_off', guard);
  logEvent('SSID_OFF', nm, 'guard='+guard+'m');
}

function hasSsidLock_(nm){
  var until = _ssidUntil_(nm);
  if(!until) return false;
  if(Date.now() <= until) return true;
  // Scaduto — pulisci
  setProp_(_ssidKey_(nm), '0');
  return false;
}

// ---------- Pending OUT ----------
function _pendingKey_(nm){ return 'PENDING_OUT_'+String(nm||'').toUpperCase(); }

function _setPendingOut_(nm, source, guardMin){
  var fireAt = Date.now() + (Number(guardMin)||20)*60000;
  setProp_(_pendingKey_(nm), JSON.stringify({
    fireAt: fireAt,
    source: String(source||'')
  }));
}

function _clearPendingOut_(nm){
  setProp_(_pendingKey_(nm), '');
}

// Sweep ogni 5 min — conferma OUT se il pending è scaduto
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

      // Se si è riconnesso nel frattempo → annulla
      if(hasSsidLock_(nm)){
        _clearPendingOut_(nm);
        logEvent('OUT_PENDING_ABORT','ssid_reconnected',nm);
        return;
      }
      // Scaduto → conferma OUT
      if(now >= pending.fireAt){
        _clearPendingOut_(nm);
        markOutNow_(nm);
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

function markOutNow_(nm){
  setPersonOut_(nm, 'USCITA');
  setProp_(_ssidKey_(nm), '0'); // cancella SSID lock
  _clearPendingOut_(nm);
}

function markAutoOut_(nm){
  setPersonOut_(nm, 'AUTO_OUT');
  setProp_(_ssidKey_(nm), '0');
  _clearPendingOut_(nm);
  logEvent('AUTO_OUT', 'timeout', nm);
}

// Geofence uscita
function markOut_geofence_(nm){
  if(hasSsidLock_(nm)){
    // SSID ancora attivo → non uscire subito, metti pending breve
    _setPendingOut_(nm, 'geofence', getExitGuardMin_());
    logEvent('OUT_PENDING','geofence','guard='+getExitGuardMin_()+'m '+nm);
  } else {
    // Nessun lock → OUT immediato
    markOutNow_(nm);
    logEvent('OUT','geofence',nm);
    try{ evaluateStateNow(); }catch(_){}
  }
}

// ---------- Auto-OUT (solo casi estremi) ----------
function autoOutByLifeTimeout_(){
  try{
    var now = Date.now();
    var night = isNight();

    // DI GIORNO: mai auto-out (SSID e geofence pensano a tutto)
    // DI NOTTE: auto-out solo dopo 8h di silenzio assoluto
    if(!night) return;

    var ppl = _getAllPeopleRaw_();
    ppl.forEach(function(p){
      if(!p.online) return;
      if(hasSsidLock_(p.name.toLowerCase())) return;
      if(!p.lifeMs) return;
      var ageMin = (now - p.lifeMs) / 60000;
      if(ageMin >= 480){ // 8h di notte = dormiva fuori casa
        markAutoOut_(p.name.toLowerCase());
      }
    });
  }catch(e){ logEvent('AUTO_OUT_ERR',String(e),''); }
}

// ---------- Morning KeepAlive (6:30) ----------
// Mantiene IN chi era IN ieri (ha SSID lock o era online)
function morningKeepAlive_(){
  try{
    var ppl = _getAllPeopleRaw_();
    var any = false;
    ppl.forEach(function(p){
      var nm = p.name.toLowerCase();
      if(hasSsidLock_(nm)){
        // Rinnova il lock per 8h
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

// ---------- lifePingNow_ — aggiorna last_life senza cambiare stato OUT/IN ----------
function lifePingNow_(nm){
  try{
    var name = String(nm||'').toLowerCase();
    var P = sh('Persone'), last = P.getLastRow();
    if(last < 2) return {ok:false,err:'no_rows'};
    var rows = P.getRange(2,1,last-1,1).getValues();
    for(var i=0; i<rows.length; i++){
      if(String(rows[i][0]||'').trim().toLowerCase() === name){
        var now = new Date();
        P.getRange(2+i,3).setValue(now); // last_life_raw
        P.getRange(2+i,5).setValue(now); // last_life_dt
        // Se era OUT → lo rimette IN (ping = sei qui)
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

// ---------- Keepalive KA trigger ----------
function disableKAIfOut_(){ /* gestito da morningKeepAlive_ */ }

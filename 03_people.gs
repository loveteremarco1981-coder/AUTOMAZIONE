// ============================================================
// 03_people.gs — gestione persone: IN/OUT/cooldown/SSID
// Colonne Persone: A=Nome B=note C=last_life_raw D=last_event E=last_life_dt F=ONLINE G=KA
// ============================================================

// ---------- Cooldown ----------
function _cdKey_(nm){ return 'IGNORE_LIFE_UNTIL_'+String(nm||'').toLowerCase(); }

function setCooldown_(name, untilMs){
  var k=_cdKey_(name);
  try{ PropertiesService.getScriptProperties().setProperty(k,String(untilMs)); }catch(_){}
}
function getCooldown_(name){
  var k=_cdKey_(name);
  try{ var vv=PropertiesService.getScriptProperties().getProperty(k); return Number(vv)||0; }catch(_){ return 0; }
}
function clearCooldown_(name){
  try{ PropertiesService.getScriptProperties().deleteProperty(_cdKey_(name)); }catch(_){}
}

// ---------- SSID lock ----------
function _ssidKey_(nm){ return 'SSID_LOCK_'+String(nm||'').toLowerCase(); }
function _ssidUntilKey_(nm){ return 'SSID_LOCK_UNTIL_'+String(nm||'').toLowerCase(); }

function hasSsidLock_(name){
  var nm=String(name||'').toLowerCase();
  try{
    var flag=getProp_(_ssidKey_(nm),'0')==='1';
    var until=Number(getProp_(_ssidUntilKey_(nm),'0'))||0;
    if(!flag)return false;
    if(until&&Date.now()>until){ setProp_(_ssidKey_(nm),'0'); return false; }
    return true;
  }catch(_){ return false; }
}

function ssidOn_(name, holdMin){
  var nm=String(name||'').toLowerCase();
  var hold=_numSafe_(holdMin,480); // default 8h — evita falsi IN da ssid_off tardivo
  setProp_(_ssidKey_(nm),'1');
  setProp_(_ssidUntilKey_(nm),String(Date.now()+hold*60000));
  clearCooldown_(nm);          // SSID connesso → azzera cooldown
  _setPersonIn_(nm,'SSID_ON');
  logEvent('SSID_ON',nm,'hold='+hold+'m');
  return {ok:true,hold:hold};
}

function ssidOff_(name){
  var nm=String(name||'').toLowerCase();
  setProp_(_ssidKey_(nm),'0');
  setProp_(_ssidUntilKey_(nm),'0');
  // Imposta pending OUT con exit guard
  var guard=getExitGuardMin_();
  setProp_('PENDING_OUT_'+nm, String(Date.now()+guard*60000));
  _ensurePendingSweep_();
  logEvent('SSID_OFF',nm,'guard='+guard+'m');
  return {ok:true,guard:guard};
}

// ---------- Pending OUT sweep ----------
function _pendingOutKey_(nm){ return 'PENDING_OUT_'+String(nm||'').toLowerCase(); }

function _ensurePendingSweep_(){
  var exists=false;
  ScriptApp.getProjectTriggers().forEach(function(t){
    if(t.getHandlerFunction&&t.getHandlerFunction()==='pendingOutSweep_') exists=true;
  });
  if(!exists){
    ScriptApp.newTrigger('pendingOutSweep_').timeBased().everyMinutes(5).create();
    logEvent('PENDING_SWEEP_ON','every 5m','');
  }
}

function pendingOutSweep_(){
  try{
    var ppl=_getAllPeopleRaw_(), now=Date.now();
    ppl.forEach(function(p){
      var nm=String(p.name||'').toLowerCase();
      var until=Number(getProp_(_pendingOutKey_(nm),'0'))||0;
      if(!until||now<until)return;

      // Se SSID è tornato connesso → annulla
      if(hasSsidLock_(nm)){
        setProp_(_pendingOutKey_(nm),'0');
        logEvent('OUT_PENDING_ABORT','ssid_reconnected',nm);
        return;
      }

      // Se c'è stato un life_ping recente (< EXIT_CONFIRM_MIN) → annulla
      var confirmMin=getExitConfirmMin_();
      var lifeMs=p.lifeMs||0;
      if(lifeMs&&(now-lifeMs)<=confirmMin*60000){
        setProp_(_pendingOutKey_(nm),'0');
        logEvent('OUT_PENDING_ABORT','life_recent',nm);
        return;
      }

      // OK → segna OUT
      markOutNow_(nm);
      setProp_(_pendingOutKey_(nm),'0');
      logEvent('OUT_CONFIRMED','pending_sweep',nm);
      try{ evaluateStateNow(); }catch(_){}
    });
  }catch(e){ logEvent('PENDING_SWEEP_ERR',String(e),''); }
}

// ---------- Lettura raw persone ----------
function _getAllPeopleRaw_(){
  var out=[];
  try{
    var P=sh('Persone'), last=P.getLastRow(); if(last<2)return out;
    var rows=P.getRange(2,1,last-1,7).getValues();
    rows.forEach(function(r,i){
      var nome=String(r[0]||'').trim(); if(!nome)return;
      var e=r[4], c=r[2];
      var eMs=(e instanceof Date)?e.getTime():null;
      var cMs=(c instanceof Date)?c.getTime():null;
      var lifeMs=(eMs||cMs)?Math.max(eMs||0,cMs||0):null;
      out.push({
        name:nome, row:2+i,
        online:String(r[5]||'').toUpperCase()==='IN',
        lastEvent:String(r[3]||'-'),
        lifeMs:lifeMs,
        lifeDate:lifeMs?new Date(lifeMs):null
      });
    });
  }catch(e){ logEvent('PPL_RAW_ERR',String(e),''); }
  return out;
}

// ---------- Scrivi IN su riga ----------
function _setPersonIn_(name, event){
  try{
    var nm=String(name||'').toLowerCase();
    var P=sh('Persone'), last=P.getLastRow(); if(last<2)return false;
    var rows=P.getRange(2,1,last-1,1).getValues();
    for(var i=0;i<rows.length;i++){
      if(String(rows[i][0]||'').trim().toLowerCase()===nm){
        var r=2+i, now=new Date();
        P.getRange(r,3).setValue(now);  // C last_life_raw
        P.getRange(r,4).setValue(event||'ARRIVO'); // D last_event
        P.getRange(r,5).setValue(now);  // E last_life_dt
        P.getRange(r,6).setValue('IN'); // F ONLINE
        return true;
      }
    }
  }catch(e){ logEvent('SET_IN_ERR',String(e),name); }
  return false;
}

// ---------- markOutNow_ ----------
function markOutNow_(name){
  try{
    var nm=String(name||'').toLowerCase();
    var P=sh('Persone'), last=P.getLastRow(); if(last<2)return {ok:false,err:'no_people'};
    var rows=P.getRange(2,1,last-1,1).getValues();
    for(var i=0;i<rows.length;i++){
      if(String(rows[i][0]||'').trim().toLowerCase()===nm){
        var r=2+i, now=new Date();
        P.getRange(r,3).setValue(now);
        P.getRange(r,4).setValue('USCITA');
        P.getRange(r,5).setValue(now);
        P.getRange(r,6).setValue('OUT');
        break;
      }
    }
    // cooldown configurabile (non più hardcoded a 10)
    var cd=getExitCooldownMin_();
    setCooldown_(nm, Date.now()+cd*60000);
    logEvent('OUT',nm,'cooldown='+cd+'m');
    try{ deleteLifeKeepaliveTrigger_(nm); }catch(_){}
    return {ok:true};
  }catch(e){ logEvent('OUT_ERR',String(e),name); return {ok:false,err:String(e)}; }
}

// ---------- lifePingNow_ ----------
// Segnale "sono vivo in casa" — aggiorna timestamp senza forzare ARRIVO
function lifePingNow_(name){
  try{
    var nm=String(name||'').toLowerCase();
    // Controlla cooldown
    var until=getCooldown_(nm);
    if(until&&Date.now()<until){
      logEvent('LIFE_IGNORED',nm,'cooldown fino '+new Date(until).toISOString());
      return {ok:true,ignored:true};
    }
    var ok=_setPersonIn_(nm,'ARRIVO');
    if(!ok)return {ok:false,err:'unknown_person'};
    logEvent('ARRIVO',nm,'life_ping');
    return {ok:true,in:true};
  }catch(e){ logEvent('LIFE_ERR',String(e),name); return {ok:false,err:String(e)}; }
}

// ---------- forceIn_ ----------
function forceIn_(name){
  var nm=String(name||'').toLowerCase(); if(!nm)return{ok:false,err:'missing'};
  clearCooldown_(nm);
  var ok=_setPersonIn_(nm,'FORCE_IN');
  if(ok){ logEvent('FORCE_IN',nm,''); return {ok:true}; }
  return {ok:false,err:'notfound'};
}

// ---------- everyoneOut con grace ----------
// NON considera "tutti fuori" se qualcuno ha un ping recente < 2×STRICT_LIFE
function everyoneOutNow_(){
  try{
    var ppl=_getAllPeopleRaw_();
    return ppl.every(function(p){ return !p.online; });
  }catch(_){ return false; }
}

function everyoneOutWithGrace_(){
  if(!everyoneOutNow_())return false;
  // Grace: se qualcuno ha ping recente < 2×STRICT_LIFE, non considerare casa vuota
  var graceMs=getStrictLifeMin_()*2*60000;
  var now=Date.now();
  try{
    var ppl=_getAllPeopleRaw_();
    for(var i=0;i<ppl.length;i++){
      if(ppl[i].lifeMs&&(now-ppl[i].lifeMs)<=graceMs)return false;
    }
  }catch(_){}
  return true;
}

// ---------- getPeople_ (API pubblica) ----------
function getPeople_(){
  var out={people:[]};
  try{
    var tz=Session.getScriptTimeZone();
    var ppl=_getAllPeopleRaw_();
    var now=Date.now(), isDay=!isNight(), STRICT=getStrictLifeMin_();
    ppl.forEach(function(p){
      var lifeRecent=!!(p.lifeMs&&((now-p.lifeMs)<=STRICT*60000));
      var onlineComputed=(isDay&&!lifeRecent)?false:p.online;
      var tsText=p.lifeDate?Utilities.formatDate(p.lifeDate,tz,'dd/MM/yyyy HH:mm'):null;
      out.people.push({
        name:p.name, online:onlineComputed,
        lastEvent:p.lastEvent, ts:p.lifeDate, tsText:tsText
      });
    });
  }catch(e){ logEvent('PEOPLE_API_ERR',String(e),''); }
  return out;
}

// ---------- autoOutByLifeTimeout_ ----------
// FILOSOFIA ROBUSTA:
// - Di giorno: auto-out SOLO dopo 8h di silenzio (telefono scarico = resta IN)
// - Di notte: auto-out dopo LIFE_TIMEOUT + buffer (comportamento originale)
// - Mai auto-out se SSID lock attivo
// - Mai auto-out se l'ultima uscita era già AUTO_OUT (evita loop)
function autoOutByLifeTimeout_(){
  try{
    var now = Date.now();
    var night = isNight();

    // Soglia diversa: notte = timeout normale, giorno = 8h
    var toMin = night
      ? (getLifeTimeoutMin_() + getIftttBufferMin_())  // es. 48 min di notte
      : 480; // 8 ore di giorno — copre telefono scarico/spento

    // Morning hold: non fare auto-out subito dopo l'alba
    var holdMin = getMorningHoldMin_(), alba = v('Stato','B3');
    if(!night && alba instanceof Date && _minutesAgo_(alba) <= holdMin){
      logEvent('AUTO_OUT_SKIP','morning_hold','');
      return;
    }

    var ppl = _getAllPeopleRaw_(), anyOut = false;
    ppl.forEach(function(p){
      if(!p.online) return;
      if(!p.lifeMs) return;
      if(hasSsidLock_(p.name.toLowerCase())) return; // SSID connesso → mai auto-out

      var ageMin = (now - p.lifeMs) / 60000;
      if(ageMin >= toMin){
        markOutNow_(p.name);
        anyOut = true;
        logEvent('AUTO_OUT', 'timeout ' + (night?'notte':'giorno'),
          p.name + ': ' + Math.round(ageMin) + 'm >= ' + toMin + 'm');
      }
    });
    if(anyOut){ try{ evaluateStateNow(); }catch(_){} }
  }catch(e){ logEvent('AUTO_OUT_ERR', String(e), ''); }
}

// ---------- KA (keepalive trigger) ----------
function deleteLifeKeepaliveTrigger_(name){
  var tag='lifeKeepalive_'+String(name||'').toLowerCase();
  ScriptApp.getProjectTriggers().forEach(function(t){
    try{ if(t.getHandlerFunction&&t.getHandlerFunction()===tag)ScriptApp.deleteTrigger(t); }catch(_){}
  });
}
function disableKAIfOut_(){
  try{
    _getAllPeopleRaw_().forEach(function(p){
      if(!p.online){ try{ deleteLifeKeepaliveTrigger_(p.name); }catch(_){} }
    });
  }catch(_){}
}

// ========== Morning KeepAlive ==========
// Ogni mattina alle 6:30: chi ha SSID lock attivo viene mantenuto IN
// Evita che chi era già connesso al Wi-Fi da ieri sera risulti OUT
function morningKeepAlive_(){
  try{
    var ppl = _getAllPeopleRaw_();
    var now = Date.now();
    var any = false;

    ppl.forEach(function(p){
      var nm = p.name.toLowerCase();
      if(hasSsidLock_(nm)){
        // SSID lock attivo → aggiorna il ping e mantieni IN
        _setPersonIn_(nm, 'MORNING_KA');
        logEvent('MORNING_KA', nm, 'ssid_lock attivo');
        any = true;
      }
    });

    if(any) try{ evaluateStateNow(); }catch(_){}
  }catch(e){ logEvent('MORNING_KA_ERR', String(e), ''); }
}

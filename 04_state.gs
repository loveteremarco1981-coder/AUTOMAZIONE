// ============================================================
// 04_state.gs — macchina a stati + azioni IFTTT
// ============================================================

function setState_(val){ s('Config','B1',val); }

// ---------- Azioni camere ----------
function camsOnBoth_(why){ _iftttSafe_('ezviz_interne_on'); _iftttSafe_('ezviz_esterne_on'); logEvent('CAMS_ON_BOTH',why||'',''); }
function camsAllOff_(why){ _iftttSafe_('ezviz_interne_off'); _iftttSafe_('ezviz_esterne_off'); logEvent('CAMS_OFF_BOTH',why||'',''); }
function camsExtOn_(why){  _iftttSafe_('ezviz_esterne_on'); logEvent('CAMS_EXT_ON',why||'',''); }

function applySecurityNight(){ camsOnBoth_('SECURITY_NIGHT'); }
function applySecurityDay(){   camsOnBoth_('SECURITY_DAY'); }
function applyComfyDay(){      camsAllOff_('COMFY_DAY'); }
function applyComfyNight(){    camsAllOff_('COMFY_NIGHT'); camsExtOn_('COMFY_NIGHT'); }

// ---------- Tapparelle ----------
function actRaiseAll_(reason){
  try{
    var st=getStatoCorrente_();
    if(st.indexOf('SECURITY_')===0){ logEvent('RAISE_BLOCK','SECURITY',reason||''); return; }
    _iftttSafe_('alza_tutto'); logEvent('RAISE_ALL','ok',reason||'');
  }catch(e){ logEvent('RAISE_ERR',String(e),reason||''); }
}
function actLowerAll_(reason){
  try{ _iftttSafe_('abbassa_tutto'); logEvent('LOWER_ALL','ok',reason||''); }
  catch(e){ logEvent('LOWER_ERR',String(e),reason||''); }
}
function raiseAllNow_(origin){
  if(isVacanza_()){ logEvent('ALZA_SKIP','vacanza',''); return false; }
  if(isOverride_()){ logEvent('ALZA_SKIP','override',''); return false; }
  actRaiseAll_(origin||'manual'); return true;
}
function lowerAllNow_(origin){
  if(isOverride_()){ logEvent('ABBASSA_SKIP','override',''); return false; }
  actLowerAll_(origin||'manual'); return true;
}

// ---------- Tramonto / 23:00 ----------
function closeShuttersAtSunset_(){
  logEvent('CLOSE_AT_SUNSET','abbassa_tutto','tramonto');
  _iftttSafe_('abbassa_tutto');
}
function closeShuttersAt23IfPeopleHome_(){
  try{
    if(new Date().getHours()!==23)return;
    if(!everyoneOutNow_()&&!isOverride_()&&!isVacanza_()){
      logEvent('CLOSE_AT_23','abbassa_tutto','house_occupied');
      _iftttSafe_('abbassa_tutto');
    }
  }catch(e){ logEvent('ERR_CLOSE_AT_23',String(e),''); }
}

// ---------- Presenza effettiva (da colonna F) ----------
function updatePresenceEffective_(){
  try{
    var ppl=_getAllPeopleRaw_();
    var eff=ppl.some(function(p){ return p.online; });
    s('Config','B6',eff); return eff;
  }catch(e){ logEvent('ERR_PRES_EFF',String(e),''); return false; }
}

// ---------- Debounce ----------
function applyPresenceDebounce_(raw){
  try{
    var now=Date.now();
    var prevStr=getProp_('presenceReported',null);
    var prev=(prevStr==='true'), hasPrev=(prevStr!==null);
    var lastChange=Number(getProp_('presenceLastChangeMs',String(now)));
    if(!isFinite(lastChange)||lastChange>now)lastChange=now;

    if(!hasPrev&&raw){
      setProp_('presenceReported','true'); setProp_('presenceLastChangeMs',String(now));
      s('Config','B6',true); return {reported:true};
    }
    if(hasPrev&&raw===prev){
      s('Config','B6',prev); return {reported:prev};
    }
    var mins=raw?getDebounceInMin_():getDebounceOutMin_();
    if((now-lastChange)>=mins*60000){
      setProp_('presenceReported',String(raw)); setProp_('presenceLastChangeMs',String(now));
      s('Config','B6',raw); return {reported:raw};
    }
    s('Config','B6',prev); return {reported:prev};
  }catch(e){
    logEvent('DEBOUNCE_ERR',String(e),'');
    s('Config','B6',!!raw); return {reported:!!raw};
  }
}

// ---------- evaluateStateNow — CORE ----------
function evaluateStateNow(){
  try{
    // Override attivo → blocca tutto, logga solo al primo ciclo
    if(isOverride_()){
      if(String(v('Stato','C1'))!=='OVR'){ logEvent('OVERRIDE','ON',''); s('Stato','C1','OVR'); }
      s('Stato','B5',new Date());
      s('Stato','B6',isNight()?'NOTTE':'GIORNO');
      return;
    } else {
      if(String(v('Stato','C1'))==='OVR')s('Stato','C1','');
    }

    // Auto-out per timeout (con buffer IFTTT)
    try{ autoOutByLifeTimeout_(); }catch(_){}

    var stato=getStatoCorrente_();
    var vac=isVacanza_();
    var notte=isNight();
    var giorno=!notte;

    // Presenza raw: almeno una persona con F=IN e ping recente
    var ppl=_getAllPeopleRaw_();
    var now=Date.now(), STRICT=getStrictLifeMin_();
    var raw=false;
    ppl.forEach(function(p){
      if(!p.online)return;
      if(hasSsidLock_(p.name.toLowerCase())){ raw=true; return; } // SSID connesso = IN certo
      var lifeRecent=!!(p.lifeMs&&((now-p.lifeMs)<=STRICT*60000));
      if(giorno?lifeRecent:p.online) raw=true;
    });
    s('Config','B5',raw);

    var deb=applyPresenceDebounce_(raw);
    var eff=deb.reported;

    // Morning hold
    var prevEff=!!(v('Config','B8'));
    var alba=v('Stato','B3');
    if(giorno&&(alba instanceof Date)){
      if(_minutesAgo_(alba)<=getMorningHoldMin_()&&prevEff&&raw) eff=true;
    }

    // Grace: everyoneOut con ping recente → non svuotare
    if(everyoneOutWithGrace_()){ eff=false; prevEff=false; }

    // Presenza effettiva da colonna F (ground truth)
    var effReal=updatePresenceEffective_();
    if(!effReal) eff=false;

    // Calcola stato desiderato
    var desired=stato, scheduleGrace=false;
    if(vac){
      desired=notte?'SECURITY_NIGHT':'SECURITY_DAY';
    } else if(notte){
      desired=eff?'COMFY_NIGHT':'SECURITY_NIGHT';
    } else {
      if(eff) desired='COMFY_DAY';
      else {
        if(prevEff){ desired=stato; scheduleGrace=true; }
        else { s('Stato','B11','—'); desired='SECURITY_DAY'; }
      }
    }

    // Patch arrivo: alza tapparelle al rientro (rispetta ALZA_CON)
    var fromSec=(stato==='SECURITY_DAY'||stato==='SECURITY_NIGHT');
    var toComfy=(desired==='COMFY_DAY'||desired==='COMFY_NIGHT');
    if(fromSec&&toComfy&&!prevEff){
      var alzaCon=getAlzaCon_();
      if(alzaCon==='MAI'||alzaCon==='PIANTE'){
        logEvent('OPEN_BLOCK','ALZA_CON='+alzaCon,'');
      } else { // ARRIVO (default)
        if(!notte&&!isQuietHours_(new Date())){
          try{ actRaiseAll_('Arrivo'); }catch(_){}
          logEvent('ARRIVO','alza','');
        } else {
          logEvent('OPEN_BLOCK','notte/quiet','');
        }
      }
    }

    // Applica cambio stato
    if(desired!==stato){
      setState_(desired);
      logEvent('STATE_CHANGE','->'+desired,'');
      try{
        if(desired==='SECURITY_NIGHT') applySecurityNight();
        if(desired==='SECURITY_DAY')   applySecurityDay();
        if(desired==='COMFY_DAY')      applyComfyDay();
        if(desired==='COMFY_NIGHT')    applyComfyNight();
      }catch(_){}
    }

    // Chiudi tapparelle al tramonto solo se casa vuota/override/vacanza
    if(desired==='SECURITY_NIGHT'&&stato!=='SECURITY_NIGHT'){
      if(everyoneOutNow_()||isOverride_()||isVacanza_()) closeShuttersAtSunset_();
    }

    // Grace timer
    if(scheduleGrace){
      var EG=getEmptyGraceMin_();
      s('Stato','B11',new Date(Date.now()+EG*60000));
      try{ ScriptApp.newTrigger('verifyHouseEmptyThenClose').timeBased().after(EG*60000).create(); }
      catch(e){ logEvent('GRACE_ERR',String(e),''); }
    }

    // Impianti OFF quando casa si svuota
    if(!vac&&!eff&&prevEff){
      try{ _iftttSafe_('clima_off'); }catch(_){}
      try{ _iftttSafe_('termostati_auto'); }catch(_){}
      logEvent('VUOTA','impianti OFF','');
    }

    s('Config','B6',eff);
    s('Config','B8',eff);
    s('Stato','B5',new Date());
    s('Stato','B6',notte?'NOTTE':'GIORNO');

  }catch(e){ logEvent('ERROR_EVAL',String(e),''); }
  try{ disableKAIfOut_(); }catch(_){}
}

function verifyHouseEmptyThenClose(){
  try{
    var ppl=_getAllPeopleRaw_();
    var anyIn=ppl.some(function(p){ return p.online; });
    if(!anyIn){
      setState_('SECURITY_DAY');
      logEvent('GRACE_CLOSE','Casa vuota','');
      applySecurityDay();
    } else {
      logEvent('GRACE_ABORT','Casa NON vuota','');
    }
  }catch(e){ logEvent('GRACE_ERR',String(e),''); }
}

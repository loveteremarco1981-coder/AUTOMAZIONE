// ============================================================
// 04_state.gs — macchina a stati
// Presenza = solo colonna F del foglio Persone
// IN = F=IN, OUT = F=OUT — nessun debounce, nessun timeout
// ============================================================

function setState_(val){ s('Config','B1',val); }

// ---------- Camere ----------
function camsOnBoth_(why){
  _iftttSafe_('ezviz_interne_on');
  _iftttSafe_('ezviz_esterne_on');
  logEvent('CAMS_ON_BOTH',why||'','');
}
function camsAllOff_(why){
  _iftttSafe_('ezviz_interne_off');
  _iftttSafe_('ezviz_esterne_off');
  logEvent('CAMS_OFF_BOTH',why||'','');
}
function camsExtOn_(why){
  _iftttSafe_('ezviz_esterne_on');
  logEvent('CAMS_EXT_ON',why||'','');
}

// ---------- Apply stati ----------
function applySecurityNight(){
  camsOnBoth_('SECURITY_NIGHT');
  try{ _iftttSafe_('off_termostato'); }catch(_){}
  try{ _iftttSafe_('spegni_clima'); }catch(_){}
  try{ actLowerAll_('SECURITY_NIGHT'); }catch(_){}
  logEvent('APPLY','SECURITY_NIGHT','cams+clima_off+abbassa');
}

function applySecurityDay(){
  camsOnBoth_('SECURITY_DAY');
  try{ _iftttSafe_('off_termostato'); }catch(_){}
  try{ _iftttSafe_('spegni_clima'); }catch(_){}
  try{ actLowerAll_('SECURITY_DAY'); }catch(_){}
  logEvent('APPLY','SECURITY_DAY','cams+clima_off+abbassa');
  // Piante 2min dopo uscita reale (solo di giorno)
  try{
    if(!isNight() && getPianteEnabled_()){
      ScriptApp.getProjectTriggers().forEach(function(t){
        var fn = t.getHandlerFunction ? t.getHandlerFunction() : '';
        if(fn==='startPianteDelayed_') ScriptApp.deleteTrigger(t);
      });
      ScriptApp.newTrigger('startPianteDelayed_').timeBased().at(new Date(Date.now()+2*60000)).create();
      logEvent('PIANTE_DELAYED','tra 2min','');
    }
  }catch(e){ logEvent('PIANTE_DELAYED_ERR',String(e),''); }
}

function applyComfyDay(){
  camsAllOff_('COMFY_DAY');
  try{ _iftttSafe_('termostato_auto'); }catch(_){}
  logEvent('APPLY','COMFY_DAY','cams_off+termostato_auto');
}

function applyComfyNight(){
  camsAllOff_('COMFY_NIGHT');
  camsExtOn_('COMFY_NIGHT');
  try{ _iftttSafe_('termostato_auto'); }catch(_){}
  logEvent('APPLY','COMFY_NIGHT','cam_est_on+termostato_auto');
}

// ---------- Tapparelle ----------
function actRaiseAll_(reason){
  try{
    if(getStatoCorrente_().indexOf('SECURITY_')===0){
      logEvent('RAISE_BLOCK','SECURITY',reason||''); return;
    }
    _iftttSafe_('alza_tutto');
    logEvent('RAISE_ALL','ok',reason||'');
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

// ---------- Tramonto ----------
function onSunset(){
  try{
    if(isOverride_()) return;
    evaluateStateNow();
    if(isVacanza_()){
      actLowerAll_('tramonto_vacanza');
      logEvent('TRAMONTO','abbassa vacanza','');
    } else if(everyoneOutNow_()){
      actLowerAll_('tramonto_casa_vuota');
      logEvent('TRAMONTO','abbassa casa vuota','');
    } else {
      logEvent('TRAMONTO','casa occupata - aspetta 23:00/00:00','');
    }
  }catch(e){ logEvent('ERR_SUNSET',String(e),''); }
}

// ---------- Chiusura notturna 23:00 feriali / 00:05 festivi ----------
function closeShuttersAt23IfPeopleHome_(){
  try{
    var now = new Date();
    var h = now.getHours();
    var feriale = isFeriale_(now);
    var isRightHour = feriale ? (h===23) : (h===0);
    if(!isRightHour) return;
    if(isOverride_() || isVacanza_()) return;
    if(!everyoneOutNow_()){
      actLowerAll_(feriale?'23:00_feriale':'00:00_festivo');
      logEvent('CLOSE_LATE', feriale?'23:00':'00:05', 'casa occupata');
    } else {
      logEvent('CLOSE_LATE_SKIP','casa vuota','');
    }
  }catch(e){ logEvent('ERR_CLOSE_LATE',String(e),''); }
}

// ---------- evaluateStateNow — LOGICA SEMPLICE ----------
// Presenza = legge direttamente colonna F foglio Persone
// Nessun debounce, nessun timeout, nessun KA
function evaluateStateNow(){
  try{
    // Purga sempre trigger KA legacy
    try{ purgeKATriggers_(); }catch(_){}

    if(isOverride_()){
      logEvent('OVERRIDE','attivo - skip eval','');
      s('Stato','B5', new Date());
      s('Stato','B6', isNight()?'NOTTE':'GIORNO');
      return;
    }

    var stato  = getStatoCorrente_();
    var vac    = isVacanza_();
    var notte  = isNight();

    // Presenza = qualcuno IN nel foglio Persone (colonna F)
    var ppl = _getAllPeopleRaw_();
    var eff = ppl.some(function(p){ return p.online; });

    s('Config','B5', eff);
    s('Config','B6', eff);

    var desired;
    if(vac){
      desired = notte ? 'SECURITY_NIGHT' : 'SECURITY_DAY';
    } else if(notte){
      desired = eff ? 'COMFY_NIGHT' : 'SECURITY_NIGHT';
    } else {
      desired = eff ? 'COMFY_DAY' : 'SECURITY_DAY';
    }

    if(desired !== stato){
      logEvent('STATE_CHANGE', stato+'->'+desired, eff?'casa_occupata':'casa_vuota');
      setState_(desired);
      if(desired==='SECURITY_NIGHT') applySecurityNight();
      if(desired==='SECURITY_DAY')   applySecurityDay();
      if(desired==='COMFY_DAY')      applyComfyDay();
      if(desired==='COMFY_NIGHT')    applyComfyNight();
    }

    s('Stato','B5', new Date());
    s('Stato','B6', notte?'NOTTE':'GIORNO');

  }catch(e){ logEvent('ERR_EVAL',String(e),''); }
}

function verifyHouseEmptyThenClose(){
  try{
    var anyIn = _getAllPeopleRaw_().some(function(p){ return p.online; });
    if(!anyIn){
      setState_('SECURITY_DAY');
      applySecurityDay();
      logEvent('GRACE_CLOSE','casa vuota confermata','');
    } else {
      logEvent('GRACE_ABORT','casa NON vuota','');
    }
  }catch(e){ logEvent('GRACE_ERR',String(e),''); }
}

function updatePresenceEffective_(){
  try{
    var eff = _getAllPeopleRaw_().some(function(p){ return p.online; });
    s('Config','B6', eff); return eff;
  }catch(e){ logEvent('ERR_PRES_EFF',String(e),''); return false; }
}

// Stub rimossi ma referenziati altrove
function applyPresenceDebounce_(raw){ return {reported:!!raw}; }
function allOutByAutoTimeout_(){ return false; }

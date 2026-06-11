// 04_state.gs — STATI
// Logica: eff = qualcuno IN nel foglio → stato COMFY, altrimenti SECURITY
// Nessun grace, nessun debounce, nessun KA, nessun timeout

function setState_(val){ s('Config','B1',val); }

function camsOnBoth_(w){ _iftttSafe_('ezviz_interne_on'); _iftttSafe_('ezviz_esterne_on'); logEvent('CAMS_ON',w||'',''); }
function camsAllOff_(w){ _iftttSafe_('ezviz_interne_off'); _iftttSafe_('ezviz_esterne_off'); logEvent('CAMS_OFF',w||'',''); }
function camsExtOn_(w){ _iftttSafe_('ezviz_esterne_on'); logEvent('CAMS_EXT_ON',w||'',''); }

function applySecurityDay(){
  camsOnBoth_('SEC_DAY');
  try{ _iftttSafe_('off_termostato'); }catch(_){}
  try{ _iftttSafe_('spegni_clima'); }catch(_){}
  try{ actLowerAll_('SEC_DAY'); }catch(_){}
  logEvent('APPLY','SECURITY_DAY','');
  try{
    if(!isNight() && getPianteEnabled_()){
      ScriptApp.getProjectTriggers().forEach(function(t){
        if((t.getHandlerFunction?t.getHandlerFunction():'') === 'startPianteDelayed_')
          ScriptApp.deleteTrigger(t);
      });
      ScriptApp.newTrigger('startPianteDelayed_').timeBased().at(new Date(Date.now()+2*60000)).create();
      logEvent('PIANTE_SCHED','tra 2min','');
    }
  }catch(e){ logEvent('PIANTE_SCHED_ERR',String(e),''); }
}

function applySecurityNight(){
  camsOnBoth_('SEC_NIGHT');
  try{ _iftttSafe_('off_termostato'); }catch(_){}
  try{ _iftttSafe_('spegni_clima'); }catch(_){}
  try{ actLowerAll_('SEC_NIGHT'); }catch(_){}
  logEvent('APPLY','SECURITY_NIGHT','');
}

function applyComfyDay(){
  camsAllOff_('COMFY_DAY');
  try{ _iftttSafe_('termostato_auto'); }catch(_){}
  logEvent('APPLY','COMFY_DAY','');
}

function applyComfyNight(){
  camsAllOff_('COMFY_NIGHT');
  camsExtOn_('COMFY_NIGHT');
  try{ _iftttSafe_('termostato_auto'); }catch(_){}
  logEvent('APPLY','COMFY_NIGHT','');
}

function actRaiseAll_(r){
  try{
    if(getStatoCorrente_().indexOf('SECURITY_')===0){ logEvent('RAISE_BLOCK','SECURITY',r||''); return; }
    _iftttSafe_('alza_tutto'); logEvent('RAISE_ALL','ok',r||'');
  }catch(e){ logEvent('RAISE_ERR',String(e),r||''); }
}
function actLowerAll_(r){
  try{ _iftttSafe_('abbassa_tutto'); logEvent('LOWER_ALL','ok',r||''); }
  catch(e){ logEvent('LOWER_ERR',String(e),r||''); }
}
function raiseAllNow_(o){
  if(isVacanza_()){ logEvent('ALZA_SKIP','vacanza',''); return false; }
  if(isOverride_()){ logEvent('ALZA_SKIP','override',''); return false; }
  actRaiseAll_(o||'manual'); return true;
}
function lowerAllNow_(o){
  if(isOverride_()){ logEvent('ABBASSA_SKIP','override',''); return false; }
  actLowerAll_(o||'manual'); return true;
}

function onSunset(){
  try{
    if(isOverride_()) return;
    evaluateStateNow();
    if(isVacanza_()){
      actLowerAll_('tramonto_vacanza');
    } else if(everyoneOutNow_()){
      actLowerAll_('tramonto_vuota');
      logEvent('TRAMONTO','abbassa casa vuota','');
    } else {
      logEvent('TRAMONTO','casa occupata — aspetta 23:00','');
    }
  }catch(e){ logEvent('ERR_SUNSET',String(e),''); }
}

function closeShuttersAt23IfPeopleHome_(){
  try{
    var now=new Date(), h=now.getHours(), fer=isFeriale_(now);
    if(fer?(h!==23):(h!==0)) return;
    if(isOverride_()||isVacanza_()) return;
    if(!everyoneOutNow_()){
      actLowerAll_(fer?'23:00':'00:00');
      logEvent('CLOSE_LATE',fer?'23:00':'00:00','occupata');
    }
  }catch(e){ logEvent('ERR_CLOSE_LATE',String(e),''); }
}

// ── evaluateStateNow: UNICA FONTE DI VERITA' = colonna F foglio Persone ──
function evaluateStateNow(){
  try{
    try{ purgeKATriggers_(); }catch(_){}

    if(isOverride_()){
      logEvent('OVERRIDE','attivo','');
      s('Stato','B5',new Date());
      s('Stato','B6',isNight()?'NOTTE':'GIORNO');
      return;
    }

    var stato   = getStatoCorrente_();
    var vac     = isVacanza_();
    var notte   = isNight();
    var eff     = _getAllPeopleRaw_().some(function(p){ return p.online; });

    s('Config','B5', eff);
    s('Config','B6', eff);

    var desired;
    if(vac){
      desired = notte ? 'SECURITY_NIGHT' : 'SECURITY_DAY';
    } else {
      desired = eff ? (notte?'COMFY_NIGHT':'COMFY_DAY') : (notte?'SECURITY_NIGHT':'SECURITY_DAY');
    }

    if(desired !== stato){
      logEvent('STATE_CHANGE', stato+'->'+desired, eff?'IN':'OUT');
      setState_(desired);
      if(desired==='SECURITY_DAY')   applySecurityDay();
      if(desired==='SECURITY_NIGHT') applySecurityNight();
      if(desired==='COMFY_DAY')      applyComfyDay();
      if(desired==='COMFY_NIGHT')    applyComfyNight();
    }

    s('Stato','B5', new Date());
    s('Stato','B6', notte?'NOTTE':'GIORNO');
  }catch(e){ logEvent('ERR_EVAL',String(e),''); }
}

// STUB compatibilità
function updatePresenceEffective_(){
  try{ var e=_getAllPeopleRaw_().some(function(p){return p.online;}); s('Config','B6',e); return e; }catch(_){ return false; }
}
function allOutByAutoTimeout_(){ return false; }
function verifyHouseEmptyThenClose(){
  try{
    if(!_getAllPeopleRaw_().some(function(p){ return p.online; })){
      setState_('SECURITY_DAY'); applySecurityDay();
      logEvent('VERIFY_CLOSE','casa vuota','');
    }
  }catch(e){ logEvent('VERIFY_ERR',String(e),''); }
}

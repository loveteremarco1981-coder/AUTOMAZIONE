// ============================================================
// 04_state.gs — macchina a stati + azioni IFTTT
// Regole tapparelle:
//   SECURITY (casa vuota):    abbassa_tutto
//   COMFY (casa occupata):    NON toccare tapparelle (gestite da piante/manuale)
//   Tramonto casa vuota:      abbassa_tutto
//   Tramonto casa occupata:   niente (aspetta 23:00 feriali / 00:00 festivi)
//   23:00 feriali:            abbassa_tutto se casa occupata
//   00:00 festivi/weekend:    abbassa_tutto se casa occupata
// ============================================================

function setState_(val){ s('Config','B1',val); }

// ---------- Azioni camere ----------
function camsOnBoth_(why){ _iftttSafe_('ezviz_interne_on'); _iftttSafe_('ezviz_esterne_on'); logEvent('CAMS_ON_BOTH',why||'',''); }
function camsAllOff_(why){ _iftttSafe_('ezviz_interne_off'); _iftttSafe_('ezviz_esterne_off'); logEvent('CAMS_OFF_BOTH',why||'',''); }
function camsExtOn_(why){  _iftttSafe_('ezviz_esterne_on'); logEvent('CAMS_EXT_ON',why||'',''); }

// ---------- Azioni per stato ----------
function applySecurityNight(){
  camsOnBoth_('SECURITY_NIGHT');
  try{ _iftttSafe_('off_termostato'); }catch(_){}
  // Abbassa tapparelle solo se casa vuota (evita di abbassare se override/vacanza)
  try{ actLowerAll_('SECURITY_NIGHT'); }catch(_){}
  logEvent('SECURITY_NIGHT','cams_on+termostati_off+abbassa','');
}

// Verifica se l'uscita è stata REALE (SSID/geofence) o solo timeout
// Uscita reale = almeno una persona ha last_event USCITA o OUT_CONFIRMED
// Uscita solo timeout = tutti AUTO_OUT → NON abbassare tapparelle
function allOutByAutoTimeout_(){
  try{
    var ppl = _getAllPeopleRaw_();
    var outPpl = ppl.filter(function(p){ return !p.online; });
    if(!outPpl.length) return false;
    // Abbassa solo se TUTTI hanno uscita reale (USCITA confermata)
    // Se anche solo UNO e' AUTO_OUT → potrebbe essere in casa → non abbassare
    var anyAutoOut = outPpl.some(function(p){
      return String(p.lastEvent||'') === 'AUTO_OUT';
    });
    if(anyAutoOut){
      logEvent('SHUTTER_HOLD','presenza incerta - non abbasso tapparelle','');
      return true;
    }
    return false;
  }catch(_){ return false; }
}

function applySecurityDay(){
  camsOnBoth_('SECURITY_DAY');
  try{ _iftttSafe_('off_termostato'); }catch(_){}

  // Abbassa tapparelle SOLO se almeno una persona è uscita per SSID/geofence
  // Se tutti OUT per timeout automatico → potrebbe essere falso negativo, non abbassare
  if(!allOutByAutoTimeout_()){
    try{ actLowerAll_('SECURITY_DAY'); }catch(_){}
    logEvent('SECURITY_DAY','cams_on+termostati_off+abbassa','uscita_reale');

    // Schedula piante 2min dopo solo se abbasso
    try{
      if(!isNight() && getPianteEnabled_()){
        ScriptApp.getProjectTriggers().forEach(function(t){
          if(t.getHandlerFunction && t.getHandlerFunction()==='startPianteDelayed_')
            ScriptApp.deleteTrigger(t);
        });
        var when = new Date(Date.now() + 2*60000);
        ScriptApp.newTrigger('startPianteDelayed_').timeBased().at(when).create();
        logEvent('PIANTE_DELAYED','programmato tra 2min', when.toISOString());
      }
    }catch(e){ logEvent('PIANTE_DELAYED_ERR',String(e),''); }
  } else {
    logEvent('SECURITY_DAY','cams_on+termostati_off','timeout_only_no_abbassa');
  }
}
function applyComfyDay(){
  camsAllOff_('COMFY_DAY');
  try{ _iftttSafe_('termostato_auto'); }catch(_){}
  // NON toccare tapparelle — gestite da piante o manuale
  logEvent('COMFY_DAY','cams_off+termostati_auto','');
}
function applyComfyNight(){
  camsAllOff_('COMFY_NIGHT');
  camsExtOn_('COMFY_NIGHT');
  try{ _iftttSafe_('termostato_auto'); }catch(_){}
  // NON toccare tapparelle
  logEvent('COMFY_NIGHT','cam_esterne_on+termostati_auto','');
}

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

// ---------- Tramonto ----------
function onSunset(){
  try{
    if(isOverride_()) return;
    evaluateStateNow();
    if(isVacanza_()){
      // In vacanza: abbassa sempre al tramonto
      actLowerAll_('tramonto_vacanza');
      logEvent('TRAMONTO','abbassa — vacanza','');
    } else if(everyoneOutWithGrace_()){
      // Casa vuota: abbassa al tramonto
      actLowerAll_('tramonto_casa_vuota');
      logEvent('TRAMONTO','abbassa — casa vuota','');
    } else {
      // Casa occupata: aspetta 23:00/00:00
      logEvent('TRAMONTO','casa occupata — aspetta 23:00/00:00','');
    }
  }catch(e){ logEvent('ERROR_SUNSET',String(e),''); }
}

// ---------- Chiusura notturna (feriali 23:00 / festivi 00:00) ----------
function closeLateNight_(){
  try{
    var now = new Date();
    var h   = now.getHours();
    var feriale = isFeriale_(now);

    // Feriali: chiudi alle 23:00
    // Festivi/weekend: chiudi a mezzanotte (trigger alle 00:00)
    var isRightHour = feriale ? (h === 23) : (h === 0);
    if(!isRightHour) return;

    if(isOverride_() || isVacanza_()) return;

    // Chiudi solo se c'è qualcuno in casa
    if(!everyoneOutNow_()){
      actLowerAll_(feriale ? 'chiusura_23:00_feriale' : 'chiusura_00:00_festivo');
      logEvent('CLOSE_LATE', feriale ? '23:00 feriale' : '00:00 festivo', 'casa occupata');
    } else {
      logEvent('CLOSE_LATE_SKIP','casa vuota','già abbassate al tramonto');
    }
  }catch(e){ logEvent('ERR_CLOSE_LATE',String(e),''); }
}

// ---------- evaluateStateNow ----------
function evaluateStateNow(){
  try{
    if(isOverride_()){
      if(String(v('Stato','C1'))!=='OVR'){ logEvent('OVERRIDE','ON',''); s('Stato','C1','OVR'); }
      s('Stato','B5',new Date()); s('Stato','B6',isNight()?'NOTTE':'GIORNO'); return;
    } else {
      if(String(v('Stato','C1'))==='OVR') s('Stato','C1','');
    }

    try{ autoOutByLifeTimeout_(); }catch(_){}

    var stato  = getStatoCorrente_();
    var vac    = isVacanza_();
    var notte  = isNight();
    var giorno = !notte;

    // Presenza raw
    var ppl  = _getAllPeopleRaw_();
    var now  = Date.now(), STRICT = getStrictLifeMin_();
    var raw  = false;
    ppl.forEach(function(p){
      if(!p.online) return; // F=OUT → skip
      if(hasSsidLock_(p.name.toLowerCase())){ raw=true; return; }
      if(giorno){
        // GIORNO: se F=IN → sei IN. Telefono morto/senza segnale = ancora in casa.
        // Non serve ping recente. Solo un segnale esplicito di uscita può portare OUT.
        raw = true;
      } else {
        // NOTTE: ping recente richiesto (telefono a casa = deve fare rumore)
        var lifeRecent = !!(p.lifeMs && ((now-p.lifeMs) <= STRICT*60000));
        if(lifeRecent) raw = true;
      }
    });
    s('Config','B5', raw);

    var deb     = applyPresenceDebounce_(raw);
    var eff     = deb.reported;
    var prevEff = !!(v('Config','B8'));
    var alba    = v('Stato','B3');

    // Morning hold
    if(giorno && (alba instanceof Date)){
      if(_minutesAgo_(alba) <= getMorningHoldMin_() && prevEff && raw) eff = true;
    }

    // Grace: everyoneOut con ping recente
    if(everyoneOutWithGrace_()){ eff=false; prevEff=false; }

    // Presenza effettiva da colonna F
    var effReal = updatePresenceEffective_();
    if(!effReal) eff = false;

    // Stato desiderato
    var desired = stato, scheduleGrace = false;
    if(vac){
      desired = notte ? 'SECURITY_NIGHT' : 'SECURITY_DAY';
    } else if(notte){
      desired = eff ? 'COMFY_NIGHT' : 'SECURITY_NIGHT';
    } else {
      if(eff) desired = 'COMFY_DAY';
      else {
        if(prevEff){ desired=stato; scheduleGrace=true; }
        else { s('Stato','B11','—'); desired='SECURITY_DAY'; }
      }
    }

    // Patch arrivo: alza solo se ALZA_CON=ARRIVO
    var fromSec  = (stato==='SECURITY_DAY'||stato==='SECURITY_NIGHT');
    var toComfy  = (desired==='COMFY_DAY'||desired==='COMFY_NIGHT');
    if(fromSec && toComfy && !prevEff){
      var alzaCon = getAlzaCon_();
      if(alzaCon==='MAI'||alzaCon==='PIANTE'){
        logEvent('OPEN_BLOCK','ALZA_CON='+alzaCon,'');
      } else {
        if(!notte && !isQuietHours_(new Date())){
          try{ actRaiseAll_('Arrivo'); }catch(_){}
          logEvent('ARRIVO','alza','');
        } else {
          logEvent('OPEN_BLOCK','notte/quiet','');
        }
      }
    }

    // Applica cambio stato
    if(desired !== stato){
      setState_(desired);
      logEvent('STATE_CHANGE','->'+desired,'');
      try{
        if(desired==='SECURITY_NIGHT') applySecurityNight();
        if(desired==='SECURITY_DAY')   applySecurityDay();
        if(desired==='COMFY_DAY')      applyComfyDay();
        if(desired==='COMFY_NIGHT')    applyComfyNight();
      }catch(_){}
    }

    // Grace timer uscita
    if(scheduleGrace){
      var EG = getEmptyGraceMin_();
      s('Stato','B11', new Date(Date.now()+EG*60000));
      try{ ScriptApp.newTrigger('verifyHouseEmptyThenClose').timeBased().after(EG*60000).create(); }
      catch(e){ logEvent('GRACE_ERR',String(e),''); }
    }

    // Impianti quando casa si svuota
    if(!vac && !eff && prevEff){
      try{ _iftttSafe_('off_termostato'); }catch(_){}
      logEvent('VUOTA','termostati_off','');
    }

    s('Config','B6', eff);
    s('Config','B8', eff);
    s('Stato','B5',  new Date());
    s('Stato','B6',  notte ? 'NOTTE' : 'GIORNO');

  }catch(e){ logEvent('ERROR_EVAL',String(e),''); }
  try{ disableKAIfOut_(); }catch(_){}
}

function verifyHouseEmptyThenClose(){
  try{
    var anyIn = _getAllPeopleRaw_().some(function(p){ return p.online; });
    if(!anyIn){
      setState_('SECURITY_DAY');
      logEvent('GRACE_CLOSE','Casa vuota','');
      applySecurityDay();
    } else {
      logEvent('GRACE_ABORT','Casa NON vuota','');
    }
  }catch(e){ logEvent('GRACE_ERR',String(e),''); }
}

// ---------- Helpers presenza ----------
function updatePresenceEffective_(){
  try{
    var ppl = _getAllPeopleRaw_();
    var eff = ppl.some(function(p){ return p.online; });
    s('Config','B6', eff); return eff;
  }catch(e){ logEvent('ERR_PRES_EFF',String(e),''); return false; }
}

function applyPresenceDebounce_(raw){
  try{
    var now=Date.now(), prevStr=getProp_('presenceReported',null);
    var prev=(prevStr==='true'), hasPrev=(prevStr!==null);
    var lastChange=Number(getProp_('presenceLastChangeMs',String(now)));
    if(!isFinite(lastChange)||lastChange>now) lastChange=now;
    if(!hasPrev&&raw){
      setProp_('presenceReported','true'); setProp_('presenceLastChangeMs',String(now));
      s('Config','B6',true); return {reported:true};
    }
    if(hasPrev&&raw===prev){ s('Config','B6',prev); return {reported:prev}; }
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

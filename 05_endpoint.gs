// ============================================================
// 05_endpoint.gs — doGet (API pubblica per Shortcuts/IFTTT)
// ============================================================

function doGet(e){
  var p=e&&e.parameter?e.parameter:{};
  var ev=String(p.event||'').toLowerCase().trim();
  var who=String(p.name||'').toLowerCase().trim();
  var cb=String(p.callback||'').trim();

  function out(obj){
    var txt=JSON.stringify(obj||{ok:false});
    if(cb) return ContentService.createTextOutput(cb+'('+txt+')').setMimeType(ContentService.MimeType.JAVASCRIPT);
    return ContentService.createTextOutput(txt).setMimeType(ContentService.MimeType.JSON);
  }

  try{
    if(!ev) return out({ok:false,err:'missing_event'});

    // ---- SSID ON (iOS: connesso al Wi-Fi di casa) ----
    if(ev==='ssid_on'){
      if(!who) return out({ok:false,err:'missing_name'});
      var hold=Number(p.hold||'');
      var r=ssidOn_(who,hold);
      try{ evaluateStateNow(); }catch(_){}
      return out({ok:true,name:who,hold:r.hold,now:new Date().toISOString()});
    }

    // ---- SSID OFF (iOS: disconnesso dal Wi-Fi di casa) ----
    if(ev==='ssid_off'){
      if(!who) return out({ok:false,err:'missing_name'});
      var r2=ssidOff_(who);
      try{ evaluateStateNow(); }catch(_){}
      return out({ok:true,name:who,guard:r2.guard,now:new Date().toISOString()});
    }

    // ---- LIFE PING (segnale "sono vivo in casa") ----
    if(ev==='life_ping'){
      if(!who) return out({ok:false,err:'missing_name'});
      var r3=lifePingNow_(who);
      try{ evaluateStateNow(); }catch(_){}
      return out(r3);
    }

    // ---- MARK OUT (uscita esplicita) ----
    if(ev==='mark_out'){
      if(!who) return out({ok:false,err:'missing_name'});
      var src=String(p.source||'').toLowerCase();

      // SSID ancora connesso → ignora
      if(hasSsidLock_(who)){
        logEvent('OUT_SSID_LOCK',who,src);
        return out({ok:true,ignored:true,reason:'ssid_lock',now:new Date().toISOString()});
      }

      // Da geofence → pending (soft OUT)
      if(src==='geofence'){
        var g=getExitGuardMin_();
        setProp_(_pendingOutKey_(who),String(Date.now()+g*60000));
        _ensurePendingSweep_();
        logEvent('OUT_PENDING','geofence','guard='+g+'m '+who);
        try{ evaluateStateNow(); }catch(_){}
        return out({ok:true,pending:true,guard:g,now:new Date().toISOString()});
      }

      // Manuale/diretto
      var rr=markOutNow_(who);
      try{ evaluateStateNow(); }catch(_){}
      return out(rr);
    }

    // ---- FORCE IN / FORCE OUT (menu/debug) ----
    if(ev==='force_in'){
      if(!who) return out({ok:false,err:'missing_name'});
      var fi=forceIn_(who);
      try{ evaluateStateNow(); }catch(_){}
      return out(fi);
    }
    if(ev==='force_out'){
      if(!who) return out({ok:false,err:'missing_name'});
      var fo=markOutNow_(who);
      try{ evaluateStateNow(); }catch(_){}
      return out(fo);
    }

    // ---- ALZA TUTTO (con controllo ALZA_CON) ----
    if(ev==='alza_tutto'){
      if(String(p.manual||'').toUpperCase()==='TRUE'){
        logEvent('ALZA_TUTTO_MANUALE','ok','via endpoint');
        try{ actRaiseAll_('Manual'); }catch(_){}
        return out({ok:true,manual:true});
      }
      var alzaCon=getAlzaCon_();
      if(alzaCon!=='ARRIVO'){
        logEvent('OPEN_BLOCK','alza_tutto','ALZA_CON='+alzaCon);
        return out({ok:false,blocked:true,reason:'ALZA_CON='+alzaCon});
      }
      try{ actRaiseAll_('Arrivo'); }catch(_){}
      return out({ok:true,auto:true});
    }

    // ---- DIAG ----
    if(ev==='diag'){
      var ppl=getPeople_().people||[];
      return out({
        ok:true,
        now:new Date().toISOString(),
        state:getStatoCorrente_(),
        override:isOverride_(),
        vacation:isVacanza_(),
        night:isNight(),
        people:ppl.map(function(p){ return {name:p.name,online:p.online,ts:p.tsText}; })
      });
    }

    return out({ok:true,note:'unknown_event',event:ev});

  }catch(err){
    try{ logEvent('EP_ERR',String(err),ev+' '+who); }catch(_){}
    return out({ok:false,error:String(err)});
  }
}

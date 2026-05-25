// ============================================================
// 05_endpoint.gs — doGet
// Senza ?event= → restituisce il modello completo per la webapp
// Con ?event=xxx → comandi (ssid_on, mark_out, force_in, ecc.)
// Con ?logs=1    → ultimi 50 log
// ============================================================

// ---- Costruisce il modello completo per la webapp ----
function buildModel_(){
  var now     = new Date();
  var notte   = isNight();
  var stato   = getStatoCorrente_();
  var vac     = isVacanza_();
  var ovr     = isOverride_();
  var eff     = !!(v('Config','B6'));
  var tz      = Session.getScriptTimeZone();

  // Persone
  var rawPeople = _getAllPeopleRaw_();
  var STRICT    = getStrictLifeMin_();
  var nowMs     = now.getTime();
  var people = rawPeople.map(function(p){
    var lifeRecent = !!(p.lifeMs && (nowMs - p.lifeMs) <= STRICT * 60000);
    var onlineSmart = notte ? p.online : (p.online && lifeRecent);
    // Se SSID è connesso, sempre IN
    if(hasSsidLock_(p.name.toLowerCase())) onlineSmart = true;
    var lastLifeMinAgo = p.lifeMs ? Math.round((nowMs - p.lifeMs) / 60000) : null;
    return {
      name:            p.name,
      onlineSmart:     onlineSmart,
      onlineRaw:       p.online,
      lastEvent:       p.lastEvent,
      lastLifeMinAgo:  lastLifeMinAgo,
      tsText:          p.lifeDate ? Utilities.formatDate(p.lifeDate, tz, 'dd/MM HH:mm') : null,
      ssidLock:        ssidLock
    };
  });

  // Meteo dal foglio Config (aggiornato da Open-Meteo client-side → non serve backend)
  var weather = {
    tempC:    _numSafe_(v('Config','B22'), null),
    humidity: _numSafe_(v('Config','B23'), null),
    windKmh:  _numSafe_(v('Config','B24'), null),
    icon:     String(v('Config','B21')||''),
    provider: 'Open-Meteo'
  };

  // Prossimi eventi
  var pianteNext  = v('Stato','B10');
  var albaDate    = v('Stato','B3');
  var tramDate    = v('Stato','B4');
  var next = {
    pianteAlba:      (pianteNext instanceof Date) ? Utilities.formatDate(pianteNext, tz, 'dd/MM HH:mm') : (pianteNext ? String(pianteNext) : null),
    piantePostClose: null,
    lateClose:       null,
    alba:            (albaDate  instanceof Date) ? albaDate.toISOString()  : null,
    tramonto:        (tramDate  instanceof Date) ? tramDate.toISOString()  : null
  };

  // Alert
  var logErrors = 0;
  try{
    var sheet = sh('Log'), last = sheet.getLastRow();
    if(last >= 2){
      var codes = sheet.getRange(2, 3, last-1, 1).getValues();
      for(var i = 0; i < codes.length; i++){
        if(String(codes[i][0]||'').toUpperCase().indexOf('ERR') >= 0) logErrors++;
      }
    }
  }catch(_){}

  // Meta
  var meta = {
    nowIso:   now.toISOString(),
    tz:       tz,
    version:  '2.0',
    albaIso:  (albaDate  instanceof Date) ? albaDate.toISOString()  : null,
    tramontoIso: (tramDate instanceof Date) ? tramDate.toISOString() : null
  };

  return {
    state:             stato,
    notte:             notte,
    vacanza:           vac,
    override:          ovr,
    presenzaEffettiva: eff,
    people:            people,
    weather:           weather,
    next:              next,
    alerts:            { logErrors: logErrors },
    meta:              meta
  };
}

// ---- Ultimi N log ----
function buildLogs_(n){
  var out = [];
  try{
    var sheet = sh('Log'), last = sheet.getLastRow();
    if(last < 2) return out;
    var from  = Math.max(2, last - (n||50) + 1);
    var rows  = sheet.getRange(from, 1, last - from + 1, 5).getValues();
    // Inverti: più recenti prima
    for(var i = rows.length - 1; i >= 0; i--){
      var r = rows[i];
      out.push({
        ts:    (r[0] instanceof Date) ? r[0].toISOString() : String(r[0]||''),
        stato: String(r[1]||''),
        code:  String(r[2]||''),
        desc:  String(r[3]||''),
        note:  String(r[4]||'')
      });
    }
  }catch(_){}
  return out;
}

// ---- doGet ----
function doGet(e){
  var p  = e && e.parameter ? e.parameter : {};
  var ev = String(p.event||'').toLowerCase().trim();
  var who= String(p.name||'').toLowerCase().trim();
  var cb = String(p.callback||'').trim();

  function out(obj){
    var txt = JSON.stringify(obj || {ok:false});
    if(cb) return ContentService.createTextOutput(cb+'('+txt+')').setMimeType(ContentService.MimeType.JAVASCRIPT);
    return ContentService.createTextOutput(txt).setMimeType(ContentService.MimeType.JSON);
  }

  try{

    // ---- MODELLO (nessun event → webapp chiede lo stato) ----
    if(!ev){
      // ?logs=1 → solo log
      if(String(p.logs||'') === '1'){
        return out({ logs: buildLogs_(50) });
      }
      // modello completo
      return out(buildModel_());
    }

    // ---- SSID ON ----
    if(ev==='ssid_on'){
      if(!who) return out({ok:false,err:'missing_name'});
      var r = ssidOn_(who, Number(p.hold||''));
      try{ evaluateStateNow(); }catch(_){}
      return out({ok:true, name:who, hold:r.hold, now:new Date().toISOString()});
    }

    // ---- SSID OFF ----
    if(ev==='ssid_off'){
      if(!who) return out({ok:false,err:'missing_name'});
      var r2 = ssidOff_(who);
      try{ evaluateStateNow(); }catch(_){}
      return out({ok:true, name:who, guard:r2.guard, now:new Date().toISOString()});
    }

    // ---- LIFE PING ----
    if(ev==='life_ping'){
      if(!who) return out({ok:false,err:'missing_name'});
      var r3 = lifePingNow_(who);
      try{ evaluateStateNow(); }catch(_){}
      return out(r3);
    }

    // ---- MARK OUT ----
    if(ev==='mark_out'){
      if(!who) return out({ok:false,err:'missing_name'});
      var src = String(p.source||'').toLowerCase();
      if(hasSsidLock_(who)){
        logEvent('OUT_SSID_LOCK', who, src);
        return out({ok:true, ignored:true, reason:'ssid_lock', now:new Date().toISOString()});
      }
      if(src==='geofence'){
        var g = getExitGuardMin_();
        setProp_(_pendingOutKey_(who), String(Date.now()+g*60000));
        _ensurePendingSweep_();
        logEvent('OUT_PENDING','geofence','guard='+g+'m '+who);
        try{ evaluateStateNow(); }catch(_){}
        return out({ok:true, pending:true, guard:g, now:new Date().toISOString()});
      }
      var rr = markOutNow_(who);
      try{ evaluateStateNow(); }catch(_){}
      return out(rr);
    }

    // ---- FORCE IN / OUT ----
    if(ev==='force_in'){
      if(!who) return out({ok:false,err:'missing_name'});
      var fi = forceIn_(who);
      try{ evaluateStateNow(); }catch(_){}
      return out(fi);
    }
    if(ev==='force_out'){
      if(!who) return out({ok:false,err:'missing_name'});
      var fo = markOutNow_(who);
      try{ evaluateStateNow(); }catch(_){}
      return out(fo);
    }

    // ---- SET VACANZA ----
    if(ev==='set_vacanza'){
      var val = String(p.value||'').toUpperCase();
      var next = (val==='TRUE'||val==='1');
      s('Config','B3', next);
      logEvent('SET_VACANZA', String(next), '');
      try{ evaluateStateNow(); }catch(_){}
      return out({ok:true, vacanza:next});
    }

    // ---- SET OVERRIDE ----
    if(ev==='set_override'){
      var val2 = String(p.value||'').toUpperCase();
      var next2 = (val2==='TRUE'||val2==='1');
      s('Config','B4', next2);
      logEvent('SET_OVERRIDE', String(next2), '');
      try{ evaluateStateNow(); }catch(_){}
      return out({ok:true, override:next2});
    }

    // ---- ALZA TUTTO ----
    if(ev==='alza_tutto'){
      if(String(p.manual||'').toUpperCase()==='TRUE'){
        logEvent('ALZA_TUTTO_MANUALE','ok','via endpoint');
        try{ actRaiseAll_('Manual'); }catch(_){}
        return out({ok:true, manual:true});
      }
      var alzaCon = getAlzaCon_();
      if(alzaCon!=='ARRIVO'){
        logEvent('OPEN_BLOCK','alza_tutto','ALZA_CON='+alzaCon);
        return out({ok:false, blocked:true, reason:'ALZA_CON='+alzaCon});
      }
      try{ actRaiseAll_('Arrivo'); }catch(_){}
      return out({ok:true, auto:true});
    }

    // ---- ABBASSA TUTTO ----
    if(ev==='abbassa_tutto'){
      try{ actLowerAll_('endpoint'); }catch(_){}
      return out({ok:true});
    }

    // ---- PIANTE ----
    if(ev==='piante'){
      var ok = startPiante_('webapp');
      return out({ok:ok});
    }

    // ---- DIAG ----
    if(ev==='diag'){
      return out(buildModel_());
    }

    return out({ok:true, note:'unknown_event', event:ev});

  }catch(err){
    try{ logEvent('EP_ERR', String(err), ev+' '+who); }catch(_){}
    return out({ok:false, error:String(err)});
  }
}

// ============================================================
// 05_endpoint.gs — doGet
// ============================================================

function buildModel_(){
  var now   = new Date();
  var notte = isNight();
  var stato = getStatoCorrente_();
  var vac   = isVacanza_();
  var ovr   = isOverride_();
  var eff   = !!(v('Config','B6'));
  var tz    = Session.getScriptTimeZone();
  var nowMs = now.getTime();
  var STRICT = getStrictLifeMin_();

  var rawPeople = _getAllPeopleRaw_();
  var people = rawPeople.map(function(p){
    var nm       = p.name.toLowerCase();
    var ssidLock = hasSsidLock_(nm);
    var staleMins = notte ? STRICT : 480;
    var lifeOk = !!(p.lifeMs && ((nowMs - p.lifeMs) <= staleMins * 60000));
    var onlineSmart = p.online ? (ssidLock ? true : (notte ? true : lifeOk)) : false;
    var lastLifeMinAgo = p.lifeMs ? Math.round((nowMs - p.lifeMs) / 60000) : null;
    return {
      name:           p.name,
      onlineSmart:    onlineSmart,
      onlineRaw:      p.online,
      lastEvent:      p.lastEvent,
      lastLifeMinAgo: lastLifeMinAgo,
      ssidLock:       ssidLock
    };
  });

  var weather = {
    tempC:    _numSafe_(v('Config','B22'), null),
    humidity: _numSafe_(v('Config','B23'), null),
    windKmh:  _numSafe_(v('Config','B24'), null),
    icon:     String(v('Config','B21')||''),
    provider: 'Open-Meteo'
  };

  var pianteNext = v('Stato','B10');
  var albaDate   = v('Stato','B3');
  var tramDate   = v('Stato','B4');
  var next = {
    pianteAlba:      (pianteNext instanceof Date) ? Utilities.formatDate(pianteNext, tz, 'dd/MM HH:mm') : (pianteNext ? String(pianteNext) : null),
    piantePostClose: null,
    lateClose:       null,
    alba:            (albaDate instanceof Date) ? albaDate.toISOString() : null,
    tramonto:        (tramDate  instanceof Date) ? tramDate.toISOString() : null
  };

  var logErrors = 0;
  try{
    var sheet = sh('Log'), last = sheet.getLastRow();
    if(last >= 2){
      var codes = sheet.getRange(2, 3, last-1, 1).getValues();
      for(var i=0; i<codes.length; i++){
        if(String(codes[i][0]||'').toUpperCase().indexOf('ERR') >= 0) logErrors++;
      }
    }
  }catch(_){}

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
    meta: {
      nowIso:      now.toISOString(),
      tz:          tz,
      version:     '2.2',
      albaIso:     (albaDate instanceof Date) ? albaDate.toISOString() : null,
      tramontoIso: (tramDate  instanceof Date) ? tramDate.toISOString() : null
    }
  };
}

function buildLogs_(n){
  var out = [];
  try{
    var sheet = sh('Log'), last = sheet.getLastRow();
    if(last < 2) return out;
    var from = Math.max(2, last - (n||50) + 1);
    var rows = sheet.getRange(from, 1, last - from + 1, 5).getValues();
    for(var i = rows.length-1; i >= 0; i--){
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

function doGet(e){
  var p  = e && e.parameter ? e.parameter : {};
  var ev = String(p.event||'').toLowerCase().trim();
  var who= String(p.name||'').toLowerCase().trim();
  var cb = String(p.callback||'').trim();

  function out(obj){
    var txt = JSON.stringify(obj||{ok:false});
    if(cb) return ContentService.createTextOutput(cb+'('+txt+')').setMimeType(ContentService.MimeType.JAVASCRIPT);
    return ContentService.createTextOutput(txt).setMimeType(ContentService.MimeType.JSON);
  }

  try{
    if(!ev){
      if(String(p.logs||'')==='1') return out({ logs: buildLogs_(50) });
      return out(buildModel_());
    }

    if(ev==='ssid_on'){
      if(!who) return out({ok:false,err:'missing_name'});
      var r = ssidOn_(who, Number(p.hold||'480'));
      try{ evaluateStateNow(); }catch(_){}
      return out({ok:true, name:who, hold:r.hold, now:new Date().toISOString()});
    }

    if(ev==='ssid_off'){
      if(!who) return out({ok:false,err:'missing_name'});
      var r2 = ssidOff_(who);
      try{ evaluateStateNow(); }catch(_){}
      return out({ok:true, name:who, guard:r2.guard, now:new Date().toISOString()});
    }

    if(ev==='life_ping'){
      if(!who) return out({ok:false,err:'missing_name'});
      var r3 = lifePingNow_(who);
      try{ evaluateStateNow(); }catch(_){}
      return out(r3);
    }

    if(ev==='mark_in'){
      if(!who) return out({ok:false,err:'missing_name'});
      markIn_geofence_(who);
      try{ evaluateStateNow(); }catch(_){}
      return out({ok:true,name:who,now:new Date().toISOString()});
    }

    if(ev==='mark_out'){
      if(!who) return out({ok:false,err:'missing_name'});
      var src = String(p.source||'').toLowerCase();
      markOut_geofence_(who);
      return out({ok:true,name:who,src:src,now:new Date().toISOString()});
    }

    if(ev==='force_in'){
      if(!who) return out({ok:false,err:'missing_name'});
      var fi = forceIn_(who);
      try{ evaluateStateNow(); }catch(_){}
      return out(fi);
    }

    if(ev==='force_out'){
      if(!who) return out({ok:false,err:'missing_name'});
      var pplNow = _getAllPeopleRaw_();
      var personNow = null;
      for(var i=0;i<pplNow.length;i++){
        if(pplNow[i].name.toLowerCase()===who){ personNow=pplNow[i]; break; }
      }
      var wasIn = personNow ? personNow.online : false;
      markOutNow_(who, true);
      if(wasIn){ try{ evaluateStateNow(); }catch(_){} }
      return out({ok:true, name:who, changed:wasIn});
    }

    if(ev==='set_vacanza'){
      var nv=(String(p.value||'').toUpperCase()==='TRUE'||p.value==='1');
      s('Config','B3',nv);
      logEvent('SET_VACANZA',String(nv),'');
      try{ evaluateStateNow(); }catch(_){}
      return out({ok:true,vacanza:nv});
    }

    if(ev==='set_override'){
      var no=(String(p.value||'').toUpperCase()==='TRUE'||p.value==='1');
      s('Config','B4',no);
      logEvent('SET_OVERRIDE',String(no),'');
      try{ evaluateStateNow(); }catch(_){}
      return out({ok:true,override:no});
    }

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

    if(ev==='abbassa_tutto'){
      try{ actLowerAll_('endpoint'); }catch(_){}
      return out({ok:true});
    }

    if(ev==='piante'){
      var ok=startPiante_('webapp');
      return out({ok:ok});
    }

    // Comandi IFTTT diretti dal tab Dispositivi
    var iftttDirect = [
      'ezviz_interne_on','ezviz_interne_off',
      'ezviz_esterne_on','ezviz_esterne_off',
      'off_termostato','termostato_auto',
      'spegni_clima'
    ];
    if(iftttDirect.indexOf(ev) >= 0){
      try{ _iftttSafe_(ev); return out({ok:true,event:ev}); }
      catch(e){ return out({ok:false,err:String(e)}); }
    }

    if(ev==='update_weather'){
      try{
        if(p.temp) s('Config','B22', Number(p.temp));
        if(p.hum)  s('Config','B23', Number(p.hum));
        if(p.wind) s('Config','B24', Number(p.wind));
        if(p.icon) s('Config','B21', String(p.icon));
        return out({ok:true});
      }catch(e){ return out({ok:false,err:String(e)}); }
    }

    if(ev==='diag') return out(buildModel_());

    return out({ok:true,note:'unknown_event',event:ev});

  }catch(err){
    try{ logEvent('EP_ERR',String(err),ev+' '+who); }catch(_){}
    return out({ok:false,error:String(err)});
  }
}


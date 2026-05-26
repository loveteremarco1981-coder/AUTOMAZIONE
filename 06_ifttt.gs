// ============================================================
// 06_ifttt.gs — IFTTT helper
// ============================================================

function IFTTT_KEY(){
  try{ var k=PropertiesService.getScriptProperties().getProperty('IFTTT_KEY'); if(k)return k; }catch(_){}
  return '';
}

var _IFTTT_ALIAS_={
  'ezviz_interne_on':'ezviz_interne_on','ezviz_interne_off':'ezviz_interne_off',
  'ezviz_esterne_on':'ezviz_esterne_on','ezviz_esterne_off':'ezviz_esterne_off',
  'termostati_auto':'termostato_auto',
  'alza_tutto':'alza_tutto','abbassa_tutto':'abbassa_tutto',
  'piante':'piante','log_life':'log_life','log_arrivo':'log_arrivo','log_uscita':'log_uscita'
};

function _iftttSafe_(eventName, payload){
  var key=IFTTT_KEY(); if(!key){ logEvent('IFTTT_SKIP','key mancante',''); return; }
  try{
    var applet=_IFTTT_ALIAS_[String(eventName||'')]||String(eventName||'');
    var url='https://maker.ifttt.com/trigger/'+encodeURIComponent(applet)+'/with/key/'+key;
    var r=UrlFetchApp.fetch(url,{method:'post',contentType:'application/json',payload:JSON.stringify(payload||{}),muteHttpExceptions:true});
    logEvent('IFTTT_OK',applet,'HTTP '+r.getResponseCode());
  }catch(e){ logEvent('IFTTT_ERR',String(eventName),String(e)); }
}

// Alias pubblico usato nel vecchio codice
function callIFTTT(eventName,payload){ _iftttSafe_(eventName,payload); }

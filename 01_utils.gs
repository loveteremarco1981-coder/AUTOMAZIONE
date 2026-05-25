// ============================================================
// 01_utils.gs — helper di base (invariati, compatibili)
// ============================================================

function ss(){ return SpreadsheetApp.getActiveSpreadsheet(); }
function sh(name){ var s=ss(); return s.getSheetByName(name)||s.insertSheet(name); }
function v(sheet,range){ return sh(sheet).getRange(range).getValue(); }
function s(sheet,range,value){ sh(sheet).getRange(range).setValue(value); }
function appendRow(sheet,array){ sh(sheet).appendRow(array); }

function getProp_(k,def){
  try{ var val=PropertiesService.getScriptProperties().getProperty(k); return val==null?def:val; }
  catch(_){ return def; }
}
function setProp_(k,val){
  try{ PropertiesService.getScriptProperties().setProperty(k,String(val)); }catch(_){}
}
function delProp_(k){
  try{ PropertiesService.getScriptProperties().deleteProperty(k); }catch(_){}
}

function logEvent(code,desc,note){
  try{
    appendRow('Log',[new Date(),String(v('Config','B1')||''),String(code||''),String(desc||''),String(note||'')]);
  }catch(_){}
}

function _numSafe_(x,def){ x=Number(x); return isFinite(x)?x:def; }
function _toDate_(x){ if(x instanceof Date)return x; if(!x)return null; var d=new Date(String(x)); return isNaN(d)?null:d; }
function _minutesAgo_(d){ var dd=_toDate_(d); if(!dd)return 9999; return (Date.now()-dd.getTime())/60000; }

function sh(n){ return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(n); }
function v(s,c){ return sh(s).getRange(c).getValue(); }
function s(sht,c,vv){ sh(sht).getRange(c).setValue(vv); }
function logEvent(c,d){ sh('Log').appendRow([new Date(),c,d]); }

function isTrue(vv){
  return String(vv).toLowerCase().trim() === 'true';
}

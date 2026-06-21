function sh(n){ return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(n); }
function v(s,c){ return sh(s).getRange(c).getValue(); }
function s(sht,c,vv){ sh(sht).getRange(c).setValue(vv); }
function logEvent(c,d){ sh('Log').appendRow([new Date(),c,d]); }

function isTrue(vv){
  return String(vv).toLowerCase().trim() === 'true';
}

// =====================================
// ANTI DUPLICAZIONE EVENTI
// =====================================

function isDuplicateEvent(key, seconds) {

  seconds = seconds || 10;

  var p = PropertiesService.getScriptProperties();

  var last =
    Number(
      p.getProperty('DEDUP_' + key) || 0
    );

  var now = Date.now();

  if (
    last &&
    (now - last) < seconds * 1000
  ) {
    return true;
  }

  p.setProperty(
    'DEDUP_' + key,
    String(now)
  );

  return false;
}

// ============================================================
// 02_config.gs — lettura centralizzata Config sheet
// ============================================================

function getCfg_(row){ return v('Config','B'+row); }

function getStatoCorrente_(){ return String(getCfg_(1)||''); }
function isVacanza_(){ return String(getCfg_(3)).toUpperCase()==='TRUE'; }
function isOverride_(){ return String(getCfg_(4)).toUpperCase()==='TRUE'; }

function getStrictLifeMin_(){ return _numSafe_(getCfg_(9),  20); }
function getMorningHoldMin_(){ return _numSafe_(getCfg_(10), 30); }
function getExitGuardMin_(){   return _numSafe_(getCfg_(12), 10); }
function getExitConfirmMin_(){ return _numSafe_(getCfg_(13),  5); }
function getLogRetentionDays_(){ return _numSafe_(getCfg_(14),10); }
function getLifeTimeoutMin_(){ return _numSafe_(getCfg_(15), 40); }
function getDebounceInMin_(){  return _numSafe_(getCfg_(16),  2); }
function getDebounceOutMin_(){ return _numSafe_(getCfg_(17), 12); }
function getEmptyGraceMin_(){  return _numSafe_(getCfg_(18),  7); }
function getPianteMinIntervalMin_(){ return _numSafe_(getCfg_(19),60); }
function getPianteEnabled_(){ return String(getCfg_(20)).toUpperCase()!=='FALSE'; }
function getAlzaCon_(){ return String(getCfg_(30)||'ARRIVO').toUpperCase(); }
function getIftttBufferMin_(){ return _numSafe_(getCfg_(25), 8); }
function getExitCooldownMin_(){ return _numSafe_(getCfg_(26), 15); }

// Buffer minuti dopo il tramonto prima di considerare "notte" (default 90)
function getNightBufferMin_(){ return _numSafe_(getCfg_(27), 90); }

// isNight: notte = (tramonto + buffer) oppure prima dell'alba
// Fallback orario: 22:30 - 07:00
function isNight(){
  try{
    var alba=v('Stato','B3'), tram=v('Stato','B4'), now=new Date();
    if(alba instanceof Date && tram instanceof Date){
      var bufMin = getNightBufferMin_();
      var notteStart = new Date(tram.getTime() + bufMin * 60000);
      return (now >= notteStart) || (now < alba);
    }
  }catch(_){}
  var h=new Date().getHours(), m=new Date().getMinutes();
  return (h > 22 || (h === 22 && m >= 30) || h < 7);
}

function isQuietHours_(d){
  d=d||new Date(); var h=d.getHours(); return (h>=22||h<8);
}
function isFeriale_(d){
  d=d||new Date(); var dow=d.getDay();
  return (dow>=1&&dow<=5)&&!isItalianHoliday_(d);
}
function isItalianHoliday_(d){
  try{
    var CAL='it.italian#holiday@group.v.calendar.google.com';
    var cal=CalendarApp.getCalendarById(CAL); if(!cal)return false;
    var start=new Date(d.getFullYear(),d.getMonth(),d.getDate(),0,0,0);
    var end=new Date(d.getFullYear(),d.getMonth(),d.getDate(),23,59,59);
    var evs=cal.getEvents(start,end); return !!(evs&&evs.length>0);
  }catch(_){ return false; }
}

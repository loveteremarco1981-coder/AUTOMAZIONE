// ============================================================
// setup_cruscotto.gs v3
// ============================================================

function setupAll_() {
  deleteUnusedSheets_();
  setupCruscotto_();
  setupConfigFormat_();
  setupStatoFormat_();
  SpreadsheetApp.getUi().alert('Setup completato!');
}

function deleteUnusedSheets_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  ['Foglio1','VIMAR','Diagnostica'].forEach(function(n) {
    var s = ss.getSheetByName(n); if(s) ss.deleteSheet(s);
  });
}

function setupCruscotto_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName('CRUSCOTTO') || ss.insertSheet('CRUSCOTTO');
  sh.clear(); sh.clearConditionalFormatRules();
  sh.setTabColor('#1a73e8');
  sh.setColumnWidth(1, 240); sh.setColumnWidth(2, 220); sh.setColumnWidth(3, 200);

  var static_vals = [
    [1,1,'🏠 CRUSCOTTO CASA'],
    [3,1,'STATO SISTEMA'],
    [4,1,'Stato attuale'],[5,1,'Presenza effettiva'],[6,1,'Notte / Giorno'],
    [7,1,'Override'],[8,1,'Vacanza'],[9,1,'Ultimo aggiornamento'],
    [11,1,'SOLE'],[12,1,'Alba oggi'],[13,1,'Tramonto oggi'],
    [15,1,'PERSONE'],
    [16,1,'Marco'],[17,1,'Silvia'],[18,1,'Viola'],[19,1,'Samuele'],
    [21,1,'PIANTE'],[22,1,'Prossimo run'],[23,1,'Min intervallo (min)'],
    [24,1,'Alza con'],
    [26,1,'CONFIG CHIAVE'],
    [27,1,'STRICT_LIFE_MIN'],[27,3,'Ping recente per IN (min)'],
    [28,1,'EXIT_GUARD_MIN'],[28,3,'Guard uscita (min)'],
    [29,1,'LIFE_TIMEOUT_MIN'],[29,3,'Timeout auto-OUT (min)'],
    [30,1,'NIGHT_BUFFER_MIN'],[30,3,'Buffer tramonto→notte (min, default 90)'],
    [31,1,'LOG_RETENTION_DAYS'],[31,3,'Retention log (giorni)'],
    [33,1,'LINK RAPIDI'],
    [34,1,'IFTTT Activity'],[34,2,'https://ifttt.com/activity'],
    [35,1,'Apps Script'],[35,2,'https://script.google.com'],
    [36,1,'GitHub'],[36,2,'https://github.com/loveteremarco1981-coder/AUTOMAZIONE'],
    [37,1,'App Casa'],[37,2,'https://loveteremarco1981-coder.github.io/AUTOMAZIONE/'],
  ];
  static_vals.forEach(function(v){ sh.getRange(v[0],v[1]).setValue(v[2]); });

  sh.getRange('B4').setFormula('=Config!B1');
  sh.getRange('B5').setFormula('=IF(Config!B6;"SI";"NO")');
  sh.getRange('B6').setFormula('=Stato!B6');
  sh.getRange('B7').setFormula('=IF(Config!B4;"ATTIVO";"OFF")');
  sh.getRange('B8').setFormula('=IF(Config!B3;"ATTIVO";"OFF")');
  sh.getRange('B9').setFormula('=Stato!B5');
  sh.getRange('B12').setFormula('=IF(Stato!B3<>"";TEXT(Stato!B3;"HH:mm");"--")');
  sh.getRange('B13').setFormula('=IF(Stato!B4<>"";TEXT(Stato!B4;"HH:mm");"--")');
  sh.getRange('B16').setFormula('=IF(Persone!F2="IN";"IN CASA";"FUORI")');
  sh.getRange('B17').setFormula('=IF(Persone!F3="IN";"IN CASA";"FUORI")');
  sh.getRange('B18').setFormula('=IF(Persone!F4="IN";"IN CASA";"FUORI")');
  sh.getRange('B19').setFormula('=IF(Persone!F5="IN";"IN CASA";"FUORI")');
  sh.getRange('C16').setFormula('=IF(Persone!E2<>"";TEXT(Persone!E2;"dd/MM HH:mm");"--")');
  sh.getRange('C17').setFormula('=IF(Persone!E3<>"";TEXT(Persone!E3;"dd/MM HH:mm");"--")');
  sh.getRange('C18').setFormula('=IF(Persone!E4<>"";TEXT(Persone!E4;"dd/MM HH:mm");"--")');
  sh.getRange('C19').setFormula('=IF(Persone!E5<>"";TEXT(Persone!E5;"dd/MM HH:mm");"--")');
  sh.getRange('B22').setFormula('=IF(Stato!B10<>"";TEXT(Stato!B10;"dd/MM HH:mm");"--")');
  sh.getRange('B23').setFormula('=Config!B19');
  sh.getRange('B24').setFormula('=Config!B30');
  sh.getRange('B27').setFormula('=Config!B9');
  sh.getRange('B28').setFormula('=Config!B12');
  sh.getRange('B29').setFormula('=Config!B15');
  sh.getRange('B30').setFormula('=Config!B27');
  sh.getRange('B31').setFormula('=Config!B14');

  sh.getRange('A1').setFontSize(16).setFontWeight('bold').setFontColor('#1a73e8');
  sh.setRowHeight(1, 40);
  [3,11,15,21,26,33].forEach(function(r){
    sh.getRange(r,1,1,3).setBackground('#1a73e8').setFontColor('#ffffff').setFontWeight('bold');
  });
  [4,5,6,7,8,9,12,13,16,17,18,19,22,23,24,27,28,29,30,31,34,35,36,37].forEach(function(r){
    sh.getRange(r,1,1,3).setBackground(r%2===0?'#f8f9fa':'#ffffff');
  });
  sh.getRange('A1:A40').setFontWeight('bold');

  var rules = [];
  rules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenTextEqualTo('ATTIVO').setBackground('#fce8e6').setFontColor('#d93025')
    .setRanges([sh.getRange('B7:B8')]).build());
  rules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenTextEqualTo('IN CASA').setBackground('#e6f4ea').setFontColor('#137333')
    .setRanges([sh.getRange('B16:B19')]).build());
  rules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenTextEqualTo('FUORI').setFontColor('#80868b')
    .setRanges([sh.getRange('B16:B19')]).build());
  sh.setConditionalFormatRules(rules);
  sh.getRange('A1:C37').setBorder(false,false,false,false,true,false,'#e0e0e0',SpreadsheetApp.BorderStyle.SOLID);
  sh.setFrozenColumns(1);
}

function setupConfigFormat_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName('Config'); if(!sh) return;
  sh.setTabColor('#34a853');
  sh.setColumnWidth(1,220); sh.setColumnWidth(2,160);
  sh.getRange('A1:B1').setFontWeight('bold').setBackground('#34a853').setFontColor('#ffffff');
  var rules = sh.getConditionalFormatRules();
  rules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenTextEqualTo('TRUE').setBackground('#fce8e6').setFontColor('#d93025')
    .setRanges([sh.getRange('B4')]).build());
  sh.setConditionalFormatRules(rules);
}

function setupStatoFormat_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName('Stato'); if(!sh) return;
  sh.setTabColor('#fbbc04');
  sh.setColumnWidth(1,200); sh.setColumnWidth(2,200);
}

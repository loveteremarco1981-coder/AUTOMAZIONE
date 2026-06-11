// ============================================================
// setup_cruscotto.gs v4 — allineato a 4 comandi iOS
// Rimossi: STRICT_LIFE_MIN, EXIT_GUARD_MIN, LIFE_TIMEOUT_MIN, NIGHT_BUFFER_MIN
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
    [27,1,'PIANTE_MIN_INTERVAL'],[27,3,'Minuti min tra run piante'],
    [28,1,'PIANTE_ENABLED'],[28,3,'Abilita irrigazione (TRUE/FALSE)'],
    [29,1,'LOG_RETENTION_DAYS'],[29,3,'Retention log (giorni)'],
    [30,1,'ALZA_CON'],[30,3,'ARRIVO / PIANTE / MAI'],
    [32,1,'4 COMANDI iOS'],
    [33,1,'ssid_on'],[33,3,'Wi-Fi connesso → IN immediato'],
    [34,1,'ssid_off'],[34,3,'Wi-Fi disconnesso → solo log'],
    [35,1,'mark_out'],[35,3,'Geofence uscita → OUT immediato'],
    [36,1,'mark_in'],[36,3,'Geofence entrata → IN immediato'],
    [38,1,'LINK RAPIDI'],
    [39,1,'IFTTT Activity'],[39,2,'https://ifttt.com/activity'],
    [40,1,'Apps Script'],[40,2,'https://script.google.com'],
    [41,1,'GitHub'],[41,2,'https://github.com/loveteremarco1981-coder/AUTOMAZIONE'],
    [42,1,'App Casa'],[42,2,'https://loveteremarco1981-coder.github.io/AUTOMAZIONE/'],
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
  sh.getRange('B27').setFormula('=Config!B19');
  sh.getRange('B28').setFormula('=Config!B20');
  sh.getRange('B29').setFormula('=Config!B14');
  sh.getRange('B30').setFormula('=Config!B30');

  sh.getRange('A1').setFontSize(16).setFontWeight('bold').setFontColor('#1a73e8');
  sh.setRowHeight(1, 40);
  [3,11,15,21,26,32,38].forEach(function(r){
    sh.getRange(r,1,1,3).setBackground('#1a73e8').setFontColor('#ffffff').setFontWeight('bold');
  });
  [4,5,6,7,8,9,12,13,16,17,18,19,22,23,24,27,28,29,30,33,34,35,36,39,40,41,42].forEach(function(r){
    sh.getRange(r,1,1,3).setBackground(r%2===0?'#f8f9fa':'#ffffff');
  });
  sh.getRange('A1:A42').setFontWeight('bold');

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
  sh.getRange('A1:C42').setBorder(false,false,false,false,true,false,'#e0e0e0',SpreadsheetApp.BorderStyle.SOLID);
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

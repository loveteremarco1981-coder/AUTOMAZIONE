// ============================================================
// setup_cruscotto.gs — Cruscotto + pulizia fogli
// VERSIONE CORRETTA: usa setFormula() per evitare problemi locale IT
// Esegui: setupAll_() una volta sola
// ============================================================

function setupAll_() {
  deleteUnusedSheets_();
  setupCruscotto_();
  setupConfigFormat_();   // solo formattazione, NON sovrascrive B1
  setupStatoFormat_();
  SpreadsheetApp.getUi().alert(
    '✅ Setup completato!\n\n' +
    '• Fogli inutili eliminati\n' +
    '• CRUSCOTTO ricostruito con formule corrette\n' +
    '• Config e Stato riformattati'
  );
}

// ---------- Elimina fogli inutili ----------
function deleteUnusedSheets_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  ['Foglio1','VIMAR','Diagnostica'].forEach(function(name) {
    var sh = ss.getSheetByName(name);
    if (sh) { ss.deleteSheet(sh); }
  });
}

// ---------- CRUSCOTTO ----------
function setupCruscotto_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName('CRUSCOTTO') || ss.insertSheet('CRUSCOTTO');
  sh.clear();
  sh.setTabColor('#1a73e8');
  sh.setColumnWidth(1, 240);
  sh.setColumnWidth(2, 220);
  sh.setColumnWidth(3, 200);

  // ---- Struttura etichette ----
  var labels = [
    [1,  'A', '🏠 CRUSCOTTO CASA', null, null],
    [2,  'A', '', null, null],
    [3,  'A', '═══ STATO SISTEMA ═══', null, null],
    [4,  'A', 'Stato attuale',        'B', '=Config!B1'],
    [5,  'A', 'Presenza effettiva',   'B', null],   // setFormula separato
    [6,  'A', 'Notte / Giorno',       'B', '=Stato!B6'],
    [7,  'A', 'Override',             'B', null],
    [8,  'A', 'Vacanza',              'B', null],
    [9,  'A', 'Ultimo aggiornamento', 'B', '=Stato!B5'],
    [10, 'A', '', null, null],
    [11, 'A', '═══ SOLE ═══',         null, null],
    [12, 'A', 'Alba oggi',            'B', null],
    [13, 'A', 'Tramonto oggi',        'B', null],
    [14, 'A', '', null, null],
    [15, 'A', '═══ PERSONE ═══',      null, null],
    [16, 'A', 'Marco',   'B', null, 'C', null],
    [17, 'A', 'Silvia',  'B', null, 'C', null],
    [18, 'A', 'Viola',   'B', null, 'C', null],
    [19, 'A', 'Samuele', 'B', null, 'C', null],
    [20, 'A', '', null, null],
    [21, 'A', '═══ PIANTE ═══', null, null],
    [22, 'A', 'Prossimo run',         'B', null],
    [23, 'A', 'Min intervallo (min)', 'B', '=Config!B19'],
    [24, 'A', 'Alza con',             'B', '=Config!B30'],
    [25, 'A', '', null, null],
    [26, 'A', '═══ CONFIG CHIAVE ═══', null, null],
    [27, 'A', 'STRICT_LIFE_MIN',      'B', '=Config!B9',  'C', 'Ping recente per IN (min)'],
    [28, 'A', 'EXIT_GUARD_MIN',       'B', '=Config!B12', 'C', 'Guard uscita (min)'],
    [29, 'A', 'LIFE_TIMEOUT_MIN',     'B', '=Config!B15', 'C', 'Timeout auto-OUT (min)'],
    [30, 'A', 'EXIT_COOLDOWN_MIN',    'B', '=Config!B26', 'C', 'Cooldown post-uscita (min)'],
    [31, 'A', 'LOG_RETENTION_DAYS',   'B', '=Config!B14', 'C', 'Retention log (giorni)'],
    [32, 'A', '', null, null],
    [33, 'A', '═══ LINK RAPIDI ═══', null, null],
    [34, 'A', 'IFTTT Activity',  'B', 'https://ifttt.com/activity'],
    [35, 'A', 'Apps Script',     'B', 'https://script.google.com'],
    [36, 'A', 'GitHub',          'B', 'https://github.com/loveteremarco1981-coder/AUTOMAZIONE'],
    [37, 'A', 'App Casa',        'B', 'https://loveteremarco1981-coder.github.io/AUTOMAZIONE/'],
  ];

  // Scrivi etichette e valori semplici
  labels.forEach(function(row) {
    var r = row[0];
    if (row[1] && row[2] !== null) sh.getRange(r, 1).setValue(row[2]);
    if (row[3] && row[4] !== null) sh.getRange(r, 2).setValue(row[4]);
    if (row.length > 5 && row[5] && row[6] !== null) sh.getRange(r, 3).setValue(row[6]);
  });

  // ---- Formule con setFormula() — usa sempre virgole (locale EN) ----
  sh.getRange('B5').setFormula('=IF(Config!B6,"✅ IN CASA","⬜ VUOTA")');
  sh.getRange('B7').setFormula('=IF(Config!B4,"🔴 ATTIVO","✅ OFF")');
  sh.getRange('B8').setFormula('=IF(Config!B3,"🏝️ ATTIVO","✅ OFF")');
  sh.getRange('B12').setFormula('=TEXT(Stato!B3,"HH:mm")');
  sh.getRange('B13').setFormula('=TEXT(Stato!B4,"HH:mm")');
  sh.getRange('B16').setFormula('=IF(Persone!F2="IN","🟢 IN CASA","⚪ FUORI")');
  sh.getRange('C16').setFormula('=TEXT(Persone!E2,"dd/MM HH:mm")');
  sh.getRange('B17').setFormula('=IF(Persone!F3="IN","🟢 IN CASA","⚪ FUORI")');
  sh.getRange('C17').setFormula('=TEXT(Persone!E3,"dd/MM HH:mm")');
  sh.getRange('B18').setFormula('=IF(Persone!F4="IN","🟢 IN CASA","⚪ FUORI")');
  sh.getRange('C18').setFormula('=TEXT(Persone!E4,"dd/MM HH:mm")');
  sh.getRange('B19').setFormula('=IF(Persone!F5="IN","🟢 IN CASA","⚪ FUORI")');
  sh.getRange('C19').setFormula('=TEXT(Persone!E5,"dd/MM HH:mm")');
  sh.getRange('B22').setFormula('=TEXT(Stato!B10,"dd/MM HH:mm")');

  // ---- Formattazione ----
  // Titolo
  sh.getRange('A1').setFontSize(16).setFontWeight('bold').setFontColor('#1a73e8');
  sh.setRowHeight(1, 40);

  // Sezioni header
  [3,11,15,21,26,33].forEach(function(r) {
    sh.getRange(r,1,1,3)
      .setBackground('#1a73e8')
      .setFontColor('#ffffff')
      .setFontWeight('bold');
  });

  // Alternanza righe dati
  var dataRows = [4,5,6,7,8,9, 12,13, 16,17,18,19, 22,23,24, 27,28,29,30,31, 34,35,36,37];
  dataRows.forEach(function(r) {
    var bg = (r % 2 === 0) ? '#f8f9fa' : '#ffffff';
    sh.getRange(r,1,1,3).setBackground(bg);
  });

  // Colonna A grassetto
  sh.getRange('A1:A40').setFontWeight('bold');

  // Colore condizionale: Override rosso se ATTIVO
  var rules = sh.getConditionalFormatRules();
  rules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenTextContains('ATTIVO')
    .setBackground('#fce8e6').setFontColor('#d93025')
    .setRanges([sh.getRange('B7')])
    .build());
  // Verde se in casa
  rules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenTextContains('IN CASA')
    .setBackground('#e6f4ea').setFontColor('#137333')
    .setRanges([sh.getRange('B16:B19')])
    .build());
  sh.setConditionalFormatRules(rules);

  // Bordi
  sh.getRange('A1:C37').setBorder(false,false,false,false,true,false,'#e0e0e0',SpreadsheetApp.BorderStyle.SOLID);
  sh.setFrozenColumns(1);
}

// ---------- Config — solo formattazione, NON tocca B1 ----------
function setupConfigFormat_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName('Config');
  if (!sh) return;
  sh.setTabColor('#34a853');
  sh.setColumnWidth(1, 220);
  sh.setColumnWidth(2, 160);

  // Intestazione riga 1: solo formattazione
  sh.getRange('A1:B1')
    .setFontWeight('bold')
    .setBackground('#34a853')
    .setFontColor('#ffffff');
  // NON scrivere su B1 — è il valore stato gestito dal backend

  // Override in rosso se TRUE
  var rules = sh.getConditionalFormatRules();
  rules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenTextEqualTo('TRUE')
    .setBackground('#fce8e6').setFontColor('#d93025')
    .setRanges([sh.getRange('B4')])
    .build());
  sh.setConditionalFormatRules(rules);
}

// ---------- Stato — solo formattazione ----------
function setupStatoFormat_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName('Stato');
  if (!sh) return;
  sh.setTabColor('#fbbc04');
  sh.setColumnWidth(1, 200);
  sh.setColumnWidth(2, 200);
}

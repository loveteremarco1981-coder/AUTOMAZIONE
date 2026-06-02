// ============================================================
// setup_cruscotto.gs — Pulizia fogli + CRUSCOTTO professionale
// Esegui: setupAll_() una volta sola
// ============================================================

function setupAll_() {
  deleteUnusedSheets_();
  setupCruscotto_();
  setupConfig_();
  setupStato_();
  SpreadsheetApp.getUi().alert(
    '✅ Setup completato!\n\n' +
    '• Foglio1 e VIMAR eliminati\n' +
    '• CRUSCOTTO aggiornato\n' +
    '• Config e Stato riformattati\n\n' +
    '⚠️ RICORDA: disattiva OVERRIDE in Config!B4'
  );
}

// ---------- Elimina fogli inutili ----------
function deleteUnusedSheets_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  ['Foglio1', 'VIMAR', 'Diagnostica'].forEach(function(name) {
    var sh = ss.getSheetByName(name);
    if (sh) { ss.deleteSheet(sh); Logger.log('Eliminato: ' + name); }
  });
}

// ---------- CRUSCOTTO ----------
function setupCruscotto_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName('CRUSCOTTO') || ss.insertSheet('CRUSCOTTO');
  sh.clear();
  sh.setTabColor('#1a73e8');

  // Larghezze colonne
  sh.setColumnWidth(1, 260);
  sh.setColumnWidth(2, 220);
  sh.setColumnWidth(3, 220);

  var rows = [
    // Titolo
    ['🏠 CRUSCOTTO CASA', '', ''],
    ['', '', ''],

    // Sezione Stato
    ['═══ STATO SISTEMA ═══', '', ''],
    ['Stato attuale',        "=Config!B1",                  ''],
    ['Presenza effettiva',   "=IF(Config!B6,\"✅ IN CASA\",\"⬜ VUOTA\")", ''],
    ['Notte / Giorno',       "=Stato!B6",                   ''],
    ['Override',             "=IF(Config!B4,\"🔴 ATTIVO\",\"✅ OFF\")", ''],
    ['Vacanza',              "=IF(Config!B3,\"🏝️ ATTIVO\",\"✅ OFF\")", ''],
    ['Ultimo aggiornamento', "=Stato!B5",                   ''],
    ['', '', ''],

    // Sezione Sole
    ['═══ SOLE ═══', '', ''],
    ['Alba oggi',            "=TEXT(Stato!B3,\"HH:mm\")",  ''],
    ['Tramonto oggi',        "=TEXT(Stato!B4,\"HH:mm\")",  ''],
    ['', '', ''],

    // Sezione Persone
    ['═══ PERSONE ═══', '', ''],
    ['Marco',    "=IF(Persone!F2=\"IN\",\"🟢 IN CASA\",\"⚪ FUORI\")", "=TEXT(Persone!E2,\"dd/MM HH:mm\")"],
    ['Silvia',   "=IF(Persone!F3=\"IN\",\"🟢 IN CASA\",\"⚪ FUORI\")", "=TEXT(Persone!E3,\"dd/MM HH:mm\")"],
    ['Viola',    "=IF(Persone!F4=\"IN\",\"🟢 IN CASA\",\"⚪ FUORI\")", "=TEXT(Persone!E4,\"dd/MM HH:mm\")"],
    ['Samuele',  "=IF(Persone!F5=\"IN\",\"🟢 IN CASA\",\"⚪ FUORI\")", "=TEXT(Persone!E5,\"dd/MM HH:mm\")"],
    ['', '', ''],

    // Sezione Piante
    ['═══ PIANTE ═══', '', ''],
    ['Prossimo run',         "=TEXT(Stato!B10,\"dd/MM HH:mm\")", ''],
    ['Min intervallo (min)', "=Config!B19",                ''],
    ['Alza con',             "=Config!B30",                ''],
    ['', '', ''],

    // Sezione Config chiave
    ['═══ CONFIG CHIAVE ═══', '', ''],
    ['STRICT_LIFE_MIN',      "=Config!B9",   'Ping recente per IN (min)'],
    ['EXIT_GUARD_MIN',       "=Config!B12",  'Guard uscita (min)'],
    ['LIFE_TIMEOUT_MIN',     "=Config!B15",  'Timeout auto-OUT (min)'],
    ['EXIT_COOLDOWN_MIN',    "=Config!B26",  'Cooldown post-uscita (min)'],
    ['LOG_RETENTION_DAYS',   "=Config!B14",  'Retention log (giorni)'],
    ['', '', ''],

    // Link rapidi
    ['═══ LINK RAPIDI ═══', '', ''],
    ['IFTTT Activity', 'https://ifttt.com/activity', ''],
    ['Apps Script',    'https://script.google.com', ''],
    ['GitHub',         'https://github.com/loveteremarco1981-coder/AUTOMAZIONE', ''],
    ['App Casa',       'https://loveteremarco1981-coder.github.io/AUTOMAZIONE/', ''],
  ];

  // Scrivi dati
  rows.forEach(function(row, i) {
    var r = sh.getRange(i+1, 1, 1, 3);
    r.setValues([row]);
  });

  // Formattazione titolo
  var title = sh.getRange('A1');
  title.setFontSize(16).setFontWeight('bold').setFontColor('#1a73e8');
  sh.setRowHeight(1, 40);

  // Formattazione intestazioni sezioni
  var sectionRows = [3, 11, 15, 21, 26, 33];
  sectionRows.forEach(function(r) {
    var cell = sh.getRange(r, 1);
    cell.setFontWeight('bold').setFontColor('#ffffff').setBackground('#1a73e8');
    sh.getRange(r, 1, 1, 3).setBackground('#1a73e8').setFontColor('#ffffff').setFontWeight('bold');
  });

  // Sfondo alternato righe dati
  var dataRanges = [
    [4,6],[12,13],[16,19],[22,24],[27,31],[34,37]
  ];
  var colors = ['#f8f9fa', '#ffffff'];
  dataRanges.forEach(function(range) {
    for (var r = range[0]; r <= range[1]; r++) {
      var color = (r % 2 === 0) ? colors[0] : colors[1];
      sh.getRange(r, 1, 1, 3).setBackground(color);
    }
  });

  // Colonna A in grassetto
  sh.getRange('A1:A40').setFontWeight('bold');

  // Colori condizionali per stato
  // Override rosso se attivo
  sh.getRange('B8').setFontColor('#d93025'); // override sempre rosso finché attivo

  // Bordi
  sh.getRange('A1:C37').setBorder(false, false, false, false, true, false,
    '#e0e0e0', SpreadsheetApp.BorderStyle.SOLID);

  // Freeze prima colonna
  sh.setFrozenColumns(1);

  Logger.log('CRUSCOTTO setup completato');
}

// ---------- Config — formattazione ----------
function setupConfig_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName('Config');
  if (!sh) return;
  sh.setTabColor('#34a853');
  sh.setColumnWidth(1, 220);
  sh.setColumnWidth(2, 160);

  // Intestazioni
  sh.getRange('A1').setValue('PARAMETRO');
  sh.getRange('B1').setValue('VALORE');
  sh.getRange('A1:B1').setFontWeight('bold').setBackground('#34a853').setFontColor('#ffffff');

  // Colore rosso su B4 (Override) se TRUE
  var rules = sh.getConditionalFormatRules();
  var ruleOverride = SpreadsheetApp.newConditionalFormatRule()
    .whenTextEqualTo('TRUE')
    .setBackground('#fce8e6')
    .setFontColor('#d93025')
    .setRanges([sh.getRange('B4')])
    .build();
  rules.push(ruleOverride);
  sh.setConditionalFormatRules(rules);

  Logger.log('Config formattato');
}

// ---------- Stato — formattazione ----------
function setupStato_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName('Stato');
  if (!sh) return;
  sh.setTabColor('#fbbc04');
  sh.setColumnWidth(1, 200);
  sh.setColumnWidth(2, 200);
  Logger.log('Stato formattato');
}

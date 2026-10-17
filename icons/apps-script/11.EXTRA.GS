/**
 * ============================================================
 *  CASA · AUTOMAZIONE — funzioni extra (file "11.EXTRA.GS")
 *  - storico per i grafici (foglio "Storico", ogni 15 minuti)
 *  - conteggio vero degli errori delle ultime 24 ore
 *  - orari tapparelle modificabili dall'app
 *  - notifiche via email (ingressi, uscite, errori)
 *  La doGet in 10.WEBAPP.GS le chiama già: qui non serve altro.
 * ============================================================
 */

var EXTRA_ = {
  SHEET_STORICO: 'Storico',
  MAX_RIGHE: 3000,                 // circa 30 giorni a un rilevamento ogni 15 minuti
  ORE_ERRORI: 24,
  EMAIL: ''                        // vuoto = l'email dell'account che esegue lo script
};

/* ------------------------------------------------------------
   Utilità: legge il modello o i log chiamando la tua stessa doGet
   (così non dipende dai nomi interni delle tue funzioni)
   ------------------------------------------------------------ */
function leggiJson_(params) {
  var props = PropertiesService.getScriptProperties();
  params = params || {};
  params.key = props.getProperty('APP_KEY');
  var out = doGet({ parameter: params });
  var txt = out.getContent();
  var m = /^[\w$.]*\(([\s\S]*)\)\s*;?\s*$/.exec(txt);
  return JSON.parse(m ? m[1] : txt);
}

/* ------------------------------------------------------------
   2) STORICO — una riga ogni 15 minuti: ora, temperatura, umidità, n. persone, nomi
   ------------------------------------------------------------ */
function attivaStorico() {                       // da eseguire UNA volta
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'registraStorico_') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('registraStorico_').timeBased().everyMinutes(15).create();
  registraStorico_();
}

function foglioStorico_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(EXTRA_.SHEET_STORICO);
  if (!sh) {
    sh = ss.insertSheet(EXTRA_.SHEET_STORICO);
    sh.appendRow(['ora', 'temperatura', 'umidita', 'persone', 'nomi']);
    sh.setFrozenRows(1);
  }
  return sh;
}

function registraStorico_() {
  var m = leggiJson_({});
  var w = m.weather || {};
  var nomi = (m.people || []).filter(function (x) { return x.onlineSmart; }).map(function (x) { return x.name; });
  var sh = foglioStorico_();
  sh.appendRow([new Date(), w.tempC == null ? '' : w.tempC, w.humidity == null ? '' : w.humidity, nomi.length, nomi.join(',')]);
  var n = sh.getLastRow();
  if (n > EXTRA_.MAX_RIGHE + 200) sh.deleteRows(2, n - EXTRA_.MAX_RIGHE);   // tiene solo le righe recenti
}

function storicoJson_(p) {
  var giorni = Math.max(1, Math.min(30, Number(p.days) || 2));
  var da = Date.now() - giorni * 864e5;
  var sh = foglioStorico_();
  var n = sh.getLastRow();
  if (n < 2) return { ok: true, rows: [] };
  var start = Math.max(2, n - giorni * 96 - 4);   // 96 righe al giorno
  var vals = sh.getRange(start, 1, n - start + 1, 5).getValues();
  var rows = [];
  vals.forEach(function (r) {
    var t = r[0] instanceof Date ? r[0] : new Date(r[0]);
    if (isNaN(t) || t.getTime() < da) return;
    rows.push([t.toISOString(), r[1], r[2], r[3], r[4]]);
  });
  return { ok: true, rows: rows };
}

/* ------------------------------------------------------------
   3) ERRORI — conteggio vero delle ultime 24 ore (in cache 5 minuti)
   ------------------------------------------------------------ */
function eErrore_(x) {
  return /err|fail|timeout|exception/i.test(String((x && x.code) || '')) ||
    /(^|[^a-z])(error|errore|failed|fail|timeout|exception)([^a-z]|$)|HTTP_[45]\d\d/i.test(String((x && x.desc) || ''));
}
function erroriRecenti_() {
  var d = leggiJson_({ logs: '1' });
  var da = Date.now() - EXTRA_.ORE_ERRORI * 36e5;
  return (d.logs || []).filter(function (x) {
    var t = new Date(x.ts);
    return !isNaN(t) && t.getTime() >= da && eErrore_(x);
  });
}
function contaErroriRecenti_() {
  var cache = CacheService.getScriptCache();
  var c = cache.get('logErrors24');
  if (c !== null) return Number(c);
  var n = 0;
  try { n = erroriRecenti_().length; } catch (e) { n = 0; }
  cache.put('logErrors24', String(n), 300);
  return n;
}

/* ------------------------------------------------------------
   4) ORARI TAPPARELLE — salvati nello script, validi per tutta la casa
   ------------------------------------------------------------ */
function leggiOrariTapparelle_() {
  var props = PropertiesService.getScriptProperties();
  var o = props.getProperty('SCHED_OPEN'), c = props.getProperty('SCHED_CLOSE');
  return (o && c) ? { open: o, close: c } : null;
}
function impostaOrari_(p) {
  var props = PropertiesService.getScriptProperties();
  if (p.open === 'auto' || p.close === 'auto') {
    props.deleteProperty('SCHED_OPEN'); props.deleteProperty('SCHED_CLOSE');
    return { ok: true };
  }
  var re = /^([01]?\d|2[0-3]):[0-5]\d$/;
  if (!re.test(String(p.open)) || !re.test(String(p.close))) return { ok: false, error: 'orario non valido' };
  props.setProperty('SCHED_OPEN', String(p.open));
  props.setProperty('SCHED_CLOSE', String(p.close));
  return { ok: true };
}

/* ------------------------------------------------------------
   5) NOTIFICHE via email (arrivano come notifica sull'iPhone con Mail o Gmail)
   Controlla ogni 5 minuti: chi è entrato/uscito e se ci sono errori nuovi.
   ------------------------------------------------------------ */
function attivaNotifiche() {                      // da eseguire UNA volta
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'controllaNotifiche_') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('controllaNotifiche_').timeBased().everyMinutes(5).create();
  PropertiesService.getScriptProperties().deleteProperty('NOTIFY_PRESENCE');   // riparte da zero senza avvisi vecchi
  PropertiesService.getScriptProperties().deleteProperty('NOTIFY_LAST_ERR');
  controllaNotifiche_();
}
function disattivaNotifiche() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'controllaNotifiche_') ScriptApp.deleteTrigger(t);
  });
}

function inviaAvviso_(oggetto, testo) {
  var a = EXTRA_.EMAIL || Session.getEffectiveUser().getEmail();
  MailApp.sendEmail(a, oggetto, testo);
}

function controllaNotifiche_() {
  var props = PropertiesService.getScriptProperties();

  // Ingressi e uscite
  var m = leggiJson_({});
  var ora = {};
  (m.people || []).forEach(function (x) { ora[x.name] = !!x.onlineSmart; });
  var prima = null;
  try { prima = JSON.parse(props.getProperty('NOTIFY_PRESENCE') || 'null'); } catch (e) {}
  if (prima) {
    Object.keys(ora).forEach(function (n) {
      if (prima[n] !== undefined && prima[n] !== ora[n]) {
        var nome = n.charAt(0).toUpperCase() + n.slice(1);
        inviaAvviso_('Casa · ' + nome + (ora[n] ? ' è entrato' : ' è uscito'),
          nome + (ora[n] ? ' è entrato in casa' : ' è uscito di casa') + ' alle ' +
          Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'HH:mm') + '.');
      }
    });
  }
  props.setProperty('NOTIFY_PRESENCE', JSON.stringify(ora));

  // Errori nuovi nel log
  var errs = erroriRecenti_().sort(function (a, b) { return new Date(b.ts) - new Date(a.ts); });
  if (errs.length) {
    var top = errs[0], chiave = top.ts + '|' + top.code;
    var vista = props.getProperty('NOTIFY_LAST_ERR');
    if (vista === null) {
      props.setProperty('NOTIFY_LAST_ERR', chiave);          // prima esecuzione: memorizza e basta
    } else if (vista !== chiave) {
      props.setProperty('NOTIFY_LAST_ERR', chiave);
      inviaAvviso_('Casa · errore ' + top.code, (top.desc || 'Errore nel log') + '\n' + top.ts);
    }
  } else if (props.getProperty('NOTIFY_LAST_ERR') === null) {
    props.setProperty('NOTIFY_LAST_ERR', '');
  }
}

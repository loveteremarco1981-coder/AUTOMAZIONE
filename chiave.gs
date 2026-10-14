// ============================================================
// Chiave di accesso per il tuo Apps Script
// ============================================================
// 1) Apps Script → Impostazioni progetto (ingranaggio) → Proprietà dello script
//    → Aggiungi proprietà:  nome = APP_KEY   valore = la tua chiave (lunga, casuale)
//    La chiave NON va scritta nel codice né nel repository.
//
// 2) Incolla queste due funzioni in un file del progetto (es. chiave.gs)
//    e, come PRIMA istruzione della tua doGet(e), aggiungi:
//
//        const denied = guardia_(e);
//        if (denied) return denied;
//
// 3) Distribuisci → Gestisci distribuzioni → modifica → Nuova versione.
//    (oppure crea una distribuzione nuova: il vecchio indirizzo smette di funzionare)
// ============================================================

function guardia_(e) {
  const attesa = PropertiesService.getScriptProperties().getProperty('APP_KEY');
  const ricevuta = e && e.parameter ? e.parameter.key : '';
  if (attesa && ricevuta === attesa) return null;      // chiave giusta: prosegui

  // chiave assente o sbagliata: rispondi "unauthorized" nel formato che l'app capisce (JSONP)
  const cb = ((e && e.parameter && e.parameter.callback) || '').replace(/[^\w.]/g, '');
  const corpo = JSON.stringify({ ok: false, error: 'unauthorized' });
  return ContentService
    .createTextOutput(cb ? cb + '(' + corpo + ')' : corpo)
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}

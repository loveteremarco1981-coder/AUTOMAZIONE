'use strict';
/* ============================================================
   COLLEGAMENTI TRA LE SCHEDE
   Qualunque elemento con data-vai="…" porta da un'altra parte:
     tab:<scheda>        apre una scheda (home, devices, people, log, settings)
     log:<filtro>        apre il Log già filtrato (presenze, err, who:<nome>, code:<CODICE>)
     dev:<gruppo>        apre Dispositivi su quel gruppo
     hist:<tipo>         apre l'analisi (temp, heat, hum, pres)
     scene               modifica le scene
     orari               orari delle tapparelle
     termostati          impostazioni dei termostati
   Un solo ascoltatore per tutta la pagina, così vale anche per
   i pezzi disegnati dopo (Home, pannelli, foglio in basso).
   ============================================================ */

function vai(dest) {
  if (!dest) return;
  const [cosa, arg] = dest.split(':');
  const chiudi = () => { if (typeof closeSheet === 'function' && document.body.classList.contains('sheet-open')) closeSheet(); };
  if (cosa === 'tab') { chiudi(); activateTab(arg); return; }
  if (cosa === 'log') {
    chiudi(); _logFilter = dest.slice(4) || 'all'; _logQ = '';
    const q = $('#log-search'); if (q) q.value = '';
    activateTab('log'); drawLogs(); return;
  }
  if (cosa === 'dev') { chiudi(); activateDevices(arg); return; }
  if (cosa === 'hist') {
    if (typeof _hist === 'undefined' || !_hist.ok) { toast('Andamento non ancora disponibile.', 'info', 2500); return; }
    chiudi(); setTimeout(() => openHistDetail(arg), 0); return;
  }
  if (isReadOnly()) { toast('Solo lettura: non puoi cambiare le impostazioni.', 'info', 2500); return; }
  if (cosa === 'scene') { chiudi(); openScenesSheet(); return; }
  if (cosa === 'orari') { chiudi(); openScheduleSheet(MODEL || {}); return; }
  if (cosa === 'termostati') { chiudi(); openTermostatoSheet(MODEL || {}); return; }
}

document.addEventListener('click', e => {
  const el = e.target.closest('[data-vai]');
  if (!el) return;
  e.preventDefault(); e.stopPropagation();
  haptic(); vai(el.dataset.vai);
}, true);

// Riga di collegamenti in fondo a una sezione
function linkBar(voci) {
  return `<div class="link-bar">${voci.map(([dest, icona, testo]) =>
    `<button type="button" class="link-chip" data-vai="${dest}">${svg(icona)}<span>${esc(testo)}</span>${svg('chevron', 'link-go')}</button>`).join('')}</div>`;
}

// Collegamenti fissi nei pannelli (si rimettono a ogni aggiornamento: non costa nulla)
function renderCollegamenti(m) {
  const metti = (sel, voci) => {
    const host = $(sel); if (!host) return;
    let bar = host.querySelector(':scope > .link-bar');
    const html = linkBar(voci);
    if (!bar) { host.insertAdjacentHTML('beforeend', html); return; }
    bar.outerHTML = html;
  };
  const ht = typeof termo === 'function' && termo(m || MODEL || {});
  metti('.dev-panel[data-group="tapparelle"]', [
    ['orari', 'sun', 'Orari automatici'],
    ['tab:home', 'home', 'Comandi rapidi in Home']
  ]);
  metti('.dev-panel[data-group="riscaldamento"]', [
    ['hist:heat', 'thermo', 'Andamento del riscaldamento'],
    ...(ht ? [['termostati', 'moon', 'Fasce e temperature']] : []),
    ['tab:people', 'home', 'Chi è in casa (Comfort o Ridotta)']
  ]);
  metti('.dev-panel[data-group="clima"]', [
    ['hist:temp', 'thermo', 'Temperatura in casa'],
    ['hist:hum', 'cloud', 'Umidità']
  ]);
  metti('#view-people', [
    ['hist:pres', 'home', 'Analisi delle presenze'],
    ['dev:riscaldamento', 'thermo', 'Riscaldamento dei piani'],
    ['log:presenze', 'bell', 'Registro: entrate e uscite']
  ]);
  metti('#view-settings', [
    ['dev:riscaldamento', 'thermo', 'Termostati in Dispositivi'],
    ['dev:tapparelle', 'shutter', 'Tapparelle in Dispositivi'],
    ['tab:people', 'home', 'Persone']
  ]);
}

// Invio / spazio sugli elementi non-pulsante con data-vai (es. la riga "Fuori")
document.addEventListener('keydown', e => {
  if (e.key !== 'Enter' && e.key !== ' ') return;
  const el = e.target.closest && e.target.closest('[data-vai][role="button"]');
  if (el) { e.preventDefault(); vai(el.dataset.vai); }
});

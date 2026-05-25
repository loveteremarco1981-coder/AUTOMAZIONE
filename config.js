// ============================================================
// config.js
// ============================================================
window.CONFIG = {
  DOGET_URL: 'https://script.google.com/macros/s/AKfycbzRf9E4gTCHnq3-9Hm6BPLjIxwuTM5CiawvdbV1zKFfVQew0MWMD-Eq8nTqRW_c67uG/exec',
  AUTO_REFRESH_MS: 60000,
  WEATHER: { lat: 44.7, lon: 10.9, tz: 'Europe/Rome', forceClient: false },
  FAVORITES: [
    { id:'tapparelle', label:'Tapparelle',  subtitle:'Alza / Abbassa',   kind:'toggle', upEvent:'alza_tutto', downEvent:'abbassa_tutto', color:'#e7f2ff' },
    { id:'piante',     label:'Piante',      subtitle:'Irrigazione',      kind:'action', event:'piante',        color:'#e6f8ed' },
    { id:'vacanza',    label:'Vacanza',      subtitle:'Modalità away',    kind:'toggle', stateKey:'vacanza',   toggleEvent:'set_vacanza',  color:'#ece9ff' },
    { id:'override',   label:'Override',    subtitle:'Blocca automaz.',  kind:'toggle', stateKey:'override',  toggleEvent:'set_override', color:'#fff3e0' },
  ],
  PEOPLE: ['marco','silvia','viola','samuele'],
  // hold SSID in minuti — 1380 = 23h, copre tutta la giornata
  SSID_HOLD_MIN: 1380,
};

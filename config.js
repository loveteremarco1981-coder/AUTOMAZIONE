// ============================================================
// config.js — configurazione app
// ============================================================
window.CONFIG = {
  // URL del Web App Apps Script (doGet)
  DOGET_URL: 'https://script.google.com/macros/s/AKfycbzRf9E4gTCHnq3-9Hm6BPLjIxwuTM5CiawvdbV1zKFfVQew0MWMD-Eq8nTqRW_c67uG/exec',

  // Aggiornamento automatico ogni 60 secondi (0 = disabilitato)
  AUTO_REFRESH_MS: 60000,

  // Meteo: usa coordinate del foglio Geo
  WEATHER: {
    lat: 44.7,
    lon: 10.9,
    tz: 'Europe/Rome',
    forceClient: false   // true = ignora meteo dal backend, usa sempre Open-Meteo client
  },

  // Preferiti (ordine e configurazione tile)
  FAVORITES: [
    { id: 'tapparelle', label: 'Tapparelle',   subtitle: 'Alza / Abbassa', kind: 'toggle',  stateKey: null,       upEvent: 'alza_tutto', downEvent: 'abbassa_tutto', color: '#e7f2ff', glyphColor: '#3b82f6' },
    { id: 'piante',     label: 'Piante',        subtitle: 'Irrigazione',   kind: 'action',  event: 'piante',       color: '#e6f8ed', glyphColor: '#16a34a' },
    { id: 'vacanza',    label: 'Vacanza',        subtitle: 'Modalità away', kind: 'toggle',  stateKey: 'vacanza',   toggleEvent: 'set_vacanza', color: '#ece9ff', glyphColor: '#7c3aed' },
    { id: 'override',   label: 'Override',       subtitle: 'Blocca automaz', kind: 'toggle', stateKey: 'override',  toggleEvent: 'set_override', color: '#fff3e0', glyphColor: '#ea580c' },
  ],

  // Nomi persone da mostrare nella tab Persone (se vuoto usa quelli dal modello)
  PEOPLE: ['marco', 'silvia', 'viola', 'samuele'],
};

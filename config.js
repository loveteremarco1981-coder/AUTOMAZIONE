// ============================================================
// config.js
// ============================================================
window.CONFIG = {
  DOGET_URL: 'https://script.google.com/macros/s/AKfycbzRf9E4gTCHnq3-9Hm6BPLjIxwuTM5CiawvdbV1zKFfVQew0MWMD-Eq8nTqRW_c67uG/exec',
  AUTO_REFRESH_MS: 60000,
  WEATHER: { lat: 44.7, lon: 10.9, tz: 'Europe/Rome', forceClient: false },

  FAVORITES: [
    { id:'tapparelle', label:'Tapparelle',  subtitle:'Alza / Abbassa',  kind:'toggle', upEvent:'alza_tutto', downEvent:'abbassa_tutto', color:'#e7f2ff' },
    { id:'piante',     label:'Piante',      subtitle:'Irrigazione',     kind:'action', event:'piante',       color:'#e6f8ed' },
    { id:'vacanza',    label:'Vacanza',     subtitle:'Modalità away',   kind:'toggle', stateKey:'vacanza',   toggleEvent:'set_vacanza',  color:'#ece9ff' },
    { id:'override',   label:'Override',   subtitle:'Blocca automaz.', kind:'toggle', stateKey:'override',  toggleEvent:'set_override', color:'#fff3e0' },
  ],

  PEOPLE: ['marco','silvia','viola','samuele'],
  SSID_HOLD_MIN: 1380,

  // ---- Tab Dispositivi ----
  DEVICES: {

    // App esterne — deep link iOS / fallback web
    APPS: [
      {
        id:       'vimar',
        label:    'Vimar View',
        subtitle: 'Tapparelle · Luci · Termostati',
        icon:     '🏠',
        color:    '#fff3e0',
        // deep link app Vimar View su iOS
        url:      'vimar-view://',
        urlFallback: 'https://apps.apple.com/it/app/vimar-view/id1326139225',
      },
      {
        id:       'clivet',
        label:    'NetHome Plus',
        subtitle: 'Clima · Condizionatori',
        icon:     '❄️',
        color:    '#e3f2fd',
        url:      'nethomeplus://',
        urlFallback: 'https://apps.apple.com/it/app/nethome-plus/id1008001920',
      },
    ],

    // Tapparelle per stanza — comandi via IFTTT
    // Aggiungi/modifica stanze e i nomi degli applet IFTTT corrispondenti
    SHUTTERS: [
      { id:'tutto',      label:'Tutto',         icon:'🏡', upEvent:'alza_tutto',          downEvent:'abbassa_tutto' },
      { id:'soggiorno',  label:'Soggiorno',      icon:'🛋️', upEvent:'alza_soggiorno',     downEvent:'abbassa_soggiorno' },
      { id:'cucina',     label:'Cucina',         icon:'🍳', upEvent:'alza_cucina',         downEvent:'abbassa_cucina' },
      { id:'camera',     label:'Camera',         icon:'🛏️', upEvent:'alza_camera',        downEvent:'abbassa_camera' },
      { id:'studio',     label:'Studio',         icon:'💻', upEvent:'alza_studio',         downEvent:'abbassa_studio' },
    ],
  },
};

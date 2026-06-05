// ============================================================
// config.js
// ============================================================
window.CONFIG = {
  DOGET_URL: 'https://script.google.com/macros/s/AKfycbwQ2ON5nhBrwD4yKvcMmoNFZZoW0TnAy5ge1VhyReZlk6rvk6fzjSuC8sv8nMZD80A2/exec',
  AUTO_REFRESH_MS: 60000,
  WEATHER: { lat: 44.7, lon: 10.9, tz: 'Europe/Rome', forceClient: false },

  FAVORITES: [
    { id:'tapparelle', label:'Tapparelle',  subtitle:'Alza / Abbassa',  kind:'toggle', upEvent:'alza_tutto', downEvent:'abbassa_tutto', color:'#e7f2ff' },
    { id:'piante',     label:'Piante',      subtitle:'Irrigazione',     kind:'action', event:'piante',       color:'#e6f8ed' },
    { id:'vacanza',    label:'Vacanza',     subtitle:'Modalità away',   kind:'toggle', stateKey:'vacanza',   toggleEvent:'set_vacanza',  color:'#ece9ff' },
    { id:'override',   label:'Override',   subtitle:'Blocca automaz.', kind:'toggle', stateKey:'override',  toggleEvent:'set_override', color:'#fff3e0' },
  ],

  PEOPLE: ['marco','silvia','viola','samuele'],
  SSID_HOLD_MIN: 480,  // 8h — evita falsi positivi da ssid_off tardivo

  DEVICES: {

    // App esterne — si aprono direttamente
    APPS: [
      {
        id:       'vimar',
        label:    'Vimar View',
        subtitle: 'Tapparelle · Luci · Termostati',
        icon:     '🏠',
        color:    '#fff3e0',
        // com.vimar.view — apre l'app direttamente se installata
        url:      'com.vimar.view://',
        urlFallback: 'https://apps.apple.com/it/app/vimar-view/id1326139225',
      },
      {
        id:       'clivet',
        label:    'NetHome Plus',
        subtitle: 'Clima · Condizionatori',
        icon:     '❄️',
        color:    '#e3f2fd',
        // com.midea.nethome — bundle ID Midea NetHome Plus
        url:      'com.midea.MSmartHome://',
        urlFallback: 'https://apps.apple.com/it/app/nethome-plus/id1008001920',
      },
    ],

    // Tapparelle — solo globale (non hai applet per stanza)
    SHUTTERS: [
      { id:'tutto', label:'Tutte le tapparelle', icon:'🏡', upEvent:'alza_tutto', downEvent:'abbassa_tutto' },
    ],

    // Termostati — comandi globali disponibili
    THERMOSTATS: [
      { id:'off',  label:'Termostati OFF',  icon:'🌡️', event:'off_termostato',  color:'#fce4ec' },
      { id:'auto', label:'Termostati AUTO', icon:'♻️', event:'termostato_auto', color:'#e8f5e9' },
    ],

    // Telecamere Ezviz
    CAMERAS: [
      { id:'int_on',  label:'Cam interne ON',  icon:'📷', event:'ezviz_interne_on',  color:'#fce4ec' },
      { id:'int_off', label:'Cam interne OFF', icon:'📷', event:'ezviz_interne_off', color:'#f5f5f5' },
      { id:'est_on',  label:'Cam esterne ON',  icon:'📹', event:'ezviz_esterne_on',  color:'#fce4ec' },
      { id:'est_off', label:'Cam esterne OFF', icon:'📹', event:'ezviz_esterne_off', color:'#f5f5f5' },
    ],
  },
};

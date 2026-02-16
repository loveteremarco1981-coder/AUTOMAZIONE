/* ============================================
 *   CONFIGURAZIONE DASHBOARD GITHUB
 * ============================================ */

/* URL Web App Apps Script (endpoint JSONP /exec) */
const CONFIG = {
  BASE_URL: 'https://script.google.com/macros/s/AKfycbzx-jta1hBn-PZmXj7IGhpO_B2uNAz_G5BrGaQ6V7lZYEf2VBXGHCyr_ho8Xlo7jNEj/exec',

  // Aggiornamento automatico del modello (ms)
  AUTO_REFRESH_MS: 60_000,

  /* -----------------------------------------
   *    PREFERITI (Home)
   * -----------------------------------------
   * kind:
   *   - "action": invoca un comando admin
   *   - "toggle": ON/OFF sincronizzato con stato backend
   *
   * icon:
   *   up | down | leaf | suit | switch
   *
   * toggleEvent:
   *   nome dell’evento admin senza pin
   *
   * stateKey:
   *   proprietà del modello doGet (es: vacanza, override)
   */
  FAVORITES: [
    { id:'alza',     kind:'action', label:'Alza tutto',     icon:'up',     event:'alza_tutto' },
    { id:'abbassa',  kind:'action', label:'Abbassa tutto',  icon:'down',   event:'abbassa_tutto' },
    { id:'piante',   kind:'action', label:'Piante',          icon:'leaf',   event:'piante' },
    { id:'vacanza',  kind:'toggle', label:'Vacanza',         icon:'suit',   toggleEvent:'set_vacanza', stateKey:'vacanza' },
    { id:'override', kind:'toggle', label:'Override',        icon:'switch', toggleEvent:'set_override', stateKey:'override' }
  ]
};


/* ============================================
 *   CLASSI CSS PER GLI STATI CASA
 * ============================================ */
const STATE_CLASS = {
  'COMFY_DAY':     'good',
  'COMFY_NIGHT':   'good',
  'SECURITY_DAY':  'sec',
  'SECURITY_NIGHT':'sec'
};


/* ============================================
 *   MAPPA CODICI WMO (Open‑Meteo → Emoji / Testo)
 * ============================================ */
function mapWeatherCode(wc){
  const m = {
    '0': {icon:'☀️', text:'Sereno'},
    '1': {icon:'🌤️', text:'Poco nuv.'},
    '2': {icon:'⛅', text:'Parz. nuv.'},
    '3': {icon:'☁️', text:'Nuvoloso'},
    '45':{icon:'🌫️', text:'Nebbia'},
    '48':{icon:'🌫️', text:'Nebbia ghiacciata'},

    '51':{icon:'🌦️', text:'Pioviggine'},
    '53':{icon:'🌦️', text:'Pioviggine'},
    '55':{icon:'🌦️', text:'Pioviggine intensa'},

    '61':{icon:'🌧️', text:'Pioggia'},
    '63':{icon:'🌧️', text:'Pioggia'},
    '65':{icon:'🌧️', text:'Pioggia forte'},

    '66':{icon:'🌧️❄️', text:'Ghiacciata'},
    '67':{icon:'🌧️❄️', text:'Ghiacciata'},

    '71':{icon:'🌨️', text:'Neve leggera'},
    '73':{icon:'🌨️', text:'Neve'},
    '75':{icon:'🌨️', text:'Neve forte'},

    '77':{icon:'❄️', text:'Grani di neve'},

    '80':{icon:'🌦️', text:'Rovesci'},
    '81':{icon:'🌧️', text:'Rovesci'},
    '82':{icon:'⛈️', text:'Rovesci intensi'},

    '85':{icon:'❄️', text:'Rov. neve'},
    '86':{icon:'❄️', text:'Rov. neve'},

    '95':{icon:'⛈️', text:'Temporale'},
    '96':{icon:'⛈️', text:'Grandine'},
    '99':{icon:'⛈️', text:'Grandine forte'}
  };

  return m[String(wc)] || {icon:'', text:''};

// --- METEO lato client (niente Apps Script) ---
  WEATHER: {
    // Imposta qui le coordinate di casa. Esempio Torino:
    lat: 45.004636,
    lon: 7.6522632,
    tz:  'Europe/Rome',

    // se true forza sempre la lettura client, anche se il backend mandasse weather
    forceClient: false
  }

}

/* ============================================
 *   CONFIGURAZIONE DASHBOARD GITHUB
 * ============================================ */

const CONFIG = {
  BASE_URL: 'https://script.google.com/macros/s/AKfycbzx-jta1hBn-PZmXj7IGhpO_B2uNAz_G5BrGaQ6V7lZYEf2VBXGHCyr_ho8Xlo7jNEj/exec',
  AUTO_REFRESH_MS: 60000,

  FAVORITES: [
    { id:'tapparelle', kind:'toggle', label:'Tapparelle', icon:'shutter' },
    { id:'piante',     kind:'action', label:'Piante',      icon:'leaf',    event:'piante' },
    { id:'vacanza',    kind:'toggle', label:'Modalità Vacanza', icon:'suit',   toggleEvent:'set_vacanza', stateKey:'vacanza' },
    { id:'override',   kind:'toggle', label:'Override Notte',   icon:'switch', toggleEvent:'set_override', stateKey:'override' }
  ],

  WEATHER: { lat:45.004636, lon:7.6522632, tz:'Europe/Rome', forceClient:false }
};

const STATE_CLASS = {
  'COMFY_DAY':'good', 'COMFY_NIGHT':'good', 'SECURITY_DAY':'sec', 'SECURITY_NIGHT':'sec'
};

function mapWeatherCode(wc){
  const m = {
    '0':{icon:'☀️',text:'Sereno'}, '1':{icon:'🌤️',text:'Poco nuvoloso'}, '2':{icon:'⛅',text:'Parz. nuvoloso'}, '3':{icon:'☁️',text:'Nuvoloso'},
    '45':{icon:'🌫️',text:'Nebbia'}, '48':{icon:'🌫️',text:'Nebbia ghiacciata'},
    '51':{icon:'🌦️',text:'Pioviggine'}, '53':{icon:'🌦️',text:'Pioviggine'}, '55':{icon:'🌦️',text:'Pioviggine intensa'},
    '61':{icon:'🌧️',text:'Pioggia'}, '63':{icon:'🌧️',text:'Pioggia'}, '65':{icon:'🌧️',text:'Pioggia forte'},
    '80':{icon:'🌦️',text:'Rovesci'}, '81':{icon:'🌧️',text:'Rovesci'}, '82':{icon:'⛈️',text:'Temporali'},
    '95':{icon:'⛈️',text:'Temporale'}, '96':{icon:'⛈️',text:'Grandine'}, '99':{icon:'⛈️',text:'Grandine forte'}
  };
  return m[String(wc)] || {icon:'', text:''};
}

/* ===== Config & mapping (GitHub Pages) ===== */

// URL del tuo Web App (/exec) per JSONP
const CONFIG = {
  BASE_URL: 'https://script.google.com/macros/s/AKfycbzx-jta1hBn-PZmXj7IGhpO_B2uNAz_G5BrGaQ6V7lZYEf2VBXGHCyr_ho8Xlo7jNEj/exec',
  AUTO_REFRESH_MS: 60_000 // 1 min; metti 0 per disattivare
};

// Stati -> classi chip
const STATE_CLASS = {
  'COMFY_DAY': 'good',
  'COMFY_NIGHT': 'good',
  'SECURITY_DAY': 'sec',
  'SECURITY_NIGHT': 'sec'
};

// WMO -> emoji/label breve
function mapWeatherCode(wc){
  const m = {
    '0': {icon:'☀️', text:'Sereno'},
    '1': {icon:'🌤️', text:'Poco nuv.'},
    '2': {icon:'⛅', text:'Parz. nuv.'},
    '3': {icon:'☁️', text:'Nuvoloso'},
    '45':{icon:'🌫️', text:'Nebbia'},
    '48':{icon:'🌫️', text:'Nebbia gh.'},
    '51':{icon:'🌦️', text:'Pioviggine'},
    '53':{icon:'🌦️', text:'Pioviggine'},
    '55':{icon:'🌦️', text:'Pioviggine'},
    '61':{icon:'🌧️', text:'Pioggia'},
    '63':{icon:'🌧️', text:'Pioggia'},
    '65':{icon:'🌧️', text:'Pioggia'},
    '66':{icon:'🌧️❄️', text:'Ghiacciata'},
    '67':{icon:'🌧️❄️', text:'Ghiacciata'},
    '71':{icon:'🌨️', text:'Neve'},
    '73':{icon:'🌨️', text:'Neve'},
    '75':{icon:'🌨️', text:'Neve'},
    '77':{icon:'❄️', text:'Grani neve'},
    '80':{icon:'🌦️', text:'Rovesci'},
    '81':{icon:'🌧️', text:'Rovesci'},
    '82':{icon:'⛈️', text:'Rov. intensi'},
    '85':{icon:'❄️', text:'Rov. neve'},
    '86':{icon:'❄️', text:'Rov. neve'},
    '95':{icon:'⛈️', text:'Temporali'},
    '96':{icon:'⛈️', text:'Temp./grand.'},
    '99':{icon:'⛈️', text:'Temp./grand.'}
  };
  return m[String(wc)] || {icon:'', text:''};
}

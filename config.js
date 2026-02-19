window.CONFIG = {
  DOGET_URL: "https://script.google.com/macros/s/AKfycby3ch-Fue-VeHhdqW5ILkTvxyk3U3e3dUYfpscuBjxxW0fa9zexuEYwZmVTIi2ixRkG1g/exec",
  AUTO_REFRESH_MS: 60000,
  FAVORITES: [
    { id:'tapparelle', kind:'toggle', label:'Tapparelle', icon:'shutter',  toggleEvent:null, stateKey:null, subtitle:'Casa' },
    { id:'piante',     kind:'action', label:'Piante',      icon:'plant',    event:'piante', subtitle:'Irrigazione' },
    { id:'vacanza',    kind:'toggle', label:'Modalità Vacanza', icon:'suit',   toggleEvent:'set_vacanza', stateKey:'vacanza', subtitle:'Automazioni' },
    { id:'override',   kind:'toggle', label:'Override Notte',   icon:'moon',   toggleEvent:'set_override', stateKey:'override', subtitle:'Silenzia' }
  ],
  WEATHER: { lat:45.004636, lon:7.6522632, tz:'Europe/Rome', forceClient:false }
};
``

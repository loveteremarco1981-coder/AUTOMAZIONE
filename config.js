window.APP_CONFIG = {
  title: "Casa di Marco",
  endpoint: "https://script.google.com/macros/s/AKfycbzx-jta1hBn-PZmXj7IGhpO_B2uNAz_G5BrGaQ6V7lZYEf2VBXGHCyr_ho8Xlo7jNEj/exec",
  pollMs: 4000,
  transport: "jsonp",
  jsonpCallbackParam: "callback",

  paths: {
    homeState:   "state",
    weatherTemp: "weather.tempC",
    offlineCount:"devicesOfflineCount", /* non usato in dashboard, ma lo lasciamo */
    energyKwh:   "energy.kwh"
  },

  tiles: [
    {
      id: "vacanza",
      type: "pushToggle",
      label: "Vacanza",
      path: "vacanza",
      toggle: {
        on:  "admin=1&event=set_vacanza&value=true",
        off: "admin=1&event=set_vacanza&value=false"
      }
    },
    {
      id: "override",
      type: "pushToggle",
      label: "Override",
      path: "override",
      toggle: {
        on:  "admin=1&event=set_override&value=true",
        off: "admin=1&event=set_override&value=false"
      }
    },
    {
      id: "piante",
      type: "push",
      label: "Piante",
      action: { url: "admin=1&event=piante" }
    },
    /* Nuove scorciatoie “tutte le tapparelle” */
    {
      id: "tapparelle_up",
      type: "push",
      label: "Tapparelle ▲",
      action: { url: "admin=1&event=alza_tutto" }
    },
    {
      id: "tapparelle_down",
      type: "push",
      label: "Tapparelle ▼",
      action: { url: "admin=1&event=abbassa_tutto" }
    }
  ],

  favorites: ["vacanza","override","piante","tapparelle_up","tapparelle_down"],
  logLimit: 30
};

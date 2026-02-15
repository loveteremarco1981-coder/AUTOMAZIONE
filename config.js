window.APP_CONFIG = {
  title: "Casa di Marco",
  endpoint: "https://script.google.com/macros/s/AKfycbzx-jta1hBn-PZmXj7IGhpO_B2uNAz_G5BrGaQ6V7lZYEf2VBXGHCyr_ho8Xlo7jNEj/exec",
  pollMs: 4000,
  transport: "jsonp",
  jsonpCallbackParam: "callback",

  /* === PERCORSI LETTI DALLA UI ===
     - state: COMFY_DAY / SECURITY_NIGHT ecc. (mostrato nel chip in alto)
     - weather.tempC: temperatura per la pill meteo (°C)
     - devicesOfflineCount: numero dispositivi offline
     - energy.kwh: consumo energia per la pill Energy
  */
  paths: {
    homeState:   "state",
    weatherTemp: "weather.tempC",
    offlineCount:"devicesOfflineCount",
    energyKwh:   "energy.kwh"
  },

  /* === PREFERITI (HOME) ===
     - "pushToggle": un solo bottone che attiva/disattiva in base allo stato corrente
     - "push": un solo bottone che esegue l’azione
     - path punta al booleano pubblicato dal tuo doGet (vacanza/override)
  */
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
    }

    // Se vuoi aggiungere un indicatore in sola lettura, puoi rimettere:
    // { id:"presenza", type:"sensor", label:"Presenza", path:"presenzaEffettiva",
    //   format: v => v ? "In casa" : "Assente" }
    //
    // La tile "statoCasa" NON serve più: lo stato è nel chip in alto (paths.homeState).
  ],

  // Ordine delle card Preferiti
  favorites: ["vacanza", "override", "piante"],

  // Quante righe massimo mostrare nella vista Log
  logLimit: 30
};

window.APP_CONFIG = {
  title: "Casa di Marco",
  endpoint: "https://script.google.com/macros/s/AKfycbzx-jta1hBn-PZmXj7IGhpO_B2uNAz_G5BrGaQ6V7lZYEf2VBXGHCyr_ho8Xlo7jNEj/exec",
  pollMs: 4000,
  transport: "jsonp",
  jsonpCallbackParam: "callback",

  // Tile principali (ordine di rendering = posizione in griglia)
  tiles: [
    { id:"vacanza",  type:"switch", label:"Vacanza",  path:"vacanza",
      on:{  url:"admin=1&event=set_vacanza&value=true"  },
      off:{ url:"admin=1&event=set_vacanza&value=false" } },

    { id:"presenza", type:"sensor", label:"Presenza", path:"presenzaEffettiva",
      format:v=>v?"In casa":"Assente" },

    { id:"piante",   type:"scene",  label:"Piante",   subtitle:"Apertura Tapparelle",
      action:{ url:"admin=1&event=piante", confirm:"Attivo modalità Apertura Tapparelle?" } },

    { id:"override", type:"switch", label:"Override", path:"override",
      on:{  url:"admin=1&event=set_override&value=true"  },
      off:{ url:"admin=1&event=set_override&value=false" } },

    // 👇 la nuova TILE STATO (accanto a Override nella griglia)
    { id:"statoCasa", type:"state", label:"Stato", path:"state" }
  ],

  persons: [],   // user: i nomi arrivano già in model.people dal tuo doGet

  rooms: [
    { id:"soggiorno", name:"Soggiorno", tiles:["presenza"] },
    { id:"esterno",   name:"Esterno",   tiles:["alba","tramonto","piante"] },
  ],

  virtual: { alba:{label:"Alba",path:"alba"}, tramonto:{label:"Tramonto",path:"tramonto"} },

  logLimit: 20
};

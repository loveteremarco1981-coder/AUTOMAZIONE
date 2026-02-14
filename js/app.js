/*******************************************************
 * HOMEKIT APP – SEZIONE A (Utility + Animazioni)
 *******************************************************/

console.log("[LOAD] app.js HomeKit Dark");

// Endpoint
const ENDPOINT = window.APP_CONFIG.endpoint;

// Delay promisificato
const delay = ms => new Promise(res => setTimeout(res, ms));

// Toast stile iOS
function toast(msg){
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 1500);
}

// Formattazione data
function fmt(d){
  if(!d) return "—";
  const dt = new Date(d);
  if(isNaN(dt)) return d;
  return dt.toLocaleString();
}

// “x min fa”
function fmtAgo(min){
  if(min == null) return "—";
  if(min < 1) return "ora";
  if(min === 1) return "1 min";
  return min+" min";
}

// Animazione inserimento card (utilizzata nelle render)
function animateCard(id){
  const el = document.getElementById(id);
  if(!el) return;
  el.classList.remove("fade-in");
  void el.offsetWidth;
  el.classList.add("fade-in");
}
/*******************************************************
 * HOMEKIT APP – SEZIONE A (Utility + Animazioni)
 *******************************************************/

console.log("[LOAD] app.js HomeKit Dark");

// Endpoint
const ENDPOINT = window.APP_CONFIG.endpoint;

// Delay promisificato
const delay = ms => new Promise(res => setTimeout(res, ms));

// Toast stile iOS
function toast(msg){
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 1500);
}

// Formattazione data
function fmt(d){
  if(!d) return "—";
  const dt = new Date(d);
  if(isNaN(dt)) return d;
  return dt.toLocaleString();
}

// “x min fa”
function fmtAgo(min){
  if(min == null) return "—";
  if(min < 1) return "ora";
  if(min === 1) return "1 min";
  return min+" min";
}

// Animazione inserimento card (utilizzata nelle render)
function animateCard(id){
  const el = document.getElementById(id);
  if(!el) return;
  el.classList.remove("fade-in");
  void el.offsetWidth;
  el.classList.add("fade-in");
}

/*******************************************************
 * HOMEKIT APP — SEZIONE C
 * Comandi: Vacanza, Override, Tapparelle, Piante (+Retry)
 *******************************************************/

/*────────────────────────────────────────────
  JSONP CALL GENERICA
────────────────────────────────────────────*/
async function sendJSONP(url){
  return new Promise((resolve, reject)=>{
    const cb = "cb_" + Math.random().toString(36).slice(2);
    const s  = document.createElement("script");

    window[cb] = (data)=>{
      resolve(data);
      delete window[cb];
      s.remove();
    };

    s.onerror = ()=>{
      reject(new Error("JSONP error"));
      delete window[cb];
      s.remove();
    };

    const sep = url.includes("?") ? "&" : "?";
    s.src = url + sep + "callback=" + cb;
    document.head.appendChild(s);
  });
}

/*────────────────────────────────────────────
  COMANDO PIANTE con Retry (3 tentativi)
────────────────────────────────────────────*/
async function sendPianteRetry(){
  for(let i=1;i<=3;i++){
    try{
      await sendJSONP(`${ENDPOINT}?admin=1&event=piante&value=true`);
      toast("🌿 Piante avviate");
      return;
    }catch(err){
      console.warn("Retry PIANTE:", i, err);
      await delay(2000);
    }
  }
  toast("Errore PIANTE");
}

/*────────────────────────────────────────────
  COMANDO GENERICO
────────────────────────────────────────────*/
async function sendCmd(evt, val){
  // Caso speciale PIANTE con retry automatico
  if(evt === "piante"){
    return sendPianteRetry();
  }

  const url =
    `${ENDPOINT}?admin=1&event=${encodeURIComponent(evt)}&value=${val?'true':'false'}`;

  try{
    await sendJSONP(url);
    animateCommandButton(evt);
    toast("OK");

    // ricarico modello con leggero delay
    setTimeout(loadModel, 250);

  }catch(err){
    console.error("Cmd error:", err);
    toast("Errore");
  }
}

/*────────────────────────────────────────────
  ANIMAZIONE PULSANTE STILE HOMEKIT
────────────────────────────────────────────*/
function animateCommandButton(evt){
  const btn = document.querySelector(`[data-cmd="${evt}"]`);
  if(!btn) return;

  btn.classList.remove("hk-pulse");
  void btn.offsetWidth;
  btn.classList.add("hk-pulse");
}

/*******************************************************
 * HOMEKIT APP — SEZIONE D
 * Loader, Bind interattivo, Auto-refresh
 *******************************************************/

/*────────────────────────────────────────────
  CARICA MODELLO (JSONP)
────────────────────────────────────────────*/
async function loadModel(){
  try{
    const model = await sendJSONP(ENDPOINT);

    // rendering completo
    renderAll(model);

  }catch(err){
    console.error("LoadModel error:", err);
    toast("Errore rete");
  }
}

/*────────────────────────────────────────────
  BIND EVENTI (tutti i pulsanti HomeKit)
────────────────────────────────────────────*/
function bindButtons(){
  // tutti i pulsanti con data-cmd
  document.querySelectorAll("[data-cmd]").forEach(btn => {
    btn.addEventListener("click", ()=>{
      const cmd = btn.dataset.cmd;
      const val = (btn.dataset.val === "true");

      animatePress(btn);
      sendCmd(cmd, val);
    });
  });
}

/*────────────────────────────────────────────
  Animazione del pulsante stile iOS “press”
────────────────────────────────────────────*/
function animatePress(btn){
  btn.classList.remove("hk-press");
  void btn.offsetWidth; // forza reflow
  btn.classList.add("hk-press");
}

/*────────────────────────────────────────────
  AVVIO APP
────────────────────────────────────────────*/
document.addEventListener("DOMContentLoaded", ()=>{
  
  // Binding
  bindButtons();

  // Primo caricamento immediato
  loadModel();

  // Refresh automatico ogni 10s
  setInterval(loadModel, 10000);
  
});

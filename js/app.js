/*******************************************************
 * APP.JS — BLOCCO 1
 * VARIABILI + ENDPOINT + JSONP + UTILITY
 *******************************************************/

console.log("[LOAD] app.js — iOS Version");

/* ENDPOINT */
const ENDPOINT = window.APP_CONFIG.endpoint;

/*******************************************************
 * JSONP WRAPPER
 *******************************************************/
async function sendJSONP(url){
  return new Promise((resolve, reject) => {
    const cb = "cb_" + Math.random().toString(36).slice(2);
    const sep = url.includes("?") ? "&" : "?";
    const s = document.createElement("script");

    window[cb] = (data) => {
      resolve(data);
      delete window[cb];
      s.remove();
    };

    s.onerror = () => {
      reject(new Error("JSONP ERROR"));
      delete window[cb];
      s.remove();
    };

    s.src = url + sep + "callback=" + cb;
    document.head.appendChild(s);
  });
}

/*******************************************************
 * UTILITY
 *******************************************************/
const delay = ms => new Promise(res => setTimeout(res, ms));

function toast(t){
  const el = document.getElementById("toast");
  el.textContent = t;
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 1600);
}

function fmt(d){
  if(!d) return "—";
  const dt = new Date(d);
  if(isNaN(dt)) return d;
  return dt.toLocaleString();
}

function fmtAgo(m){
  if(m == null) return "—";
  if(m < 1) return "ora";
  if(m === 1) return "1 min";
  return m + " min";
}

/*******************************************************
 * APP.JS — BLOCCO 2
 * PRESS EFFECT + PULSE EFFECT + SELECTORS
 *******************************************************/

/* Effetto pressione stile iOS */
function pressFx(el){
  if(!el) return;
  el.classList.remove("hk-press");
  void el.offsetWidth;
  el.classList.add("hk-press");
}

/* Effetto bloom/pulse HomeKit */
function pulseFx(el){
  if(!el) return;
  el.classList.add("hk-pulse");
  setTimeout(() => el.classList.remove("hk-pulse"), 450);
}

/* Shortcut per selettori */
const $ = sel => document.querySelector(sel);
const $$ = sel => document.querySelectorAll(sel);

/*******************************************************
 * APP.JS — BLOCCO 3
 * RENDER STATO / EVENTI / GIORNO-NOTTE
 *******************************************************/

function renderState(model){

  /* Stato principale */
  const st = model.state || "—";
  $("#state-pill").textContent = st;
  $("#state-pill-dup") && ($("#state-pill-dup").textContent = st);

  /* Ultimo evento */
  $("#last-event").textContent = model.lastEvent || "—";

  /* Giorno / Notte */
  const isNight = String(model.notte).toLowerCase() === "true" || st.toUpperCase().includes("NIGHT");
  const dayState = isNight ? "notte" : "giorno";
  $("#hk-daystate").textContent = dayState;

  /* Flag superiori */
  const flags = [];
  if(model.vacanza) flags.push("vacanza");
  if(model.override) flags.push("override");
  flags.push(dayState);
  $("#meta-flags") && ($("#meta-flags").textContent = flags.join(" · "));

  /* Aggiorna tema visivo */
  applyTheme(model);
}

function applyTheme(model){
  const st = model.state || "";
  const notte = st.toUpperCase().includes("NIGHT");
  document.body.classList.remove("hk-night", "hk-day");
  document.body.classList.add(notte ? "hk-night" : "hk-day");
}

/*******************************************************
 * APP.JS — BLOCCO 4
 * RENDER PERSONE (lista + badge IN/OUT)
 *******************************************************/

function renderPeople(list){
  const box = $("#people-list");
  if(!box) return;

  box.innerHTML = "";

  (list || []).forEach(p => {
    const online = p.onlineSmart || p.onlineRaw;

    const li = document.createElement("li");
    li.className = "person";

    li.innerHTML = `
      <div>${p.name}</div>
      <div class="badge ${online ? 'in' : 'out'}">
        ${online ? 'IN' : 'OUT'}
        ${p.lastLifeMinAgo != null ? ' · ' + fmtAgo(p.lastLifeMinAgo) : ''}
      </div>
    `;

    box.appendChild(li);
  });
}

/*******************************************************
 * APP.JS — BLOCCO 5
 * RENDER ORARI + PIANTE (next events)
 *******************************************************/

function renderTime(model){
  $("#alba").textContent = fmt(model.alba);
  $("#tramonto").textContent = fmt(model.tramonto);
  $("#ora").textContent = fmt(model.meta.nowIso);
}

function renderNext(model){
  const n = model.next || {};
  $("#next-piante-alba").textContent = fmt(n.pianteAlba);
  $("#next-piante-close").textContent = fmt(n.piantePostClose);
}

/*******************************************************
 * RENDER COMPLETO (STATE + PEOPLE + ORARI + NEXT)
 *******************************************************/
function renderAll(model){
  renderState(model);
  renderPeople(model.people);
  renderTime(model);
  renderNext(model);
}

/*******************************************************
 * APP.JS — BLOCCO 6
 * NAVIGAZIONE iOS A TAB (Casa / Comandi / Tapparelle / Piante)
 *******************************************************/

function initTabs(){
  const tabs = $$(".hk-tab");
  const sections = {
    home: $(".hk-main"),       // sezione principale
    cmd: $("#section-cmd"),
    tapp: $("#section-tapp"),
    plant: $("#section-plant")
  };

  function showSection(target){
    // disattiva tutte le tab
    tabs.forEach(t => t.classList.remove("active"));

    // nascondi tutte le sezioni secondarie
    Object.keys(sections).forEach(k => {
      if(k === "home"){
        // la sezione home è il main
        sections[k].style.display = (target === "home") ? "flex" : "none";
      } else {
        sections[k].style.display = (target === k) ? "block" : "none";
      }
    });

    // attiva tab corrente
    const currentTab = document.querySelector(`.hk-tab[data-target="${target}"]`);
    if(currentTab){
      currentTab.classList.add("active");
      pressFx(currentTab);
    }
  }

  // click handler
  tabs.forEach(tab => {
    tab.addEventListener("click", () => {
      const target = tab.dataset.target;
      showSection(target);
    });
  });

  // sezione iniziale
  showSection("home");
}

/*******************************************************
 * APP.JS — BLOCCO 7
 * COMANDI CASA / TAPPARELLE / PIANTE
 *******************************************************/

/* PIANTE — 3 tentativi con attesa */
async function sendPianteRetry(){
  for(let i = 1; i <= 3; i++){
    try{
      await sendJSONP(`${ENDPOINT}?admin=1&event=piante&value=true`);
      toast("🌱 Piante avviate");
      return;
    }catch(e){
      await delay(1200);
    }
  }
  toast("Errore PIANTE");
}

/* Gestore comandi generici */
async function sendCmd(evt, val, el){
  if(el) pressFx(el);

  if(evt === "piante"){
    pulseFx(el);
    return sendPianteRetry();
  }

  try{
    await sendJSONP(`${ENDPOINT}?admin=1&event=${evt}&value=${val ? 'true' : 'false'}`);
    pulseFx(el);
    toast("OK");
    setTimeout(loadModel, 300);
  }catch(e){
    toast("Errore rete");
  }
}

/* Bind dei pulsanti */
function bindButtons(){
  $$("[data-cmd]").forEach(btn => {
    btn.addEventListener("click", () => {
      const cmd = btn.dataset.cmd;
      const val = (btn.dataset.val === "true");
      sendCmd(cmd, val, btn);
    });
  });
}

/*******************************************************
 * APP.JS — BLOCCO 8
 * LOADER + AUTOREFRESH + INIT COMPLETO
 *******************************************************/

function showLoading(){
  $$(".hk-value, .person, .badge").forEach(el => {
    el.classList.add("hk-shimmer");
  });
}

function hideLoading(){
  $$(".hk-shimmer").forEach(el => {
    el.classList.remove("hk-shimmer");
  });
}

/*******************************************************
 * MODEL LOADING
 *******************************************************/
async function loadModel(){
  try{
    showLoading();
    const model = await sendJSONP(ENDPOINT);
    renderAll(model);
    flashUpdated();
  }catch(e){
    toast("Errore rete");
  }finally{
    hideLoading();
  }
}

/*******************************************************
 * INIT APP (Apple Home Style)
 *******************************************************/
document.addEventListener("DOMContentLoaded", () => {

  /* Bind pulsanti */
  bindButtons();

  /* Navigazione tab iOS */
  initTabs();

  /* Primo caricamento */
  loadModel();

  /* Auto-refresh ogni 10 secondi */
  setInterval(loadModel, 10000);

});


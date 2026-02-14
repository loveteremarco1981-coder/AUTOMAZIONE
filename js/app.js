/*******************************************************
 * HOMEKIT APP – VERSIONE FINALE CORRETTA
 *******************************************************/

console.log("[LOAD] app.js – CLEAN VERSION");

// ENDPOINT
const ENDPOINT = window.APP_CONFIG.endpoint;

/*******************************************************
 * Utility
 *******************************************************/
const delay = ms => new Promise(res => setTimeout(res, ms));

function toast(t){
  const el = document.getElementById("toast");
  el.textContent = t;
  el.classList.add("show");
  setTimeout(()=>el.classList.remove("show"),1500);
}

function fmt(d){
  if(!d) return "—";
  const dt = new Date(d);
  if(isNaN(dt)) return d;
  return dt.toLocaleString();
}
function fmtAgo(m){
  if(m==null) return "—";
  if(m<1) return "ora";
  if(m===1) return "1 min";
  return m+" min";
}

/*******************************************************
 * JSONP
 *******************************************************/
async function sendJSONP(url){
  return new Promise((resolve, reject)=>{
    const cb = "cb_"+Math.random().toString(36).slice(2);
    const sep = url.includes("?") ? "&" : "?";
    const s = document.createElement("script");

    window[cb] = (data)=>{
      resolve(data);
      delete window[cb];
      s.remove();
    };

    s.onerror = ()=>{
      reject(new Error("JSONP ERROR"));
      delete window[cb];
      s.remove();
    };

    s.src = url + sep + "callback=" + cb;
    document.head.appendChild(s);
  });
}

/*******************************************************
 * RENDER – stato, persone, orari, eventi
 *******************************************************/
function renderState(model){
  const st = model.state || "—";

  document.getElementById("state-pill").textContent = st;
  document.getElementById("state-pill-dup").textContent = st;

  const notte = st.toUpperCase().includes("NIGHT");
  document.getElementById("notte").textContent = notte ? "NOTTE" : "GIORNO";

  const flags = [];
  if(model.vacanza) flags.push("vacanza");
  if(model.override) flags.push("override");
  flags.push(notte ? "notte" : "giorno");
  document.getElementById("meta-flags").textContent = flags.join(" · ");

  document.getElementById("meta-time").textContent = fmt(model.meta.nowIso);
  document.getElementById("last-event").textContent = model.lastEvent || "—";
}

function renderPeople(list){
  const box = document.getElementById("people-list");
  box.innerHTML = "";
  (list||[]).forEach(p=>{
    const online = p.onlineSmart || p.onlineRaw;
    const li = document.createElement("li");
    li.className = "person";

    li.innerHTML = `
      <div>${p.name}</div>
      <div class="badge ${online?'in':'out'}">
        ${online?'IN':'OUT'}${p.lastLifeMinAgo!=null?' · '+fmtAgo(p.lastLifeMinAgo):''}
      </div>
    `;

    box.appendChild(li);
  });
}

function renderTime(m){
  document.getElementById("alba").textContent = fmt(m.alba);
  document.getElementById("tramonto").textContent = fmt(m.tramonto);
  document.getElementById("ora").textContent = fmt(m.meta.nowIso);
}

function renderNext(m){
  const n = m.next || {};
  document.getElementById("next-piante-alba").textContent = fmt(n.pianteAlba);
  document.getElementById("next-piante-close").textContent = fmt(n.piantePostClose);
}

function renderAll(model){
  renderState(model);
  renderPeople(model.people);
  renderTime(model);
  renderNext(model);
}

/*******************************************************
 * Tema dinamico giorno/notte
 *******************************************************/
function applyTheme(model){
  const st = model.state || "";
  const notte = st.toUpperCase().includes("NIGHT");

  document.body.classList.remove("hk-night","hk-day");
  document.body.classList.add(notte ? "hk-night" : "hk-day");
}

/*******************************************************
 * Flash aggiornamento card
 *******************************************************/
function flashUpdated(){
  document.querySelectorAll(".hk-card").forEach(card=>{
    card.classList.remove("update-flash");
    void card.offsetWidth;
    card.classList.add("update-flash");
  });
}

/*******************************************************
 * Loading shimmer
 *******************************************************/
function showLoading(){
  document.querySelectorAll(".hk-value, .person, .badge").forEach(el=>{
    el.classList.add("hk-shimmer");
  });
}
function hideLoading(){
  document.querySelectorAll(".hk-shimmer").forEach(el=>{
    el.classList.remove("hk-shimmer");
  });
}

/*******************************************************
 * Comandi
 *******************************************************/
async function sendPianteRetry(){
  for(let i=1;i<=3;i++){
    try{
      await sendJSONP(`${ENDPOINT}?admin=1&event=piante&value=true`);
      toast("🌿 Piante avviate");
      return;
    }catch(e){
      await delay(1500);
    }
  }
  toast("Errore PIANTE");
}

async function sendCmd(evt,val){
  if(evt==="piante") return sendPianteRetry();

  try{
    await sendJSONP(`${ENDPOINT}?admin=1&event=${evt}&value=${val?'true':'false'}`);
    toast("OK");
    setTimeout(loadModel,300);
  }catch(e){
    toast("Errore");
  }
}

/*******************************************************
 * Loader + Bind
 *******************************************************/
async function loadModel(){
  try{
    showLoading();
    const model = await sendJSONP(ENDPOINT);
    renderAll(model);
    applyTheme(model);
    flashUpdated();
  }catch(e){
    toast("Errore rete");
  }finally{
    hideLoading();
  }
}

function bindButtons(){
  document.querySelectorAll("[data-cmd]").forEach(btn=>{
    btn.addEventListener("click",()=>{
      const cmd = btn.dataset.cmd;
      const val = btn.dataset.val==="true";
      sendCmd(cmd,val);
    });
  });
}

document.addEventListener("DOMContentLoaded",()=>{
  bindButtons();
  loadModel();
  setInterval(loadModel,10000);
});

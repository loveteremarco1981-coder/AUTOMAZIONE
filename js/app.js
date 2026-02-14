console.log("[LOAD] app v4 HOMEKIT");

const ENDPOINT = window.APP_CONFIG.endpoint;

// small helpers
const delay = ms => new Promise(res => setTimeout(res, ms));

function toast(t){
  const el = document.getElementById("toast");
  el.textContent = t;
  el.classList.add("show");
  setTimeout(()=>el.classList.remove("show"),1500);
}

function fmt(d){
  if(!d) return "—";
  const dd = new Date(d);
  if(isNaN(dd)) return d;
  return dd.toLocaleString();
}
function fmtAgo(min){
  if(min==null) return "—";
  if(min<1) return "ora";
  if(min==1) return "1 min";
  return min+" min";
}

// card updates
function paintState(s){
  document.getElementById("state-pill").textContent = s||"—";
  document.getElementById("state-pill-dup").textContent = s||"—";
}

function renderPeople(people){
  const box = document.getElementById("people-list");
  box.innerHTML = "";
  (people||[]).forEach(p=>{
    const online = p.onlineSmart || p.onlineRaw;
    const li = document.createElement("li");
    li.className = "person";
    li.innerHTML = `
      <div>${p.name}</div>
      <div class="badge ${online?"in":"out"}">
        ${online?"IN":"OUT"}${p.lastLifeMinAgo!=null?" · "+fmtAgo(p.lastLifeMinAgo):""}
      </div>`;
    box.appendChild(li);
  });
}

function renderMeta(m){
  document.getElementById("meta-time").textContent = fmt(m.meta.nowIso);
  document.getElementById("meta-flags").textContent =
    (m.vacanza?"vacanza ":"") +
    (m.override?"override ":"") +
    ((m.state||"").includes("NIGHT")?"notte":"giorno");

  document.getElementById("last-event").textContent = m.lastEvent||"—";

  document.getElementById("alba").textContent = fmt(m.alba);
  document.getElementById("tramonto").textContent = fmt(m.tramonto);
  document.getElementById("ora").textContent = fmt(m.meta.nowIso);

  const isNight = (m.state||"").includes("NIGHT");
  document.getElementById("notte").textContent = isNight?"NOTTE":"GIORNO";

  // next events
  const next = m.next||{};
  document.getElementById("next-piante-alba").textContent = fmt(next.pianteAlba);
  document.getElementById("next-piante-close").textContent = fmt(next.piantePostClose);
}

// retry for PIANTE
async function sendPianteRetry(){
  for(let i=1;i<=3;i++){
    try{
      await jsonp(ENDPOINT+"?admin=1&event=piante&value=true");
      toast("PIANTE avviate");
      return;
    }catch(e){
      console.warn("Retry piante",i);
      await delay(2000);
    }
  }
  toast("Errore PIANTE");
}

async function sendCmd(evt, val){
  if(evt==="piante"){
    return sendPianteRetry();
  }
  try{
    await jsonp(`${ENDPOINT}?admin=1&event=${evt}&value=${val?'true':'false'}`);
    toast("OK");
    setTimeout(loadModel,200);
  }catch(e){
    toast("Errore");
  }
}

async function loadModel(){
  const model = await jsonp(ENDPOINT);
  paintState(model.state);
  renderPeople(model.people);
  renderMeta(model);
}

// bind
document.addEventListener("DOMContentLoaded",()=>{
  document.querySelectorAll(".hk-btn, .seg").forEach(btn=>{
    btn.addEventListener("click",()=>{
      const evt = btn.dataset.cmd;
      const val = btn.dataset.val==="true";
      sendCmd(evt,val);
    });
  });

  loadModel();
  setInterval(loadModel,15000);
});

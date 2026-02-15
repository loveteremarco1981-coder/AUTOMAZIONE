<script>
/* ================================
 *  CONFIG
 * ================================ */
const WEBAPP_URL = 'https://script.google.com/macros/s/AKfycbzx-jta1hBn-PZmXj7IGhpO_B2uNAz_G5BrGaQ6V7lZYEf2VBXGHCyr_ho8Xlo7jNEj/exec';
const REFRESH_MS = 60_000;
const UNIT_LS_KEY = 'dash.unit'; // 'C' o 'F'

/* ================================
 *  UTIL
 * ================================ */
function qs(sel){ return document.querySelector(sel); }
function qsa(sel){ return Array.from(document.querySelectorAll(sel)); }
function toNum(val){ if(typeof val==='number') return val; const s=String(val||'').replace(',', '.').replace(/[^\d.\-]/g,'').trim(); const n=Number(s); return isFinite(n)?n:null; }
function cToF(c){ return c==null ? null : (c*9/5 + 32); }
function fmtTemp(n,unit){ if(n==null||!isFinite(n)) return '— °'+unit; const v = unit==='F' ? cToF(n) : n; return Math.round(v)+'°'+unit; }
function wmoEmoji(code){ const m={'0':'☀️','1':'🌤️','2':'⛅','3':'☁️','45':'🌫️','48':'🌫️','51':'🌦️','53':'🌦️','55':'🌦️','61':'🌧️','63':'🌧️','65':'🌧️','66':'🌧️❄️','67':'🌧️❄️','71':'🌨️','73':'🌨️','75':'🌨️','77':'❄️','80':'🌦️','81':'🌧️','82':'⛈️','85':'❄️','86':'❄️','95':'⛈️','96':'⛈️','99':'⛈️'}; return m[String(code)]||'⛅'; }
function toast(msg){ try{ console.log('[toast]',msg); }catch(_){} }

/* JSON prima, fallback JSONP se serve */
async function getJSON(url){
  try{
    const r = await fetch(url, { cache:'no-store' });
    const ct = (r.headers.get('content-type')||'').toLowerCase();
    if (ct.includes('application/json')) return await r.json();
    const txt = await r.text();
    const m = txt.match(/^[\w$]+\((.*)\);?$/s);
    if (m) return JSON.parse(m[1]);
    return JSON.parse(txt);
  }catch(e){ return jsonp(url); }
}
function jsonp(url){
  return new Promise((resolve,reject)=>{
    const cb = 'cb_'+Date.now()+'_'+Math.floor(Math.random()*1e6);
    window[cb] = (data)=>{ resolve(data); cleanup(); };
    function cleanup(){ try{ delete window[cb]; }catch(_){}
      if (script && script.parentNode) script.parentNode.removeChild(script); }
    const script = document.createElement('script');
    const sep = url.includes('?')?'&':'?';
    script.src = url + sep + 'callback=' + cb;
    script.onerror = ()=>{ cleanup(); reject(new Error('JSONP error')); };
    document.head.appendChild(script);
  });
}

/* ================================
 *  DATA LOADERS
 * ================================ */
async function loadModel(){
  return await getJSON(WEBAPP_URL + '?t=' + Date.now());
}
async function loadLogs(){
  return await getJSON(WEBAPP_URL + '?logs=1&t=' + Date.now());
}

/* ================================
 *  RENDER (NON CAMBIO STILE)
 * ================================ */
function renderModel(model){
  // Unità
  const unit = (localStorage.getItem(UNIT_LS_KEY)||'C').toUpperCase();

  // Meteo
  const w = model.weather || {};
  const tempEl = qs('[data-weather-temp]');
  const iconEl = qs('[data-weather-emoji]');
  const provEl = qs('[data-weather-provider]');
  if (tempEl) tempEl.textContent = fmtTemp(w.tempC, unit);
  if (iconEl) iconEl.textContent = wmoEmoji(w.icon);
  if (provEl) provEl.textContent = (w.provider||'').replace('Open‑','Open-');

  // Ultimo aggiornamento
  const tsEl = qs('[data-last-update]');
  const nowIso = model.meta && model.meta.nowIso ? new Date(model.meta.nowIso) : new Date();
  if (tsEl){
    const hh = String(nowIso.getHours()).padStart(2,'0');
    const mm = String(nowIso.getMinutes()).padStart(2,'0');
    const ss = String(nowIso.getSeconds()).padStart(2,'0');
    tsEl.textContent = `${hh}:${mm}:${ss}`;
  }

  // People
  const people = Array.isArray(model.people)?model.people:[];
  const online = people.filter(p=>p.onlineSmart||p.onlineRaw).length;
  const sumEl = qs('[data-people-summary]');
  if (sumEl){
    const txt = `${people.length} · ${online>0 ? 'Casa occupata' : 'Casa vuota'}`;
    sumEl.textContent = txt;
  }
  const listEl = qs('[data-people-list]');
  if (listEl){
    listEl.innerHTML = '';
    people.forEach(p=>{
      const div = document.createElement('div');
      div.textContent = `${p.name} · ${ (p.onlineSmart||p.onlineRaw) ? 'IN CASA':'OUT' }`;
      listEl.appendChild(div);
    });
  }

  // Energy + devices offline
  const kwh = model.energy && model.energy.kwh;
  const kwhEl = qs('[data-energy-kwh]');
  if (kwhEl) kwhEl.textContent = (kwh==null || !isFinite(kwh)) ? '— kWh' : `${kwh.toFixed(1)} kWh`;
  const off = (model.devicesOfflineCount==null?0:model.devicesOfflineCount);
  const offEl = qs('[data-devices-offline]');
  if (offEl) offEl.textContent = off;

  // Badge log errori
  const errs = model.alerts && model.alerts.logErrors || 0;
  const badge = qs('[data-log-badge]');
  if (badge){
    badge.textContent = errs>0 ? String(errs) : '';
    badge.style.display = errs>0 ? '' : 'none';
  }
}

/* ================================
 *  ACTIONS (Preferiti già esistenti)
 * ================================ */
async function callAdmin(eventName, extra={}){
  const params = new URLSearchParams({ admin:'1', event:eventName, t: Date.now() });
  Object.entries(extra).forEach(([k,v])=> params.set(k, v));
  const url = WEBAPP_URL + '?' + params.toString();
  return await getJSON(url);
}
function bindAdmin(){
  qsa('[data-admin]').forEach(btn=>{
    btn.addEventListener('click', async ()=>{
      const evt = btn.getAttribute('data-admin');
      const val = btn.getAttribute('data-value');
      try{
        const payload = {}; if (val!=null) payload.value = String(val);
        await callAdmin(evt, payload);
        toast('OK: '+evt+(val!=null ? ' → '+val:''));
        await refreshOnce(); // aggiorna UI dopo comando
      }catch(e){ toast('Errore: '+e.message); }
    });
  });
  qsa('[data-vimar]').forEach(btn=>{
    btn.addEventListener('click', async ()=>{
      const type = btn.getAttribute('data-vimar'); // shutter|thermo|hvac
      const id   = btn.getAttribute('data-id');
      const cmd  = btn.getAttribute('data-cmd') || btn.getAttribute('data-op');
      try{
        if (type==='shutter')      await callAdmin('vimar_shutter', { id, cmd });
        else if (type==='thermo')  await callAdmin('vimar_thermo',  { id, op: cmd });
        else if (type==='hvac')    await callAdmin('vimar_hvac',    { id, op: cmd });
        toast(`VIMAR ${type} ${id} → ${cmd}`);
      }catch(e){ toast('Errore VIMAR: '+e.message); }
    });
  });
}

/* ================================
 *  INIT + REFRESH
 * ================================ */
async function refreshOnce(){
  const model = await loadModel();
  renderModel(model);
}
async function refreshLoop(){
  await refreshOnce();
  setInterval(refreshOnce, REFRESH_MS);
}
function bindUnitToggle(){
  const tempEl = qs('[data-weather-temp]');
  if (!tempEl) return;
  tempEl.style.cursor = 'pointer';
  tempEl.title = 'Clic per cambiare unità °C/°F';
  tempEl.addEventListener('click', ()=>{
    const cur = (localStorage.getItem(UNIT_LS_KEY)||'C').toUpperCase();
    const next = (cur==='C') ? 'F' : 'C';
    localStorage.setItem(UNIT_LS_KEY, next);
    refreshOnce();
  });
}
document.addEventListener('DOMContentLoaded', ()=>{
  bindUnitToggle();
  bindAdmin();
  refreshLoop();
});
</script>

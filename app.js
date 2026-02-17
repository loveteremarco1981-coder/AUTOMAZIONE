const $=(q,r)=> (r||document).querySelector(q);
const $$=(q,r)=> Array.from((r||document).querySelectorAll(q));
const fmtNum=x=>{const n=Number(x);return isFinite(n)?n.toLocaleString('it-IT'):'—'};
const fmtTime=iso=>{try{return new Date(iso).toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'})}catch(_){return'—:—'}};
let LAST_MODEL=null;

function favIcon(name){
  const c='currentColor';
  const M={
    up:`<svg viewBox="0 0 24 24"><path fill="${c}" d="M7 14l5-5 5 5"/></svg>`,
    down:`<svg viewBox="0 0 24 24"><path fill="${c}" d="M7 10l5 5 5-5"/></svg>`,
    leaf:`<svg viewBox="0 0 24 24"><path fill="${c}" d="M6 13c0 5 4 9 9 9 0-7-7-14-14-14 0 2 2 5 5 5z"/></svg>`,
    suit:`<svg viewBox="0 0 24 24"><path fill="${c}" d="M7 7h10l1 5H6zm-1 7h12v5H6z"/></svg>`,
    switch:`<svg viewBox="0 0 24 24"><path fill="${c}" d="M7 7h10a5 5 0 1 1 0 10H7A5 5 0 1 1 7 7zm0 2a3 3 0 0 0 0 6h10a3 3 0 0 0 0-6z"/></svg>`,
    shutter:`<svg viewBox="0 0 24 24"><path fill="${c}" d="M3 4h18v2H3V4Zm0 4h18v2H3V8Zm0 4h18v2H3v-2Zm0 4h18v2H3v-2Z"/></svg>`
  };
  return M[name]||`<svg viewBox='0 0 24 24'><circle cx='12' cy='12' r='8' fill='${c}'/></svg>`;
}

function renderState(m){
  const chip = $('#chipState'); // se non la usi più puoi tenerla invisibile
  const st = (m.state || '').toUpperCase();

  if (chip){
    const cls = STATE_CLASS[st] || 'neutral';
    chip.className = 'chip state ' + cls;
    chip.textContent = st.replace('_', ' ');
    const hs = $('#houseStatus'); if (hs) hs.textContent = m.notte ? 'Notte' : 'Giorno';
  }

  // Banner stato a tutta larghezza
  const sb = $('#stateBanner');
  if (sb){
    const map = {
      'COMFY_DAY':'sb-comfy-day',
      'COMFY_NIGHT':'sb-comfy-night',
      'SECURITY_DAY':'sb-security-day',
      'SECURITY_NIGHT':'sb-security-night'
    };
    sb.className = 'state-banner ' + (map[st] || 'sb-security-day');
    sb.textContent = st.replace('_',' ');
  }
}

function renderPeople(m){
  const arr=Array.isArray(m.people)?m.people:[];
  const n=arr.filter(p=>p.onlineSmart||p.onlineRaw).length;
  const ppl=$('#peopleOnline'); if(ppl) ppl.textContent=n+' in casa';
  const chips=$('#peopleChips'); if(!chips) return; chips.innerHTML='';
  arr.forEach(p=>{ const on=(p.onlineSmart||p.onlineRaw); const el=document.createElement('div'); el.className='chip'; el.innerHTML=`<span class="dot ${on?'on':'off'}"></span>${p.name}`; chips.appendChild(el); });
}

function renderWeather(m){
  const w=(m&&m.weather)||{}; console.log('[UI] weather (backend) =',w);
  const tempTxt=(typeof w.tempC==='number')?Math.round(w.tempC)+'°C':'N/D';
  const temp=$('#weatherTemp'); if(temp) temp.textContent=tempTxt;
  const wc=mapWeatherCode(w.icon); const prov=$('#weatherProvider'); if(prov) prov.textContent=(wc.icon?wc.icon+' ':'')+(w.provider||'—');
  const dot=$('#weatherDot'); if(dot){ dot.style.background='#ffc107'; dot.style.boxShadow='0 0 10px #ffc107cc'; }
}

async function getLatLonFromConfigOrBrowser(){
  const cfg=(typeof CONFIG!=='undefined'&&CONFIG&&CONFIG.WEATHER)?CONFIG.WEATHER:{};
  if(typeof cfg.lat==='number'&&typeof cfg.lon==='number') return {lat:cfg.lat,lon:cfg.lon,tz:cfg.tz||'Europe/Rome'};
  return await new Promise((resolve,reject)=>{
    if(!('geolocation' in navigator)) return reject(new Error('no geolocation'));
    navigator.geolocation.getCurrentPosition(p=>resolve({lat:p.coords.latitude,lon:p.coords.longitude,tz:cfg.tz||'Europe/Rome'}),reject,{timeout:3000,maximumAge:600000});
  });
}
async function fetchWeatherClient(){
  const {lat,lon,tz}=await getLatLonFromConfigOrBrowser();
  const url='https://api.open-meteo.com/v1/forecast?latitude='+encodeURIComponent(lat)+'&longitude='+encodeURIComponent(lon)+'&current=temperature_2m,weather_code&timezone='+encodeURIComponent(tz||'Europe/Rome');
  const r=await fetch(url); if(!r.ok) throw new Error('Open-Meteo HTTP '+r.status); const js=await r.json();
  const t=(js&&js.current&&typeof js.current.temperature_2m==='number')?js.current.temperature_2m:null; const wc=(js&&js.current&&js.current.weather_code!=null)?String(js.current.weather_code):''; return {tempC:t,icon:wc,provider:'Open‑Meteo'};
}
async function ensureWeatherFallback(model){
  try{
    const force=!!(CONFIG&&CONFIG.WEATHER&&CONFIG.WEATHER.forceClient);
    const has=(model&&model.weather&&typeof model.weather.tempC==='number');
    if(has && !force) return;
    const w=await fetchWeatherClient(); renderWeather({weather:w});
    const wc=mapWeatherCode(w.icon); const prov=$('#weatherProvider'); if(prov) prov.textContent=(wc.icon?wc.icon+' ':'')+(w.provider||'Open‑Meteo');
    console.log('[UI] weather (client) =', w);
  }catch(e){ console.warn('Weather client fallback failed:',e); }
}

function renderEnergy(m){ const k=(m.energy&&m.energy.kwh!=null)?m.energy.kwh:null; const ek=$('#energyKwh'); if(ek) ek.textContent=(k==null?'—':fmtNum(k)); }

function getShuttersUp(){ try{ return localStorage.getItem('ui_shutters_up')==='1'; }catch(_){ return false; } }
function setShuttersUp(v){ try{ localStorage.setItem('ui_shutters_up', v?'1':'0'); }catch(_){ } }

function renderFavorites(m){
  const grid=$('#favoritesGrid'); if(!grid) return; grid.innerHTML='';
  (CONFIG.FAVORITES||[]).forEach(f=>{
    let isOn = (f.kind==='toggle' && f.stateKey && !!m[f.stateKey]);
    if(f.id==='tapparelle'){ isOn=getShuttersUp(); }

    const tile=document.createElement('div'); tile.className='fav'+(isOn?' active':'');
    const status = (f.id==='tapparelle') ? (isOn?'Aperte':'Chiuse') : (f.kind==='toggle' ? (isOn?'On':'Off') : '');

    tile.innerHTML = `
      <div class="top-row">
        <div class="label-col">
          <div class="title">${f.label}</div>
          <div class="status">${status}</div>
        </div>
        <div class="power-btn" data-id="${f.id}">
          <svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 2v10m6.9 5.5a9 9 0 1 1-13.8 0"/></svg>
        </div>
      </div>`;

    // click sulla card
    tile.addEventListener('click',()=>{
      if(f.id==='piante'){ callAdmin('piante',{},()=>{},()=>{}); return; }
      if(f.id==='tapparelle'){
        const next=!isOn; // next true=apri
        callAdmin(next?'alza_tutto':'abbassa_tutto',{},()=>{},()=>{});
        setShuttersUp(next); // aggiorna stato locale
        setTimeout(loadAll, 800);
      }
    });

    // click sul pulsante power
    tile.querySelector('.power-btn').addEventListener('click',(ev)=>{
      ev.stopPropagation();
      if(f.id==='tapparelle'){
        const next=!isOn; callAdmin(next?'alza_tutto':'abbassa_tutto',{},()=>{},()=>{}); setShuttersUp(next); setTimeout(loadAll, 800); return;
      }
      if(f.kind==='toggle' && f.toggleEvent){ const next=!isOn; callAdmin(f.toggleEvent,{value:String(next)},()=>{ setTimeout(loadAll,400); },()=>{}); }
    });

    grid.appendChild(tile);
  });
}

function renderVimar(m){
  const v=m.vimar||{shutters:[],thermostats:[],hvac:[]};
  const sh=$('#vimarShutters'); if(sh){ sh.innerHTML=''; v.shutters.forEach(x=>{ const row=document.createElement('div'); row.className='row'; row.innerHTML=`<div><div class='title'>${x.name||x.id||'—'}</div><div class='sub'>${x.room||''} ${x.online?'· Online':'· Offline'}</div></div><div class='controls'><button class='small-btn' data-cmd='up'>Su</button><button class='small-btn' data-cmd='stop'>Stop</button><button class='small-btn' data-cmd='down'>Giu</button></div>`; row.querySelectorAll('button').forEach(b=> b.addEventListener('click',()=> callAdmin('vimar_shutter',{id:x.id,cmd:b.getAttribute('data-cmd')},()=>{},()=>{}) )); sh.appendChild(row); }); }
  const th=$('#vimarThermo'); if(th){ th.innerHTML=''; v.thermostats.forEach(x=>{ const row=document.createElement('div'); row.className='row'; row.innerHTML=`<div><div class='title'>${x.name||x.id||'—'}</div><div class='sub'>${x.room||''} · T=${x.temp??'—'}° · Set=${x.setpoint??'—'}° · ${x.mode||''}</div></div><div class='controls'><button class='small-btn' data-op='dec'>-</button><button class='small-btn' data-op='inc'>+</button><button class='small-btn' data-op='modeNext'>Mode</button></div>`; row.querySelectorAll('button').forEach(b=> b.addEventListener('click',()=> callAdmin('vimar_thermo',{id:x.id,op:b.getAttribute('data-op').toLowerCase()},()=>{},()=>{}) )); th.appendChild(row); }); }
  const hv=$('#vimarHvac'); if(hv){ hv.innerHTML=''; v.hvac.forEach(x=>{ const row=document.createElement('div'); row.className='row'; row.innerHTML=`<div><div class='title'>${x.name||x.id||'—'}</div><div class='sub'>${x.room||''} · ${x.mode||''} · Set=${x.setpoint??'—'}° · Fan=${x.fan||''}</div></div><div class='controls'><button class='small-btn' data-op='powerToggle'>Power</button><button class='small-btn' data-op='dec'>-</button><button class='small-btn' data-op='inc'>+</button><button class='small-btn' data-op='modeNext'>Mode</button><button class='small-btn' data-op='fanNext'>Fan</button></div>`; row.querySelectorAll('button').forEach(b=> b.addEventListener('click',()=> callAdmin('vimar_hvac',{id:x.id,op:b.getAttribute('data-op')},()=>{},()=>{}) )); hv.appendChild(row); }); }
}

function renderLogs(logs){ const list=$('#log'), empty=$('#logEmpty'); if(!list) return; list.innerHTML=''; if(!logs||!logs.length){ if(empty) empty.textContent='Nessun log recente.'; return;} if(empty) empty.textContent=''; logs.forEach(x=>{ const row=document.createElement('div'); row.className='row'; const ts=(x.ts?new Date(x.ts).toLocaleString('it-IT'):'—'); row.innerHTML=`<div><div class='title'>${x.code||'—'}<span class='sub'> · ${x.stato||''}</span></div><div class='sub'>${ts} · ${x.desc||''} ${x.note?('· '+x.note):''}</div></div>`; list.appendChild(row); }); }

function activateTab(t){$$('.tab').forEach(b=>b.classList.toggle('active',b.getAttribute('data-target')===t));$$('.view').forEach(v=>v.classList.toggle('active',v.id==='view-'+t));window.scrollTo({top:0,behavior:'smooth'});}

function loadAll(){ fetchModel((m)=>{ LAST_MODEL=m; try{ renderState(m); renderPeople(m); renderWeather(m); renderEnergy(m); renderFavorites(m); renderVimar(m); ensureWeatherFallback(m); const err = (m.alerts && Number(m.alerts.logErrors)) || 0;
const badge = $('#badgeLog'); if (badge) badge.hidden = (err <= 0);

// Mostra/occulta ⋮
const kb = $('#btnKebab'); if (kb) kb.hidden = (err <= 0); const ts=$('#ts'); if(ts) ts.textContent='Aggiornamento: '+fmtTime(m.meta&&m.meta.nowIso); }catch(e){console.error(e);} }, (e)=>{ console.error('Model error',e); }); }
function loadLogs(){ fetchLogs(d=>renderLogs((d&&d.logs)||[]), e=>console.error('Logs error',e)); }

document.addEventListener('DOMContentLoaded',()=>{ $$('.tab').forEach(t=>t.addEventListener('click',()=> activateTab(t.getAttribute('data-target')))); $$('.menu-btn').forEach(b=>b.addEventListener('click',()=> activateTab(b.getAttribute('data-target')))); const btn=$('#btnRefreshLog'); if(btn) btn.addEventListener('click', loadLogs); console.log('[CFG] BASE_URL =', (typeof CONFIG!=='undefined'&&CONFIG&&CONFIG.BASE_URL)?CONFIG.BASE_URL:'(manca CONFIG.BASE_URL)'); loadAll(); loadLogs(); if(CONFIG && CONFIG.AUTO_REFRESH_MS>0) setInterval(loadAll, CONFIG.AUTO_REFRESH_MS); // ...quello che già hai...

  const go = $('#btnHomeGo');
  if (go) go.addEventListener('click', () => activateTab('home'));

  const kebab = $('#btnKebab');
  if (kebab) kebab.addEventListener('click', () => activateTab('log'));

  const add = $('#btnAdd');
  if (add) add.addEventListener('click', () => activateTab('devices')); // o quello che preferisci

  // Titolo "Casa"
  const nm = $('#homeName'); if (nm) nm.textContent = 'Casa';
});

// ============================================================
// app.js — Automazione Casa · SmartThings-style v2.1
// ============================================================
'use strict';

let MODEL = null;
let _toastTimer = null;
let _cbId = 0;

const $ = (sel, ctx) => (ctx || document).querySelector(sel);
const $$ = (sel, ctx) => Array.from((ctx || document).querySelectorAll(sel));

function fmtTime(iso) {
  try { return new Date(iso).toLocaleTimeString('it-IT', { hour:'2-digit', minute:'2-digit' }); }
  catch(_) { return '—'; }
}
function fmtDateTime(iso) {
  try { return new Date(iso).toLocaleString('it-IT', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' }); }
  catch(_) { return '—'; }
}
function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''; }
const getShuttersUp = () => { try { return localStorage.getItem('ui_shutters_up')==='1'; } catch(_){ return false; } };
const setShuttersUp = v => { try { localStorage.setItem('ui_shutters_up', v?'1':'0'); } catch(_){} };

/* ---- Toast ---- */
function toast(msg, ms=2200) {
  const el = $('#toast'); if(!el) return;
  el.textContent = msg; el.classList.add('show');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => el.classList.remove('show'), ms);
}

/* ---- JSONP ---- */
function jsonpFetch(url) {
  return new Promise((resolve, reject) => {
    const id = '__cb_' + (++_cbId);
    const sep = url.includes('?') ? '&' : '?';
    const el = document.createElement('script');
    const timer = setTimeout(() => { cleanup(); reject(new Error('timeout')); }, 15000);
    function cleanup() { try { delete window[id]; el.remove(); } catch(_){} }
    window[id] = data => { clearTimeout(timer); cleanup(); resolve(data); };
    el.src = url + sep + 'callback=' + id + '&_=' + Date.now();
    el.onerror = () => { clearTimeout(timer); cleanup(); reject(new Error('load error')); };
    document.head.appendChild(el);
  });
}

function callAdmin(event, params) {
  return new Promise(resolve => {
    const u = new URL(CONFIG.DOGET_URL);
    u.searchParams.set('event', event);
    if(params) Object.entries(params).forEach(([k,v]) => u.searchParams.set(k, String(v)));
    jsonpFetch(u.toString())
      .then(d => { if(d && d.ok===false) toast('⚠️ '+(d.err||d.error||'Errore')); resolve(d); })
      .catch(() => { toast('❌ Errore connessione'); resolve(null); });
  });
}

function fetchModel() { return jsonpFetch(CONFIG.DOGET_URL); }
function fetchLogs()  { return jsonpFetch(CONFIG.DOGET_URL + '?logs=1'); }

/* ---- Weather client-side ---- */
async function fetchWeatherClient() {
  const w = CONFIG.WEATHER||{}; if(!w.lat||!w.lon) return null;
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${w.lat}&longitude=${w.lon}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&timezone=${encodeURIComponent(w.tz||'Europe/Rome')}`;
  const r = await fetch(url); if(!r.ok) return null;
  const js = await r.json(); const c = js.current||{};
  return { tempC:c.temperature_2m??null, humidity:c.relative_humidity_2m??null, windKmh:c.wind_speed_10m??null, icon:String(c.weather_code??''), provider:'Open-Meteo' };
}

function weatherEmoji(code) {
  const n = parseInt(code);
  if(n===0) return '☀️'; if(n<=3) return '🌤️'; if(n<=48) return '🌫️';
  if(n<=67) return '🌧️'; if(n<=77) return '🌨️'; if(n<=82) return '🌦️';
  if(n<=99) return '⛈️'; return '🌡️';
}

/* ============================================================ RENDER ============================================================ */

function renderBanner(m) {
  const el = $('#state-banner'); if(!el) return;
  const st = String(m.state||'').toUpperCase();
  const map = { COMFY_DAY:'sb-comfy-day', COMFY_NIGHT:'sb-comfy-night', SECURITY_DAY:'sb-security-day', SECURITY_NIGHT:'sb-security-night' };
  el.className = 'state-banner ' + (map[st]||'sb-security-day');
  el.innerHTML = `<span class="banner-dot"></span>${st.replace(/_/g,' ')}`;
}

function renderCards(m) {
  const people = Array.isArray(m.people) ? m.people : [];
  const inCount = people.filter(p => p.onlineSmart).length;
  const el = $('#people-count'); if(el) el.textContent = inCount;
  const card = $('#card-presence'); if(card) card.classList.toggle('card-glow', inCount>0);
}

function renderWeather(w) {
  if(!w) return;
  const tv=$('#temp-val'); if(tv&&w.tempC!=null)    tv.textContent=Math.round(w.tempC);
  const hv=$('#hum-val');  if(hv&&w.humidity!=null) hv.textContent=Math.round(w.humidity);
  const wv=$('#wind-val'); if(wv&&w.windKmh!=null)  wv.textContent=Math.round(w.windKmh);
  // Pill topbar
  const pe=$('#weather-emoji');
  const pt=$('#weather-pill-temp');
  if(pe) pe.textContent = w.icon!=null ? weatherEmoji(w.icon) : (w.iconEmoji||'🌡️');
  if(pt) pt.textContent = w.tempC!=null ? Math.round(w.tempC)+'°' : '—';
}

function favGlyph(id) {
  return ({tapparelle:'icons/st/glyph-shutter.svg',piante:'icons/st/glyph-plant.svg',vacanza:'icons/st/glyph-suit.svg',override:'icons/st/glyph-moon.svg'})[id]||'icons/st/glyph-generic.svg';
}

function renderFavorites(m) {
  const grid = $('#fav-grid'); if(!grid) return;
  grid.innerHTML = '';
  (CONFIG.FAVORITES||[]).forEach(f => {
    let isOn = false;
    if(f.id==='tapparelle') isOn=getShuttersUp();
    else if(f.id==='vacanza')  isOn=!!m.vacanza;
    else if(f.id==='override') isOn=!!m.override;
    else if(f.stateKey)        isOn=!!m[f.stateKey];
    const statusText = f.id==='tapparelle'?(isOn?'Aperte':'Chiuse'):f.kind==='toggle'?(isOn?'Attivo':'Disattivo'):'';
    const card = document.createElement('article');
    card.className = 'fav-card'+(isOn?' active':'');
    card.innerHTML = `
      <div class="fav-glyph" style="background:${f.color||'#f0f0f0'}"><img src="${favGlyph(f.id)}" alt=""></div>
      <button class="fav-action" aria-label="azione"><img src="${f.kind==='action'?'icons/st/ui-play.svg':'icons/st/ui-power.svg'}" alt=""></button>
      <div class="fav-label">${f.label}</div>
      <div class="fav-sub">${f.subtitle||''}</div>
      ${statusText?`<div class="fav-status">${statusText}</div>`:''}`;
    const doAction = async () => {
      if(f.id==='tapparelle'){ const next=!isOn; setShuttersUp(next); toast(next?'⬆️ Alzo…':'⬇️ Abbasso…'); await callAdmin(next?(f.upEvent||'alza_tutto'):(f.downEvent||'abbassa_tutto'),{manual:'TRUE'}); setTimeout(loadAll,800); }
      else if(f.id==='vacanza'){ const next=!isOn; toast(next?'🏝️ Vacanza ON':'🏠 OFF'); await callAdmin('set_vacanza',{value:String(next)}); setTimeout(loadAll,500); }
      else if(f.id==='override'){ const next=!isOn; toast(next?'🛡️ Override ON':'✅ OFF'); await callAdmin('set_override',{value:String(next)}); setTimeout(loadAll,500); }
      else if(f.kind==='toggle'&&f.toggleEvent){ const next=!isOn; toast(`${f.label}: ${next?'ON':'OFF'}`); await callAdmin(f.toggleEvent,{value:String(next)}); setTimeout(loadAll,500); }
      else if(f.kind==='action'&&f.event){ toast(`▶️ ${f.label}…`); await callAdmin(f.event); }
    };
    card.addEventListener('click', e => { if(!e.target.closest('.fav-action')) doAction(); });
    card.querySelector('.fav-action').addEventListener('click', e => { e.stopPropagation(); doAction(); });
    grid.appendChild(card);
  });
}

/* ---- People chips con indicatore SSID ---- */
function renderPeopleChips(m) {
  const host = $('#people-chips'); if(!host) return;
  host.className = 'people-chips'; host.innerHTML = '';
  const people = Array.isArray(m.people) ? m.people : [];
  if(!people.length){ host.innerHTML='<div class="empty-state">Nessuna persona.</div>'; return; }
  const sorted = [...people].sort((a,b) => {
    if(a.onlineSmart!==b.onlineSmart) return a.onlineSmart?-1:1;
    return String(a.name).localeCompare(String(b.name),'it');
  });
  sorted.forEach(p => {
    const st = p.onlineSmart ? 'in' : 'out';
    const ini = String(p.name||'?').charAt(0).toUpperCase();
    const ago = p.lastLifeMinAgo!=null ? `${p.lastLifeMinAgo} min fa` : '—';
    // SSID lock badge
    const ssidBadge = p.ssidLock
      ? '<span class="ssid-badge">📶 Wi-Fi</span>'
      : '';
    const chip = document.createElement('div');
    chip.className = `person-chip ${st}`;
    chip.innerHTML = `
      <div class="person-avatar ${st}">${ini}</div>
      <div class="person-info">
        <div class="person-name">${cap(p.name)} ${ssidBadge}</div>
        <div class="person-meta">${p.onlineSmart?'IN casa':'Fuori'} · ${ago}</div>
      </div>
      <span class="person-badge ${st}">${st.toUpperCase()}</span>`;
    host.appendChild(chip);
  });
}

function renderEvents(m) {
  const list = $('#events-list'); if(!list) return;
  list.innerHTML = '';
  const nx = m.next||{};
  const rows = [
    ['Piante (alba)',         nx.pianteAlba||null],
    ['Piante (post chiusura)',nx.piantePostClose||null],
    ['Chiusura tardiva',      nx.lateClose||null],
  ].filter(r=>r[1]);
  if(!rows.length){ list.innerHTML='<div class="empty-state">Nessun evento programmato.</div>'; return; }
  rows.forEach(([label,val]) => {
    const row=document.createElement('div'); row.className='event-row';
    row.innerHTML=`<span class="event-label">${label}</span><span class="event-val">${val}</span>`;
    list.appendChild(row);
  });
}

function renderDevices() {
  const DEV = CONFIG.DEVICES || {};

  /* ---- App links ---- */
  const appLinks = $('#app-links');
  if (appLinks) {
    appLinks.innerHTML = '';
    (DEV.APPS || []).forEach(app => {
      const card = document.createElement('a');
      card.className = 'app-link-card';
      card.href = '#';
      card.innerHTML = `
        <div class="app-link-icon" style="background:${app.color||'#f0f0f0'}">${app.icon||'📱'}</div>
        <div class="app-link-info">
          <div class="app-link-name">${app.label}</div>
          <div class="app-link-sub">${app.subtitle||''}</div>
        </div>
        <span class="app-link-arrow">›</span>
      `;
      card.addEventListener('click', e => {
        e.preventDefault();
        // Su iOS: window.location.href con URL scheme apre l'app se installata.
        // Se l'app non è installata, la pagina rimane e dopo 2s mandiamo all'App Store.
        const fallback = app.urlFallback || app.url;
        const t = setTimeout(() => { window.location.href = fallback; }, 2000);
        window.location.href = app.url;
        // Se l'app si apre, la pagina va in background e il timeout non scatta
        // (oppure viene cancellato al ritorno in foreground — buon comportamento)
        document.addEventListener('visibilitychange', function cancel() {
          if (document.hidden) { clearTimeout(t); document.removeEventListener('visibilitychange', cancel); }
        });
      });
      appLinks.appendChild(card);
    });
  }

  /* ---- Tapparelle ---- */
  const shutterList = $('#shutter-list');
  if (shutterList) {
    shutterList.innerHTML = '';
    (DEV.SHUTTERS || []).forEach(sh => {
      const card = document.createElement('div');
      card.className = 'shutter-card';
      card.innerHTML = `
        <span class="shutter-icon">${sh.icon||'🪟'}</span>
        <span class="shutter-label">${sh.label}</span>
        <div class="shutter-btns">
          <button class="sh-btn" data-ev="${sh.upEvent}"   title="Alza">⬆</button>
          <button class="sh-btn" data-ev="${sh.downEvent}" title="Abbassa">⬇</button>
        </div>`;
      card.querySelectorAll('.sh-btn').forEach(b => {
        b.addEventListener('click', async () => {
          toast(b.dataset.ev.startsWith('alza') ? `⬆️ ${sh.label}…` : `⬇️ ${sh.label}…`);
          await callAdmin(b.dataset.ev, { manual: 'TRUE' });
        });
      });
      shutterList.appendChild(card);
    });
  }

  /* ---- Termostati ---- */
  const thermoList = $('#thermostat-list');
  if (thermoList) {
    thermoList.innerHTML = '';
    (DEV.THERMOSTATS || []).forEach(t => {
      const card = document.createElement('div');
      card.className = 'shutter-card';
      card.innerHTML = `
        <span class="shutter-icon">${t.icon||'🌡️'}</span>
        <span class="shutter-label">${t.label}</span>
        <div class="shutter-btns">
          <button class="sh-btn" data-ev="${t.event}" title="${t.label}">▶</button>
        </div>`;
      card.querySelector('.sh-btn').addEventListener('click', async () => {
        toast(`${t.icon} ${t.label}…`);
        await callAdmin(t.event);
      });
      thermoList.appendChild(card);
    });
  }

  /* ---- Telecamere ---- */
  const camList = $('#camera-list');
  if (camList) {
    camList.innerHTML = '';
    // Raggruppa in coppie ON/OFF
    const cams = DEV.CAMERAS || [];
    const pairs = [];
    for (let i = 0; i < cams.length; i += 2) pairs.push([cams[i], cams[i+1]]);
    pairs.forEach(([on, off]) => {
      if (!on) return;
      const card = document.createElement('div');
      card.className = 'shutter-card';
      const label = on.label.replace(' ON','').replace(' on','');
      card.innerHTML = `
        <span class="shutter-icon">${on.icon||'📷'}</span>
        <span class="shutter-label">${label}</span>
        <div class="shutter-btns">
          <button class="sh-btn sh-on"  data-ev="${on.event}"  title="ON"  style="font-size:12px;font-weight:700;color:var(--green)">ON</button>
          ${off ? `<button class="sh-btn sh-off" data-ev="${off.event}" title="OFF" style="font-size:12px;font-weight:700;color:var(--muted)">OFF</button>` : ''}
        </div>`;
      card.querySelectorAll('.sh-btn').forEach(b => {
        b.addEventListener('click', async () => {
          const isOn = b.classList.contains('sh-on');
          toast(`${on.icon} ${label} ${isOn ? 'ON' : 'OFF'}…`);
          await callAdmin(b.dataset.ev);
        });
      });
      camList.appendChild(card);
    });
  }
}

/* ---- People detail con SSID badge ---- */
function renderPeopleDetail(m) {
  const list = $('#people-detail');
  if(list) {
    list.innerHTML = '';
    const people = Array.isArray(m.people)?m.people:[];
    const sorted = [...people].sort((a,b)=>{
      if(a.onlineSmart!==b.onlineSmart) return a.onlineSmart?-1:1;
      return String(a.name).localeCompare(String(b.name),'it');
    });
    sorted.forEach(p => {
      const st = p.onlineSmart?'in':'out';
      const ini = String(p.name||'?').charAt(0).toUpperCase();
      const ago = p.lastLifeMinAgo!=null?`${p.lastLifeMinAgo} min fa`:'—';
      const ssidStatus = p.ssidLock ? '📶 Wi-Fi connesso · lock attivo' : '📵 Wi-Fi non rilevato';
      const card = document.createElement('div'); card.className='people-detail-card';
      card.innerHTML=`
        <div class="pdc-top">
          <div class="pdc-avatar ${st}">${ini}</div>
          <div>
            <div class="pdc-name">${cap(p.name)}</div>
            <div class="pdc-state" style="color:${st==='in'?'var(--green)':'var(--muted)'}">${st==='in'?'● In casa':'○ Fuori'} · ${ago}</div>
            <div class="pdc-ssid">${ssidStatus}</div>
          </div>
        </div>
        <div class="pdc-actions">
          <button class="pdc-btn btn-in"  data-name="${p.name}">✅ Forza IN</button>
          <button class="pdc-btn btn-out" data-name="${p.name}">❌ Forza OUT</button>
        </div>`;
      card.querySelector('.btn-in').addEventListener('click', async()=>{ toast('✅ Forza IN '+cap(p.name)+'…'); await callAdmin('force_in',{name:p.name}); setTimeout(loadAll,700); });
      card.querySelector('.btn-out').addEventListener('click', async()=>{ toast('❌ Forza OUT '+cap(p.name)+'…'); await callAdmin('force_out',{name:p.name}); setTimeout(loadAll,700); });
      list.appendChild(card);
    });
  }

  const qa=$('#quick-actions');
  if(qa){
    qa.innerHTML='';
    [
      {icon:'⬆️',label:'Alza tutto',    fn:async()=>{ toast('⬆️ Alzo…'); setShuttersUp(true);  await callAdmin('alza_tutto',{manual:'TRUE'}); }},
      {icon:'⬇️',label:'Abbassa tutto', fn:async()=>{ toast('⬇️ Abbasso…'); setShuttersUp(false); await callAdmin('abbassa_tutto'); }},
      {icon:'🌿',label:'Piante ora',    fn:async()=>{ toast('🌿 Irrigazione…'); await callAdmin('piante'); }},
      {icon:'🏝️',label:'Toggle vacanza',fn:async()=>{ const next=!MODEL?.vacanza; toast(next?'🏝️ Vacanza ON':'🏠 OFF'); await callAdmin('set_vacanza',{value:String(next)}); setTimeout(loadAll,500); }},
      {icon:'🛡️',label:'Toggle override',fn:async()=>{ const next=!MODEL?.override; toast(next?'🛡️ Override ON':'✅ OFF'); await callAdmin('set_override',{value:String(next)}); setTimeout(loadAll,500); }},
      {icon:'🔄',label:'Aggiorna',      fn:()=>loadAll()},
    ].forEach(a=>{
      const btn=document.createElement('button'); btn.className='qa-btn';
      btn.innerHTML=`<span class="qa-icon">${a.icon}</span>${a.label}`;
      btn.addEventListener('click',a.fn); qa.appendChild(btn);
    });
  }
}

function renderSettings(m) {
  const list=$('#settings-list');
  if(list){
    list.innerHTML='';
    [{label:'Vacanza',sub:'Modalità assenza',key:'vacanza',event:'set_vacanza'},{label:'Override',sub:'Sospendi automazioni',key:'override',event:'set_override'}].forEach(r=>{
      const isOn=!!m[r.key];
      const row=document.createElement('div'); row.className='setting-row';
      row.innerHTML=`<div><div class="setting-label">${r.label}</div><div class="setting-sub">${r.sub}</div></div><label class="toggle-wrap"><input type="checkbox" ${isOn?'checked':''}><span class="toggle-slider"></span></label>`;
      row.querySelector('input').addEventListener('change', async e=>{ const next=e.target.checked; toast(`${r.label}: ${next?'ON':'OFF'}`); await callAdmin(r.event,{value:String(next)}); setTimeout(loadAll,500); });
      list.appendChild(row);
    });
  }

  const info=$('#info-card');
  if(info){
    const stato   = String(m.state||'—').replace(/_/g,' ');
    const night   = m.notte?'🌙 Notte':'☀️ Giorno';
    const alba    = m.meta?.albaIso    ? fmtTime(m.meta.albaIso)    : (m.next?.alba    ? fmtDateTime(m.next.alba)    : '—');
    const tram    = m.meta?.tramontoIso? fmtTime(m.meta.tramontoIso): (m.next?.tramonto? fmtDateTime(m.next.tramonto): '—');
    const updated = m.meta?.nowIso ? fmtDateTime(m.meta.nowIso) : '—';
    const errors  = (m.alerts&&Number(m.alerts.logErrors))||0;
    // Conta persone con SSID lock attivo
    const ssidActive = (Array.isArray(m.people)?m.people:[]).filter(p=>p.ssidLock).map(p=>cap(p.name)).join(', ')||'—';
    info.innerHTML=[
      ['Stato',       stato],
      ['Ora',         night],
      ['Alba',        alba],
      ['Tramonto',    tram],
      ['Aggiornato',  updated],
      ['Errori log',  String(errors)],
      ['Wi-Fi lock',  ssidActive],
    ].map(([k,v])=>`<div class="info-row"><span class="info-key">${k}</span><span class="info-val">${v}</span></div>`).join('');
  }
}

function renderLogs(logs) {
  const list=$('#log-list'), empty=$('#log-empty'); if(!list) return;
  list.innerHTML='';
  if(!logs||!logs.length){ if(empty) empty.hidden=false; return; }
  if(empty) empty.hidden=true;
  logs.forEach(x=>{
    const isErr=/err/i.test(x.code||'');
    const row=document.createElement('div'); row.className='log-row'+(isErr?' log-err':'');
    row.innerHTML=`<div class="log-code">${x.code||'—'} <span style="opacity:.5;font-weight:400;font-size:11px">· ${x.stato||''}</span></div><div class="log-meta">${x.ts?fmtDateTime(x.ts):'—'}</div>${(x.desc||x.note)?`<div class="log-desc">${x.desc||''}${x.note?' · '+x.note:''}</div>`:''}`;
    list.appendChild(row);
  });
}

function updateErrorBadge(m) {
  const n=(m.alerts&&Number(m.alerts.logErrors))||0;
  const dot=$('#dot-err'); if(dot) dot.hidden=!n;
  const badge=$('#badge-log'); if(badge) badge.hidden=!n;
}

function updateTs(m) {
  const el=$('#ts'); if(!el) return;
  el.textContent = m.meta?.nowIso ? fmtTime(m.meta.nowIso) : fmtTime(new Date().toISOString());
}

/* ---- Load ---- */
async function loadAll() {
  const btn=$('#btn-refresh'); if(btn) btn.style.opacity='.4';
  try{
    const m = await fetchModel();
    MODEL = m;
    renderBanner(m); renderCards(m); renderFavorites(m);
    renderPeopleChips(m); renderEvents(m); renderDevices();
    renderPeopleDetail(m); renderSettings(m);
    updateErrorBadge(m); updateTs(m);
    const w=m.weather||{};
    // Temperatura/umidità/vento dal backend se disponibili
    if(w.tempC!=null||w.humidity!=null) renderWeather(w);
    // Sempre ricarica da Open-Meteo per avere l'emoji meteo aggiornata
    fetchWeatherClient().then(renderWeather).catch(()=>{});
  }catch(e){ console.error('loadAll:',e); toast('⚠️ Errore caricamento'); }
  finally{ if(btn) btn.style.opacity=''; }
}

async function loadLogs() {
  try{ const data=await fetchLogs(); renderLogs((data&&data.logs)||[]); }
  catch(e){ const el=$('#log-empty'); if(el){el.textContent='Errore caricamento log.';el.hidden=false;} }
}

function activateTab(target) {
  $$('.tab').forEach(b=>b.classList.toggle('active',b.dataset.target===target));
  $$('.view').forEach(v=>v.classList.toggle('active',v.id==='view-'+target));
  window.scrollTo({top:0,behavior:'smooth'});
  if(target==='log') loadLogs();
}

document.addEventListener('DOMContentLoaded', () => {
  $$('.tab').forEach(t=>t.addEventListener('click',()=>activateTab(t.dataset.target)));
  $('#btn-refresh')?.addEventListener('click',()=>{
    // Hard reload — bypassa service worker e cache browser
    if('serviceWorker' in navigator){
      navigator.serviceWorker.getRegistrations().then(regs => {
        regs.forEach(r => r.unregister());
      });
    }
    // Forza reload senza cache
    window.location.reload(true);
  });
  $('#btn-log')?.addEventListener('click',()=>activateTab('log'));
  loadAll();
  if(CONFIG.AUTO_REFRESH_MS>0) setInterval(loadAll, CONFIG.AUTO_REFRESH_MS);
  document.addEventListener('visibilitychange',()=>{ if(!document.hidden) loadAll(); });
});

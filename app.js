/* Helpers */
const $  = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);
const pick = (o,p)=>p.split('.').reduce((x,k)=>(x && x[k]!==undefined)?x[k]:undefined,o);
const qs = (base, q) => base + (base.includes('?')?'&':'?') + q;

/* ---------- FAVORITES (push / pushToggle) ---------- */
function renderFavorites(){
  const tiles = APP_CONFIG.tiles || [];
  const favIds = (APP_CONFIG.favorites && APP_CONFIG.favorites.length)
    ? APP_CONFIG.favorites
    : tiles.map(t => t.id);
  const byId = new Map(tiles.map(t => [t.id,t]));
  $('#favoritesGrid').innerHTML = favIds.map(id=>{
    const t = byId.get(id); if(!t) return '';
    return `
      <article class="tile click" data-id="${t.id}" data-type="${t.type}">
        <div class="title">${t.label}</div>
        <div class="state">—</div>
      </article>
    `;
  }).join('');
}

/* ---------- TABBAR ---------- */
function initTabbar(){
  $('.tabbar').addEventListener('click', ev=>{
    const tab = ev.target.closest('.tab'); if(!tab) return;
    const target = tab.dataset.target;
    $$('.tab').forEach(b=>b.classList.toggle('active', b===tab));
    $$('.view').forEach(v=>v.classList.remove('active'));
    $(`#view-${target}`)?.classList.add('active');
    if(target==='devices') renderDevicesCached();
    if(target==='log') loadLogs();
  });
  // quick from menu
  $('#view-menu').addEventListener('click', e=>{
    const b=e.target.closest('.menu-btn'); if(!b) return;
    document.querySelector(`.tab[data-target="${b.dataset.target}"]`)?.click();
  });
}

/* ---------- FAVORITES ACTIONS ---------- */
function bindFavoriteActions(){
  $('#favoritesGrid').addEventListener('click', async ev=>{
    const card = ev.target.closest('.tile'); if(!card) return;
    const id = card.dataset.id;
    const t = (APP_CONFIG.tiles||[]).find(x=>x.id===id);
    if(!t) return;

    if(t.type==='push'){
      const url = qs(APP_CONFIG.endpoint, t.action.url);
      try{ await fetch(url,{method:'GET',mode:'no-cors'});}catch(_){}
      return;
    }
    if(t.type==='pushToggle'){
      const active = card.classList.contains('on');
      const url = qs(APP_CONFIG.endpoint, active ? t.toggle.off : t.toggle.on);
      try{ await fetch(url,{method:'GET',mode:'no-cors'});}catch(_){}
      return;
    }
  });
}

/* ---------- LOAD STATE ---------- */
async function loadState(){
  try{
    const model = await jsonp(APP_CONFIG.endpoint, APP_CONFIG.jsonpCallbackParam || 'callback');
    window.__lastModel = model;
    apply(model);
    $('#ts').textContent = 'Aggiornamento: ' + new Date().toLocaleTimeString();
    // badge su Log se errori
    const hasErr = Number(pick(model,'alerts.logErrors')||0) > 0;
    document.querySelector('.tab[data-target="log"]')?.classList.toggle('has-dot', hasErr);
  }catch(e){
    $('#ts').textContent = 'Errore di connessione';
  }
}

/* ---------- APPLY UI ---------- */
function apply(m){
  // Nome & Stato Casa
  $('#homeName').textContent = APP_CONFIG.title || 'Casa';
  const stRaw = String(pick(m, APP_CONFIG.paths.homeState)||'').toUpperCase();
  const chip = $('#chipState');
  chip.textContent = stRaw || '—';
  chip.classList.remove('neutral','comfy','security');
  if(/^COMFY/.test(stRaw))        chip.classList.add('comfy');
  else if(/^SECURITY|NIGHT/.test(stRaw)) chip.classList.add('security');
  else                              chip.classList.add('neutral');

  // Meteo
  const t = pick(m, APP_CONFIG.paths.weatherTemp);
  $('#weatherTemp').textContent = (t!=null) ? `${Math.round(t)} °C` : '— °C';
  $('#weatherProvider').textContent = pick(m,'weather.provider') || 'The Weather Channel';

  // Dashboard
  const off = pick(m, APP_CONFIG.paths.offlineCount);
  $('#offlineCount').textContent = (off!=null) ? off : '—';
  const kwh = pick(m, APP_CONFIG.paths.energyKwh);
  $('#energyKwh').textContent = (kwh!=null) ? Number(kwh).toFixed(2) : '—';

  // Favorites
  (APP_CONFIG.tiles||[]).forEach(t=>{
    const el = document.querySelector(`.tile[data-id="${t.id}"]`);
    if(!el) return;
    if(t.type==='push'){
      el.classList.toggle('on', false);
      el.querySelector('.state').textContent = 'Premi per eseguire';
    }else if(t.type==='pushToggle'){
      const active = !!pick(m, t.path);
      el.classList.toggle('on', active);
      el.querySelector('.state').textContent = active ? 'Disattiva' : 'Attiva';
    }
  });

  renderDevicesCached();
}

/* ---------- DEVICES VIEW (Vimar + Persone) ---------- */
function renderDevicesCached(){
  const m = window.__lastModel || {};
  // Persone chips
  const arr = Array.isArray(m.people) ? m.people : [];
  $('#peopleChips').innerHTML = arr.length
    ? arr.map(p=>{
        const inHome = !!(p.onlineSmart || p.onlineRaw);
        return `<span class="badge ${inHome?'in':'out'}">${p.name} · ${inHome?'Online':'Offline'}</span>`;
      }).join('')
    : `<span class="muted" style="margin:6px">Nessuna persona</span>`;

  // Tapparelle con controlli up/stop/down
  const shutters = pick(m, 'vimar.shutters') || [];
  $('#vimarShutters').innerHTML = shutters.length ? shutters.map(s=>`
    <div class="row">
      <div class="meta">
        <div class="title">${s.name || 'Tapparella'}</div>
        <div class="sub">${s.room || ''}</div>
      </div>
      <div class="controls">
        <button class="ctl-btn" title="Su" onclick="cmdShutter('${encodeURIComponent(s.id)}','up')">
          <svg viewBox="0 0 24 24"><path fill="currentColor" d="M7 14l5-5 5 5z"/></svg>
        </button>
        <button class="ctl-btn" title="Stop" onclick="cmdShutter('${encodeURIComponent(s.id)}','stop')">
          <svg viewBox="0 0 24 24"><path fill="currentColor" d="M6 6h12v12H6z"/></svg>
        </button>
        <button class="ctl-btn" title="Giu" onclick="cmdShutter('${encodeURIComponent(s.id)}','down')">
          <svg viewBox="0 0 24 24"><path fill="currentColor" d="M7 10l5 5 5-5z"/></svg>
        </button>
      </div>
    </div>
  `).join('') : `<div class="muted" style="margin:6px">Nessuna tapparella</div>`;

  // Termostati con setpoint +/- e mode cycle
  const ths = pick(m, 'vimar.thermostats') || [];
  $('#vimarThermo').innerHTML = ths.length ? ths.map(t=>`
    <div class="row">
      <div class="meta">
        <div class="title">${t.name || 'Termostato'}</div>
        <div class="sub">${t.room || ''}</div>
      </div>
      <div class="controls">
        <button class="ctl-btn" title="Setpoint -" onclick="cmdThermo('${encodeURIComponent(t.id)}','dec')">
          <svg viewBox="0 0 24 24"><path fill="currentColor" d="M5 11h14v2H5z"/></svg>
        </button>
        <div class="muted">${fmtTemp(t.setpoint)}</div>
        <button class="ctl-btn" title="Setpoint +" onclick="cmdThermo('${encodeURIComponent(t.id)}','inc')">
          <svg viewBox="0 0 24 24"><path fill="currentColor" d="M11 5h2v14h-2zM5 11h14v2H5z"/></svg>
        </button>
        <button class="ctl-btn" title="Mode" onclick="cmdThermo('${encodeURIComponent(t.id)}','modeNext')">
          <svg viewBox="0 0 24 24"><path fill="currentColor" d="M7 6h10v2H7zm0 10h10v2H7zm0-5h10v2H7z"/></svg>
        </button>
      </div>
    </div>
  `).join('') : `<div class="muted" style="margin:6px">Nessun termostato</div>`;

  // Clivet HVAC: power, setpoint, mode, fan
  const hvac = pick(m, 'vimar.hvac') || [];
  $('#vimarHvac').innerHTML = hvac.length ? hvac.map(h=>`
    <div class="row">
      <div class="meta">
        <div class="title">${h.name || 'Clivet'}</div>
        <div class="sub">${h.room || ''}</div>
      </div>
      <div class="controls">
        <button class="ctl-btn" title="Power" onclick="cmdHvac('${encodeURIComponent(h.id)}','powerToggle')">
          <svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 2v10M6.2 4.8a10 10 0 1 0 11.6 0"/></svg>
        </button>
        <button class="ctl-btn" title="Setpoint -" onclick="cmdHvac('${encodeURIComponent(h.id)}','dec')">
          <svg viewBox="0 0 24 24"><path fill="currentColor" d="M5 11h14v2H5z"/></svg>
        </button>
        <div class="muted">${fmtTemp(h.setpoint)}</div>
        <button class="ctl-btn" title="Setpoint +" onclick="cmdHvac('${encodeURIComponent(h.id)}','inc')">
          <svg viewBox="0 0 24 24"><path fill="currentColor" d="M11 5h2v14h-2zM5 11h14v2H5z"/></svg>
        </button>
        <button class="ctl-btn" title="Mode" onclick="cmdHvac('${encodeURIComponent(h.id)}','modeNext')">
          <svg viewBox="0 0 24 24"><path fill="currentColor" d="M7 6h10v2H7zm0 10h10v2H7zm0-5h10v2H7z"/></svg>
        </button>
        <button class="ctl-btn" title="Fan" onclick="cmdHvac('${encodeURIComponent(h.id)}','fanNext')">
          <svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 4a4 4 0 0 1 4 4c0 3-4 7-4 7s-4-4-4-7a4 4 0 0 1 4-4z"/></svg>
        </button>
      </div>
    </div>
  `).join('') : `<div class="muted" style="margin:6px">Nessun climatizzatore</div>`;
}
function fmtTemp(x){ const n=Number(x); return Number.isFinite(n)? (n.toFixed(1)+'°C') : '—'; }

/* ---------- COMMAND SENDERS (Vimar) ---------- */
async function cmdShutter(id, cmd){
  const url = qs(APP_CONFIG.endpoint, `admin=1&event=vimar_shutter&id=${id}&cmd=${cmd}`);
  try{ await fetch(url,{method:'GET',mode:'no-cors'});}catch(_){}
}
async function cmdThermo(id, op){
  const url = qs(APP_CONFIG.endpoint, `admin=1&event=vimar_thermo&id=${id}&op=${op}`);
  try{ await fetch(url,{method:'GET',mode:'no-cors'});}catch(_){}
}
async function cmdHvac(id, op){
  const url = qs(APP_CONFIG.endpoint, `admin=1&event=vimar_hvac&id=${id}&op=${op}`);
  try{ await fetch(url,{method:'GET',mode:'no-cors'});}catch(_){}
}

/* ---------- LOGS ---------- */
async function loadLogs(){
  const url = qs(APP_CONFIG.endpoint, 'logs=1');
  try{
    const data = await jsonp(url, APP_CONFIG.jsonpCallbackParam || 'callback');
    const rows = Array.isArray(data.logs)?data.logs:[];
    const errors = rows.filter(r=>{
      const c = String(r.code||'').toUpperCase();
      const d = String(r.desc||'').toUpperCase();
      return /ERR|ERROR|FAIL/.test(c) || /ERR|ERROR|FAIL/.test(d);
    });
    if(!errors.length){
      $('#log').innerHTML = '';
      $('#logEmpty').textContent = 'Nessun errore recente.';
      document.querySelector('.tab[data-target="log"]')?.classList.toggle('has-dot', false);
      return;
    }
    $('#logEmpty').textContent='';
    $('#log').innerHTML = errors.slice(0, APP_CONFIG.logLimit || 30).map(e=>{
      const when = e.ts ? new Date(e.ts).toLocaleString() : '';
      return `<div class="row">
        <div class="meta">
          <div class="title">${e.code || '—'}</div>
          <div class="sub">${e.desc || ''}${e.note? ' · '+e.note : ''}</div>
        </div>
        <div class="muted">${when}</div>
      </div>`;
    }).join('');
    document.querySelector('.tab[data-target="log"]')?.classList.toggle('has-dot', true);
  }catch(e){
    $('#log').innerHTML = '';
    $('#logEmpty').textContent = 'Log non disponibili (aggiungi ?logs=1).';
  }
}

/* ---------- BOOT ---------- */
renderFavorites();
initTabbar();
bindFavoriteActions();
loadState();
setInterval(loadState, APP_CONFIG.pollMs || 10000);
const btn = document.getElementById('btnRefreshLog');
if(btn){ btn.addEventListener('click', ()=>loadLogs()); }

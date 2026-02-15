/* ===== UI logic ===== */

function $(sel, root){ return (root||document).querySelector(sel); }
function $all(sel, root){ return Array.from((root||document).querySelectorAll(sel)); }
function fmtNum(x){ const n=Number(x); return isFinite(n)? n.toLocaleString('it-IT'): '—'; }
function fmtTime(dtIso){
  try{
    const d = new Date(dtIso);
    return d.toLocaleTimeString('it-IT', {hour:'2-digit', minute:'2-digit'});
  }catch(_){ return '—:—'; }
}

/* ====== RENDER ====== */
function renderState(model){
  const chip = $('#chipState');
  const st = String(model.state||'').toUpperCase();
  const cls = STATE_CLASS[st] || 'neutral';
  chip.className = 'chip state '+cls;
  chip.textContent = st.replace('_',' ');
  $('#houseStatus').textContent = model.notte ? 'Notte' : 'Giorno';
}

function renderPeople(model){
  const arr = Array.isArray(model.people)? model.people : [];
  const onlineCount = arr.filter(p => p.onlineSmart || p.onlineRaw).length;
  $('#peopleOnline').textContent = onlineCount + ' in casa';

  const chips = $('#peopleChips');
  chips.innerHTML = '';
  arr.forEach(p => {
    const on = (p.onlineSmart || p.onlineRaw);
    const el = document.createElement('div');
    el.className = 'chip';
    el.innerHTML = `<span class="dot ${on?'on':'off'}"></span>${p.name}`;
    chips.appendChild(el);
  });
}

function renderWeather(model){
  const meta = (model.weather || {});
  const wc = mapWeatherCode(meta.icon);
  const dot = $('#weatherDot');
  const temp = (meta.tempC==null)? '—' : Math.round(meta.tempC)+'°C';
  $('#weatherTemp').textContent = temp;
  $('#weatherProvider').textContent = (wc.icon? (wc.icon+' ') : '') + (meta.provider || '—');

  // Colora dot
  const code = String(meta.icon||'');
  let color = 'var(--accent)';
  if (/6[1-7]|8[0-2]|9[5-9]/.test(code)) color = 'var(--bad)';     // pioggia/temporali
  else if (/4[5-8]/.test(code)) color = 'var(--warn)';              // nebbia
  else if (code==='0' || code==='1') color = 'var(--good)';         // sereno
  dot.style.background = color;
  dot.style.boxShadow = `0 0 10px ${color}cc`;
}

function renderEnergy(model){
  const kwh = (model.energy && model.energy.kwh!=null) ? model.energy.kwh : null;
  $('#energyKwh').textContent = (kwh==null? '—' : fmtNum(kwh));
}

function renderVimar(model){
  const v = model.vimar || {shutters:[],thermostats:[],hvac:[]};

  // Shutters
  const sh = $('#vimarShutters'); sh.innerHTML = '';
  v.shutters.forEach(x=>{
    const row = document.createElement('div');
    row.className='row';
    row.innerHTML = `
      <div>
        <div class="title">${x.name||x.id||'—'}</div>
        <div class="sub">${x.room||''} ${x.online? '· Online':'· Offline'}</div>
      </div>
      <div class="controls">
        <button class="small-btn" data-cmd="up">Su</button>
        <button class="small-btn" data-cmd="stop">Stop</button>
        <button class="small-btn" data-cmd="down">Giu</button>
      </div>
    `;
    row.querySelectorAll('button').forEach(b=>{
      b.addEventListener('click', ()=>{
        const cmd = b.getAttribute('data-cmd');
        callAdmin('vimar_shutter',{ id:x.id, cmd }, ()=>{}, ()=>{});
      });
    });
    sh.appendChild(row);
  });

  // Thermo
  const th = $('#vimarThermo'); th.innerHTML='';
  v.thermostats.forEach(x=>{
    const row = document.createElement('div');
    row.className='row';
    row.innerHTML = `
      <div>
        <div class="title">${x.name||x.id||'—'}</div>
        <div class="sub">${x.room||''} · T=${x.temp??'—'}° · Set=${x.setpoint??'—'}° · ${x.mode||''}</div>
      </div>
      <div class="controls">
        <button class="small-btn" data-op="dec">-</button>
        <button class="small-btn" data-op="inc">+</button>
        <button class="small-btn" data-op="modeNext">Mode</button>
      </div>
    `;
    row.querySelectorAll('button').forEach(b=>{
      b.addEventListener('click', ()=>{
        const op = (b.getAttribute('data-op')||'').toLowerCase();
        callAdmin('vimar_thermo',{ id:x.id, op }, ()=>{}, ()=>{});
      });
    });
    th.appendChild(row);
  });

  // HVAC
  const hv = $('#vimarHvac'); hv.innerHTML='';
  v.hvac.forEach(x=>{
    const row = document.createElement('div');
    row.className='row';
    row.innerHTML = `
      <div>
        <div class="title">${x.name||x.id||'—'}</div>
        <div class="sub">${x.room||''} · ${x.mode||''} · Set=${x.setpoint??'—'}° · Fan=${x.fan||''}</div>
      </div>
      <div class="controls">
        <button class="small-btn" data-op="powerToggle">Power</button>
        <button class="small-btn" data-op="dec">-</button>
        <button class="small-btn" data-op="inc">+</button>
        <button class="small-btn" data-op="modeNext">Mode</button>
        <button class="small-btn" data-op="fanNext">Fan</button>
      </div>
    `;
    row.querySelectorAll('button').forEach(b=>{
      b.addEventListener('click', ()=>{
        const op = (b.getAttribute('data-op')||'');
        callAdmin('vimar_hvac',{ id:x.id, op }, ()=>{}, ()=>{});
      });
    });
    hv.appendChild(row);
  });
}

function renderLogs(logs){
  const list = $('#log');
  const empty = $('#logEmpty');
  list.innerHTML = '';
  if(!logs || !logs.length){
    empty.textContent = 'Nessun log recente.';
    return;
  }
  empty.textContent = '';
  logs.forEach(x=>{
    const row = document.createElement('div');
    row.className='row';
    const ts = (x.ts ? new Date(x.ts).toLocaleString('it-IT') : '—');
    row.innerHTML = `
      <div>
        <div class="title">${x.code||'—'} <span class="sub">· ${x.stato||''}</span></div>
        <div class="sub">${ts} · ${x.desc||''} ${x.note?('· '+x.note):''}</div>
      </div>
    `;
    list.appendChild(row);
  });
}

/* ===== Navigation ===== */
function activateTab(target){
  $all('.tab').forEach(t => t.classList.toggle('active', t.getAttribute('data-target')===target));
  $all('.view').forEach(v => v.classList.toggle('active', v.id === ('view-'+target)));
  window.scrollTo({top:0, behavior:'smooth'});
}

/* ===== Data flow ===== */
function loadAll(){
  fetchModel((model)=>{
    try{
      renderState(model);
      renderPeople(model);
      renderWeather(model);
      renderEnergy(model);
      renderVimar(model);

      // Badge log errori
      const err = (model.alerts && Number(model.alerts.logErrors)) || 0;
      $('#badgeLog').hidden = (err<=0);

      // Time
      $('#ts').textContent = 'Aggiornamento: ' + fmtTime(model.meta && model.meta.nowIso);
    }catch(e){ console.error(e); }
  }, (err)=>{ console.error('Model error', err); });
}

function loadLogs(){
  fetchLogs((data)=>{
    renderLogs(data && data.logs || []);
  }, (err)=>{ console.error('Logs error', err); });
}

/* ===== Init ===== */
document.addEventListener('DOMContentLoaded', ()=>{
  // tabbar
  $all('.tab').forEach(t => t.addEventListener('click', ()=> activateTab(t.getAttribute('data-target')) ));
  // menu interni
  $all('.menu-btn').forEach(b => b.addEventListener('click', ()=> activateTab(b.getAttribute('data-target')) ));
  // log refresh
  const btn = $('#btnRefreshLog'); if (btn) btn.addEventListener('click', loadLogs);

  // prima load
  loadAll();
  loadLogs();

  // auto refresh
  if (CONFIG.AUTO_REFRESH_MS > 0){
    setInterval(loadAll, CONFIG.AUTO_REFRESH_MS);
  }
});

/* ============================================================
 *                    HELPER FUNZIONI VELOCI
 * ============================================================ */

const $  = (q, r) => (r || document).querySelector(q);
const $$ = (q, r) => Array.from((r || document).querySelectorAll(q));

function fmtNum(x){
  const n = Number(x);
  return isFinite(n) ? n.toLocaleString('it-IT') : '—';
}

function fmtTime(iso){
  try{
    return new Date(iso).toLocaleTimeString('it-IT', {
      hour:'2-digit',
      minute:'2-digit'
    });
  }catch(_){
    return '—:—';
  }
}

let LAST_MODEL = null;


/* ============================================================
 *                     ICON SET PREFERITI
 * ============================================================ */
function favIcon(name){
  const c = 'currentColor';
  const M = {
    up:     `<svg viewBox="0 0 24 24"><path fill="${c}" d="M7 14l5-5 5 5z"/></svg>`,
    down:   `<svg viewBox="0 0 24 24"><path fill="${c}" d="M7 10l5 5 5-5z"/></svg>`,
    leaf:   `<svg viewBox="0 0 24 24"><path fill="${c}" d="M6 13c0 5 4 9 9 9 0-7-7-14-14-14 0 2 2 5 5 5z"/></svg>`,
    suit:   `<svg viewBox="0 0 24 24"><path fill="${c}" d="M7 7h10l1 5H6zm-1 7h12v5H6z"/></svg>`,
    switch: `<svg viewBox="0 0 24 24"><path fill="${c}" d="M7 7h10a5 5 0 1 1 0 10H7A5 5 0 1 1 7 7zm0 2a3 3 0 0 0 0 6h10a3 3 0 0 0 0-6z"/></svg>`
    shutter: `<svg viewBox="0 0 24 24"><path fill="currentColor" d="M3 4h18v2H3V4Zm0 4h18v2H3V8Zm0 4h18v2H3v-2Zm0 4h18v2H3v-2Z"/></svg>`,
  };

  return M[name] || `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8" fill="${c}"/></svg>`;
}


/* ============================================================
 *                       RENDER: STATO CASA
 * ============================================================ */
function renderState(m){
  const chip = $('#chipState');
  const st = (m.state || '').toUpperCase();
  const cls = STATE_CLASS[st] || 'neutral';

  chip.className = 'chip state ' + cls;
  chip.textContent = st.replace('_', ' ');

  const house = $('#houseStatus');
  if (house) house.textContent = m.notte ? 'Notte' : 'Giorno';
}


/* ============================================================
 *                       RENDER: PERSONE
 * ============================================================ */
function renderPeople(m){
  const arr = Array.isArray(m.people) ? m.people : [];
  const inCasa = arr.filter(p => p.onlineSmart || p.onlineRaw).length;

  const ppl = $('#peopleOnline');
  if (ppl) ppl.textContent = inCasa + ' in casa';

  const chips = $('#peopleChips');
  if (chips) {
    chips.innerHTML = '';
    arr.forEach(p => {
      const on = (p.onlineSmart || p.onlineRaw);
      const el = document.createElement('div');
      el.className = 'chip';
      el.innerHTML = `
        <span class="dot ${on ? 'on' : 'off'}"></span>
        ${p.name}
      `;
      chips.appendChild(el);
    });
  }
}


/* ============================================================
 *                       RENDER: METEO
 * ============================================================ */
function renderWeather(m){
  const w = (m && m.weather) ? m.weather : {};
  console.log('[UI] weather (backend) = ', w);

  const tempTxt = (typeof w.tempC === 'number') ? `${Math.round(w.tempC)}°C` : 'N/D';
  const tempEl = $('#weatherTemp');
  if (tempEl) tempEl.textContent = tempTxt;

  const wc = mapWeatherCode(w.icon);
  const provEl = $('#weatherProvider');
  if (provEl) provEl.textContent = (wc.icon ? wc.icon + ' ' : '') + (w.provider || '—');

  // dot meteo: giallo fisso come da UI scelta
  const dot = $('#weatherDot');
  if (dot){
    dot.style.background = '#ffc107';
    dot.style.boxShadow = '0 0 10px #ffc107cc';
  }
}


/* ============================================================
 *                  METEO lato client (Open‑Meteo)
 *    (fallback automatico se backend non fornisce weather)
 * ============================================================ */

// 1) Legge lat/lon da CONFIG.WEATHER oppure, se assenti, chiede al browser
function getLatLonFromConfigOrBrowser(){
  return new Promise((resolve, reject)=>{
    const cfg = (typeof CONFIG !== 'undefined' && CONFIG && CONFIG.WEATHER) ? CONFIG.WEATHER : {};
    if (typeof cfg.lat === 'number' && typeof cfg.lon === 'number'){
      return resolve({ lat: cfg.lat, lon: cfg.lon, tz: cfg.tz || 'Europe/Rome' });
    }
    if (!('geolocation' in navigator)) return reject(new Error('no geolocation'));
    navigator.geolocation.getCurrentPosition(
      pos => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude, tz: (cfg.tz||'Europe/Rome') }),
      err => reject(err),
      { enableHighAccuracy:false, timeout:3000, maximumAge:600000 }
    );
  });
}

// 2) Chiamata diretta Open‑Meteo (CORS ok, no key)
async function fetchWeatherClient(){
  const { lat, lon, tz } = await getLatLonFromConfigOrBrowser();
  const url = 'https://api.open-meteo.com/v1/forecast'
    + `?latitude=${encodeURIComponent(lat)}`
    + `&longitude=${encodeURIComponent(lon)}`
    + `&current=temperature_2m,weather_code`
    + `&timezone=${encodeURIComponent(tz || 'Europe/Rome')}`;
  const r  = await fetch(url);
  if (!r.ok) throw new Error('Open‑Meteo HTTP '+r.status);
  const js = await r.json();
  const t  = (js && js.current && typeof js.current.temperature_2m === 'number') ? js.current.temperature_2m : null;
  const wc = (js && js.current && js.current.weather_code != null) ? String(js.current.weather_code) : '';
  return { tempC: t, icon: wc, provider: 'Open‑Meteo' };
}

// 3) Se il backend non manda weather (o se forziamo), prendo quello client e aggiorno la pill
async function ensureWeatherFallback(model){
  try{
    const forceClient = !!(CONFIG && CONFIG.WEATHER && CONFIG.WEATHER.forceClient);
    const hasBackend  = !!(model && model.weather && typeof model.weather.tempC === 'number');

    if (hasBackend && !forceClient) return; // già ok dal backend

    const w = await fetchWeatherClient();

    // Aggiorna la pill con i dati client
    renderWeather({ weather: w });

    // provider leggibile (emoji + nome)
    const wc = mapWeatherCode(w.icon);
    const provEl = $('#weatherProvider');
    if (provEl) provEl.textContent = (wc.icon ? wc.icon + ' ' : '') + (w.provider || 'Open‑Meteo');

    console.log('[UI] weather (client) =', w);
  }catch(e){
    console.warn('Weather client fallback failed:', e);
  }
}


/* ============================================================
 *                       RENDER: ENERGIA
 * ============================================================ */
function renderEnergy(m){
  const k = (m.energy && m.energy.kwh != null) ? m.energy.kwh : null;
  const el = $('#energyKwh');
  if (el) el.textContent = (k == null ? '—' : fmtNum(k));
}


/* ============================================================
 *                       RENDER: PREFERITI
 * ============================================================ */
function renderFavorites(m){
  const grid = $('#favoritesGrid');
  if (!grid) return;
  grid.innerHTML = '';

  (CONFIG.FAVORITES || []).forEach(f => {
    const isOn = (f.kind === 'toggle' && f.stateKey && !!m[f.stateKey]);

    const el = document.createElement('button');
    el.className = 'fav';
    if (isOn) el.classList.add('active');

    el.innerHTML = `
      <span class="ico">${favIcon(f.icon)}</span>
      <div>
        <div class="title">${f.label}</div>
        <div class="sub">${f.kind === 'toggle' ? (isOn ? 'ON' : 'OFF') : 'Azione'}</div>
      </div>
    `;

    el.addEventListener('click', () => {
      if (f.kind === 'action'){
        if (f.event) callAdmin(f.event, {}, () => {}, () => {});
      } 
      else if (f.kind === 'toggle'){
        const next = !isOn;
        callAdmin(f.toggleEvent, { value: String(next) }, () => {
          loadAll();   // ricarica stato per aggiornare UI
        });
      }
    });

    grid.appendChild(el);
  });
}


/* ============================================================
 *                       RENDER: VIMAR
 * ============================================================ */
function renderVimar(m){
  const v = m.vimar || { shutters:[], thermostats:[], hvac:[] };

  /* --- SHUTTERS --- */
  const sh = $('#vimarShutters');
  if (sh){
    sh.innerHTML = '';
    v.shutters.forEach(x => {
      const row = document.createElement('div');
      row.className = 'row';
      row.innerHTML = `
        <div>
          <div class="title">${x.name || x.id || '—'}</div>
          <div class="sub">${x.room || ''} ${x.online?'· Online':'· Offline'}</div>
        </div>

        <div class="controls">
          <button class="small-btn" data-cmd="up">Su</button>
          <button class="small-btn" data-cmd="stop">Stop</button>
          <button class="small-btn" data-cmd="down">Giu</button>
        </div>
      `;

      row.querySelectorAll('button').forEach(b => {
        b.addEventListener('click', () =>
          callAdmin('vimar_shutter', {
            id: x.id,
            cmd: b.getAttribute('data-cmd')
          })
        );
      });

      sh.appendChild(row);
    });
  }

  /* --- THERMOSTATS --- */
  const th = $('#vimarThermo');
  if (th){
    th.innerHTML = '';
    v.thermostats.forEach(x => {
      const row = document.createElement('div');
      row.className = 'row';

      row.innerHTML = `
        <div>
          <div class="title">${x.name || x.id || '—'}</div>
          <div class="sub">
            ${x.room || ''} · 
            T=${x.temp ?? '—'}° · 
            Set=${x.setpoint ?? '—'}° · 
            ${x.mode || ''}
          </div>
        </div>

        <div class="controls">
          <button class="small-btn" data-op="dec">-</button>
          <button class="small-btn" data-op="inc">+</button>
          <button class="small-btn" data-op="modeNext">Mode</button>
        </div>
      `;

      row.querySelectorAll('button').forEach(b => {
        b.addEventListener('click', () =>
          callAdmin('vimar_thermo', {
            id: x.id,
            op: b.getAttribute('data-op').toLowerCase()
          })
        );
      });

      th.appendChild(row);
    });
  }

  /* --- HVAC --- */
  const hv = $('#vimarHvac');
  if (hv){
    hv.innerHTML = '';
    v.hvac.forEach(x => {
      const row = document.createElement('div');
      row.className = 'row';

      row.innerHTML = `
        <div>
          <div class="title">${x.name || x.id || '—'}</div>
          <div class="sub">
            ${x.room || ''} · ${x.mode || ''} · 
            Set=${x.setpoint ?? '—'}° · Fan=${x.fan || ''}
          </div>
        </div>

        <div class="controls">
          <button class="small-btn" data-op="powerToggle">Power</button>
          <button class="small-btn" data-op="dec">-</button>
          <button class="small-btn" data-op="inc">+</button>
          <button class="small-btn" data-op="modeNext">Mode</button>
          <button class="small-btn" data-op="fanNext">Fan</button>
        </div>
      `;

      row.querySelectorAll('button').forEach(b => {
        b.addEventListener('click', () =>
          callAdmin('vimar_hvac', {
            id: x.id,
            op: b.getAttribute('data-op')
          })
        );
      });

      hv.appendChild(row);
    });
  }
}


/* ============================================================
 *                       RENDER: LOG
 * ============================================================ */
function renderLogs(logs){
  const list = $('#log');
  const empty = $('#logEmpty');

  if (!list) return;
  list.innerHTML = '';

  if (!logs || !logs.length){
    if (empty) empty.textContent = 'Nessun log recente.';
    return;
  }

  if (empty) empty.textContent = '';

  logs.forEach(x => {
    const row = document.createElement('div');
    row.className = 'row';

    const ts = x.ts ? new Date(x.ts).toLocaleString('it-IT') : '—';

    row.innerHTML = `
      <div>
        <div class="title">${x.code || '—'}
          <span class="sub"> · ${x.stato || ''}</span>
        </div>
        <div class="sub">${ts} · ${x.desc || ''} ${x.note ? ('· '+x.note) : ''}</div>
      </div>
    `;

    list.appendChild(row);
  });
}


/* ============================================================
 *                       NAVIGAZIONE
 * ============================================================ */
function activateTab(target){
  $$('.tab').forEach(t =>
    t.classList.toggle('active', t.getAttribute('data-target') === target)
  );
  $$('.view').forEach(v =>
    v.classList.toggle('active', v.id === 'view-' + target)
  );
  window.scrollTo({top:0, behavior:'smooth'});
}


/* ============================================================
 *                       CARICAMENTO DATI
 * ============================================================ */
function loadAll(){
  fetchModel((m) => {

    LAST_MODEL = m;

    try{
      renderState(m);
      renderPeople(m);
      renderWeather(m);     // usa il meteo backend se presente
      renderEnergy(m);
      renderFavorites(m);
      renderVimar(m);

      // Fallback meteo client-side se il backend non lo fornisce (o se forzato)
      ensureWeatherFallback(m);

      const err = (m.alerts && Number(m.alerts.logErrors)) || 0;
      const b = $('#badgeLog'); if (b) b.hidden = (err <= 0);

      const ts = $('#ts');
      if (ts) ts.textContent = 'Aggiornamento: ' + fmtTime(m.meta?.nowIso);

    }catch(e){
      console.error(e);
    }

  }, (e) => {
    console.error('Model error', e);
  });
}

function loadLogs(){
  fetchLogs((d) => {
    renderLogs(d.logs || []);
  }, (e)=>{
    console.error('Logs error', e);
  });
}


/* ============================================================
 *                       INIT
 * ============================================================ */
document.addEventListener('DOMContentLoaded', () => {

  $$('.tab').forEach(t =>
    t.addEventListener('click', () =>
      activateTab(t.getAttribute('data-target'))
    )
  );

  $$('.menu-btn').forEach(b =>
    b.addEventListener('click', () =>
      activateTab(b.getAttribute('data-target'))
    )
  );

  const btn = $('#btnRefreshLog');
  if (btn) btn.addEventListener('click', loadLogs);

  console.log('[CFG] BASE_URL =', (typeof CONFIG !== 'undefined' && CONFIG && CONFIG.BASE_URL) ? CONFIG.BASE_URL : '(manca CONFIG.BASE_URL)');

  loadAll();
  loadLogs();

  if (typeof CONFIG !== 'undefined' && CONFIG && CONFIG.AUTO_REFRESH_MS > 0)
    setInterval(loadAll, CONFIG.AUTO_REFRESH_MS);
});

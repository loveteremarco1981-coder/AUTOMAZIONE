// ============================================================
// app.js — Automazione Casa · SmartThings-style
// ============================================================

'use strict';

/* ---- Globals ---- */
let MODEL = null;
let _toastTimer = null;
let _refreshTimer = null;
let _shuttersUp = false;

/* ---- Helpers ---- */
const $ = (sel, ctx) => (ctx || document).querySelector(sel);
const $$ = (sel, ctx) => Array.from((ctx || document).querySelectorAll(sel));
const fmtTime = iso => { try { return new Date(iso).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }); } catch (_) { return '—'; } };
const fmtDate = iso => { try { return new Date(iso).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }); } catch (_) { return '—'; } };
const cap = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
const getShuttersUp = () => { try { return localStorage.getItem('ui_shutters_up') === '1'; } catch (_) { return false; } };
const setShuttersUp = v => { try { localStorage.setItem('ui_shutters_up', v ? '1' : '0'); } catch (_) { } };

/* ---- Toast ---- */
function toast(msg, duration = 2200) {
  const el = $('#toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => el.classList.remove('show'), duration);
}

/* ---- JSONP fetch (no CORS) ---- */
let _cbId = 0;
function jsonpFetch(url) {
  return new Promise((resolve, reject) => {
    const id = '__jcb_' + (++_cbId);
    const sep = url.includes('?') ? '&' : '?';
    const el = document.createElement('script');
    const timer = setTimeout(() => { cleanup(); reject(new Error('JSONP timeout')); }, 14000);
    function cleanup() { try { delete window[id]; el.remove(); } catch (_) { } }
    window[id] = data => { clearTimeout(timer); cleanup(); resolve(data); };
    el.src = url + sep + 'callback=' + id + '&_=' + Date.now();
    el.onerror = () => { clearTimeout(timer); cleanup(); reject(new Error('JSONP load error')); };
    document.head.appendChild(el);
  });
}

/* ---- Fetch model (fetch → JSONP fallback) ---- */
async function fetchModel() {
  const url = CONFIG.DOGET_URL;
  if (!url || url.includes('<<')) throw new Error('DOGET_URL non configurato');
  try {
    const r = await fetch(url + (url.includes('?') ? '&' : '?') + '_=' + Date.now(), { cache: 'no-store' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return await r.json();
  } catch (_) {
    return await jsonpFetch(url);
  }
}

/* ---- callAdmin (invia comando al backend) ---- */
async function callAdmin(event, params = {}) {
  const url = new URL(CONFIG.DOGET_URL);
  url.searchParams.set('event', event);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  try {
    const r = await fetch(url.toString(), { cache: 'no-store' });
    const data = await r.json();
    if (data && data.ok === false) { toast('⚠️ ' + (data.err || data.error || 'Errore')); }
    return data;
  } catch (_) {
    // fallback JSONP
    try { return await jsonpFetch(url.toString()); } catch (e) { toast('❌ Errore connessione'); }
  }
}

/* ---- Fetch weather (Open-Meteo client-side) ---- */
async function fetchWeather() {
  const w = CONFIG.WEATHER || {};
  const lat = w.lat, lon = w.lon, tz = w.tz || 'Europe/Rome';
  if (!lat || !lon) return null;
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&timezone=${encodeURIComponent(tz)}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error('Open-Meteo ' + r.status);
  const js = await r.json();
  const c = js.current || {};
  return {
    tempC: c.temperature_2m ?? null,
    humidity: c.relative_humidity_2m ?? null,
    windKmh: c.wind_speed_10m ?? null,
    icon: String(c.weather_code ?? ''),
    provider: 'Open-Meteo'
  };
}

/* ---- Weather code → emoji ---- */
function weatherEmoji(code) {
  const n = parseInt(code);
  if (n === 0) return '☀️';
  if (n <= 3) return '🌤️';
  if (n <= 48) return '🌫️';
  if (n <= 67) return '🌧️';
  if (n <= 77) return '🌨️';
  if (n <= 82) return '🌦️';
  if (n <= 86) return '❄️';
  if (n <= 99) return '⛈️';
  return '🌡️';
}

/* ============================================================
   RENDER FUNCTIONS
   ============================================================ */

/* ---- State Banner ---- */
function renderBanner(m) {
  const el = $('#state-banner');
  if (!el) return;
  const st = String(m.state || '').toUpperCase();
  const label = st.replace(/_/g, ' ');
  const map = {
    'COMFY_DAY': 'sb-comfy-day',
    'COMFY_NIGHT': 'sb-comfy-night',
    'SECURITY_DAY': 'sb-security-day',
    'SECURITY_NIGHT': 'sb-security-night',
  };
  el.className = 'state-banner ' + (map[st] || 'sb-security-day');
  el.innerHTML = `<span class="banner-dot"></span>${label}`;
}

/* ---- Summary cards ---- */
function renderCards(m) {
  const ppl = Array.isArray(m.people) ? m.people : [];
  const inCount = ppl.filter(p => p.onlineSmart || p.online || p.onlineRaw).length;
  const countEl = $('#people-count');
  if (countEl) countEl.textContent = inCount;
  const card = $('#card-presence');
  if (card) card.classList.toggle('card-glow', inCount > 0);
}

/* ---- Weather ---- */
function renderWeather(w) {
  if (!w) return;
  const tv = $('#temp-val'); if (tv && w.tempC != null) tv.textContent = Math.round(w.tempC);
  const hv = $('#hum-val');  if (hv && w.humidity != null) hv.textContent = Math.round(w.humidity);
  const wv = $('#wind-val'); if (wv && w.windKmh != null) wv.textContent = Math.round(w.windKmh);
}

/* ---- Favorites ---- */
function renderFavorites(m) {
  const grid = $('#fav-grid');
  if (!grid) return;
  grid.innerHTML = '';
  (CONFIG.FAVORITES || []).forEach(f => {
    let isOn = false;
    if (f.id === 'tapparelle') isOn = getShuttersUp();
    else if (f.stateKey && m[f.stateKey] != null) isOn = !!m[f.stateKey];

    const statusText = f.id === 'tapparelle' ? (isOn ? 'Aperte' : 'Chiuse') :
      f.kind === 'toggle' ? (isOn ? 'Attivo' : 'Disattivo') : '';

    const card = document.createElement('article');
    card.className = 'fav-card' + (isOn ? ' active' : '');
    card.innerHTML = `
      <div class="fav-glyph" style="background:${f.color || '#f0f0f0'}">
        <img src="${favGlyph(f.id)}" alt="">
      </div>
      <button class="fav-action" aria-label="${f.kind === 'action' ? 'Esegui' : 'Toggle'}">
        <img src="${f.kind === 'action' ? 'icons/st/ui-play.svg' : 'icons/st/ui-power.svg'}" alt="">
      </button>
      <div class="fav-label">${f.label}</div>
      <div class="fav-sub">${f.subtitle || ''}</div>
      ${statusText ? `<div class="fav-status">${statusText}</div>` : ''}
    `;

    // tap on card body
    card.addEventListener('click', async e => {
      if (e.target.closest('.fav-action')) return;
      await doFavAction(f, isOn);
    });
    // tap on action button
    card.querySelector('.fav-action').addEventListener('click', async e => {
      e.stopPropagation();
      await doFavAction(f, isOn);
    });

    grid.appendChild(card);
  });
}

async function doFavAction(f, isOn) {
  if (f.id === 'tapparelle') {
    const next = !isOn;
    setShuttersUp(next);
    toast(next ? '⬆️ Alzo le tapparelle…' : '⬇️ Abbasso le tapparelle…');
    await callAdmin(next ? f.upEvent : f.downEvent, { manual: 'TRUE' });
    setTimeout(loadAll, 800);
  } else if (f.kind === 'toggle' && f.toggleEvent) {
    const next = !isOn;
    toast(next ? `✅ ${f.label} attivato` : `⬜ ${f.label} disattivato`);
    await callAdmin(f.toggleEvent, { value: String(next) });
    setTimeout(loadAll, 500);
  } else if (f.kind === 'action' && f.event) {
    toast(`▶️ ${f.label} avviato`);
    await callAdmin(f.event);
  }
}

function favGlyph(id) {
  const map = { tapparelle: 'icons/st/glyph-shutter.svg', piante: 'icons/st/glyph-plant.svg', vacanza: 'icons/st/glyph-suit.svg', override: 'icons/st/glyph-moon.svg' };
  return map[id] || 'icons/st/glyph-generic.svg';
}

/* ---- People chips (home) ---- */
function renderPeopleChips(m) {
  const host = $('#people-chips');
  if (!host) return;
  host.innerHTML = '';
  host.className = 'people-chips';
  const people = buildPeople(m);
  if (!people.length) { host.innerHTML = '<div class="empty-state">Nessuna persona configurata.</div>'; return; }
  people.forEach(p => {
    const st = (p.onlineSmart || p.online) ? 'in' : 'out';
    const ini = String(p.name || '?').charAt(0).toUpperCase();
    const time = p.lastTime && p.lastDay ? (p.lastTime + ' · ' + p.lastDay) : (p.tsText || '—');
    const chip = document.createElement('div');
    chip.className = `person-chip ${st}`;
    chip.innerHTML = `
      <div class="person-avatar ${st}">${ini}</div>
      <div class="person-info">
        <div class="person-name">${cap(p.name)}</div>
        <div class="person-meta">${p.lastEvent || '—'} · ${time}</div>
      </div>
      <span class="person-badge ${st}">${st.toUpperCase()}</span>
    `;
    host.appendChild(chip);
  });
}

/* ---- Events ---- */
function renderEvents(m) {
  const list = $('#events-list');
  if (!list) return;
  list.innerHTML = '';
  const nx = m.next || {};
  const alba = m.alba || (m.state && null);
  const rows = [
    ['Alba', m.albaText || (nx.alba ? fmtDate(nx.alba) : null)],
    ['Tramonto', m.tramText || (nx.tramonto ? fmtDate(nx.tramonto) : null)],
    ['Prossime piante', nx.pianteAlba || nx.piante || null],
    ['Chiusura tardiva', nx.lateClose || null],
  ].filter(r => r[1]);
  if (!rows.length) { list.innerHTML = '<div class="empty-state">Nessun evento programmato.</div>'; return; }
  rows.forEach(([label, val]) => {
    const row = document.createElement('div');
    row.className = 'event-row';
    row.innerHTML = `<span class="event-label">${label}</span><span class="event-val">${val}</span>`;
    list.appendChild(row);
  });
}

/* ---- Vimar Devices ---- */
function renderVimar(m) {
  const vimar = m.vimar || {};

  function renderList(containerId, items, renderFn) {
    const el = $(containerId);
    if (!el) return;
    el.innerHTML = '';
    if (!items || !items.length) { el.innerHTML = '<div class="empty-state">Nessun dispositivo.</div>'; return; }
    items.forEach(x => el.appendChild(renderFn(x)));
  }

  renderList('#vimar-shutters', vimar.shutters, x => {
    const card = document.createElement('div'); card.className = 'device-card';
    card.innerHTML = `<div class="dev-row"><div><div class="dev-name">${x.name || x.id || '—'}</div><div class="dev-meta">${x.room || ''} ${x.online ? '· Online' : '· Offline'}</div></div></div><div class="dev-ctrl"><button class="small-btn" data-cmd="up">⬆ Su</button><button class="small-btn" data-cmd="stop">■ Stop</button><button class="small-btn" data-cmd="down">⬇ Giù</button></div>`;
    card.querySelectorAll('button').forEach(b => b.addEventListener('click', () => { toast('↕ Tapparella…'); callAdmin('vimar_shutter', { id: x.id, cmd: b.dataset.cmd }); }));
    return card;
  });

  renderList('#vimar-thermo', vimar.thermostats, x => {
    const card = document.createElement('div'); card.className = 'device-card';
    card.innerHTML = `<div class="dev-row"><div><div class="dev-name">${x.name || x.id || '—'}</div><div class="dev-meta">${x.room || ''} · T=${x.temp ?? '—'}° · Set=${x.setpoint ?? '—'}° · ${x.mode || ''}</div></div></div><div class="dev-ctrl"><button class="small-btn" data-op="dec">− 0.5°</button><button class="small-btn" data-op="inc">+ 0.5°</button><button class="small-btn" data-op="modeNext">Mode</button></div>`;
    card.querySelectorAll('button').forEach(b => b.addEventListener('click', () => { toast('🌡 Termostato…'); callAdmin('vimar_thermo', { id: x.id, op: b.dataset.op }); }));
    return card;
  });

  renderList('#vimar-hvac', vimar.hvac, x => {
    const card = document.createElement('div'); card.className = 'device-card';
    card.innerHTML = `<div class="dev-row"><div><div class="dev-name">${x.name || x.id || '—'}</div><div class="dev-meta">${x.room || ''} · ${x.mode || ''} · Set=${x.setpoint ?? '—'}° · Fan=${x.fan || ''}</div></div></div><div class="dev-ctrl"><button class="small-btn" data-op="powerToggle">⏻ Power</button><button class="small-btn" data-op="dec">−</button><button class="small-btn" data-op="inc">+</button><button class="small-btn" data-op="modeNext">Mode</button><button class="small-btn" data-op="fanNext">Fan</button></div>`;
    card.querySelectorAll('button').forEach(b => b.addEventListener('click', () => { toast('❄️ Clima…'); callAdmin('vimar_hvac', { id: x.id, op: b.dataset.op }); }));
    return card;
  });
}

/* ---- People detail (tab Persone) ---- */
function renderPeopleDetail(m) {
  const list = $('#people-detail');
  if (!list) return;
  list.innerHTML = '';
  const people = buildPeople(m);
  people.forEach(p => {
    const st = (p.onlineSmart || p.online) ? 'in' : 'out';
    const ini = String(p.name || '?').charAt(0).toUpperCase();
    const time = p.lastTime && p.lastDay ? (p.lastTime + ' · ' + p.lastDay) : (p.tsText || '—');
    const card = document.createElement('div'); card.className = 'people-detail-card';
    card.innerHTML = `
      <div class="pdc-top">
        <div class="pdc-avatar ${st}">${ini}</div>
        <div>
          <div class="pdc-name">${cap(p.name)}</div>
          <div class="pdc-state" style="color:${st === 'in' ? 'var(--green)' : 'var(--muted)'}">${st === 'in' ? '● In casa' : '○ Fuori'} · ${time}</div>
        </div>
      </div>
      <div class="pdc-actions">
        <button class="pdc-btn btn-in" data-name="${p.name}">✅ Forza IN</button>
        <button class="pdc-btn btn-out" data-name="${p.name}">❌ Forza OUT</button>
      </div>
    `;
    card.querySelector('.btn-in').addEventListener('click', async () => {
      toast('✅ Forza IN ' + cap(p.name) + '…');
      await callAdmin('force_in', { name: p.name });
      setTimeout(loadAll, 600);
    });
    card.querySelector('.btn-out').addEventListener('click', async () => {
      toast('❌ Forza OUT ' + cap(p.name) + '…');
      await callAdmin('force_out', { name: p.name });
      setTimeout(loadAll, 600);
    });
    list.appendChild(card);
  });

  // Quick actions
  const qa = $('#quick-actions');
  if (qa) {
    qa.innerHTML = '';
    [
      { icon: '⬆️', label: 'Alza tutto', fn: () => { toast('⬆️ Alzo…'); callAdmin('alza_tutto', { manual: 'TRUE' }); setShuttersUp(true); } },
      { icon: '⬇️', label: 'Abbassa tutto', fn: () => { toast('⬇️ Abbasso…'); callAdmin('abbassa_tutto'); setShuttersUp(false); } },
      { icon: '🌿', label: 'Piante ora', fn: () => { toast('🌿 Irrigazione…'); callAdmin('piante'); } },
      { icon: '🏝️', label: 'Toggle vacanza', fn: async () => { const next = !m.vacanza; toast(next ? '🏝️ Vacanza ON' : '🏠 Vacanza OFF'); await callAdmin('set_vacanza', { value: String(next) }); setTimeout(loadAll, 500); } },
      { icon: '🛡️', label: 'Toggle override', fn: async () => { const next = !m.override; toast(next ? '🛡️ Override ON' : '✅ Override OFF'); await callAdmin('set_override', { value: String(next) }); setTimeout(loadAll, 500); } },
      { icon: '🔄', label: 'Aggiorna', fn: () => loadAll() },
    ].forEach(a => {
      const btn = document.createElement('button'); btn.className = 'qa-btn';
      btn.innerHTML = `<span class="qa-icon">${a.icon}</span>${a.label}`;
      btn.addEventListener('click', a.fn);
      qa.appendChild(btn);
    });
  }
}

/* ---- Settings tab ---- */
function renderSettings(m) {
  const list = $('#settings-list');
  if (!list) return;
  list.innerHTML = '';

  const rows = [
    { label: 'Vacanza', sub: 'Modalità assenza prolungata', key: 'vacanza', event: 'set_vacanza' },
    { label: 'Override', sub: 'Sospendi automazioni', key: 'override', event: 'set_override' },
  ];
  rows.forEach(r => {
    const isOn = !!m[r.key];
    const row = document.createElement('div'); row.className = 'setting-row';
    row.innerHTML = `
      <div>
        <div class="setting-label">${r.label}</div>
        <div class="setting-sub">${r.sub}</div>
      </div>
      <label class="toggle-wrap">
        <input type="checkbox" ${isOn ? 'checked' : ''}>
        <span class="toggle-slider"></span>
      </label>
    `;
    row.querySelector('input').addEventListener('change', async e => {
      const next = e.target.checked;
      toast(`${r.label}: ${next ? 'ON' : 'OFF'}`);
      await callAdmin(r.event, { value: String(next) });
      setTimeout(loadAll, 500);
    });
    list.appendChild(row);
  });

  // Info card
  const info = $('#info-card');
  if (info) {
    const stato = String(m.state || '—');
    const night = m.notte ? '🌙 Notte' : '☀️ Giorno';
    const alba = m.alba || (m.next && m.next.alba) || '—';
    const tram = m.tramonto || (m.next && m.next.tramonto) || '—';
    const ts = m.meta && m.meta.nowIso ? fmtDate(m.meta.nowIso) : '—';
    info.innerHTML = [
      ['Stato', stato],
      ['Ora', night],
      ['Alba', typeof alba === 'string' ? alba : fmtDate(alba)],
      ['Tramonto', typeof tram === 'string' ? tram : fmtDate(tram)],
      ['Ultimo aggiornamento', ts],
      ['Errori log', String((m.alerts && m.alerts.logErrors) || 0)],
    ].map(([k, v]) => `<div class="info-row"><span class="info-key">${k}</span><span class="info-val">${v}</span></div>`).join('');
  }
}

/* ---- Log ---- */
function renderLogs(logs) {
  const list = $('#log-list'), empty = $('#log-empty');
  if (!list) return;
  list.innerHTML = '';
  if (!logs || !logs.length) {
    if (empty) empty.hidden = false;
    return;
  }
  if (empty) empty.hidden = true;
  logs.forEach(x => {
    const isErr = String(x.code || '').toUpperCase().includes('ERR');
    const row = document.createElement('div'); row.className = 'log-row' + (isErr ? ' log-err' : '');
    row.innerHTML = `
      <div class="log-code">${x.code || '—'} <span style="color:var(--muted);font-weight:400;font-size:11px">· ${x.stato || ''}</span></div>
      <div class="log-meta">${x.ts ? fmtDate(x.ts) : '—'}</div>
      ${(x.desc || x.note) ? `<div class="log-desc">${x.desc || ''} ${x.note ? '· ' + x.note : ''}</div>` : ''}
    `;
    list.appendChild(row);
  });
}

/* ---- Error dot ---- */
function updateErrorDot(m) {
  const n = (m.alerts && Number(m.alerts.logErrors)) || 0;
  const dot = $('#dot-err'); if (dot) dot.hidden = !n;
  const badge = $('#badge-log'); if (badge) badge.hidden = !n;
}

/* ---- Build people array ---- */
function buildPeople(m) {
  const byName = {};
  const base = Array.isArray(m.people) ? m.people : [];
  base.forEach(p => { byName[String(p.name || '').toLowerCase()] = { ...p }; });

  // merge peopleLast
  (m.peopleLast || []).forEach(x => {
    const k = String(x.name || '').toLowerCase();
    if (!byName[k]) byName[k] = { name: x.name, onlineSmart: false };
    byName[k].lastEvent = x.lastEvent;
    byName[k].lastDay   = x.lastDay;
    byName[k].lastTime  = x.lastTime;
  });

  // merge from CONFIG.PEOPLE if not present
  (CONFIG.PEOPLE || []).forEach(name => {
    const k = name.toLowerCase();
    if (!byName[k]) byName[k] = { name, onlineSmart: false };
  });

  return Object.values(byName).sort((a, b) => {
    const A = (a.onlineSmart || a.online) ? 1 : 0;
    const B = (b.onlineSmart || b.online) ? 1 : 0;
    if (A !== B) return B - A;
    return String(a.name).localeCompare(String(b.name), 'it');
  });
}

/* ---- Timestamp ---- */
function updateTs(m) {
  const ts = $('#ts');
  if (ts) ts.textContent = m.meta && m.meta.nowIso ? fmtTime(m.meta.nowIso) : fmtTime(new Date().toISOString());
}

/* ============================================================
   LOAD FUNCTIONS
   ============================================================ */

async function loadAll() {
  const btn = $('#btn-refresh');
  if (btn) btn.style.opacity = '.4';
  try {
    const m = await fetchModel();
    MODEL = m;
    renderBanner(m);
    renderCards(m);
    renderFavorites(m);
    renderPeopleChips(m);
    renderEvents(m);
    renderVimar(m);
    renderPeopleDetail(m);
    renderSettings(m);
    updateErrorDot(m);
    updateTs(m);

    // Weather: from model or client fallback
    const w = m.weather || {};
    const hasWeather = w.tempC != null || w.humidity != null;
    if (hasWeather && !CONFIG.WEATHER.forceClient) {
      renderWeather(w);
    } else {
      fetchWeather().then(renderWeather).catch(() => {});
    }
  } catch (e) {
    console.error('loadAll error:', e);
    toast('⚠️ Errore caricamento');
  } finally {
    if (btn) btn.style.opacity = '';
  }
}

async function loadLogs() {
  try {
    const url = CONFIG.DOGET_URL + (CONFIG.DOGET_URL.includes('?') ? '&' : '?') + 'logs=1&_=' + Date.now();
    const data = await jsonpFetch(url).catch(async () => {
      const r = await fetch(url, { cache: 'no-store' });
      return r.json();
    });
    renderLogs((data && data.logs) || []);
  } catch (e) {
    console.error('Logs error:', e);
    const empty = $('#log-empty');
    if (empty) empty.textContent = 'Errore caricamento log.';
  }
}

/* ---- Tab navigation ---- */
function activateTab(target) {
  $$('.tab').forEach(b => b.classList.toggle('active', b.dataset.target === target));
  $$('.view').forEach(v => v.classList.toggle('active', v.id === 'view-' + target));
  window.scrollTo({ top: 0, behavior: 'smooth' });
  if (target === 'log') loadLogs();
}

/* ============================================================
   INIT
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
  // Tab clicks
  $$('.tab').forEach(t => t.addEventListener('click', () => activateTab(t.dataset.target)));

  // Refresh button
  const rb = $('#btn-refresh');
  if (rb) rb.addEventListener('click', () => { toast('🔄 Aggiorno…'); loadAll(); });

  // Log button
  const lb = $('#btn-log');
  if (lb) lb.addEventListener('click', () => activateTab('log'));

  // Load
  loadAll();

  // Auto refresh
  if (CONFIG.AUTO_REFRESH_MS > 0) {
    _refreshTimer = setInterval(loadAll, CONFIG.AUTO_REFRESH_MS);
  }

  // Refresh on page visibility
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) loadAll();
  });
});

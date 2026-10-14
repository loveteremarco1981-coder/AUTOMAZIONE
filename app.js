// ============================================================
// app.js — Automazione Casa v3.0
// ============================================================
'use strict';

let MODEL = null;
let _toastTimer = null;
let _reloadTimer = null;
let _cbId = 0;
let _loading = false;
let _lastWxPush = 0;

const $  = (sel, ctx) => (ctx || document).querySelector(sel);
const $$ = (sel, ctx) => Array.from((ctx || document).querySelectorAll(sel));

/* ============================================================
   UTILITÀ
   ============================================================ */

// Evita che nomi o etichette con caratteri speciali rompano il layout
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

function fmtTime(iso) {
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
  } catch (_) { return '—'; }
}
function fmtDateTime(iso) {
  try { return new Date(iso).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }); }
  catch (_) { return '—'; }
}
function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''; }
// Ogni persona ha sempre lo stesso colore (deriva dal nome)
function avClass(name) {
  let n = 0;
  String(name || '').split('').forEach(ch => { n += ch.charCodeAt(0); });
  return 'av-' + (n % 5);
}

const getShuttersUp = () => { try { return localStorage.getItem('ui_shutters_up') === '1'; } catch (_) { return false; } };
const setShuttersUp = v => { try { localStorage.setItem('ui_shutters_up', v ? '1' : '0'); } catch (_) {} };

function haptic() {
  try {
    if (navigator.vibrate) { navigator.vibrate(10); return; }
    const l = document.getElementById('haptic'); // iPhone: il tocco su un interruttore dà un leggero "tic"
    if (l) l.click();
  } catch (_) {}
}

/* ---- Trasparenza del vetro (0 = trasparente, 100 = opaco) ---- */
function applyGlass(v) {
  const t = Math.min(100, Math.max(0, Number(v))) / 100;
  const root = document.documentElement.style;
  root.setProperty('--ga', (0.05 + t * 0.15).toFixed(3));
  root.setProperty('--glass-blur', Math.round(14 + (1 - t) * 14) + 'px');
}

/* ---- Ultimo comando alle tapparelle (il Bluetooth non restituisce lo stato reale) ---- */
let _wx = null;
const getShutterLog = () => { try { return JSON.parse(localStorage.getItem('ui_shutter_last') || '{}'); } catch (_) { return {}; } };
function markShutters(dir, label) {
  try {
    const log = getShutterLog();
    log[label || 'ALL'] = { dir, ts: Date.now() };
    localStorage.setItem('ui_shutter_last', JSON.stringify(log));
  } catch (_) {}
  updateShutterSubs();
  updateHero();
}
function lastShutter(label) {
  const log = getShutterLog();
  const a = log.ALL, b = label ? log[label] : null;
  if (a && b) return a.ts >= b.ts ? a : b;
  return a || b || null;
}
function shutterText(rec) {
  if (!rec) return 'Nessun comando recente';
  return `Ultimo comando: ${rec.dir === 'up' ? 'aperte' : 'chiuse'}, ${fmtTime(new Date(rec.ts).toISOString())}`;
}
function updateShutterSubs() {
  $$('.shutter-sub[data-label]').forEach(el => { el.textContent = shutterText(lastShutter(el.dataset.label)); });
}

/* ---- Scene (modificabili: basta definire CONFIG.SCENES in config.js) ---- */
const DEFAULT_SCENES = [
  { id: 'buongiorno', label: 'Buongiorno', sub: 'Alza e clima auto', icon: 'sun', tone: 'amber',
    steps: [{ event: 'alza_tutto', params: { manual: 'TRUE' } }, { event: 'termostato_auto' }, { event: 'ezviz_interne_off' }] },
  { id: 'esco', label: 'Esco', sub: 'Chiudi, clima off, cam', icon: 'door', tone: 'blue',
    steps: [{ event: 'abbassa_tutto', params: { manual: 'TRUE' } }, { event: 'off_termostato' }, { event: 'ezviz_interne_on' }] },
  { id: 'rientro', label: 'Rientro', sub: 'Clima auto, cam off', icon: 'home', tone: 'green',
    steps: [{ event: 'termostato_auto' }, { event: 'ezviz_interne_off' }] },
  { id: 'notte', label: 'Notte', sub: 'Chiudi e cam esterne', icon: 'moon', tone: 'purple',
    steps: [{ event: 'abbassa_tutto', params: { manual: 'TRUE' } }, { event: 'ezviz_esterne_on' }, { event: 'ezviz_interne_off' }] },
];

async function runScene(scene) {
  haptic();
  toast(`${scene.label}…`);
  let failed = false;
  for (const s of scene.steps) {
    const r = await callAdmin(s.event, s.params);
    if (!r || r.ok === false) failed = true;
    if (s.event === 'alza_tutto')    { setShuttersUp(true);  markShutters('up'); }
    if (s.event === 'abbassa_tutto') { setShuttersUp(false); markShutters('down'); }
  }
  toast(failed ? `${scene.label}: alcuni comandi non sono andati a buon fine` : `${scene.label}: fatto`, failed ? 'err' : 'ok', 3000);
  reloadSoon(800);
}

function renderScenes() {
  const host = $('#scene-row'); if (!host || host.dataset.built) return;
  host.innerHTML = '';
  (CONFIG.SCENES || DEFAULT_SCENES).forEach(sc => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'scene-btn';
    if (sc.tone) b.dataset.tone = sc.tone;
    b.innerHTML = `<span class="scene-ico">${svg(sc.icon || 'play')}</span>
      <span class="scene-txt"><span class="scene-name">${esc(sc.label)}</span><span class="scene-sub">${esc(sc.sub || '')}</span></span>`;
    b.addEventListener('click', () => busy(b, () => runScene(sc)));
    host.appendChild(b);
  });
  host.dataset.built = '1';
}

/* ---- Frase di benvenuto ---- */
function updateHero() {
  const t = $('#hero-title'), s = $('#hero-sub'); if (!t || !s) return;
  const h = new Date().getHours();
  t.textContent = h < 5 ? 'Buonanotte' : h < 12 ? 'Buongiorno' : h < 18 ? 'Buon pomeriggio' : h < 23 ? 'Buonasera' : 'Buonanotte';
  if (!MODEL) return;

  const names = (Array.isArray(MODEL.people) ? MODEL.people : []).filter(p => p.onlineSmart).map(p => cap(p.name));
  const who = !names.length ? 'Non c’è nessuno in casa'
            : names.length === 1 ? `In casa c’è ${names[0]}`
            : `In casa: ${names.slice(0, -1).join(', ')} e ${names[names.length - 1]}`;
  const parts = [who];
  if (_wx && _wx.tempC != null) parts.push(`fuori ci sono ${Math.round(_wx.tempC)}°`);
  const rec = lastShutter(null);
  if (rec) parts.push(`tapparelle ${rec.dir === 'up' ? 'aperte' : 'chiuse'} dalle ${fmtTime(new Date(rec.ts).toISOString())}`);
  s.textContent = parts.join(', ') + '.';
}

/* ============================================================
   ICONE (SVG inline, stesso stile su ogni dispositivo)
   ============================================================ */
const ICONS = {
  up:       '<path d="M12 19V5"/><path d="m5 12 7-7 7 7"/>',
  down:     '<path d="M12 5v14"/><path d="m19 12-7 7-7-7"/>',
  play:     '<polygon points="6 3 20 12 6 21 6 3"/>',
  power:    '<path d="M12 2v10"/><path d="M18.4 6.6a9 9 0 1 1-12.77.04"/>',
  leaf:     '<path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/>',
  plane:    '<path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/>',
  shield:   '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>',
  refresh:  '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>',
  camera:   '<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/>',
  video:    '<path d="m16 13 5.223 3.482a.5.5 0 0 0 .777-.416V7.87a.5.5 0 0 0-.752-.432L16 10.5"/><rect x="2" y="6" width="14" height="12" rx="2"/>',
  thermo:   '<path d="M14 4v10.54a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0Z"/>',
  shutter:  '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M3 15h18"/>',
  check:    '<path d="M20 6 9 17l-5-5"/>',
  x:        '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  chevron:  '<path d="m9 18 6-6-6-6"/>',
  phone:    '<rect width="14" height="20" x="5" y="2" rx="2"/><path d="M12 18h.01"/>',
  moon:     '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
  door:     '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/>',
  home:     '<path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z"/><path d="M9 21V12h6v9"/>',
  sun:      '<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>',
  cloudsun: '<path d="M12 2v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="M20 12h2"/><path d="m19.07 4.93-1.41 1.41"/><path d="M15.947 12.65a4 4 0 0 0-5.925-4.128"/><path d="M13 22H7a5 5 0 1 1 4.9-6H13a3 3 0 0 1 0 6Z"/>',
  fog:      '<path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"/><path d="M16 17H7"/><path d="M17 21H9"/>',
  rain:     '<path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"/><path d="M16 14v6"/><path d="M8 14v6"/><path d="M12 16v6"/>',
  snow:     '<path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"/><path d="M8 15h.01"/><path d="M8 19h.01"/><path d="M12 17h.01"/><path d="M12 21h.01"/><path d="M16 15h.01"/><path d="M16 19h.01"/>',
  storm:    '<path d="M6 16.326A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 .5 8.973"/><path d="m13 12-3 5h4l-3 5"/>',
};

function svg(name, cls) {
  return `<svg class="ico${cls ? ' ' + cls : ''}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ''}</svg>`;
}

// Le icone che arrivano da config.js sono emoji: dove la conosciamo
// la sostituiamo con l'SVG, altrimenti la lasciamo com'è.
const EMOJI_TO_ICON = {
  '⬆': 'up', '⬇': 'down', '▶': 'play', '🌿': 'leaf', '🏝': 'plane',
  '🛡': 'shield', '🔄': 'refresh', '📷': 'camera', '📹': 'video',
  '🌡': 'thermo', '🪟': 'shutter',
};
function iconFromEmoji(e, fallbackName) {
  const key = String(e || '').replace(/\uFE0F/g, '');
  const name = EMOJI_TO_ICON[key] || (!key && fallbackName);
  return name ? svg(name) : `<span class="emoji">${esc(e)}</span>`;
}

function weatherIcon(code) {
  const n = parseInt(code, 10);
  if (isNaN(n)) return svg('thermo');
  if (n === 0)  return svg('sun');
  if (n <= 3)   return svg('cloudsun');
  if (n <= 48)  return svg('fog');
  if (n <= 67)  return svg('rain');
  if (n <= 77)  return svg('snow');
  if (n <= 82)  return svg('rain');
  if (n <= 99)  return svg('storm');
  return svg('thermo');
}

/* ============================================================
   FEEDBACK: toast, stato rete, pulsanti "in corso"
   ============================================================ */
function toast(msg, type, ms) {
  const el = $('#toast'); if (!el) return;
  el.className = 'toast show ' + (type || 'info');
  el.innerHTML = '<span class="toast-dot"></span><span></span>';
  el.lastChild.textContent = msg;
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => el.classList.remove('show'), ms || 2400);
}

function setOnline(ok) {
  const b = $('#net-banner'); if (b) b.hidden = !!ok;
}

// Blocca un elemento mentre l'azione è in corso (niente doppi tocchi)
async function busy(el, fn) {
  if (!el || el.classList.contains('is-busy')) return;
  el.classList.add('is-busy');
  el.setAttribute('aria-busy', 'true');
  try { return await fn(); }
  finally { el.classList.remove('is-busy'); el.removeAttribute('aria-busy'); }
}

function reloadSoon(ms) {
  clearTimeout(_reloadTimer);
  _reloadTimer = setTimeout(() => loadAll(), ms || 500);
}

function skeleton(host, n, cls) {
  if (!host) return;
  host.innerHTML = Array.from({ length: n }, () => `<div class="skel ${cls}"></div>`).join('');
}

function showLoadError() {
  ['#people-chips', '#events-list'].forEach(s => { const h = $(s); if (h) h.innerHTML = ''; });
  const g = $('#fav-grid'); if (!g) return;
  g.innerHTML = `<div class="empty-state wide">
    <p>Impossibile caricare i dati. Controlla la connessione e riprova.</p>
    <button class="small-btn" type="button" id="btn-retry">Riprova</button>
  </div>`;
  $('#btn-retry')?.addEventListener('click', () => {
    skeleton($('#fav-grid'), 4, 'skel-fav');
    skeleton($('#people-chips'), 3, 'skel-av');
    skeleton($('#events-list'), 4, 'skel-row');
    loadAll(true);
  });
}

/* ============================================================
   RETE (JSONP verso Apps Script)
   ============================================================ */
function jsonpFetch(url) {
  return new Promise((resolve, reject) => {
    const id = '__cb_' + (++_cbId);
    const sep = url.includes('?') ? '&' : '?';
    const el = document.createElement('script');
    const timer = setTimeout(() => { cleanup(); reject(new Error('timeout')); }, 15000);
    function cleanup() { try { delete window[id]; el.remove(); } catch (_) {} }
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
    if (params) Object.entries(params).forEach(([k, v]) => u.searchParams.set(k, String(v)));
    jsonpFetch(u.toString())
      .then(d => { setOnline(true); resolve(d); })
      .catch(() => { setOnline(false); toast('Connessione assente. Riprova tra poco.', 'err'); resolve(null); });
  });
}

function fetchModel() { return jsonpFetch(CONFIG.DOGET_URL); }
function fetchLogs()  { return jsonpFetch(CONFIG.DOGET_URL + '?logs=1'); }

/* ---- Meteo ---- */
async function fetchWeatherClient() {
  const w = CONFIG.WEATHER || {};
  if (!w.lat || !w.lon) return null;

  const url =
    'https://api.open-meteo.com/v1/forecast' +
    '?latitude=' + encodeURIComponent(w.lat) +
    '&longitude=' + encodeURIComponent(w.lon) +
    '&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m' +
    '&timezone=' + encodeURIComponent(w.tz || 'Europe/Rome');

  const r = await fetch(url);
  if (!r.ok) return null;

  const js = await r.json();
  const c = js.current || {};
  return {
    tempC: c.temperature_2m ?? null,
    humidity: c.relative_humidity_2m ?? null,
    windKmh: c.wind_speed_10m ?? null,
    icon: String(c.weather_code ?? ''),
    provider: 'Open-Meteo',
  };
}

/* ============================================================
   RENDER
   ============================================================ */

function renderBanner(m) {
  const el = $('#state-banner'); if (!el) return;
  const st = String(m.state || '').toUpperCase();
  const map = { COMFY_DAY: 'sb-comfy-day', COMFY_NIGHT: 'sb-comfy-night', SECURITY_DAY: 'sb-security-day', SECURITY_NIGHT: 'sb-security-night' };
  const icon = { COMFY_DAY: 'sun', COMFY_NIGHT: 'moon', SECURITY_DAY: 'shield', SECURITY_NIGHT: 'shield' }[st] || 'home';
  el.className = 'state-banner ' + (map[st] || 'sb-security-day');

  const isSecurity = st.startsWith('SECURITY');
  const isNight = st.endsWith('NIGHT');
  const title = isSecurity ? 'Sicurezza' : (map[st] ? 'Comfort' : cap(st.toLowerCase().replace(/_/g, ' ')) || '—');
  // Stessa logica con cui l'app mostra lo stato delle telecamere nei Dispositivi
  const estOn = isSecurity || st === 'COMFY_NIGHT';
  const cams = isSecurity ? 'cam interne ed esterne attive' : estOn ? 'cam esterne attive' : 'cam spente';
  const sub = map[st] ? `${isNight ? 'Notte' : 'Giorno'} · ${cams}` : '';

  // Prossimo evento solare (alba o tramonto) ancora da venire
  const nx = m.next || {};
  const now = Date.now();
  const upcoming = [['Alba', nx.alba], ['Tramonto', nx.tramonto]]
    .map(([l, v]) => [l, v ? new Date(v) : null])
    .filter(([, d]) => d && !isNaN(d.getTime()) && d.getTime() > now)
    .sort((x, y) => x[1] - y[1])[0];

  el.innerHTML = `
    <span class="sb-ico">${svg(icon)}</span>
    <span class="sb-text">
      <span class="sb-title">${esc(title)}</span>
      ${sub ? `<span class="sb-sub">${esc(sub)}</span>` : ''}
    </span>
    ${upcoming ? `<span class="sb-next">${upcoming[0]} ${fmtTime(upcoming[1].toISOString())}</span>` : ''}
    <span class="sb-chev">${svg('chevron')}</span>`;
}

function renderCards(m) {
  const people = Array.isArray(m.people) ? m.people : [];
  const inCount = people.filter(p => p.onlineSmart).length;
  const el = $('#people-count'); if (el) el.textContent = inCount;
  const card = $('#card-presence'); if (card) card.classList.toggle('card-glow', inCount > 0);
}

function renderWeather(w) {
  if (!w) return;
  _wx = w;
  const tv = $('#temp-val'); if (tv && w.tempC != null)    tv.textContent = Math.round(w.tempC);
  const hv = $('#hum-val');  if (hv && w.humidity != null) hv.textContent = Math.round(w.humidity);
  const wv = $('#wind-val'); if (wv && w.windKmh != null)  wv.textContent = Math.round(w.windKmh);
  const pi = $('#weather-icon');
  const pt = $('#weather-pill-temp');
  if (pi) pi.innerHTML = weatherIcon(w.icon);
  if (pt) pt.textContent = w.tempC != null ? Math.round(w.tempC) + '°' : '—';
  updateHero();
}

function favGlyph(id) {
  return ({ tapparelle: 'icons/st/glyph-shutter.svg', piante: 'icons/st/glyph-plant.svg', vacanza: 'icons/st/glyph-suit.svg', override: 'icons/st/glyph-moon.svg' })[id] || 'icons/st/glyph-generic.svg';
}

function renderFavorites(m) {
  const grid = $('#fav-grid'); if (!grid) return;
  grid.innerHTML = '';

  (CONFIG.FAVORITES || []).forEach(f => {
    let isOn = false;
    if (f.id === 'tapparelle')      isOn = getShuttersUp();
    else if (f.id === 'vacanza')    isOn = !!m.vacanza;
    else if (f.id === 'override')   isOn = !!m.override;
    else if (f.stateKey)            isOn = !!m[f.stateKey];

    const isToggle = f.id === 'tapparelle' || f.kind === 'toggle';
    const statusText = f.id === 'tapparelle' ? (isOn ? 'Aperte' : 'Chiuse')
                     : f.kind === 'toggle'   ? (isOn ? 'Attivo' : 'Disattivo')
                     : f.kind === 'action'   ? 'Avvia' : '';

    const card = document.createElement('article');
    card.className = 'fav-card' + (isOn ? ' active' : '');
    card.style.setProperty('--fc', f.color || '#58a6ff');
    card.dataset.kind = f.kind || (f.id === 'tapparelle' ? 'toggle' : 'action');
    card.tabIndex = 0;
    card.setAttribute('role', 'button');
    if (isToggle) card.setAttribute('aria-pressed', String(isOn));
    card.setAttribute('aria-label', f.label || 'Azione');
    card.innerHTML = `
      <div class="fav-glyph" style="background:${esc(f.color || '#f0f0f0')}"><img src="${favGlyph(f.id)}" alt=""></div>
      <span class="fav-action" aria-hidden="true">${svg(f.kind === 'action' ? 'play' : 'power')}</span>
      <div class="fav-label">${esc(f.label)}</div>
      <div class="fav-sub">${esc(f.subtitle || '')}</div>
      ${statusText ? `<div class="fav-status">${statusText}</div>` : ''}`;

    const doAction = async () => {
      haptic();
      if (f.id === 'tapparelle') {
        const next = !isOn; setShuttersUp(next);
        toast(next ? 'Alzo le tapparelle…' : 'Abbasso le tapparelle…');
        const r = await callAdmin(next ? (f.upEvent || 'alza_tutto') : (f.downEvent || 'abbassa_tutto'), { manual: 'TRUE' });
        if (r && r.ok !== false) markShutters(next ? 'up' : 'down');
        reloadSoon(800);
      } else if (f.id === 'vacanza') {
        const next = !isOn; toast(next ? 'Modalità vacanza attiva' : 'Modalità vacanza disattivata');
        await callAdmin('set_vacanza', { value: String(next) }); reloadSoon(500);
      } else if (f.id === 'override') {
        const next = !isOn; toast(next ? 'Override attivo' : 'Override disattivato');
        await callAdmin('set_override', { value: String(next) }); reloadSoon(500);
      } else if (f.kind === 'toggle' && f.toggleEvent) {
        const next = !isOn; toast(`${f.label}: ${next ? 'attivo' : 'disattivo'}`);
        await callAdmin(f.toggleEvent, { value: String(next) }); reloadSoon(500);
      } else if (f.kind === 'action' && f.event) {
        toast(`${f.label} in corso…`);
        await callAdmin(f.event);
      }
    };

    const trigger = () => {
      card.classList.remove('pulse'); void card.offsetWidth; card.classList.add('pulse');   // onda di colore al tocco
      setTimeout(() => card.classList.remove('pulse'), 650);
      busy(card, doAction);
    };
    card.addEventListener('click', trigger);
    card.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); trigger(); }
    });
    grid.appendChild(card);
  });
}

function renderPeopleChips(m) {
  const host = $('#people-chips'); if (!host) return;
  host.innerHTML = '';
  const people = Array.isArray(m.people) ? m.people : [];
  if (!people.length) { host.innerHTML = '<div class="empty-state">Nessuna persona configurata.</div>'; return; }

  const sorted = [...people].sort((a, b) => {
    if (a.onlineSmart !== b.onlineSmart) return a.onlineSmart ? -1 : 1;
    return String(a.name).localeCompare(String(b.name), 'it');
  });
  const inN = sorted.filter(p => p.onlineSmart).length;

  const head = document.createElement('div');
  head.className = 'fam-head';
  head.innerHTML = `
    <span class="fam-count"><b>${inN}</b> su ${sorted.length} in casa</span>
    <span class="fam-pips" aria-hidden="true">${sorted.map(p => `<i class="${p.onlineSmart ? 'on' : ''}"></i>`).join('')}</span>`;
  host.appendChild(head);

  const row = document.createElement('div');
  row.className = 'fam-row';
  host.appendChild(row);

  sorted.forEach((p, idx) => {
    const st = p.onlineSmart ? 'in' : 'out';
    const ini = String(p.name || '?').charAt(0).toUpperCase();
    const t = /(\d{1,2}:\d{2})/.exec(String(p.lastSeen || ''));
    const wifi = p.wifiOnline ? 'Wi‑Fi connesso' : 'Wi‑Fi non connesso';

    const b = document.createElement('button');
    b.type = 'button';
    b.className = `fam-person ${st}`;
    b.style.setProperty('--i', idx);
    b.setAttribute('aria-label', `${cap(p.name)}, ${p.onlineSmart ? 'in casa' : 'fuori'}, ${wifi}`);
    b.innerHTML = `
      <span class="fam-avatar ${avClass(p.name)}">${esc(ini)}<span class="fam-dot ${p.wifiOnline ? 'on' : ''}"></span></span>
      <span class="fam-name">${esc(cap(p.name))}</span>
      <span class="fam-state">${p.onlineSmart ? 'In casa' : 'Fuori'}</span>
      ${t ? `<span class="fam-time">dalle ${t[1]}</span>` : ''}`;
    b.addEventListener('click', () => { haptic(); activateTab('people'); });
    row.appendChild(b);
  });
}

function renderEvents(m) {
  const list = $('#events-list'); if (!list) return;
  list.innerHTML = '';
  const nx = m.next || {};

  const rows = [
    ['Alba',              nx.alba ? fmtTime(nx.alba) : null],
    ['Tramonto',          nx.tramonto ? fmtTime(nx.tramonto) : null],
    ['Apre tapparelle',   nx.shuttersOpenTime || null],
    ['Chiude tapparelle', nx.shuttersCloseTime || null],
  ].filter(r => r[1] && r[1] !== '—');

  if (!rows.length) { list.innerHTML = '<div class="empty-state">Nessun evento in programma.</div>'; return; }

  // Ordina per orario e mette in evidenza il prossimo (se tutti gli orari sono leggibili)
  const toMin = s => { const t = /(\d{1,2}):(\d{2})/.exec(String(s)); return t ? (+t[1]) * 60 + (+t[2]) : null; };
  // Mostra solo ore e minuti (lo script a volte manda data e secondi: "14/10/2026 09:43:14")
  const hm = s => { const t = /(\d{1,2}):(\d{2})/.exec(String(s)); return t ? t[1].padStart(2, '0') + ':' + t[2] : String(s); };
  const items = rows.map(([label, val]) => ({ label, val: hm(val), min: toMin(val) }));
  let nextIdx = -1;
  if (items.every(i => i.min !== null)) {
    items.sort((x, y) => x.min - y.min);
    const d = new Date(), nowMin = d.getHours() * 60 + d.getMinutes();
    nextIdx = items.findIndex(i => i.min > nowMin);
    if (nextIdx === -1) nextIdx = 0; // tutti già passati: il primo di domani
  }

  items.forEach((it, i) => {
    const row = document.createElement('div');
    row.className = 'event-row' + (i === nextIdx ? ' next' : '');
    row.innerHTML = `<span class="event-label">${esc(it.label)}</span><span class="event-val">${esc(it.val)}</span>`;
    list.appendChild(row);
  });
}

/* ---- Dispositivi ---- */
function renderDevices(m) {
  const DEV = CONFIG.DEVICES || {};

  /* App collegate (costruite una sola volta) */
  const appLinks = $('#app-links');
  if (appLinks && !appLinks.dataset.built) {
    appLinks.innerHTML = '';
    (DEV.APPS || []).forEach(app => {
      const card = document.createElement('a');
      card.className = 'app-link-card';
      card.href = '#';
      card.innerHTML = `
        <div class="app-link-icon" style="background:${esc(app.color || '#f0f0f0')}">${iconFromEmoji(app.icon || '📱', 'phone')}</div>
        <div class="app-link-info">
          <div class="app-link-name">${esc(app.label)}</div>
          <div class="app-link-sub">${esc(app.subtitle || '')}</div>
        </div>
        <span class="app-link-arrow">${svg('chevron')}</span>`;
      card.addEventListener('click', e => {
        e.preventDefault();
        const fallback = app.urlFallback || app.url;
        const t = setTimeout(() => { window.location.href = fallback; }, 2000);
        window.location.href = app.url;
        document.addEventListener('visibilitychange', function cancel() {
          if (document.hidden) { clearTimeout(t); document.removeEventListener('visibilitychange', cancel); }
        });
      });
      appLinks.appendChild(card);
    });
    appLinks.dataset.built = '1';
  }

  /* Tapparelle (costruite una sola volta) */
  const shutterList = $('#shutter-list');
  if (shutterList && !shutterList.dataset.built) {
    shutterList.innerHTML = '';
    (DEV.SHUTTERS || []).forEach(sh => {
      const card = document.createElement('div');
      card.className = 'shutter-card';
      card.innerHTML = `
        <span class="dev-icon">${iconFromEmoji(sh.icon || '🪟', 'shutter')}</span>
        <span class="shutter-text">
          <span class="shutter-label">${esc(sh.label)}</span>
          <span class="shutter-sub" data-label="${esc(sh.label)}"></span>
        </span>
        <div class="shutter-btns">
          <button class="sh-btn" type="button" data-ev="${esc(sh.upEvent)}"   title="Alza"     aria-label="Alza ${esc(sh.label)}">${svg('up')}</button>
          <button class="sh-btn" type="button" data-ev="${esc(sh.downEvent)}" title="Abbassa" aria-label="Abbassa ${esc(sh.label)}">${svg('down')}</button>
        </div>`;
      card.querySelectorAll('.sh-btn').forEach(b => {
        b.addEventListener('click', () => busy(b, async () => {
          haptic();
          const up = b.dataset.ev.startsWith('alza');
          const icon = card.querySelector('.dev-icon');
          icon.classList.add('moving');
          toast(`${up ? 'Alzo' : 'Abbasso'} ${sh.label}…`);
          const r = await callAdmin(b.dataset.ev, { manual: 'TRUE' });
          setTimeout(() => icon.classList.remove('moving'), 1800);
          if (r && r.ok !== false) {
            markShutters(up ? 'up' : 'down', /tutt/i.test(sh.label) ? 'ALL' : sh.label);
            if (/tutt/i.test(sh.label)) setShuttersUp(up);
          }
        }));
      });
      shutterList.appendChild(card);
    });
    shutterList.dataset.built = '1';
  }
  updateShutterSubs();

  /* Termostati (costruiti una sola volta) */
  const thermoList = $('#thermostat-list');
  if (thermoList && !thermoList.dataset.built) {
    thermoList.innerHTML = '';
    (DEV.THERMOSTATS || []).forEach(t => {
      const card = document.createElement('div');
      card.className = 'shutter-card';
      card.innerHTML = `
        <span class="dev-icon">${iconFromEmoji(t.icon || '🌡️', 'thermo')}</span>
        <span class="shutter-label">${esc(t.label)}</span>
        <div class="shutter-btns">
          <button class="sh-btn" type="button" data-ev="${esc(t.event)}" title="Applica" aria-label="Applica ${esc(t.label)}">${svg('play')}</button>
        </div>`;
      const b = card.querySelector('.sh-btn');
      b.addEventListener('click', () => busy(b, async () => {
        haptic();
        toast(`${t.label} in corso…`);
        await callAdmin(t.event);
      }));
      thermoList.appendChild(card);
    });
    thermoList.dataset.built = '1';
  }

  /* Telecamere */
  const camList = $('#camera-list');
  if (camList) {
    if (!camList.dataset.built) {
      camList.innerHTML = '';
      const groups = [
        { key: 'int', icon: 'camera', label: 'Cam interne' },
        { key: 'est', icon: 'video',  label: 'Cam esterne' },
      ];
      groups.forEach(g => {
        const camOn  = (DEV.CAMERAS || []).find(c => c.id === g.key + '_on');
        const camOff = (DEV.CAMERAS || []).find(c => c.id === g.key + '_off');
        if (!camOn || !camOff) return;

        const card = document.createElement('div');
        card.className = 'shutter-card';
        card.dataset.camKey = g.key;
        card.innerHTML = `
          <span class="dev-icon">${svg(g.icon)}</span>
          <span class="shutter-label">${g.label}</span>
          <div class="seg" role="group" aria-label="${g.label}">
            <button class="seg-btn" type="button" data-ev="${esc(camOn.event)}"  data-state="on">ON</button>
            <button class="seg-btn" type="button" data-ev="${esc(camOff.event)}" data-state="off">OFF</button>
          </div>`;

        card.querySelectorAll('.seg-btn').forEach(btn => {
          btn.addEventListener('click', () => busy(btn, async () => {
            haptic();
            const isOn = btn.dataset.state === 'on';
            toast(`${isOn ? 'Accendo' : 'Spengo'} ${g.label.toLowerCase()}…`);
            setCamButtons(card, isOn); // aggiornamento immediato
            const result = await callAdmin(btn.dataset.ev);
            if (result && result.ok === false) {
              toast('Comando non riuscito' + (result.error ? ': ' + result.error : ''), 'err');
              reloadSoon(500); // ripristina lo stato reale
            } else if (result) {
              toast(`${g.label}: ${isOn ? 'accese' : 'spente'}`, 'ok');
            }
          }));
        });
        camList.appendChild(card);
      });
      camList.dataset.built = '1';
    }
    updateCamStates(m);
  }
}

function setCamButtons(card, isOn) {
  card.querySelectorAll('.seg-btn').forEach(b => {
    const active = b.dataset.state === 'on' ? isOn : !isOn;
    b.classList.toggle('is-active', active);
    b.setAttribute('aria-pressed', String(active));
  });
}

function updateCamStates(m) {
  const stato = (m && m.state) ? String(m.state).toUpperCase() : '';
  const stateMap = {
    int: stato.startsWith('SECURITY'),
    est: stato.startsWith('SECURITY') || stato === 'COMFY_NIGHT',
  };
  $$('[data-cam-key]').forEach(card => setCamButtons(card, !!stateMap[card.dataset.camKey]));
}

function renderPeopleDetail(m) {
  const list = $('#people-detail');
  if (list) {
    list.innerHTML = '';
    const people = Array.isArray(m.people) ? m.people : [];
    const sorted = [...people].sort((a, b) => {
      if (a.onlineSmart !== b.onlineSmart) return a.onlineSmart ? -1 : 1;
      return String(a.name).localeCompare(String(b.name), 'it');
    });

    sorted.forEach(p => {
      const st = p.onlineSmart ? 'in' : 'out';
      const ini = String(p.name || '?').charAt(0).toUpperCase();
      const ago = p.lastSeen || '—';
      const wifi = p.wifiOnline ? 'Wi‑Fi connesso' : 'Wi‑Fi non connesso';

      const card = document.createElement('div');
      card.className = 'people-detail-card';
      card.innerHTML = `
        <div class="pdc-top">
          <div class="pdc-avatar ${st} ${avClass(p.name)}">${esc(ini)}</div>
          <div>
            <div class="pdc-name">${esc(cap(p.name))}</div>
            <div class="pdc-state ${st}">${st === 'in' ? 'In casa' : 'Fuori'} · ${esc(ago)}</div>
            <div class="pdc-ssid">${wifi}</div>
          </div>
        </div>
        <div class="pdc-actions">
          <button class="pdc-btn btn-in"  type="button">${svg('check')}Forza in casa</button>
          <button class="pdc-btn btn-out" type="button">${svg('x')}Forza fuori</button>
        </div>`;

      const force = (btn, event, okMsg) => busy(btn, async () => {
        haptic();
        toast(`Aggiorno ${cap(p.name)}…`);
        const r = await callAdmin(event, { name: p.name });
        if (r && r.ok !== false) toast(okMsg, 'ok');
        else if (r) toast('Operazione non riuscita. Riprova tra qualche secondo.', 'err');
        reloadSoon(800);
      });
      const bIn = card.querySelector('.btn-in'), bOut = card.querySelector('.btn-out');
      bIn.addEventListener('click',  () => force(bIn,  'force_in',  `${cap(p.name)} è in casa`));
      bOut.addEventListener('click', () => force(bOut, 'force_out', `${cap(p.name)} è fuori`));
      list.appendChild(card);
    });
  }

  const qa = $('#quick-actions');
  if (qa) {
    qa.innerHTML = '';
    [
      { icon: 'up',      label: 'Alza tutto',      fn: async () => { toast('Alzo le tapparelle…');   setShuttersUp(true);  const r = await callAdmin('alza_tutto', { manual: 'TRUE' }); if (r && r.ok !== false) markShutters('up'); } },
      { icon: 'down',    label: 'Abbassa tutto',   fn: async () => { toast('Abbasso le tapparelle…'); setShuttersUp(false); const r = await callAdmin('abbassa_tutto'); if (r && r.ok !== false) markShutters('down'); } },
      { icon: 'leaf',    label: 'Annaffia piante', fn: async () => { toast('Avvio irrigazione…'); await callAdmin('piante'); } },
      { icon: 'plane',   label: 'Vacanza',         fn: async () => { const next = !MODEL?.vacanza;  toast(next ? 'Modalità vacanza attiva' : 'Modalità vacanza disattivata'); await callAdmin('set_vacanza',  { value: String(next) }); reloadSoon(500); } },
      { icon: 'shield',  label: 'Override',        fn: async () => { const next = !MODEL?.override; toast(next ? 'Override attivo' : 'Override disattivato'); await callAdmin('set_override', { value: String(next) }); reloadSoon(500); } },
      { icon: 'refresh', label: 'Aggiorna dati',   fn: () => loadAll(true) },
    ].forEach(a => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'qa-btn';
      btn.innerHTML = `${svg(a.icon)}<span>${a.label}</span>`;
      btn.addEventListener('click', () => busy(btn, async () => { haptic(); await a.fn(); }));
      qa.appendChild(btn);
    });
  }
}

function renderSettings(m) {
  const list = $('#settings-list');
  if (list) {
    list.innerHTML = '';
    [
      { label: 'Escludi tapparelle', sub: 'Blocca solo i movimenti automatici', key: 'shuttersExcluded', event: 'set_shutters_excluded' },
      { label: 'Vacanza',            sub: 'Modalità assenza',                   key: 'vacanza',          event: 'set_vacanza' },
      { label: 'Override',           sub: 'Sospendi le automazioni',            key: 'override',         event: 'set_override' },
    ].forEach(r => {
      const isOn = !!m[r.key];
      const row = document.createElement('div');
      row.className = 'setting-row';
      row.innerHTML = `
        <div><div class="setting-label">${r.label}</div><div class="setting-sub">${r.sub}</div></div>
        <label class="toggle-wrap"><input type="checkbox" aria-label="${r.label}" ${isOn ? 'checked' : ''}><span class="toggle-slider"></span></label>`;
      const input = row.querySelector('input');
      input.addEventListener('change', async e => {
        const next = e.target.checked;
        toast(`${r.label}: ${next ? 'attivo' : 'disattivo'}`);
        const res = await callAdmin(r.event, { value: String(next) });
        if (!res) input.checked = !next; // comando non arrivato: ripristina l'interruttore
        else reloadSoon(500);
      });
      list.appendChild(row);
    });

    // Forza il ricaricamento dell'app (utile dopo un aggiornamento dei file)
    const upd = document.createElement('div');
    upd.className = 'setting-row';
    upd.innerHTML = `
      <div><div class="setting-label">Aggiorna app</div><div class="setting-sub">Scarica l'ultima versione dei file</div></div>
      <button class="small-btn" type="button">Aggiorna</button>`;
    upd.querySelector('button').addEventListener('click', forceAppReload);
    list.appendChild(upd);
  }

  const info = $('#info-card');
  if (info) {
    const stato   = cap(String(m.state || '—').toLowerCase().replace(/_/g, ' '));
    const night   = m.notte ? 'Notte' : 'Giorno';
    const alba    = m.next?.alba ? fmtTime(m.next.alba) : '—';
    const tram    = m.next?.tramonto ? fmtTime(m.next.tramonto) : '—';
    const updated = m.meta?.nowIso ? fmtDateTime(m.meta.nowIso) : '—';
    const errors  = (m.alerts && Number(m.alerts.logErrors)) || 0;
    const ssidActive = (Array.isArray(m.people) ? m.people : []).filter(p => p.wifiOnline).map(p => cap(p.name)).join(', ') || '—';
    info.innerHTML = [
      ['Stato',      stato],
      ['Fase',       night],
      ['Alba',       alba],
      ['Tramonto',   tram],
      ['Aggiornato', updated],
      ['Errori log', String(errors)],
      ['Wi‑Fi attivo', ssidActive],
    ].map(([k, v]) => `<div class="info-row"><span class="info-key">${k}</span><span class="info-val">${esc(v)}</span></div>`).join('');
  }
}

function renderLogs(logs) {
  const list = $('#log-list'), empty = $('#log-empty'); if (!list) return;
  list.innerHTML = '';
  if (!logs || !logs.length) { if (empty) { empty.textContent = 'Nessun evento registrato.'; empty.hidden = false; } return; }
  if (empty) empty.hidden = true;
  logs.forEach(x => {
    const isErr = /err/i.test(x.code || '');
    const row = document.createElement('div');
    row.className = 'log-row' + (isErr ? ' log-err' : '');
    row.innerHTML = `
      <div class="log-code">${esc(x.code || '—')}${x.stato ? `<small>${esc(x.stato)}</small>` : ''}</div>
      <div class="log-meta">${x.ts ? fmtDateTime(x.ts) : '—'}</div>
      ${(x.desc || x.note) ? `<div class="log-desc">${esc(x.desc || '')}${x.note ? ' · ' + esc(x.note) : ''}</div>` : ''}`;
    list.appendChild(row);
  });
}

function updateErrorBadge(m) {
  const n = (m.alerts && Number(m.alerts.logErrors)) || 0;
  const dot = $('#dot-err'); if (dot) dot.hidden = !n;
  const badge = $('#badge-log'); if (badge) badge.hidden = !n;
}

function updateTs(m) {
  const el = $('#ts'); if (!el) return;
  el.textContent = m.meta?.nowIso ? fmtTime(m.meta.nowIso) : fmtTime(new Date().toISOString());
}

/* ============================================================
   CARICAMENTO
   ============================================================ */
async function loadAll(manual) {
  if (_loading) return;
  _loading = true;
  const btn = $('#btn-refresh'); if (btn) btn.classList.add('spin');
  try {
    const m = await fetchModel();
    MODEL = m;
    window._lastModel = m;
    setOnline(true);

    renderBanner(m); renderCards(m); renderScenes(); renderFavorites(m);
    renderPeopleChips(m); renderEvents(m); renderDevices(m);
    renderPeopleDetail(m); renderSettings(m);
    updateErrorBadge(m); updateTs(m);
    updateHero();

    if (document.body.classList.contains('first-paint')) {
      setTimeout(() => document.body.classList.remove('first-paint'), 1000);
    }

    const w = m.weather || {};
    if (w.tempC != null || w.humidity != null) renderWeather(w);

    fetchWeatherClient().then(ww => {
      if (!ww) return;
      renderWeather(ww);
      // Invia il meteo allo script al massimo ogni 10 minuti
      if (Date.now() - _lastWxPush < 10 * 60 * 1000) return;
      _lastWxPush = Date.now();
      try {
        const u = new URL(CONFIG.DOGET_URL);
        u.searchParams.set('event', 'update_weather');
        if (ww.tempC != null)    u.searchParams.set('temp', Math.round(ww.tempC));
        if (ww.humidity != null) u.searchParams.set('hum',  Math.round(ww.humidity));
        if (ww.windKmh != null)  u.searchParams.set('wind', Math.round(ww.windKmh));
        if (ww.icon != null)     u.searchParams.set('icon', ww.icon);
        jsonpFetch(u.toString()).catch(() => {});
      } catch (_) {}
    }).catch(() => {});

    if (manual === true) toast('Dati aggiornati', 'ok', 1600);
  } catch (e) {
    console.error('loadAll:', e);
    setOnline(false);
    if (!MODEL) showLoadError();
    else if (manual === true) toast('Aggiornamento non riuscito', 'err');
  } finally {
    _loading = false;
    if (btn) btn.classList.remove('spin');
  }
}

async function loadLogs() {
  try { const data = await fetchLogs(); renderLogs((data && data.logs) || []); }
  catch (e) {
    const el = $('#log-empty');
    if (el) { el.textContent = 'Impossibile caricare il log. Riprova più tardi.'; el.hidden = false; }
  }
}

function forceAppReload() {
  const done = () => window.location.reload();
  try {
    const jobs = [];
    if ('serviceWorker' in navigator) {
      jobs.push(navigator.serviceWorker.getRegistrations().then(regs => Promise.all(regs.map(r => r.unregister()))));
    }
    if (window.caches) {
      jobs.push(caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k)))));
    }
    Promise.all(jobs).then(done, done);
  } catch (_) { done(); }
}

/* ============================================================
   NAVIGAZIONE
   ============================================================ */
/* ============================================================
   PERLA DELLA BARRA + MENISCO
   La scheda attiva sale fuori dalla barra dentro una perla colorata;
   il bordo della barra si solleva attorno a lei come una goccia d'acqua.
   La perla si allunga mentre scivola e si può trascinare.
   ============================================================ */
const TAB_TONES = { home: '#58a6ff', devices: '#4ade80', people: '#fbbf24', settings: '#f472b6', log: '#c4a1ff' };
const REDUCE_MOTION = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
const BEAD_LIFT = 16;      // di quanto l'icona attiva sale sopra le altre
const PLATE_OVER = 30;     // spazio sopra la barra per il rigonfiamento
let _beadX = null, _beadY = 0, _trackToken = 0;

function setTone(target) {
  document.documentElement.style.setProperty('--tone', TAB_TONES[target] || TAB_TONES.home);
}

function beadTargetFor(btn) {
  const bar = $('.tabbar'), bead = $('.tab-bead');
  const br = bar.getBoundingClientRect(), r = btn.getBoundingClientRect();
  return {
    x: r.left + r.width / 2 - br.left - bead.offsetWidth / 2,
    y: r.top - br.top + 19 - BEAD_LIFT - bead.offsetHeight / 2,   // 19 = margine sopra + metà icona
  };
}

// Ridisegna la piastra seguendo la posizione attuale della perla
function updatePlate() {
  const bar = $('.tabbar'), bead = $('.tab-bead'), svg = $('.tab-plate');
  if (!bar || !bead || !svg) return;
  const W = bar.offsetWidth, H = bar.offsetHeight, O = PLATE_OVER, R = 28, k = 1.4;
  const br = bar.getBoundingClientRect(), r = bead.getBoundingClientRect();
  const cx = r.left + r.width / 2 - br.left;
  const cy = r.top + r.height / 2 - br.top + O;
  const rx = r.width / 2 + 9, ry = r.height / 2 + 9;
  const set = (id, o) => { const n = document.getElementById(id); if (n) Object.entries(o).forEach(([a, v]) => n.setAttribute(a, v)); };
  svg.setAttribute('viewBox', `0 0 ${W} ${H + O}`);
  set('plate-rim-r',  { x: 0, y: O, width: W, height: H, rx: R });
  set('plate-fill-r', { x: k, y: O + k, width: W - 2 * k, height: H - 2 * k, rx: R - k });
  set('plate-rim-e',  { cx, cy, rx, ry });
  set('plate-fill-e', { cx, cy, rx: rx - k, ry: ry - k });
}

function placeBead(btn, animate) {
  const bead = $('.tab-bead'); if (!bead || !btn) return;
  const { x, y } = beadTargetFor(btn);
  const from = _beadX;
  const token = ++_trackToken;                       // interrompe un eventuale inseguimento precedente
  bead.getAnimations && bead.getAnimations().forEach(an => an.cancel());
  bead.style.transform = `translate(${x}px, ${y}px)`;
  if (animate && from !== null && Math.abs(from - x) > 1 && bead.animate && !REDUCE_MOTION) {
    const dist = Math.abs(x - from);
    const sx = 1 + Math.min(0.9, dist / 240);        // si allunga in orizzontale…
    const sy = 1 / Math.sqrt(sx);                    // …e si assottiglia
    const mid = (from + x) / 2;
    const an = bead.animate([
      { transform: `translate(${from}px, ${y}px) scale(1, 1)` },
      { transform: `translate(${mid}px, ${y}px) scale(${sx}, ${sy})`, offset: 0.45 },
      { transform: `translate(${x}px, ${y}px) scale(1.05, 0.95)`, offset: 0.8 },
      { transform: `translate(${x}px, ${y}px) scale(1, 1)` },
    ], { duration: 560, easing: 'cubic-bezier(.3,.9,.4,1)' });
    const loop = () => { if (token !== _trackToken) return; updatePlate(); requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
    an.onfinish = () => { an.cancel(); if (token === _trackToken) { _trackToken++; updatePlate(); } };
  } else {
    updatePlate();
  }
  _beadX = x; _beadY = y;
}

function initTabBead() {
  const bar = $('.tabbar'), bead = $('.tab-bead'); if (!bar || !bead) return;
  const placeActive = animate => placeBead($('.tab.active'), animate);

  requestAnimationFrame(() => placeActive(false));
  window.addEventListener('load', () => placeActive(false));
  window.addEventListener('resize', () => placeActive(false));
  if (window.ResizeObserver) new ResizeObserver(() => placeActive(false)).observe(bar);

  // Trascinamento: la perla segue il dito e, rilasciando, si ferma sulla scheda più vicina
  let down = false, moved = false, startX = 0, current = null;
  const tabs = () => $$('.tab');
  const nearest = cx => tabs().reduce((best, t) => {
    const r = t.getBoundingClientRect();
    const d = Math.abs(r.left + r.width / 2 - cx);
    return (!best || d < best.d) ? { t, d } : best;
  }, null).t;

  bar.addEventListener('pointerdown', e => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    down = true; moved = false; startX = e.clientX; current = null;
  });
  bar.addEventListener('pointermove', e => {
    if (!down) return;
    if (!moved) {
      if (Math.abs(e.clientX - startX) < 8) return;
      moved = true;
      try { bar.setPointerCapture(e.pointerId); } catch (_) {}
      bar.classList.add('dragging');
    }
    _trackToken++;
    const br = bar.getBoundingClientRect();
    const w = bead.offsetWidth;
    const x = Math.min(br.width - w - 4, Math.max(4, e.clientX - br.left - w / 2));
    bead.getAnimations && bead.getAnimations().forEach(an => an.cancel());
    bead.style.transform = `translate(${x}px, ${_beadY}px)`;
    _beadX = x;
    updatePlate();
    const t = nearest(e.clientX);
    if (t !== current) {
      current = t; haptic();
      tabs().forEach(b => b.classList.toggle('active', b === t));
      setTone(t.dataset.target);
    }
  });
  const end = e => {
    if (!down) return;
    down = false;
    bar.classList.remove('dragging');
    if (moved) activateTab(nearest(e.clientX).dataset.target);   // la perla si assesta sulla scheda scelta
  };
  bar.addEventListener('pointerup', end);
  bar.addEventListener('pointercancel', end);
}

function activateTab(target) {
  $$('.tab').forEach(b => {
    const on = b.dataset.target === target;
    b.classList.toggle('active', on);
    if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
  });
  $$('.view').forEach(v => v.classList.toggle('active', v.id === 'view-' + target));
  setTone(target);
  placeBead($('.tab.active'), true);
  window.scrollTo({ top: 0 });
  try { sessionStorage.setItem('ui_tab', target); } catch (_) {}
  if (target === 'log') loadLogs();
}

document.addEventListener('DOMContentLoaded', () => {
  $$('.tab').forEach(t => t.addEventListener('click', () => activateTab(t.dataset.target)));
  initTabBead();
  $('#btn-refresh')?.addEventListener('click', () => { haptic(); loadAll(true); });
  $('#btn-log')?.addEventListener('click', () => activateTab('log'));
  $('#state-banner')?.addEventListener('click', () => { haptic(); activateTab('devices'); });

  // Cursore trasparenza: salva la scelta su questo dispositivo
  const gr = $('#glass-range');
  let gv = 35;
  try { const s = localStorage.getItem('ui_glass'); if (s !== null) gv = Number(s); } catch (_) {}
  applyGlass(gv);
  if (gr) {
    gr.value = String(gv);
    gr.addEventListener('input', () => { applyGlass(gr.value); try { localStorage.setItem('ui_glass', gr.value); } catch (_) {} });
  }

  // Segnaposto mentre arrivano i primi dati
  skeleton($('#fav-grid'), 4, 'skel-fav');
  skeleton($('#people-chips'), 3, 'skel-av');
  skeleton($('#events-list'), 4, 'skel-row');

  // Riapre l'ultima scheda usata nella sessione
  try {
    const last = sessionStorage.getItem('ui_tab');
    if (last && $('#view-' + last)) activateTab(last);
  } catch (_) {}

  window.addEventListener('offline', () => setOnline(false));
  window.addEventListener('online',  () => loadAll());

  loadAll();
  if (CONFIG.AUTO_REFRESH_MS > 0) setInterval(() => loadAll(), CONFIG.AUTO_REFRESH_MS);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) loadAll(); });
});

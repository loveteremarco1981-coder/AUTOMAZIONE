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

/* ---- Chiave di accesso (una sola, uguale per tutti; si chiede una volta per dispositivo) ---- */
const getKey   = () => { try { return localStorage.getItem('ui_key') || ''; } catch (_) { return ''; } };
const setKey   = v  => { try { localStorage.setItem('ui_key', v); } catch (_) {} };
const clearKey = () => { try { localStorage.removeItem('ui_key'); } catch (_) {} };
const isDenied = d  => !!(d && d.error === 'unauthorized');

/* ---- Ultimo stato noto (per aprire subito l'app anche senza rete) ---- */
function saveModel(m) {
  try { localStorage.setItem('ui_last_model', JSON.stringify(m)); localStorage.setItem('ui_last_ts', String(Date.now())); } catch (_) {}
}
function loadSavedModel() {
  try { const s = localStorage.getItem('ui_last_model'); return s ? JSON.parse(s) : null; } catch (_) { return null; }
}
function lastSavedTs() {
  try { return Number(localStorage.getItem('ui_last_ts') || 0); } catch (_) { return 0; }
}

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
// Ultimo comando automatico registrato dallo script (se disponibile)
function backendShutter() {
  const sh = MODEL && MODEL.shutters;
  if (!sh || !sh.since) return null;
  const ts = Number(sh.since);
  if (!ts) return null;
  const dir = sh.state === 'PIANTE' ? 'piante' : 'down';
  return { dir, ts, auto: true };
}
function lastShutter(label) {
  const log = getShutterLog();
  const a = log.ALL, b = label ? log[label] : null;
  let rec = (a && b) ? (a.ts >= b.ts ? a : b) : (a || b || null);
  const bk = backendShutter();
  if (bk && (!rec || bk.ts > rec.ts)) rec = bk;
  return rec;
}
const SHUTTER_WHAT = { up: 'apertura', down: 'chiusura', piante: 'apertura per le piante' };
function shutterWhen(ts) {
  const d = new Date(ts), now = new Date();
  const t = fmtTime(d.toISOString());
  if (d.toDateString() === now.toDateString()) return `alle ${t}`;
  const y = new Date(now); y.setDate(now.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return `ieri alle ${t}`;
  return `il ${d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })} alle ${t}`;
}
// Il Bluetooth non conferma l'esecuzione: si dice cosa è stato INVIATO, non lo stato reale
function shutterText(rec) {
  if (!rec) return 'Nessun comando recente';
  return `${cap(SHUTTER_WHAT[rec.dir] || 'comando')}${rec.auto ? ' automatica' : ''} inviata ${shutterWhen(rec.ts)}`;
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

async function runScene(scene, onlySteps) {
  haptic();
  if (isReadOnly()) { toast('Sola lettura: con questa chiave non puoi dare comandi.', 'err', 3200); return; }
  if (!onlySteps) {
    const go = await undoWindow(`Scena «${scene.label}»`);
    if (!go) { toast('Annullato', 'info', 1500); return; }
  }
  toast(`${scene.label}…`);
  const failed = [];
  for (const s of (onlySteps || scene.steps)) {
    const r = await callAdmin(s.event, s.params, { noUndo: true });
    if (!r || r.ok === false) { failed.push(s); continue; }
    if (s.event === 'alza_tutto')    { setShuttersUp(true);  markShutters('up'); }
    if (s.event === 'abbassa_tutto') { setShuttersUp(false); markShutters('down'); }
  }
  if (failed.length) failToast(`${scene.label}: ${failed.length} ${failed.length === 1 ? 'comando non confermato' : 'comandi non confermati'}`, () => runScene(scene, failed));
  else toast(`${scene.label}: comandi inviati`, 'ok', 3000);
  reloadSoon(800);
}

function renderScenes(force) {
  const host = $('#scene-row'); if (!host) return;
  if (host.dataset.built && !force) return;
  host.innerHTML = '';
  (typeof getScenes === 'function' ? getScenes() : (CONFIG.SCENES || DEFAULT_SCENES)).forEach(sc => {
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
  if (rec) parts.push(`ultimo comando alle tapparelle: ${SHUTTER_WHAT[rec.dir] || 'comando'} ${shutterWhen(rec.ts)}`);
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
  alert:    '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  bell:     '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
  palette:  '<circle cx="13.5" cy="6.5" r=".6"/><circle cx="17.5" cy="10.5" r=".6"/><circle cx="8.5" cy="7.5" r=".6"/><circle cx="6.5" cy="12.5" r=".6"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/>',
  lock:     '<rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
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
function toast(msg, type, ms, action) {
  const el = $('#toast'); if (!el) return;
  el.className = 'toast show ' + (type || 'info') + (action ? ' has-act' : '');
  el.innerHTML = '<span class="toast-dot"></span><span class="toast-msg"></span>';
  el.querySelector('.toast-msg').textContent = msg;
  if (action) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'toast-act'; b.textContent = action.label;
    b.addEventListener('click', () => { el.classList.remove('show'); action.fn(); });
    el.appendChild(b);
  }
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => el.classList.remove('show'), ms || 2400);
}
// Comando non confermato: avviso con "Riprova"
function failToast(msg, retry) { toast(msg, 'err', 8000, { label: 'Riprova', fn: retry }); }

function setOnline(ok) {
  const b = $('#net-banner'); if (!b) return;
  b.hidden = !!ok;
  if (!ok) {
    const ts = lastSavedTs();
    b.textContent = ts ? `Connessione assente. Dati delle ${fmtTime(new Date(ts).toISOString())}.` : 'Connessione assente.';
  }
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
    const k = getKey();
    el.src = url + sep + 'callback=' + id + (k ? '&key=' + encodeURIComponent(k) : '') + '&_=' + Date.now();
    el.onerror = () => { clearTimeout(timer); cleanup(); reject(new Error('load error')); };
    document.head.appendChild(el);
  });
}

async function callAdmin(event, params, opts) {
  opts = opts || {};
  if (isReadOnly()) { toast('Sola lettura: con questa chiave non puoi dare comandi.', 'err', 3200); return null; }

  // Azioni delicate: qualche secondo per annullare prima che parta il comando
  if (!opts.noUndo) {
    const label = undoLabelFor(event, params);
    if (label) {
      const go = await undoWindow(label);
      if (!go) { toast('Annullato', 'info', 1500); return null; }
    }
  }

  const u = new URL(CONFIG.DOGET_URL);
  u.searchParams.set('event', event);
  if (params) Object.entries(params).forEach(([k, v]) => u.searchParams.set(k, String(v)));
  try {
    const d = await jsonpFetch(u.toString());
    if (isDenied(d)) { showLock(); return null; }
    if (d && d.error === 'readonly') { toast('Questa chiave è di sola lettura.', 'err', 3200); return null; }
    setOnline(true);
    return d;
  } catch (_) {
    setOnline(false);
    toast('Connessione assente. Riprova tra poco.', 'err');
    return null;
  }
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


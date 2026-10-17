'use strict';
/* ============================================================
   STORICO — grafici di temperatura, umidità e presenze.
   I dati arrivano dallo script (foglio "Storico"): ?history=1
   ============================================================ */
let _hist = { rows: [], ts: 0, ok: false };
let _histDays = 1;

function parseHistRow(r) {
  if (!Array.isArray(r)) return null;
  const t = new Date(r[0]).getTime();
  if (isNaN(t)) return null;
  const num = v => (v === '' || v === null || v === undefined || isNaN(Number(v))) ? null : Number(v);
  return { t, temp: num(r[1]), hum: num(r[2]), n: num(r[3]), names: String(r[4] || '').split(',').map(s => s.trim()).filter(Boolean) };
}

async function loadHistory(force) {
  if (!force && Date.now() - _hist.ts < 10 * 60 * 1000) return;
  _hist.ts = Date.now();
  try {
    const d = await jsonpFetch(CONFIG.DOGET_URL + '?history=1&days=7');
    if (isDenied(d)) return;
    if (d && d.ok !== false && Array.isArray(d.rows)) {
      _hist.rows = d.rows.map(parseHistRow).filter(Boolean).sort((a, b) => a.t - b.t);
      _hist.ok = _hist.rows.length > 1;
    } else {
      _hist.ok = false;            // script non ancora aggiornato: la sezione resta nascosta
    }
  } catch (_) { return; }
  renderHistory();
  if (typeof drawLogs === 'function' && _logAll.length) drawLogs();
}

/* Chi era in casa nel momento di un evento (riga di storico entro 40 minuti) */
function presenceAt(ts) {
  if (!_hist.ok) return null;
  const t = new Date(ts).getTime();
  if (isNaN(t)) return null;
  let best = null, bd = Infinity;
  for (const r of _hist.rows) { const d = Math.abs(r.t - t); if (d < bd) { bd = d; best = r; } }
  if (!best || bd > 40 * 60 * 1000) return null;
  return best.names;
}

function chartLabels(from, to) {
  const f = d => _histDays <= 1
    ? new Date(d).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
    : new Date(d).toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric' });
  return [f(from), f((from + to) / 2), f(to)];
}

function lineChart(rows, key, color, unit) {
  const pts = rows.filter(r => r[key] !== null);
  if (pts.length < 2) return '<div class="hc-empty">Dati non ancora sufficienti</div>';
  const W = 320, H = 96, PL = 4, PR = 4, PT = 8, PB = 4;
  const t0 = pts[0].t, t1 = pts[pts.length - 1].t;
  let lo = Math.min(...pts.map(p => p[key])), hi = Math.max(...pts.map(p => p[key]));
  if (hi - lo < 2) { const c = (hi + lo) / 2; lo = c - 1; hi = c + 1; }
  const pad = (hi - lo) * .12; lo -= pad; hi += pad;
  const x = t => PL + (t - t0) / Math.max(1, t1 - t0) * (W - PL - PR);
  const y = v => PT + (1 - (v - lo) / (hi - lo)) * (H - PT - PB);
  const line = pts.map((p, i) => (i ? 'L' : 'M') + x(p.t).toFixed(1) + ' ' + y(p[key]).toFixed(1)).join(' ');
  const area = line + ` L${x(t1).toFixed(1)} ${H - PB} L${x(t0).toFixed(1)} ${H - PB} Z`;
  const id = 'g' + key;
  const last = pts[pts.length - 1];
  return `<svg class="hc-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Andamento ${key}">
    <defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${color}" stop-opacity=".38"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></linearGradient></defs>
    <path d="${area}" fill="url(#${id})"/>
    <path d="${line}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/>
    <circle cx="${x(last.t).toFixed(1)}" cy="${y(last[key]).toFixed(1)}" r="3" fill="${color}"/>
  </svg>`;
}

function presenceChart(rows) {
  const pts = rows.filter(r => r.n !== null);
  if (pts.length < 2) return '<div class="hc-empty">Dati non ancora sufficienti</div>';
  const W = 320, H = 64, PT = 6, PB = 2;
  const t0 = pts[0].t, t1 = pts[pts.length - 1].t;
  const max = Math.max(1, ...pts.map(p => p.n));
  const x = t => (t - t0) / Math.max(1, t1 - t0) * W;
  const y = v => PT + (1 - v / max) * (H - PT - PB);
  let d = `M0 ${H - PB}`;
  pts.forEach((p, i) => {
    const nx = i + 1 < pts.length ? x(pts[i + 1].t) : W;
    d += ` L${x(p.t).toFixed(1)} ${y(p.n).toFixed(1)} L${nx.toFixed(1)} ${y(p.n).toFixed(1)}`;
  });
  d += ` L${W} ${H - PB} Z`;
  return `<svg class="hc-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Presenze in casa">
    <path d="${d}" fill="rgba(63,185,80,.42)" stroke="#3fb950" stroke-width="1.6" vector-effect="non-scaling-stroke"/>
  </svg>`;
}

function statLine(rows, key, unit, dec) {
  const v = rows.filter(r => r[key] !== null).map(r => r[key]);
  if (!v.length) return '—';
  const f = n => (dec ? n.toFixed(1) : Math.round(n)) + unit;
  return `<b>${f(v[v.length - 1])}</b><small>min ${f(Math.min(...v))} · max ${f(Math.max(...v))}</small>`;
}

function renderHistory() {
  const sec = $('#hist-section'); if (!sec) return;
  sec.hidden = !_hist.ok;
  if (!_hist.ok) return;
  const from = Date.now() - _histDays * 864e5;
  const rows = _hist.rows.filter(r => r.t >= from);
  const body = $('#hist-body');
  if (rows.length < 2) { body.innerHTML = '<div class="hc-empty wide">Dati non ancora sufficienti per questo periodo.</div>'; syncHistSeg(); return; }
  const [a, b, c] = chartLabels(rows[0].t, rows[rows.length - 1].t);
  const axis = `<div class="hc-axis"><span>${a}</span><span>${b}</span><span>${c}</span></div>`;

  const peak = rows.reduce((m, r) => (r.n !== null && r.n > (m ? m.n : -1)) ? r : m, null);
  const peakTxt = peak && peak.n > 0
    ? `Più presenze: ${peak.n} ${peak.n === 1 ? 'persona' : 'persone'}, ${_histDays <= 1 ? fmtTime(new Date(peak.t).toISOString()) : new Date(peak.t).toLocaleDateString('it-IT', { weekday: 'long' })}`
    : 'Nessuna presenza registrata nel periodo';

  body.innerHTML = `
    <div class="hc-grid">
      <article class="hc-card"><header><span class="hc-t">Temperatura</span><span class="hc-v">${statLine(rows, 'temp', '°', true)}</span></header>${lineChart(rows, 'temp', '#ff9f43')}${axis}</article>
      <article class="hc-card"><header><span class="hc-t">Umidità</span><span class="hc-v">${statLine(rows, 'hum', '%', false)}</span></header>${lineChart(rows, 'hum', '#58a6ff')}${axis}</article>
    </div>
    <article class="hc-card hc-wide"><header><span class="hc-t">Presenze in casa</span><span class="hc-v"><small>${esc(peakTxt)}</small></span></header>${presenceChart(rows)}${axis}</article>`;
  syncHistSeg();
}

function syncHistSeg() {
  $$('#hist-seg .seg-btn').forEach(b => {
    const on = Number(b.dataset.days) === _histDays;
    b.classList.toggle('is-active', on);
    b.setAttribute('aria-pressed', String(on));
  });
}

function initHistoryUI() {
  $('#hist-seg')?.addEventListener('click', e => {
    const b = e.target.closest('.seg-btn'); if (!b) return;
    _histDays = Number(b.dataset.days) || 1;
    renderHistory();
  });
}

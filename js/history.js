'use strict';
/* ============================================================
   STORICO — grafici di temperature (esterna, 3° e 4° piano), umidità,
   riscaldamento (ore accese, accensioni, interventi) e presenze.
   I dati arrivano dallo script (fogli "Storico" e "Termostati"): ?history=1
   ============================================================ */
let _hist = { rows: [], ts: 0, ok: false, termo: null };
let _histDays = 1;

function parseHistRow(r) {
  if (!Array.isArray(r)) return null;
  const t = new Date(r[0]).getTime();
  if (isNaN(t)) return null;
  const num = v => (v === '' || v === null || v === undefined || isNaN(Number(v))) ? null : Number(v);
  return { t, temp: num(r[1]), hum: num(r[2]), n: num(r[3]), names: String(r[4] || '').split(',').map(s => s.trim()).filter(Boolean),
           tg: num(r[5]), tn: num(r[6]), ag: num(r[9]), an: num(r[10]) };
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
      _hist.termo = d.termostati || null;
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

// Più linee sulla stessa scala (temperature esterna, 3° e 4° piano)
function multiLineChart(rows, series) {
  const usate = series.filter(sr => rows.filter(r => r[sr.key] !== null).length >= 2);
  if (!usate.length) return '<div class="hc-empty">Dati non ancora sufficienti</div>';
  const W = 320, H = 110, PL = 4, PR = 4, PT = 8, PB = 4;
  const t0 = rows[0].t, t1 = rows[rows.length - 1].t;
  const vals = usate.flatMap(sr => rows.filter(r => r[sr.key] !== null).map(r => r[sr.key]));
  let lo = Math.min(...vals), hi = Math.max(...vals);
  if (hi - lo < 2) { const c = (hi + lo) / 2; lo = c - 1; hi = c + 1; }
  const pad = (hi - lo) * .1; lo -= pad; hi += pad;
  const x = t => PL + (t - t0) / Math.max(1, t1 - t0) * (W - PL - PR);
  const y = v => PT + (1 - (v - lo) / (hi - lo)) * (H - PT - PB);
  const paths = usate.map(sr => {
    const pts = rows.filter(r => r[sr.key] !== null);
    const d = pts.map((p, i) => (i ? 'L' : 'M') + x(p.t).toFixed(1) + ' ' + y(p[sr.key]).toFixed(1)).join(' ');
    return `<path d="${d}" fill="none" stroke="${sr.color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/>`;
  }).join('');
  return `<svg class="hc-svg hc-multi" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Temperature esterna e dei piani">${paths}</svg>`;
}

function lastVal(rows, key) {
  for (let i = rows.length - 1; i >= 0; i--) if (rows[i][key] !== null) return rows[i][key];
  return null;
}

// Striscia acceso/spento nel tempo (dalle righe dello storico)
function onOffBand(rows, key) {
  const pts = rows.filter(r => r[key] !== null);
  if (!pts.length) return '<div class="hb-band hb-empty"></div>';
  const t0 = rows[0].t, t1 = rows[rows.length - 1].t, span = Math.max(1, t1 - t0);
  let html = '';
  pts.forEach((p, i) => {
    if (p[key] !== 1) return;
    const fine = i + 1 < pts.length ? pts[i + 1].t : t1;
    const l = (p.t - t0) / span * 100, w = Math.max(.6, (fine - p.t) / span * 100);
    html += `<i style="left:${l.toFixed(2)}%;width:${w.toFixed(2)}%"></i>`;
  });
  return `<div class="hb-band">${html}</div>`;
}

function oreTxt(h) {
  if (h === null || h === undefined) return '—';
  if (h < 1) return Math.round(h * 60) + ' min';
  return String(Math.round(h * 10) / 10).replace('.', ',') + ' h';
}

function heatingCard(rows, axis) {
  const t = _hist.termo;
  const per = t && t.periodi ? t.periodi[String(_histDays)] : null;
  const piani = [['giorno', '3° piano', 'ag'], ['notte', '4° piano', 'an']];
  const righe = piani.map(([id, nome, key]) => {
    const z = per && per[id];
    return `<div class="hb-row">
      <div class="hb-head"><b>${nome}</b>
        <span>${!z ? 'nessun dato dal registro' : t.versione >= 3
          ? `scalda ${oreTxt(z.ore)} · ${z.accensioni} ${z.accensioni === 1 ? 'accensione' : 'accensioni'}${z.oreSpento ? ` · spento ${oreTxt(z.oreSpento)}` : ''} · ${z.modifiche} ${z.modifiche === 1 ? 'modifica' : 'modifiche'} a mano`
          : t.versione
          ? `comfort ${oreTxt(z.ore)} · ridotta ${oreTxt(z.oreRidotta)}${z.oreSpento ? ` · spento ${oreTxt(z.oreSpento)}` : ''} · ${z.modifiche} ${z.modifiche === 1 ? 'modifica' : 'modifiche'} a mano`
          : `acceso ${oreTxt(z.ore)} · ${z.accensioni} ${z.accensioni === 1 ? 'accensione' : 'accensioni'} · ${z.interventi} ${z.interventi === 1 ? 'intervento' : 'interventi'} dello script`}</span>
      </div>
      ${onOffBand(rows, key)}
    </div>`;
  }).join('');
  let giorni = '';
  if (_histDays > 1 && t && Array.isArray(t.giorni)) {
    const max = Math.max(1, ...t.giorni.flatMap(g => piani.map(([id]) => (g.zone[id] || {}).ore || 0)));
    giorni = `<div class="hb-days" aria-label="Ore di accensione per giorno">${t.giorni.map(g => {
      const d = new Date(g.data + 'T12:00:00');
      const barre = piani.map(([id, nome]) => { const o = (g.zone[id] || {}).ore || 0; return `<i class="hb-${id}" style="height:${Math.max(2, o / max * 100).toFixed(0)}%" title="${nome}: ${oreTxt(o)}"></i>`; }).join('');
      return `<div class="hb-day"><div class="hb-bars">${barre}</div><span>${d.toLocaleDateString('it-IT', { weekday: 'short' })}</span></div>`;
    }).join('')}</div>
    <div class="hb-legend"><span><i class="hb-giorno"></i>3° piano</span><span><i class="hb-notte"></i>4° piano</span><span>${t.versione >= 3 ? 'ore di riscaldamento al giorno' : t.versione ? 'ore di Comfort al giorno' : 'ore di accensione al giorno'}</span></div>`;
  }
  return `<article class="hc-card hc-wide hc-tap" data-detail="heat" role="button" tabindex="0" aria-label="Riscaldamento: apri l’analisi"><header><span class="hc-t">Riscaldamento</span><span class="hc-v"><small>${_histDays <= 1 ? 'ultime 24 ore' : 'ultimi 7 giorni'}</small></span>${HC_ZOOM}</header>
    ${righe}${axis}${giorni}</article>`;
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

  const SERIE = [{ key: 'temp', color: '#ff9f43', label: 'Esterna' }, { key: 'tg', color: '#f472b6', label: '3° piano' }, { key: 'tn', color: '#a78bfa', label: '4° piano' }];
  const g1 = v => v === null ? '—' : String(Math.round(v * 10) / 10).replace('.', ',') + '°';
  const legenda = SERIE.map(sr => `<span><i style="background:${sr.color}"></i>${sr.label} <b>${g1(lastVal(rows, sr.key))}</b></span>`).join('');

  body.innerHTML = `
    <article class="hc-card hc-wide hc-tap" data-detail="temp" role="button" tabindex="0" aria-label="Temperature: apri l’analisi"><header><span class="hc-t">Temperature</span>${HC_ZOOM}</header>
      <div class="hc-legend">${legenda}</div>${multiLineChart(rows, SERIE)}${axis}</article>
    ${heatingCard(rows, axis)}
    <div class="hc-grid">
      <article class="hc-card hc-tap" data-detail="hum" role="button" tabindex="0" aria-label="Umidità esterna: apri l’analisi"><header><span class="hc-t">Umidità esterna</span><span class="hc-v">${statLine(rows, 'hum', '%', false)}</span></header>${lineChart(rows, 'hum', '#58a6ff')}${axis}</article>
      <article class="hc-card hc-tap" data-detail="pres" role="button" tabindex="0" aria-label="Presenze: apri l’analisi"><header><span class="hc-t">Presenze</span><span class="hc-v"><small>${esc(peakTxt)}</small></span></header>${presenceChart(rows)}${axis}</article>
    </div>`;
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
  // Tocco su un riquadro: schermata grande di analisi
  const apri = e => { const c = e.target.closest('.hc-tap'); if (c) { haptic(); openHistDetail(c.dataset.detail); } };
  $('#hist-body')?.addEventListener('click', apri);
  $('#hist-body')?.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); apri(e); } });
}


/* ============================================================
   ANALISI — schermata grande aperta toccando un riquadro di Andamento.
   Grafico con scala e griglia, linea di lettura che segue il dito,
   periodo a scelta (24 ore / 3 giorni / 7 giorni) e tabelle con i numeri.
   ============================================================ */
const HC_ZOOM = '<span class="hc-zoom" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6"/><path d="M9 21H3v-6"/><path d="m21 3-7 7"/><path d="m3 21 7-7"/></svg></span>';

const HD_SERIE = {
  temp: { key: 'temp', color: '#ff9f43', label: 'Esterna', unit: '°', dec: 1 },
  tg:   { key: 'tg',   color: '#f472b6', label: '3° piano', unit: '°', dec: 1 },
  tn:   { key: 'tn',   color: '#a78bfa', label: '4° piano', unit: '°', dec: 1 },
  hum:  { key: 'hum',  color: '#58a6ff', label: 'Umidità esterna', unit: '%', dec: 0 },
  n:    { key: 'n',    color: '#3fb950', label: 'Persone in casa', unit: '', dec: 0, step: true, area: true, zero: true }
};
const HD_VISTE = {
  temp: { titolo: 'Temperature', serie: ['temp', 'tg', 'tn'], bande: true },
  heat: { titolo: 'Riscaldamento', serie: ['tg', 'tn'], bande: true, giorni: true },
  hum:  { titolo: 'Umidità esterna', serie: ['hum'] },
  pres: { titolo: 'Presenze', serie: ['n'], nomi: true }
};
const HD_BANDE = [{ key: 'ag', label: '3° piano', cls: 'hb-giorno' }, { key: 'an', label: '4° piano', cls: 'hb-notte' }];
let _hd = { kind: 'temp', days: 1, off: {} };

const hdNum = (v, sr) => v === null || v === undefined ? '—' : (sr.dec ? (Math.round(v * 10) / 10).toFixed(1).replace('.', ',').replace(',0', '') : String(Math.round(v))) + sr.unit;
const hdQuando = t => new Date(t).toLocaleString('it-IT', { weekday: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
const hdOra = t => new Date(t).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });

function openHistDetail(kind) {
  if (!_hist.ok || !HD_VISTE[kind]) return;
  _hd = { kind, days: _histDays, off: {} };
  const wrap = document.createElement('div');
  wrap.className = 'hd';
  openSheet(HD_VISTE[kind].titolo, wrap);
  $('#sheet')?.classList.add('grande');
  drawHistDetail(wrap);
}

// Passi "tondi" per la scala verticale
function hdScala(lo, hi, zero) {
  if (zero) lo = 0;
  if (hi - lo < 1) { const c = (hi + lo) / 2; lo = zero ? 0 : c - .5; hi = c + .5; }
  const grezzo = (hi - lo) / 5;
  const passo = [.1, .2, .5, 1, 2, 5, 10, 20, 50].find(p => p >= grezzo) || 100;
  const a = Math.floor(lo / passo) * passo, b = Math.ceil(hi / passo) * passo;
  const tacche = [];
  for (let v = a; v <= b + passo / 2; v += passo) tacche.push(Math.round(v * 10) / 10);
  return { lo: a, hi: b, tacche };
}

// Tacche dell'asse del tempo: ore tonde, con il giorno a mezzanotte
function hdTempo(t0, t1, largo) {
  const ore = (t1 - t0) / 36e5;
  const passo = ore <= 26 ? (largo ? 2 : 4) : ore <= 80 ? (largo ? 6 : 12) : (largo ? 12 : 24);
  const out = [];
  const d = new Date(t0); d.setMinutes(0, 0, 0); d.setHours(Math.ceil(d.getHours() / passo) * passo);
  for (let t = d.getTime(); t <= t1; t += passo * 36e5) {
    const x = new Date(t), mezzanotte = x.getHours() === 0;
    out.push({ t, mezzanotte,
      label: mezzanotte ? x.toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric' }) : (passo >= 24 ? '' : String(x.getHours()).padStart(2, '0')) });
  }
  return out;
}

function drawHistDetail(wrap) {
  const vista = HD_VISTE[_hd.kind];
  const da = Date.now() - _hd.days * 864e5;
  const rows = _hist.rows.filter(r => r.t >= da);
  const seg = `<div class="seg hd-seg" role="group" aria-label="Periodo">${[[1, '24 ore'], [3, '3 giorni'], [7, '7 giorni']].map(([d, l]) =>
    `<button type="button" class="seg-btn${d === _hd.days ? ' is-active' : ''}" data-days="${d}">${l}</button>`).join('')}</div>`;
  if (rows.length < 2) { wrap.innerHTML = seg + '<div class="hc-empty wide">Dati non ancora sufficienti per questo periodo.</div>'; hdBind(wrap, rows, []); return; }

  const tutte = vista.serie.map(k => HD_SERIE[k]);
  const serie = tutte.filter(sr => !_hd.off[sr.key] && rows.some(r => r[sr.key] !== null));
  const t0 = rows[0].t, t1 = rows[rows.length - 1].t, span = Math.max(1, t1 - t0);
  const vals = serie.flatMap(sr => rows.filter(r => r[sr.key] !== null).map(r => r[sr.key]));
  const sc = vals.length ? hdScala(Math.min(...vals), Math.max(...vals), serie.some(sr => sr.zero)) : { lo: 0, hi: 1, tacche: [0, 1] };
  const W = 1000, H = 300;
  const X = t => (t - t0) / span * W, Y = v => (1 - (v - sc.lo) / (sc.hi - sc.lo)) * H;
  const largo = window.innerWidth >= 720;
  const tempo = hdTempo(t0, t1, largo);

  const griglia = sc.tacche.map(v => `<line x1="0" x2="${W}" y1="${Y(v).toFixed(1)}" y2="${Y(v).toFixed(1)}" class="hd-g"/>`).join('') +
    tempo.map(k => `<line y1="0" y2="${H}" x1="${X(k.t).toFixed(1)}" x2="${X(k.t).toFixed(1)}" class="hd-g${k.mezzanotte ? ' hd-g-day' : ''}"/>`).join('');
  const linee = serie.map(sr => {
    const pts = rows.filter(r => r[sr.key] !== null);
    let d = '';
    pts.forEach((p, i) => {
      const x = X(p.t).toFixed(1), y = Y(p[sr.key]).toFixed(1);
      if (!i) d += `M${x} ${y}`;
      else d += sr.step ? ` L${x} ${Y(pts[i - 1][sr.key]).toFixed(1)} L${x} ${y}` : ` L${x} ${y}`;
    });
    const area = sr.area ? `<path d="${d} L${X(pts[pts.length - 1].t).toFixed(1)} ${H} L${X(pts[0].t).toFixed(1)} ${H} Z" fill="${sr.color}" opacity=".18"/>` : '';
    return `${area}<path d="${d}" fill="none" stroke="${sr.color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/>`;
  }).join('');

  const chips = tutte.length > 1 ? `<div class="hd-chips">${tutte.map(sr =>
    `<button type="button" class="hd-chip${_hd.off[sr.key] ? '' : ' on'}" data-serie="${sr.key}" aria-pressed="${!_hd.off[sr.key]}"><i style="background:${sr.color}"></i>${sr.label}</button>`).join('')}</div>` : '';

  const bande = vista.bande ? `<div class="hd-bande">${HD_BANDE.map(b => `
      <div class="hd-banda"><span>${b.label}</span>${onOffBand(rows, b.key)}</div>`).join('')}
      <p class="hd-nota">Strisce verdi: quando lo script ha fatto scaldare il piano.</p></div>` : '';

  wrap.innerHTML = `
    ${seg}${chips}
    <div class="hd-read" id="hd-read" aria-live="polite">Tocca o scorri sul grafico per leggere i valori</div>
    <div class="hd-chart">
      <div class="hd-y">${sc.tacche.map(v => `<span style="top:${(Y(v) / H * 100).toFixed(2)}%">${hdNum(v, serie[0] || tutte[0])}</span>`).join('')}</div>
      <div class="hd-plot" id="hd-plot">
        <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">${griglia}${linee}</svg>
        <div class="hd-cur" id="hd-cur" hidden></div>
        ${serie.map(sr => `<i class="hd-dot" data-k="${sr.key}" style="background:${sr.color}" hidden></i>`).join('')}
      </div>
      <div class="hd-x">${tempo.filter(k => k.label).map(k => `<span class="${k.mezzanotte ? 'd' : ''}" style="left:${((k.t - t0) / span * 100).toFixed(2)}%">${k.label}</span>`).join('')}</div>
    </div>
    ${bande}
    ${hdStat(rows, serie)}
    ${vista.bande ? hdRiscaldamento(rows) : ''}
    ${vista.giorni || vista.bande ? hdGiorni(rows) : ''}
    ${vista.nomi ? hdPresenze(rows) : ''}`;
  hdBind(wrap, rows, serie, { t0, span, Y, H });
}

// Tabella: adesso, minimo, massimo e media di ogni linea
function hdStat(rows, serie) {
  if (!serie.length) return '<p class="hd-nota">Scegli almeno una linea da mostrare.</p>';
  const righe = serie.map(sr => {
    const p = rows.filter(r => r[sr.key] !== null);
    if (!p.length) return '';
    const min = p.reduce((a, b) => b[sr.key] < a[sr.key] ? b : a), max = p.reduce((a, b) => b[sr.key] > a[sr.key] ? b : a);
    const media = p.reduce((a, b) => a + b[sr.key], 0) / p.length;
    return `<tr><th><i style="background:${sr.color}"></i>${sr.label}</th><td><b>${hdNum(p[p.length - 1][sr.key], sr)}</b></td>
      <td>${hdNum(min[sr.key], sr)}<small>${hdQuando(min.t)}</small></td><td>${hdNum(max[sr.key], sr)}<small>${hdQuando(max.t)}</small></td><td>${hdNum(media, { ...sr, dec: 1 })}</td></tr>`;
  }).join('');
  return `<h3 class="hd-h">Nel periodo</h3><div class="hd-scroll"><table class="hd-tab"><thead><tr><th></th><th>Adesso</th><th>Minimo</th><th>Massimo</th><th>Media</th></tr></thead><tbody>${righe}</tbody></table></div>`;
}

// Ore di riscaldamento e accensioni contate sulle righe dello storico (una ogni 15 minuti)
function hdOreScalda(rows, key) {
  let ms = 0, acc = 0, prima = 0;
  rows.forEach((r, i) => {
    if (r[key] === null) return;
    if (r[key] === 1) { ms += (i + 1 < rows.length ? rows[i + 1].t : r.t) - r.t; if (prima !== 1) acc++; }
    prima = r[key];
  });
  return { ore: ms / 36e5, acc };
}

function hdRiscaldamento(rows) {
  const per = _hist.termo && _hist.termo.periodi ? _hist.termo.periodi[String(_hd.days)] : null;
  const righe = [['giorno', '3° piano', 'ag', 'tg'], ['notte', '4° piano', 'an', 'tn']].map(([id, nome, k, kt]) => {
    const o = hdOreScalda(rows, k), z = per && per[id];
    const t = rows.filter(r => r[kt] !== null).map(r => r[kt]);
    const quota = Math.round(o.ore / Math.max(.01, (rows[rows.length - 1].t - rows[0].t) / 36e5) * 100);
    return `<tr><th>${nome}</th><td><b>${oreTxt(o.ore)}</b><small>${quota}% del tempo</small></td><td>${o.acc}</td>
      <td>${z ? z.modifiche : '—'}</td><td>${t.length ? hdNum(Math.min(...t), HD_SERIE.tg) + ' – ' + hdNum(Math.max(...t), HD_SERIE.tg) : '—'}</td></tr>`;
  }).join('');
  return `<h3 class="hd-h">Riscaldamento</h3><div class="hd-scroll"><table class="hd-tab"><thead><tr><th></th><th>Ha scaldato</th><th>Accensioni</th><th>A mano</th><th>Stanza</th></tr></thead><tbody>${righe}</tbody></table></div>
    ${per ? '<p class="hd-nota">"A mano": le modifiche fatte sul termostato.</p>' : '<p class="hd-nota">"A mano": le modifiche fatte sul termostato, contate solo su 24 ore e 7 giorni.</p>'}`;
}

// Giorno per giorno: ore di riscaldamento dei due piani e temperatura esterna
function hdGiorni(rows) {
  const giorni = new Map();
  rows.forEach(r => {
    const d = new Date(r.t), k = d.getFullYear() + '-' + d.getMonth() + '-' + d.getDate();
    if (!giorni.has(k)) giorni.set(k, { t: r.t, rows: [] });
    giorni.get(k).rows.push(r);
  });
  if (giorni.size < 2) return '';
  const lista = [...giorni.values()];
  // l'ultima riga di ogni giorno dura fino alla prima del giorno dopo
  const righe = lista.map((g, i) => {
    const conSeguente = i + 1 < lista.length ? g.rows.concat(lista[i + 1].rows[0]) : g.rows;
    const a = hdOreScalda(conSeguente, 'ag'), b = hdOreScalda(conSeguente, 'an');
    const e = g.rows.filter(r => r.temp !== null).map(r => r.temp);
    const tg = g.rows.filter(r => r.tg !== null).map(r => r.tg), tn = g.rows.filter(r => r.tn !== null).map(r => r.tn);
    const med = l => l.length ? hdNum(l.reduce((x, y) => x + y, 0) / l.length, HD_SERIE.tg) : '—';
    return `<tr><th>${new Date(g.t).toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric' })}</th>
      <td><b>${oreTxt(a.ore)}</b></td><td><b>${oreTxt(b.ore)}</b></td><td>${med(tg)}</td><td>${med(tn)}</td><td>${e.length ? hdNum(Math.min(...e), HD_SERIE.temp) + ' – ' + hdNum(Math.max(...e), HD_SERIE.temp) : '—'}</td></tr>`;
  }).reverse().join('');
  return `<h3 class="hd-h">Giorno per giorno</h3><div class="hd-scroll"><table class="hd-tab"><thead><tr><th></th><th>Scalda 3°</th><th>Scalda 4°</th><th>Media 3°</th><th>Media 4°</th><th>Esterna</th></tr></thead><tbody>${righe}</tbody></table></div>
    <p class="hd-nota">Il primo e l’ultimo giorno possono essere parziali.</p>`;
}

// Presenze: ore con la casa vuota e ore in casa di ogni persona
function hdPresenze(rows) {
  const dur = (r, i) => (i + 1 < rows.length ? rows[i + 1].t : r.t) - r.t;
  let vuota = 0, tot = 0; const persone = {};
  rows.forEach((r, i) => {
    if (r.n === null) return;
    const d = dur(r, i); tot += d;
    if (r.n === 0) vuota += d;
    r.names.forEach(n => { persone[n] = (persone[n] || 0) + d; });
  });
  if (!tot) return '';
  const pc = x => Math.round(x / tot * 100) + '%';
  const righe = Object.entries(persone).sort((a, b) => b[1] - a[1]).map(([n, ms]) =>
    `<tr><th>${esc(n.charAt(0).toUpperCase() + n.slice(1))}</th><td><b>${oreTxt(ms / 36e5)}</b></td><td>${pc(ms)}</td></tr>`).join('');
  return `<h3 class="hd-h">Chi era in casa</h3><div class="hd-scroll"><table class="hd-tab"><thead><tr><th></th><th>In casa</th><th>Del periodo</th></tr></thead><tbody>${righe}
    <tr><th>Casa vuota</th><td><b>${oreTxt(vuota / 36e5)}</b></td><td>${pc(vuota)}</td></tr></tbody></table></div>`;
}

function hdBind(wrap, rows, serie, g) {
  wrap.querySelectorAll('.hd-seg .seg-btn').forEach(b => b.addEventListener('click', () => { _hd.days = Number(b.dataset.days) || 1; drawHistDetail(wrap); }));
  wrap.querySelectorAll('.hd-chip').forEach(b => b.addEventListener('click', () => {
    const k = b.dataset.serie;
    const accese = HD_VISTE[_hd.kind].serie.filter(x => !_hd.off[x]);
    if (!_hd.off[k] && accese.length <= 1) return;           // almeno una linea resta
    _hd.off[k] = !_hd.off[k];
    drawHistDetail(wrap);
  }));
  const plot = wrap.querySelector('#hd-plot'); if (!plot || !g) return;
  const cur = wrap.querySelector('#hd-cur'), read = wrap.querySelector('#hd-read');
  const leggi = clientX => {
    const box = plot.getBoundingClientRect();
    const f = Math.min(1, Math.max(0, (clientX - box.left) / Math.max(1, box.width)));
    const t = g.t0 + f * g.span;
    let lo = 0, hi = rows.length - 1;                          // riga più vicina nel tempo
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (rows[m].t < t) lo = m; else hi = m; }
    const r = Math.abs(rows[lo].t - t) <= Math.abs(rows[hi].t - t) ? rows[lo] : rows[hi];
    const left = ((r.t - g.t0) / g.span * 100).toFixed(2) + '%';
    cur.hidden = false; cur.style.left = left;
    serie.forEach(sr => {
      const dot = plot.querySelector(`.hd-dot[data-k="${sr.key}"]`); if (!dot) return;
      if (r[sr.key] === null) { dot.hidden = true; return; }
      dot.hidden = false; dot.style.left = left; dot.style.top = (g.Y(r[sr.key]) / g.H * 100).toFixed(2) + '%';
    });
    const valori = serie.map(sr => `<span><i style="background:${sr.color}"></i>${sr.label} <b>${hdNum(r[sr.key], sr)}</b></span>`).join('');
    const scalda = HD_VISTE[_hd.kind].bande
      ? `<span>Scalda: <b>${HD_BANDE.filter(b => r[b.key] === 1).map(b => b.label).join(' e ') || 'nessun piano'}</b></span>` : '';
    const chi = r.n !== null ? `<span>In casa: <b>${r.names.length ? esc(r.names.map(n => n.charAt(0).toUpperCase() + n.slice(1)).join(', ')) : 'nessuno'}</b></span>` : '';
    read.innerHTML = `<strong>${hdQuando(r.t)}</strong>${valori}${scalda}${chi}`;
  };
  let giu = false;
  plot.addEventListener('pointerdown', e => { giu = true; try { plot.setPointerCapture(e.pointerId); } catch (_) {} leggi(e.clientX); });
  plot.addEventListener('pointermove', e => { if (giu || e.pointerType === 'mouse') leggi(e.clientX); });
  plot.addEventListener('pointerup', () => { giu = false; });
  plot.addEventListener('pointercancel', () => { giu = false; });
}

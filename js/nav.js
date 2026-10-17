'use strict';

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


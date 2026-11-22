'use strict';
/* ============================================================
   ANIMAZIONI (con Motion, motion.dev)
   La libreria arriva da jsDelivr con "@latest": si aggiorna da sola,
   senza toccare l'app. Se non arriva (niente rete, CDN giù, versione
   che cambia comportamento) l'app funziona uguale, solo senza queste
   animazioni: ogni chiamata è protetta.
   Rispetta "Riduci movimento" del telefono.
   ============================================================ */

const ANIM_MOLLA = { type: 'spring', stiffness: 260, damping: 26 };
let _animNumeriFatti = false;

function animOk() {
  try {
    if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
    return !!(window.Motion && typeof window.Motion.animate === 'function');
  } catch (e) { return false; }
}

function anima(el, keyframes, opzioni) {
  if (!el || !animOk()) return null;
  try { return window.Motion.animate(el, keyframes, opzioni); } catch (e) { return null; }
}

/* Numero che sale fino al valore (es. "21,5°"): una volta sola per apertura dell'app */
function animaNumero(el, valore, decimali) {
  if (!el || typeof valore !== 'number' || !isFinite(valore) || !animOk()) return;
  const finale = el.textContent;
  const da = valore - Math.max(2, Math.abs(valore) * 0.15);
  const fmt = v => v.toFixed(decimali).replace('.', ',');
  try {
    const a = window.Motion.animate(da, valore, {
      duration: 0.9, ease: [0.22, 1, 0.36, 1],
      onUpdate: v => { el.textContent = fmt(v) + (finale.trim().endsWith('°') ? '°' : ''); }
    });
    const fine = () => { el.textContent = finale; };
    if (a && a.finished && a.finished.then) a.finished.then(fine, fine); else setTimeout(fine, 1000);
  } catch (e) { el.textContent = finale; }
}

/* Home: temperature dei piani e di fuori che contano, solo la prima volta */
function animaHome() {
  if (_animNumeriFatti || !animOk()) return;
  const els = $$('#ot-home .ot-room-val b, #ot-home .ot-fuori > div:first-child b');
  if (!els.length) return;
  _animNumeriFatti = true;
  els.forEach(el => {
    const m = el.textContent.match(/-?\d+(?:,\d+)?/);
    if (!m) return;
    const dec = m[0].includes(',') ? m[0].split(',')[1].length : 0;
    animaNumero(el, parseFloat(m[0].replace(',', '.')), dec);
  });
  anima($$('#ot-home .ot-room, #ot-home .ot-quick .ot-tile, #ot-home .ot-fuori'),
        { opacity: [0, 1], y: [10, 0] },
        { delay: window.Motion && window.Motion.stagger ? window.Motion.stagger(0.04) : 0, duration: 0.45, ease: [0.22, 1, 0.36, 1] });
}

/* Grafici: le curve si disegnano da sinistra a destra */
function animaGrafici(root) {
  if (!root || !animOk()) return;
  const svgs = root.querySelectorAll('svg.hc-svg, .hc svg, .hd-chart svg, .hist-chart svg');
  svgs.forEach((s, i) => anima(s, { clipPath: ['inset(0 100% 0 0)', 'inset(0 0% 0 0)'] },
    { duration: 0.9, delay: i * 0.08, ease: [0.65, 0, 0.35, 1] }));
}

/* Cambio scheda: la vista entra con una piccola molla */
function animaVista(view) {
  anima(view, { opacity: [0.4, 1], y: [12, 0] }, ANIM_MOLLA);
}

'use strict';
/* ============================================================
   SICUREZZA — conferma con "Annulla", chiave di sola lettura,
   pannello a scomparsa (usato da scene e orari)
   ============================================================ */

/* ---- Azioni che partono dopo qualche secondo, con possibilità di annullare ---- */
const UNDO_EVENTS = {
  abbassa_tutto:     ()  => 'Abbasso le tapparelle',
  ezviz_interne_off: ()  => 'Spengo le telecamere interne',
  ezviz_esterne_off: ()  => 'Spengo le telecamere esterne',
  set_override:      (p) => (p && String(p.value) === 'true') ? 'Attivo l’override' : null,   // spegnerlo non è delicato
};
const undoLabelFor = (event, params) => { const f = UNDO_EVENTS[event]; return f ? f(params) : null; };

const undoEnabled = () => { try { return localStorage.getItem('ui_undo') !== '0'; } catch (_) { return true; } };
const setUndoEnabled = v => { try { localStorage.setItem('ui_undo', v ? '1' : '0'); } catch (_) {} };
const undoSeconds = () => Math.max(2, Math.min(10, Number(CONFIG.UNDO_SECONDS) || 5));

let _undo = null;

function hideToast() { const t = $('#toast'); if (t) t.classList.remove('show'); }

// Mostra la barra "Annulla": risolve true se il tempo scade (si può procedere), false se premi Annulla
function undoWindow(label) {
  if (!undoEnabled()) return Promise.resolve(true);
  return new Promise(resolve => {
    const bar = $('#undo-bar');
    if (!bar) { resolve(true); return; }
    if (_undo) _undo.finish(true);               // c'era un'altra azione in attesa: parte subito

    const secs = undoSeconds();
    let left = secs, done = false, tick = null, to = null;
    const txt = $('#undo-label'), cnt = $('#undo-count'), prog = $('#undo-prog'), btn = $('#undo-btn');

    const finish = go => {
      if (done) return; done = true;
      clearInterval(tick); clearTimeout(to);
      document.removeEventListener('keydown', onKey);
      if (_undo && _undo.finish === finish) _undo = null;
      bar.classList.remove('show');
      setTimeout(() => { if (!_undo) bar.hidden = true; }, 240);
      resolve(go);
    };
    const onKey = e => { if (e.key === 'Escape') finish(false); };
    _undo = { finish };

    hideToast();
    txt.textContent = label;
    cnt.textContent = String(left);
    bar.hidden = false;
    prog.style.animation = 'none'; void prog.offsetWidth;
    prog.style.animation = `undo-run ${secs}s linear forwards`;
    requestAnimationFrame(() => bar.classList.add('show'));
    btn.onclick = () => finish(false);
    document.addEventListener('keydown', onKey);
    tick = setInterval(() => { left -= 1; if (left > 0) cnt.textContent = String(left); }, 1000);
    to = setTimeout(() => finish(true), secs * 1000);
  });
}

/* ---- Ruolo: la chiave di sola lettura può guardare ma non comandare ---- */
const isReadOnly = () => !!(MODEL && MODEL.role === 'ro');

function applyRole(m) {
  const ro = !!(m && m.role === 'ro');
  document.body.classList.toggle('ro', ro);
  const b = $('#ro-badge'); if (b) b.hidden = !ro;
}

/* ---- Pannello a scomparsa (bottom sheet) ---- */
function openSheet(title, node) {
  const sh = $('#sheet'); if (!sh) return;
  $('#sheet-title').textContent = title;
  const body = $('#sheet-body');
  body.innerHTML = '';
  body.appendChild(node);
  sh.hidden = false;
  requestAnimationFrame(() => sh.classList.add('show'));
  document.body.classList.add('sheet-open');
}
function setSheetTitle(t) { const e = $('#sheet-title'); if (e) e.textContent = t; }
function closeSheet() {
  const sh = $('#sheet'); if (!sh) return;
  sh.classList.remove('show');
  document.body.classList.remove('sheet-open');
  setTimeout(() => { if (!sh.classList.contains('show')) sh.hidden = true; }, 240);
}
function initSheet() {
  $('#sheet-x')?.addEventListener('click', closeSheet);
  $('#sheet')?.addEventListener('click', e => { if (e.target.id === 'sheet') closeSheet(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#sheet').hidden) closeSheet(); });
}

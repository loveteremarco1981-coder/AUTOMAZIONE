'use strict';
/* ============================================================
   ANIMAZIONE D'AVVIO — guida il volo del logo verso l'angolo
   in alto a sinistra e la riapre ogni volta che torni nell'app,
   anche se era solo in sottofondo. Un tocco la salta. Si spegne da Impostazioni
   (localStorage ui_avvio = '0').
   ============================================================ */

const AVVIO_VOLO_MS = 2550;          // quando parte il volo (il saluto resta un secondo in più)
const AVVIO_RIENTRO_MS = 800;        // sotto questo tempo era solo un attimo (es. Face ID): niente animazione
let _avvioTimer = [], _avvioNascosta = 0;

function avvioAttiva() {
  try { return localStorage.getItem('ui_avvio') !== '0' && !(navigator.webdriver && !localStorage.getItem('ui_avvio_prova')); }
  catch (e) { return true; }
}
function setAvvioAttiva(on) { try { localStorage.setItem('ui_avvio', on ? '1' : '0'); } catch (e) {} }

// Chi usa questo telefono: vale solo qui (localStorage), non è una chiave né cambia i permessi
function avvioIo() { try { return localStorage.getItem('ui_io') || ''; } catch (e) { return ''; } }
function setAvvioIo(nome) { try { nome ? localStorage.setItem('ui_io', nome) : localStorage.removeItem('ui_io'); localStorage.setItem('ui_io_chiesto', '1'); } catch (e) {} }
function avvioSaluto() {
  const h = new Date().getHours(), io = avvioIo();
  return (h < 5 ? 'Buonanotte' : h < 13 ? 'Buongiorno' : h < 18 ? 'Buon pomeriggio' : 'Buonasera') + (io ? ', ' + io : '');
}

// Foglio "Chi usa questo telefono?" con i cerchi delle persone
function openChiSonoSheet(m) {
  const people = ((m || MODEL || {}).people || []).map(p => String(p.name || '')).filter(Boolean);
  const wrap = document.createElement('div');
  wrap.className = 'chi-sono';
  const io = avvioIo();
  wrap.innerHTML = `<p class="chi-sono-txt">Serve solo per salutarti all'apertura. Resta su questo telefono.</p>
    <div class="chi-sono-grid">${people.map(n => `
      <button type="button" class="chi-sono-p${cap(n) === io ? ' scelta' : ''}" data-nome="${esc(cap(n))}">
        <span class="fam-avatar ${avClass(n)}">${esc(n.charAt(0).toUpperCase())}</span><span>${esc(cap(n))}</span></button>`).join('')}</div>
    <button type="button" class="small-btn chi-sono-no">${io ? 'Nessun nome' : 'Non ora'}</button>`;
  wrap.querySelectorAll('.chi-sono-p').forEach(b => b.addEventListener('click', () => {
    haptic(); setAvvioIo(b.dataset.nome); closeSheet(); toast(`${avvioSaluto()}!`, 'ok', 2200);
    if (typeof renderSettings === 'function' && MODEL) renderSettings(MODEL);
  }));
  wrap.querySelector('.chi-sono-no').addEventListener('click', () => {
    setAvvioIo(''); closeSheet(); if (typeof renderSettings === 'function' && MODEL) renderSettings(MODEL);
  });
  openSheet('Chi usa questo telefono?', wrap);
}

// La prima volta, finita l'animazione, chiede il nome una volta sola
function avvioChiediNome() {
  try { if (localStorage.getItem('ui_io_chiesto') || localStorage.getItem('ui_io')) return; } catch (e) { return; }
  if (!avvioAttiva() || !MODEL || !(MODEL.people || []).length) return;
  if (document.body.classList.contains('sheet-open')) return;
  openChiSonoSheet(MODEL);
}

function avvioPulisci() { _avvioTimer.forEach(clearTimeout); _avvioTimer = []; }

function avvioFine(el) {
  avvioPulisci();
  document.body.classList.remove('in-avvio');
  document.body.classList.add('dopo-avvio');
  el.classList.remove('play', 'vola', 'via');
  el.hidden = true;
  const logo = el.querySelector('.av-logo'); if (logo) logo.style.transform = '';
  _avvioTimer.push(setTimeout(() => document.body.classList.remove('dopo-avvio'), 800));
  _avvioTimer.push(setTimeout(avvioChiediNome, 1200));
}

function avvioVola(el) {
  const logo = el.querySelector('.av-logo');
  const meta = document.querySelector('#topbar .tb-icon-home');
  el.classList.add('vola');
  if (logo && meta) {
    const a = logo.getBoundingClientRect(), b = meta.getBoundingClientRect();
    // il logo è ancorato in alto a sinistra (transform-origin 0 0)
    const s = b.width / a.width;
    logo.style.transform = `translate(${b.left - a.left}px, ${b.top - a.top}px) scale(${s})`;
  }
  // il fondo si dissolve mentre il logo atterra e l'app entra
  _avvioTimer.push(setTimeout(() => {
    document.body.classList.remove('in-avvio'); document.body.classList.add('dopo-avvio');
    el.classList.add('via');
  }, 380));
  _avvioTimer.push(setTimeout(() => avvioFine(el), 820));
}

function avvioSuona() {
  const el = document.getElementById('avvio'); if (!el) return;
  avvioPulisci();
  el.hidden = false;
  el.classList.remove('play', 'vola', 'via');
  void el.offsetWidth;                         // riparte da capo
  el.classList.add('play');
  document.body.classList.add('in-avvio');
  const h = new Date().getHours();
  const sal = document.getElementById('av-saluto');
  if (sal) sal.textContent = avvioSaluto();
  const ridotto = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (ridotto) { _avvioTimer.push(setTimeout(() => avvioFine(el), 1100)); return; }
  _avvioTimer.push(setTimeout(() => avvioVola(el), AVVIO_VOLO_MS));
}

(function avvioInit() {
  const el = document.getElementById('avvio'); if (!el) return;
  el.addEventListener('click', () => {           // un tocco: salta subito al volo
    if (el.classList.contains('vola') || el.hidden) return;
    avvioPulisci(); avvioVola(el);
  });
  // Al primo caricamento l'animazione è già partita (classe "play" nell'HTML)
  if (el.classList.contains('play')) {
    const ridotto = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    _avvioTimer.push(ridotto ? setTimeout(() => avvioFine(el), 1100) : setTimeout(() => avvioVola(el), AVVIO_VOLO_MS));
  } else el.hidden = true;
  // Quando l'app va in sottofondo prepara già il velo (fondo viola, logo spento):
  // al rientro non si intravede la pagina prima dell'animazione.
  const prepara = () => {
    if (!avvioAttiva()) return;
    avvioPulisci();
    el.classList.remove('play', 'vola', 'via');
    const logo = el.querySelector('.av-logo'); if (logo) logo.style.transform = '';
    el.hidden = false;
    document.body.classList.add('in-avvio');
  };
  const rientra = () => {
    if (!avvioAttiva()) return;
    if (_avvioNascosta && Date.now() - _avvioNascosta < AVVIO_RIENTRO_MS) avvioFine(el);
    else avvioSuona();
    _avvioNascosta = 0;
  };
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { _avvioNascosta = Date.now(); prepara(); return; }
    rientra();
  });
  // Ritorno da una pagina tenuta in memoria (Safari)
  window.addEventListener('pageshow', e => { if (e.persisted) { _avvioNascosta = 0; avvioSuona(); } });
})();

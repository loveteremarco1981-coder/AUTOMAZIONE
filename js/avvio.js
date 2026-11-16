'use strict';
/* ============================================================
   ANIMAZIONE D'AVVIO — guida il volo del logo verso l'angolo
   in alto a sinistra e la riapre quando torni nell'app dopo
   almeno 10 minuti. Un tocco la salta. Si spegne da Impostazioni
   (localStorage ui_avvio = '0').
   ============================================================ */

const AVVIO_VOLO_MS = 1550;          // quando parte il volo
const AVVIO_RIENTRO_MIN = 10;        // minuti in sottofondo prima di rivederla
let _avvioTimer = [], _avvioNascosta = 0;

function avvioAttiva() { try { return localStorage.getItem('ui_avvio') !== '0'; } catch (e) { return true; } }
function setAvvioAttiva(on) { try { localStorage.setItem('ui_avvio', on ? '1' : '0'); } catch (e) {} }

function avvioPulisci() { _avvioTimer.forEach(clearTimeout); _avvioTimer = []; }

function avvioFine(el) {
  avvioPulisci();
  document.body.classList.remove('in-avvio');
  document.body.classList.add('dopo-avvio');
  el.classList.remove('play', 'vola', 'via');
  el.hidden = true;
  const logo = el.querySelector('.av-logo'); if (logo) logo.style.transform = '';
  _avvioTimer.push(setTimeout(() => document.body.classList.remove('dopo-avvio'), 800));
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
  if (sal) sal.textContent = h < 5 ? 'Buonanotte' : h < 13 ? 'Buongiorno' : h < 18 ? 'Buon pomeriggio' : 'Buonasera';
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
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { _avvioNascosta = Date.now(); return; }
    if (_avvioNascosta && avvioAttiva() && Date.now() - _avvioNascosta >= AVVIO_RIENTRO_MIN * 60000) avvioSuona();
    _avvioNascosta = 0;
  });
})();

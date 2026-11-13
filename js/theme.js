'use strict';
/* ============================================================
   ASPETTO — Tinta (predefinito), Lume, Giorno o Classico (il vetro).
   Tinta e Lume sono scuri, Giorno è chiaro; solo Classico segue il
   Tema (automatico, chiaro o scuro).
   TEMA — automatico (segue il telefono), chiaro o scuro
   ============================================================ */
const SKINS = {
  tinta:    { nome: 'Tinta',    sub: 'Un colore per ogni sezione', tema: 'dark',  colore: '#101216' },
  lume:     { nome: 'Lume',     sub: 'Scura e calma',              tema: 'dark',  colore: '#0c1118' },
  giorno:   { nome: 'Giorno',   sub: 'Chiara e ordinata',          tema: 'light', colore: '#eff2f0' },
  classico: { nome: 'Classico', sub: 'Il vetro di prima',          tema: null,    colore: null }
};
const skinPref = () => { try { const s = localStorage.getItem('ui_skin'); return SKINS[s] ? s : 'tinta'; } catch (_) { return 'tinta'; } };
const setSkinPref = v => { try { localStorage.setItem('ui_skin', v); } catch (_) {} };
const themePref = () => { try { return localStorage.getItem('ui_theme') || 'auto'; } catch (_) { return 'auto'; } };
const setThemePref = v => { try { localStorage.setItem('ui_theme', v); } catch (_) {} };

function resolveTheme() {
  const sk = SKINS[skinPref()];
  if (sk.tema) return sk.tema;
  const p = themePref();
  if (p === 'light' || p === 'dark') return p;
  return window.matchMedia && matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

function applyTheme() {
  const t = resolveTheme(), sk = skinPref();
  document.documentElement.dataset.theme = t;
  if (sk === 'classico') delete document.documentElement.dataset.skin; else document.documentElement.dataset.skin = sk;
  const tc = document.querySelector('meta[name="theme-color"]');
  if (tc) tc.setAttribute('content', SKINS[sk].colore || (t === 'light' ? '#eef2f8' : '#0d1117'));
  const cs = document.querySelector('meta[name="color-scheme"]');
  if (cs) cs.setAttribute('content', t);
}

function initTheme() {
  applyTheme();
  if (window.matchMedia) {
    const mq = matchMedia('(prefers-color-scheme: light)');
    const fn = () => { if (themePref() === 'auto') applyTheme(); };
    if (mq.addEventListener) mq.addEventListener('change', fn); else if (mq.addListener) mq.addListener(fn);
  }
}

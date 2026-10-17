'use strict';
/* ============================================================
   TEMA — automatico (segue il telefono), chiaro o scuro
   ============================================================ */
const themePref = () => { try { return localStorage.getItem('ui_theme') || 'auto'; } catch (_) { return 'auto'; } };
const setThemePref = v => { try { localStorage.setItem('ui_theme', v); } catch (_) {} };

function resolveTheme() {
  const p = themePref();
  if (p === 'light' || p === 'dark') return p;
  return window.matchMedia && matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

function applyTheme() {
  const t = resolveTheme();
  document.documentElement.dataset.theme = t;
  const tc = document.querySelector('meta[name="theme-color"]');
  if (tc) tc.setAttribute('content', t === 'light' ? '#eef2f8' : '#0d1117');
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

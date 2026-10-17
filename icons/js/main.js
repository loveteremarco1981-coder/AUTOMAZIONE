'use strict';

document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initSheet();
  initHistoryUI();
  $$('.tab').forEach(t => t.addEventListener('click', () => activateTab(t.dataset.target)));
  initTabBead();
  initLogUI();
  initLock();
  initServiceWorker();

  // Altezza della barra superiore: serve a tenere gli avvisi appena sotto di lei
  const tb = $('#topbar');
  if (tb) {
    const setH = () => document.documentElement.style.setProperty('--topbar-h', tb.offsetHeight + 'px');
    setH();
    if (window.ResizeObserver) new ResizeObserver(setH).observe(tb);
    window.addEventListener('resize', setH);
  }
  $('#btn-refresh')?.addEventListener('click', () => { haptic(); loadAll(true); });
  $('#btn-log')?.addEventListener('click', () => activateTab('log'));
  $('#state-banner')?.addEventListener('click', () => { haptic(); activateTab('devices'); });

  // Cursore trasparenza: salva la scelta su questo dispositivo
  const gr = $('#glass-range');
  let gv = 35;
  try { const s = localStorage.getItem('ui_glass'); if (s !== null) gv = Number(s); } catch (_) {}
  applyGlass(gv);
  if (gr) {
    gr.value = String(gv);
    gr.addEventListener('input', () => { applyGlass(gr.value); try { localStorage.setItem('ui_glass', gr.value); } catch (_) {} });
  }

  // Segnaposto mentre arrivano i primi dati
  skeleton($('#fav-grid'), 4, 'skel-fav');
  skeleton($('#people-chips'), 3, 'skel-av');
  skeleton($('#events-list'), 4, 'skel-row');

  // Riapre l'ultima scheda usata nella sessione
  try {
    const last = sessionStorage.getItem('ui_tab');
    if (last && $('#view-' + last)) activateTab(last);
  } catch (_) {}

  window.addEventListener('offline', () => setOnline(false));
  window.addEventListener('online',  () => loadAll());

  const saved = loadSavedModel();
  if (saved) {
    MODEL = saved;
    document.body.classList.add('stale');
    try { renderModel(saved); } catch (e) { console.error('saved:', e); }
  }

  loadAll();
  if (CONFIG.AUTO_REFRESH_MS > 0) setInterval(() => loadAll(), CONFIG.AUTO_REFRESH_MS);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) loadAll(); });
});


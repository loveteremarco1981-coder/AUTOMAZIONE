'use strict';

/* ============================================================
   CARICAMENTO
   ============================================================ */
function renderModel(m) {
  applyRole(m);
  syncSharedScenes(m);
  renderBanner(m); renderCards(m); renderScenes(); renderFavorites(m);
  renderPeopleChips(m); renderEvents(m); renderDevices(m);
  renderPeopleDetail(m); renderSettings(m);
  updateErrorBadge(m); updateTs(m);
  updateHero();
}

async function loadAll(manual) {
  if (_loading) return;
  const lock = $('#lock'); if (lock && !lock.hidden) return;     // finché è chiesta la chiave non ricarico
  _loading = true;
  const btn = $('#btn-refresh'); if (btn) btn.classList.add('spin');
  try {
    const m = await fetchModel();
    if (isDenied(m)) { showLock(); return; }
    const _prev = _liveModel;
    _liveModel = m;
    MODEL = m;
    window._lastModel = m;
    saveModel(m);
    setOnline(true);
    document.body.classList.remove('stale');

    renderModel(m);
    maybeRefreshLogs();
    try { notifyOnModel(_prev, m); } catch (_) {}
    loadHistory();

    if (document.body.classList.contains('first-paint')) {
      setTimeout(() => document.body.classList.remove('first-paint'), 1000);
    }

    const w = m.weather || {};
    if (w.tempC != null || w.humidity != null) renderWeather(w);

    fetchWeatherClient().then(ww => {
      if (!ww) return;
      renderWeather(ww);
      // Invia il meteo allo script al massimo ogni 10 minuti
      if (isReadOnly() || Date.now() - _lastWxPush < 10 * 60 * 1000) return;
      _lastWxPush = Date.now();
      try {
        const u = new URL(CONFIG.DOGET_URL);
        u.searchParams.set('event', 'update_weather');
        if (ww.tempC != null)    u.searchParams.set('temp', Math.round(ww.tempC));
        if (ww.humidity != null) u.searchParams.set('hum',  Math.round(ww.humidity));
        if (ww.windKmh != null)  u.searchParams.set('wind', Math.round(ww.windKmh));
        if (ww.icon != null)     u.searchParams.set('icon', ww.icon);
        jsonpFetch(u.toString()).catch(() => {});
      } catch (_) {}
    }).catch(() => {});

    if (manual === true) toast('Dati aggiornati', 'ok', 1600);
  } catch (e) {
    console.error('loadAll:', e);
    setOnline(false);
    if (!MODEL) showLoadError();
    else if (manual === true) toast('Aggiornamento non riuscito', 'err');
  } finally {
    _loading = false;
    if (btn) btn.classList.remove('spin');
  }
}

async function loadLogs(silent) {
  _lastLogsFetch = Date.now();
  try {
    const data = await fetchLogs();
    if (isDenied(data)) { showLock(); return; }
    renderLogs((data && data.logs) || []);
  }
  catch (e) {
    if (silent) return;
    const el = $('#log-empty');
    if (el) { el.textContent = 'Impossibile caricare il log. Riprova più tardi.'; el.hidden = false; }
  }
}

// Aggiorna il log in sottofondo ogni 5 minuti, così il pallino rosso degli errori è sempre aggiornato
function maybeRefreshLogs() {
  if (Date.now() - _lastLogsFetch < 5 * 60 * 1000) return;
  loadLogs(true);
}

/* ============================================================
   ACCESSO (chiave condivisa) E AGGIORNAMENTI
   ============================================================ */
let _prevKey = null;   // chiave in uso mentre la stai cambiando (serve per Annulla)

function showLock(msg, force) {
  const el = $('#lock'); if (!el) return;
  if (!el.hidden && !force) return;               // già visibile: non cancello quello che stai scrivendo
  _prevKey = force ? (getKey() || null) : null;   // da Impostazioni → Cambia: si può tornare indietro
  if (!force) clearKey();
  const cb = $('#lock-cancel'); if (cb) cb.hidden = !_prevKey;
  el.hidden = false;
  const m = $('#lock-msg'); if (m) m.textContent = msg || '';
  const inp = $('#lock-key');
  if (inp) { inp.value = ''; setTimeout(() => inp.focus(), 60); }
}

function initLock() {
  const form = $('#lock-form'); if (!form) return;
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const v = ($('#lock-key').value || '').trim();
    if (!v) return;
    const msg = $('#lock-msg'); msg.textContent = 'Verifico…';
    setKey(v);
    try {
      const m = await fetchModel();
      if (isDenied(m)) { if (_prevKey) setKey(_prevKey); else clearKey(); msg.textContent = 'Chiave non valida. Riprova.'; $('#lock-key').select(); return; }
      _prevKey = null;
      $('#lock').hidden = true;
      msg.textContent = '';
      loadAll(true);
    } catch (_) {
      if (_prevKey) setKey(_prevKey);
      msg.textContent = 'Connessione assente. Riprova.';
    }
  });
  const cancel = () => {
    if (!_prevKey) return;
    setKey(_prevKey); _prevKey = null;
    $('#lock').hidden = true; $('#lock-msg').textContent = '';
  };
  $('#lock-cancel')?.addEventListener('click', cancel);
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#lock').hidden) cancel(); });
}

function initServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading) return; reloading = true; window.location.reload();
  });
  navigator.serviceWorker.register('sw.js').then(reg => {
    const offer = w => {
      const b = $('#update-banner'), btn = $('#btn-update');
      if (!b || !btn || !w) return;
      b.hidden = false;
      btn.onclick = () => w.postMessage('SKIP_WAITING');
    };
    if (reg.waiting && navigator.serviceWorker.controller) offer(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const nw = reg.installing;
      if (!nw) return;
      nw.addEventListener('statechange', () => {
        if (nw.state === 'installed' && navigator.serviceWorker.controller) offer(nw);
      });
    });
    setInterval(() => reg.update().catch(() => {}), 60 * 60 * 1000);
  }).catch(() => {});
}

function forceAppReload() {
  const done = () => window.location.reload();
  try {
    const jobs = [];
    if ('serviceWorker' in navigator) {
      jobs.push(navigator.serviceWorker.getRegistrations().then(regs => Promise.all(regs.map(r => r.unregister()))));
    }
    if (window.caches) {
      jobs.push(caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k)))));
    }
    Promise.all(jobs).then(done, done);
  } catch (_) { done(); }
}


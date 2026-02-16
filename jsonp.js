/* ============================================================
 *               JSONP Helper per GitHub Pages
 * ============================================================ */

/**
 * Costruisce un URL con parametri GET
 */
function buildUrl(base, params) {
  const usp = new URLSearchParams();
  Object.keys(params || {}).forEach(k => {
    if (params[k] !== undefined && params[k] !== null)
      usp.set(k, params[k]);
  });
  return base + (base.includes('?') ? '&' : '?') + usp.toString();
}

/**
 * JSONP general purpose
 * - baseUrl: endpoint Apps Script
 * - params: parametri GET aggiuntivi
 * - onSuccess(data)
 * - onError(error)
 *
 * Crea dinamicamente un <script> con callback = "__jp_cb_xxxxx"
 */
function jsonpRequest(baseUrl, params, onSuccess, onError) {

  const cbName = '__jp_cb_' + Math.random().toString(36).slice(2);

  const cleanup = (node) => {
    try { delete window[cbName]; } catch (_) {}
    try { node && node.remove(); } catch (_) {}
  };

  const url = buildUrl(baseUrl, Object.assign({}, params, { callback: cbName }));

  const script = document.createElement('script');
  script.src = url;
  script.async = true;

  let called = false;

  window[cbName] = (data) => {
    if (called) return;
    called = true;
    cleanup(script);
    try { onSuccess && onSuccess(data); }
    catch (err) { console.error('JSONP success handler error:', err); }
  };

  script.onerror = (err) => {
    if (called) return;
    called = true;
    cleanup(script);
    try { onError && onError(err); }
    catch (err2) { console.error('JSONP error handler error:', err2); }
  };

  document.head.appendChild(script);
}


/* ============================================================
 *     FUNZIONI SPECIFICHE PER APPS SCRIPT AUTOMAZIONE
 * ============================================================ */

/**
 * Fetch modello completo (persone, stato, meteo, vimar, ecc.)
 */
function fetchModel(onSuccess, onError) {
  return jsonpRequest(CONFIG.BASE_URL, {}, onSuccess, onError);
}

/**
 * Fetch log ultimi 200 eventi
 */
function fetchLogs(onSuccess, onError) {
  return jsonpRequest(CONFIG.BASE_URL, { logs: '1' }, onSuccess, onError);
}

/**
 * Fetch trend 24h
 */
function fetchTrend24h(onSuccess, onError) {
  return jsonpRequest(CONFIG.BASE_URL, { trend: '24h' }, onSuccess, onError);
}

/**
 * Admin events (NO PIN)
 * eventName = alza_tutto / abbassa_tutto / set_vacanza / set_override…
 */
function callAdmin(eventName, extraParams, onSuccess, onError) {
  const p = Object.assign(
    {
      admin: '1',
      event: String(eventName || '')
    },
    extraParams || {}
  );

  return jsonpRequest(CONFIG.BASE_URL, p, onSuccess, onError);
}

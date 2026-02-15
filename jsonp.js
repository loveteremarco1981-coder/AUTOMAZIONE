/* ===== JSONP helper ===== */

function buildUrl(base, params){
  const usp = new URLSearchParams();
  Object.keys(params||{}).forEach(k => {
    if (params[k] !== undefined && params[k] !== null) usp.set(k, params[k]);
  });
  return base + (base.includes('?') ? '&' : '?') + usp.toString();
}

function jsonpRequest(baseUrl, params, onSuccess, onError){
  const cbName = '__jp_cb_' + Math.random().toString(36).slice(2);
  const cleanup = (node) => {
    try { delete window[cbName]; } catch(_){}
    try { node && node.remove(); } catch(_){}
  };
  const url = buildUrl(baseUrl, Object.assign({}, params, { callback: cbName }));

  const script = document.createElement('script');
  script.src = url;
  script.async = true;

  let done = false;
  window[cbName] = (data) => {
    if (done) return;
    done = true;
    cleanup(script);
    try { onSuccess && onSuccess(data); }
    catch(err){ console.error('JSONP success handler error:', err); }
  };

  script.onerror = (e) => {
    if (done) return;
    done = true;
    cleanup(script);
    try { onError && onError(e); }
    catch(err){ console.error('JSONP error handler error:', err); }
  };

  document.head.appendChild(script);
}

/* Convenienze specifiche del tuo backend */
function fetchModel(onSuccess, onError){
  return jsonpRequest(CONFIG.BASE_URL, {}, onSuccess, onError);
}
function fetchTrend24h(onSuccess, onError){
  return jsonpRequest(CONFIG.BASE_URL, { trend:'24h' }, onSuccess, onError);
}
function fetchLogs(onSuccess, onError){
  return jsonpRequest(CONFIG.BASE_URL, { logs:'1' }, onSuccess, onError);
}

/* Admin (no PIN) & Vimar bridge */
function callAdmin(eventName, extraParams, onSuccess, onError){
  const p = Object.assign({ admin:'1', event:String(eventName||'') }, extraParams||{});
  return jsonpRequest(CONFIG.BASE_URL, p, onSuccess, onError);
}

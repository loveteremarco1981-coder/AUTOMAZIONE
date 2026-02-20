
// Shim JSONP: se app.js chiama JSONP.fetch(undefined) evita crash
window.JSONP = window.JSONP || {};
(function(){
  const original = window.JSONP.fetch;
  window.JSONP.fetch = function(url){
    const safe = url || (window.CONFIG && window.CONFIG.DOGET_URL);
    if(!safe) return Promise.reject(new Error('JSONP: URL mancante'));
    if(typeof original==='function') return original.call(window.JSONP, safe);
    return fetch(safe,{cache:'no-store'}).then(r=>r.json());
  };
})();

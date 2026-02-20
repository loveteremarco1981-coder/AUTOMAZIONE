<script>
// Shim JSONP: se app.js chiama JSONP.fetch(undefined) evita crash
window.JSONP = window.JSONP || {};
(function(){
  const original = window.JSONP.fetch;
  window.JSONP.fetch = function(url){
    const safe = url || (window.CONFIG && window.CONFIG.DOGET_URL);
    if(!safe) return Promise.reject(new Error('JSONP: URL mancante'));
    if (typeof original === 'function') return original.call(window.JSONP, safe);
    return fetch(safe, {cache:'no-store'}).then(r => r.json());
  };
})();

// >>> Polyfill per app.js: fetchModel() globale (prima prova fetch, poi JSONP)
window.fetchModel = async function(){
  const u = window.CONFIG && window.CONFIG.DOGET_URL;
  if(!u) throw new Error('CONFIG.DOGET_URL mancante');
  try {
    return await fetch(u, {cache:'no-store'}).then(r => r.json());
  } catch(e) {
    return await JSONP.fetch(u);
  }
};
</script>

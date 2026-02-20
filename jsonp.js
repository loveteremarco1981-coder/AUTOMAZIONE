
// Minimal JSONP client
window.JSONP = window.JSONP || {};
(function(){
  let cbid = 0;
  window.JSONP.fetch = function(url){
    return new Promise(function(resolve,reject){
      try{
        const id = 'jsonp_cb_'+(++cbid);
        const sep = url.indexOf('?')>-1 ? '&' : '?';
        const el = document.createElement('script');
        const timer = setTimeout(()=>{ cleanup(); reject(new Error('JSONP timeout')); },12000);
        function cleanup(){ try{ delete window[id]; el.remove(); }catch(_){} }
        window[id] = function(data){ clearTimeout(timer); cleanup(); resolve(data); };
        el.src = url + sep + 'callback=' + id; el.async = true; el.onerror = function(){ clearTimeout(timer); cleanup(); reject(new Error('JSONP error')); };
        document.head.appendChild(el);
      }catch(err){ reject(err); }
    });
  };
})();

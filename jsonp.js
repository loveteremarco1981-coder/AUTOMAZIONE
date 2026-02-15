// jsonp.js
// Fetch JSON con fallback JSONP automatico (compatibile col tuo doGet)

(function(global){
  async function getJSON(url){
    try{
      const r = await fetch(url, { cache: 'no-store' });
      const ct = (r.headers.get('content-type') || '').toLowerCase();
      if (ct.includes('application/json')) return await r.json();

      // Se il server ritorna JSONP (application/javascript)
      const txt = await r.text();
      const m = txt.match(/^[\w$]+\((.*)\);?$/s);
      if (m) return JSON.parse(m[1]);

      return JSON.parse(txt); // last resort
    }catch(e){
      // Fallback JSONP classico
      return jsonp(url);
    }
  }

  function jsonp(url){
    return new Promise((resolve, reject)=>{
      const cb = 'cb_' + Date.now() + '_' + Math.floor(Math.random()*1e6);
      function cleanup(){
        try{ delete global[cb]; }catch(_){}
        if (script && script.parentNode) script.parentNode.removeChild(script);
      }
      global[cb] = (data)=>{ resolve(data); cleanup(); };
      const sep = url.includes('?') ? '&' : '?';
      const script = document.createElement('script');
      script.src = url + sep + 'callback=' + cb;
      script.onerror = ()=>{ cleanup(); reject(new Error('JSONP error')); };
      document.head.appendChild(script);
    });
  }

  global.JSONP_FETCH = { getJSON, jsonp };
})(window);

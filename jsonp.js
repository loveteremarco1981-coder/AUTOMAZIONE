
(function(global){
  let __cbId = 0;
  function jsonpFetch(url){
    return new Promise(function(resolve,reject){
      const cbName='__jsonp_cb_'+(++__cbId);
      const scr=document.createElement('script');
      const sep=url.includes('?')?'&':'?';
      scr.src=url+sep+'callback='+cbName; scr.async=true;
      const cleanup=()=>{delete global[cbName]; scr.remove();};
      const to=setTimeout(()=>{cleanup(); reject(new Error('JSONP timeout'));},12000);
      global[cbName]=data=>{clearTimeout(to); cleanup(); resolve(data);};
      scr.onerror=()=>{clearTimeout(to); cleanup(); reject(new Error('JSONP error'));};
      document.head.appendChild(scr);
    });
  }
  global.JSONP={fetch:jsonpFetch};
})(window);

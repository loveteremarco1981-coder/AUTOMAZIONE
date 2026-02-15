function jsonp(url, callbackParam='callback', timeoutMs=4500){
  return new Promise((resolve, reject)=>{
    const cb = 'cb_' + Math.random().toString(36).slice(2);
    const sep = url.includes('?') ? '&' : '?';
    const s = document.createElement('script');
    s.src = `${url}${sep}${callbackParam}=${cb}`;
    const timer = setTimeout(()=>{ cleanup(); reject(new Error('JSONP timeout')); }, timeoutMs);
    function cleanup(){ clearTimeout(timer); s.remove(); delete window[cb]; }
    window[cb] = (data)=>{ cleanup(); resolve(data); };
    s.onerror = ()=>{ cleanup(); reject(new Error('JSONP error')); };
    document.head.appendChild(s);
  });
}
``

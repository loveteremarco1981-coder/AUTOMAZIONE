// in js/jsonp.js
console.log('[LOAD] jsonp.js');

function jsonp(url, callbackParam='callback'){
  return new Promise((resolve, reject)=>{
    const cb='cb_'+Math.random().toString(36).slice(2);
    const sep = url.includes('?') ? '&' : '?';
    const s=document.createElement('script');
    s.src = `${url}${sep}${callbackParam}=${cb}`;
    window[cb] = (data)=>{ resolve(data); s.remove(); delete window[cb]; };
    s.onerror = ()=>{ reject(new Error('JSONP error')); s.remove(); delete window[cb]; };
    document.head.appendChild(s);
  });
}

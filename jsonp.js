function buildUrl(base, params){
  const usp=new URLSearchParams();
  Object.keys(params||{}).forEach(k=>{ if(params[k]!=null) usp.set(k, params[k]); });
  return base+(base.includes('?')?'&':'?')+usp.toString();
}
function jsonpRequest(baseUrl, params, onSuccess, onError){
  const cb='__jp_cb_'+Math.random().toString(36).slice(2);
  const cleanup=(node)=>{ try{delete window[cb]}catch(_){} try{node&&node.remove()}catch(_){} };
  const url=buildUrl(baseUrl, Object.assign({},params,{callback:cb}));
  const s=document.createElement('script'); s.src=url; s.async=true;
  let done=false;
  window[cb]=(data)=>{ if(done) return; done=true; cleanup(s); try{onSuccess&&onSuccess(data)}catch(e){console.error(e)} };
  s.onerror=(e)=>{ if(done) return; done=true; cleanup(s); try{onError&&onError(e)}catch(_){} };
  document.head.appendChild(s);
}
function fetchModel(ok,ko){ return jsonpRequest(CONFIG.BASE_URL, {}, ok, ko); }
function fetchLogs(ok,ko){  return jsonpRequest(CONFIG.BASE_URL, {logs:'1'}, ok, ko); }
function fetchTrend24h(ok,ko){return jsonpRequest(CONFIG.BASE_URL, {trend:'24h'}, ok, ko); }
function callAdmin(eventName, extra, ok, ko){
  const p=Object.assign({admin:'1',event:String(eventName||'')}, extra||{});
  return jsonpRequest(CONFIG.BASE_URL, p, ok, ko);
}

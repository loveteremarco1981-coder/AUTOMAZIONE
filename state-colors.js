(function(){
  function apply(){
    const sb = document.getElementById('stateBanner');
    if(!sb) return;
    const val = (sb.textContent||'').toUpperCase();
    document.body.classList.remove('state-comfy','state-security');
    if(val.indexOf('COMFY')>=0){ document.body.classList.add('state-comfy'); }
    else if(val.indexOf('SECURITY')>=0){ document.body.classList.add('state-security'); }
  }
  const mo = new MutationObserver(apply);
  document.addEventListener('DOMContentLoaded',()=>{
    const sb=document.getElementById('stateBanner'); if(sb) mo.observe(sb,{childList:true,subtree:true,characterData:true});
    apply();
  });
})();

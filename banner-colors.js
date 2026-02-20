
(function(){
  function apply(){ const b=document.getElementById('stateBanner'); if(!b) return; const t=(b.textContent||'').toUpperCase(); document.body.classList.remove('comfy','security'); if(t.indexOf('COMFY')>=0) document.body.classList.add('comfy'); else if(t.indexOf('SECURITY')>=0) document.body.classList.add('security'); }
  const mo=new MutationObserver(apply);
  document.addEventListener('DOMContentLoaded',()=>{ const b=document.getElementById('stateBanner'); if(b) mo.observe(b,{childList:true,characterData:true,subtree:true}); apply(); });
})();

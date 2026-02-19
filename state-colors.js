(function(){
  function apply(){
    const sb = document.getElementById('stateBanner');
    if(!sb) return;
    const val = (sb.textContent||'').toUpperCase();
    document.body.classList.remove('state-comfy','state-security');
    if(val.indexOf('COMFY')>=0){ document.body.classList.add('state-comfy'); }
    else if(val.indexOf('SECURITY')>=0){ document.body.classList.add('state-security'); }
  }
  document.addEventListener('DOMContentLoaded',apply);
  // se l'app cambia lo stato in runtime, ricalcola ogni 2s (lightweight)
  setInterval(apply,2000);
})();


(function(){
  document.addEventListener('DOMContentLoaded', async ()=>{
    try{
      const url = window.CONFIG && window.CONFIG.DOGET_URL; if(!url) return;
      const model = await fetch(url,{cache:'no-store'}).then(r=>r.json());
      const host = document.querySelector('#peopleChips'); if(!host) return; host.innerHTML='';
      const idx={}; (model.people||[]).forEach(p=> idx[String(p.name||'').toLowerCase()]=p);
      (model.peopleLast||[]).forEach(x=>{ const k=String(x.name||'').toLowerCase(); if(idx[k]) idx[k].lastInOut={event:x.lastEvent, day:x.lastDay, time:x.lastTime, tsIso:x.lastWhenIso}; });
      const arr=(model.people||[]).slice().sort((a,b)=> (b.onlineSmart===true)-(a.onlineSmart===true));
      if(!arr.length){ host.textContent='—'; return; }
      for(const p of arr){
        const st = p.onlineSmart? 'in' : (p.lastInOut && p.lastInOut.event==='USCITA' ? 'out' : 'out');
        const time = p.lastInOut ? (p.lastInOut.time+' • '+p.lastInOut.day) : '—';
        const d=document.createElement('div'); d.className='person-chip';
        d.innerHTML = '<span class="person-dot '+st+'"></span>'+
                      '<span class="person-name">'+(p.name||'—')+'</span>'+
                      '<span class="person-meta '+st+'">'+st.toUpperCase()+'</span>'+
                      '<span class="person-time">'+time+'</span>';
        host.appendChild(d);
      }
    }catch(e){ console.error('[people] ',e); }
  });
})();

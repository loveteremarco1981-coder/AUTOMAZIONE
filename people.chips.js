(function(){
  const USE_JSONP = false; // metti true se il doGet risponde solo JSONP
  const DOGET = (window.CONFIG && window.CONFIG.DOGET_URL) || '';
  if(!DOGET){ console.error('CONFIG.DOGET_URL mancante'); }

  document.addEventListener('DOMContentLoaded', ()=>{
    // carica una volta; se la view non è visibile, i chip compariranno quando apri "Persone"
    fetchModel().then(renderPeople).catch(console.error);
  });

  async function fetchModel(){
    if(!DOGET) throw new Error('URL doGet mancante');
    if(USE_JSONP){ return await JSONP.fetch(DOGET); }
    const r = await fetch(DOGET,{cache:'no-store'}); return await r.json();
  }

  function renderPeople(model){
    const host = document.querySelector('#peopleChips'); if(!host) return;
    host.innerHTML='';

    const people = Array.isArray(model.people) ? model.people.slice() : [];
    // Merge server-side peopleLast -> people[].lastInOut (se non già fuso)
    const idx={}; people.forEach(p=> idx[String(p.name||'').toLowerCase()] = p);
    (model.peopleLast||[]).forEach(x=>{
      const k = String(x.name||'').toLowerCase();
      if(idx[k]) idx[k].lastInOut = { event:x.lastEvent, day:x.lastDay, time:x.lastTime, tsIso:x.lastWhenIso };
    });

    // Ordina: presenti prima
    people.sort((a,b)=>{ const A=a.onlineSmart?1:0,B=b.onlineSmart?1:0; if(A!==B) return B-A; return (''+a.name).localeCompare(''+b.name,'it'); });

    if(!people.length){ host.innerHTML='<div class="muted">—</div>'; return; }

    for(const p of people){
      const st = statusOf(p);
      const chip = h('div','person-chip');
      const timeStr = (p.lastInOut && p.lastInOut.time && p.lastInOut.day) ? `${p.lastInOut.time} • ${p.lastInOut.day}` : '—';
      chip.append(
        h('span','person-dot '+st),
        h('span','person-name', p.name||'—'),
        h('span','person-meta '+(st==='in'?'in':(st==='out'?'out':'')), st==='in'?'IN':(st==='out'?'OUT':'—')),
        h('span','person-time', timeStr)
      );
      host.appendChild(chip);
    }
  }

  function statusOf(p){
    if(p && p.onlineSmart===true) return 'in';
    if(p && p.onlineSmart===false){
      if(p.lastInOut && p.lastInOut.event==='USCITA') return 'out';
      if(p.lastInOut && p.lastInOut.event==='ARRIVO') return 'in';
      return 'out';
    }
    if(p && p.lastInOut) return p.lastInOut.event==='USCITA'?'out':(p.lastInOut.event==='ARRIVO'?'in':'unk');
    return 'unk';
  }

  function h(tag, cls, text){ const el=document.createElement(tag); if(cls) el.className=cls; if(text!=null) el.textContent=text; return el; }
})();

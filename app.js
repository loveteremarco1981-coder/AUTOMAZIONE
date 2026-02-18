
(async function(){
  const useJsonp = false; // metti true se il doGet risponde solo in JSONP
  async function loadModel(){
    setLoading(true);
    try{
      const url = window.CONFIG.DOGET_URL;
      const model = useJsonp ? await JSONP.fetch(url) : await (await fetch(url,{cache:'no-store'})).json();
      renderPeople(model);
      renderDevices(model);
    }catch(e){
      console.error('loadModel', e);
      q('#peopleChips').innerHTML = '<div class="muted">Errore caricamento: '+e.message+'</div>';
    }finally{
      setLoading(false);
    }
  }

  function renderPeople(model){
    const host = q('#peopleChips'); host.innerHTML='';
    const people = Array.isArray(model.people)?model.people:[];

    const map = {}; people.forEach(p=> map[String(p.name||'').toLowerCase()]=p);
    (model.peopleLast||[]).forEach(x=>{ const k=String(x.name||'').toLowerCase(); if(map[k]) map[k].lastInOut={event:x.lastEvent,day:x.lastDay,time:x.lastTime,tsIso:x.lastWhenIso}; });

    people.sort((a,b)=>{ const A=a.onlineSmart?1:0, B=b.onlineSmart?1:0; if(A!==B) return B-A; return String(a.name||'').localeCompare(String(b.name||''),'it'); });

    if(!people.length){ host.innerHTML='<div class="muted">Nessuna persona</div>'; return; }

    for(const p of people){
      const st = pickStatus(p);
      const chip = h('div','person-chip');
      chip.title = p.lastInOut ? `Ultimo ${p.lastInOut.event} alle ${p.lastInOut.time} del ${p.lastInOut.day}` : '';
      chip.append(
        h('span','person-dot '+st),
        h('span','person-name', p.name||'—'),
        h('span','person-meta '+(st==='in'?'in':(st==='out'?'out':'')), st==='in'?'IN':(st==='out'?'OUT':'—')),
        h('span','person-time', p.lastInOut ? `${p.lastInOut.event==='ARRIVO'?'Entrata':'Uscita'}: ${p.lastInOut.time} • ${p.lastInOut.day}` : '—')
      );
      host.appendChild(chip);
    }

    function pickStatus(p){
      if(p && p.onlineSmart===true) return 'in';
      if(p && p.onlineSmart===false){
        if(p.lastInOut && p.lastInOut.event==='USCITA') return 'out';
        if(p.lastInOut && p.lastInOut.event==='ARRIVO') return 'in';
        return 'out';
      }
      if(p && p.lastInOut) return p.lastInOut.event==='USCITA'?'out':(p.lastInOut.event==='ARRIVO'?'in':'unk');
      return 'unk';
    }
  }

  function renderDevices(model){
    const arr = Array.isArray(model.vimar)?model.vimar:[];
    fill('vimarShutters', arr.filter(d=>String(d.type||'').toLowerCase()==='shutter'), 'icons/st/glyph-shutter.svg');
    const thermoTypes=['thermo','termostato','termostati','thermostat'];
    fill('vimarThermo', arr.filter(d=>thermoTypes.includes(String(d.type||'').toLowerCase())), 'icons/st/glyph-generic.svg');
    const hvacTypes=['clima','hvac','clivet'];
    fill('vimarHvac', arr.filter(d=>hvacTypes.includes(String(d.type||'').toLowerCase())), 'icons/st/glyph-suit.svg');
  }

  function fill(id, items, icon){
    const host = q('#'+id); host.innerHTML='';
    if(!items || !items.length){ host.innerHTML='<div class="muted">Nessun dispositivo</div>'; return; }
    for(const d of items){
      const st = String(d.state||'').toUpperCase();
      const badgeCls = ['UP','OPEN','ON','HEATING','COOLING','AUTO','IN'].includes(st) ? 'ok' : (['DOWN','CLOSED','OFF','ALARM','ERROR','OUT'].includes(st) ? 'off' : '');
      const card = h('div','card');
      const img = document.createElement('img'); img.className='icon'; img.src=icon; img.alt='';
      const col=h('div',''); col.append(h('div','title', d.name||d.id||'—'), h('div','state', d.state || '—'));
      const badge=h('div','badge '+badgeCls, st||'—');
      card.append(img,col,badge); q('#'+id).appendChild(card);
    }
  }

  function q(sel){ return document.querySelector(sel); }
  function h(tag, cls, text){ const el=document.createElement(tag); if(cls) el.className=cls; if(text!=null) el.textContent=text; return el; }
  function setLoading(b){ const btn=q('#btnRefresh'); if(btn) btn.disabled=b; }

  document.addEventListener('DOMContentLoaded', ()=>{
    q('#btnRefresh') && q('#btnRefresh').addEventListener('click', loadModel);
  });
  loadModel();
})();

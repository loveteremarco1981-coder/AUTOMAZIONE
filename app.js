
(function(){
  const useJsonp = false; // se il doGet espone JSONP metti true

  async function loadModel(){
    setLoading(true);
    try{
      const url = window.CONFIG && window.CONFIG.DOGET_URL;
      if(!url) throw new Error('CONFIG.DOGET_URL mancante');
      const model = useJsonp ? await JSONP.fetch(url) : await (await fetch(url,{cache:'no-store'})).json();
      renderAll(model);
    }catch(e){
      console.error(e);
      q('#peopleChips').innerHTML = '<div class="muted">Errore caricamento: '+(e.message||e)+'</div>';
    }finally{ setLoading(false); }
  }

  function renderAll(model){
    renderPeople(model);
    renderDevices(model);
    renderWeather(model);
    renderEnergy(model);
    renderNext(model);
    renderAlerts(model);
  }

  // --- Persone ---
  function renderPeople(model){
    const host = q('#peopleChips'); host.innerHTML='';
    const people = Array.isArray(model.people)?model.people:[];

    // Fonde peopleLast -> people[].lastInOut se il server non l'ha già fatto
    const map = {}; people.forEach(p=> map[String(p.name||'').toLowerCase()] = p);
    (model.peopleLast||[]).forEach(x=>{ const k=String(x.name||'').toLowerCase(); if(map[k]) map[k].lastInOut = {event:x.lastEvent, day:x.lastDay, time:x.lastTime, tsIso:x.lastWhenIso}; });

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

  // --- Dispositivi ---
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
      card.append(img,col,badge); host.appendChild(card);
    }
  }

  // --- Meteo ---
  function renderWeather(model){
    const host=q('#kpiWeather');
    if(!host) return;
    const w=model.weather||{}; const temp=(w.tempC!=null? w.tempC+'°C':'—');
    host.querySelector('.value').textContent=temp;
    host.querySelector('.label').textContent=w.text? (w.iconEmoji? w.iconEmoji+' '+w.text: w.text):'Meteo';
  }

  // --- Energia ---
  function renderEnergy(model){
    const host=q('#kpiEnergy'); if(!host) return;
    const kwh = model.energy && model.energy.kwh!=null ? model.energy.kwh : null;
    host.querySelector('.value').textContent = (kwh!=null? kwh+' kWh':'—');
    const off = Number(model.devicesOfflineCount||0);
    const lbl = host.querySelector('.label');
    lbl.textContent = off>0 ? ('Energia • '+off+' OFF') : 'Energia';
  }

  // --- Prossimi eventi ---
  function renderNext(model){
    const host=q('#nextGrid'); if(!host) return; host.innerHTML='';
    const entries=[
      {k:'Piante (alba)', v: model.next && model.next.pianteAlba},
      {k:'Piante (post chiusura)', v: model.next && model.next.piantePostClose},
      {k:'Chiusura extra', v: model.next && model.next.lateClose}
    ];
    for(const e of entries){
      const row=h('div','row');
      row.append(h('div','', e.k), h('div','', e.v? prettyDateTime(e.v): '—'));
      host.appendChild(row);
    }
  }

  // --- Alert log ---
  function renderAlerts(model){
    const host=q('#kpiAlerts'); if(!host) return;
    const n = Number(model.alerts && model.alerts.logErrors || 0);
    host.querySelector('.value').textContent = n>0? (n+' err'): 'OK';
    host.querySelector('.label').textContent = 'Log';
  }

  function prettyDateTime(x){
    try{
      if(x instanceof Date) return x.toLocaleString();
      const d = new Date(x); if(!isNaN(d.getTime())) return d.toLocaleString();
      return String(x);
    }catch(_){ return String(x||''); }
  }

  // helpers
  function q(s){ return document.querySelector(s); }
  function h(tag, cls, text){ const el=document.createElement(tag); if(cls) el.className=cls; if(text!=null) el.textContent=text; return el; }
  function setLoading(b){ const btn=q('#btnRefresh'); if(btn) btn.disabled=b; }

  document.addEventListener('DOMContentLoaded', ()=>{
    const btn=q('#btnRefresh'); if(btn) btn.addEventListener('click', loadModel);
    loadModel();
  });
})();

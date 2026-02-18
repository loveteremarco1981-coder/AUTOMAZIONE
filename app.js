// Smart UI v4.1 — app base + Persone chips
(function(){
  const useJsonp = false; // metti true se il tuo doGet richiede JSONP

  document.addEventListener('DOMContentLoaded', ()=>{
    hookTabs();
    loadModel();
  });

  function hookTabs(){
    const tabs = document.querySelectorAll('.tabbar .tab');
    tabs.forEach(btn=>{
      btn.addEventListener('click', ()=>{
        tabs.forEach(b=>b.classList.remove('active'));
        btn.classList.add('active');
        const target = btn.getAttribute('data-target');
        switchView(target);
      });
    });
  }

  function switchView(target){
    const views = document.querySelectorAll('main .view');
    views.forEach(v=>v.classList.remove('active'));
    const sel = document.querySelector('#view-'+target) || document.querySelector('#view-home');
    sel.classList.add('active');
  }

  async function loadModel(){
    try{
      const url = window.CONFIG && window.CONFIG.DOGET_URL;
      if(!url) throw new Error('CONFIG.DOGET_URL mancante');
      const model = useJsonp ? await JSONP.fetch(url) : await (await fetch(url,{cache:'no-store'})).json();
      renderAll(model);
    }catch(e){ console.error(e); }
  }

  function renderAll(model){
    updateBanner(model);
    renderDashboard(model);
    renderPeople(model); // nuova sezione Persone
  }

  function updateBanner(model){
    const el = document.querySelector('#stateBanner');
    el.textContent = model && model.state ? String(model.state) : '—';
  }

  function renderDashboard(model){
    const w = model.weather || {};
    document.querySelector('#weatherEmoji').textContent = w.iconEmoji || '';
    document.querySelector('#weatherTemp').textContent = (w.tempC!=null ? w.tempC+'°C' : '—°C');
    document.querySelector('#weatherProvider').textContent = (w.provider || '—');

    const onlineCount = (Array.isArray(model.people)? model.people.filter(p=>p.onlineSmart===true).length : 0);
    const presence = model.presenzaEffettiva===true ? 'Occupata' : 'Vuota';
    setText('#peopleOnline', onlineCount);
    setText('#houseStatus', presence);

    const kwh = model.energy && model.energy.kwh!=null ? model.energy.kwh : null;
    setText('#energyKwh', kwh!=null? kwh : '—');
    setText('#tempValue',  w.tempC!=null? w.tempC : '—');
    setText('#humValue',   '—'); // se avrai l'umidità, valorizza qui

    const ts = new Date();
    setText('#ts', 'Aggiornamento: '+two(ts.getHours())+':'+two(ts.getMinutes()));
  }

  function renderPeople(model){
    const host = document.querySelector('#peopleChips');
    if(!host) return;
    host.innerHTML='';

    const people = Array.isArray(model.people) ? model.people.slice() : [];
    // Merge con peopleLast
    const map={}; people.forEach(p=> map[String(p.name||'').toLowerCase()] = p);
    (model.peopleLast||[]).forEach(x=>{ const k=String(x.name||'').toLowerCase(); if(map[k]) map[k].lastInOut = {event:x.lastEvent, day:x.lastDay, time:x.lastTime, tsIso:x.lastWhenIso}; });

    people.sort((a,b)=>{ const A=a.onlineSmart?1:0,B=b.onlineSmart?1:0; if(A!==B) return B-A; return String(a.name||'').localeCompare(String(b.name||''),'it'); });

    if(!people.length){ host.innerHTML='<div class="muted">—</div>'; return; }

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

  // helpers
  function setText(sel, val){ const el=document.querySelector(sel); if(!el) return; el.textContent = String(val); }
  function two(n){ return (n<10?'0':'')+n; }
  function h(tag, cls, text){ const el=document.createElement(tag); if(cls) el.className=cls; if(text!=null) el.textContent=text; return el; }
})();

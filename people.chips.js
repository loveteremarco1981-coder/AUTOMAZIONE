(function(){
  const DOGET = (window.CONFIG && window.CONFIG.DOGET_URL) || '';
  const USE_JSONP = false;

  window.addEventListener('load', ()=>{
    if(!DOGET){ console.error('CONFIG.DOGET_URL mancante'); return; }
    fetchModel().then(async model=>{
      if(needLogs(model)){
        try{ const logs = await fetchLogs(); injectLastFromLogs(model, logs); }
        catch(_){ /* ignore */ }
      }
      renderPeople(model);
    }).catch(console.error);
  });

  function needLogs(m){
    const arr = Array.isArray(m.people)? m.people:[];
    return arr.some(p=> !(p && p.lastInOut && p.lastInOut.time && p.lastInOut.day));
  }

  async function fetchModel(){
    if(USE_JSONP){ return await JSONP.fetch(DOGET); }
    const r = await fetch(DOGET,{cache:'no-store'}); return await r.json();
  }
  async function fetchLogs(){
    const sep = DOGET.includes('?') ? '&' : '?';
    const url = DOGET + sep + 'logs=1';
    const r = await fetch(url,{cache:'no-store'}); const js = await r.json();
    return Array.isArray(js.logs) ? js.logs : [];
  }
  function injectLastFromLogs(model, logs){
    const byName = {}; (model.people||[]).forEach(p=> byName[String(p.name||'').toLowerCase()]=p);
    const done = {};
    for(const row of logs){
      if(!row) continue; const desc = String(row.desc||'');
      const m = desc.match(/(ARRIVO|USCITA)\s*:\s*([A-Za-zÀ-ÖØ-öø-ÿ]+)/i);
      if(!m) continue; const ev = m[1].toUpperCase(); const name=(m[2]||'').trim(); const k=name.toLowerCase(); if(done[k]) continue;
      const p = byName[k]; if(!p) continue; const when = (row.ts && (new Date(row.ts))) || null;
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const day = when? new Intl.DateTimeFormat('it-IT',{timeZone:tz, day:'2-digit', month:'2-digit', year:'numeric'}).format(when): null;
      const time = when? new Intl.DateTimeFormat('it-IT',{timeZone:tz, hour:'2-digit', minute:'2-digit'}).format(when): null;
      p.lastInOut = { event: ev, day: day||'—', time: time||'—', tsIso: when? when.toISOString(): null };
      done[k]=true;
    }
  }

  function renderPeople(model){
    const host = document.querySelector('#peopleChips'); if(!host) return; host.innerHTML='';
    const people = Array.isArray(model.people) ? model.people.slice() : [];
    const idx={}; people.forEach(p=> idx[String(p.name||'').toLowerCase()] = p);
    (model.peopleLast||[]).forEach(x=>{ const k = String(x.name||'').toLowerCase(); if(idx[k]) idx[k].lastInOut = { event:x.lastEvent, day:x.lastDay, time:x.lastTime, tsIso:x.lastWhenIso }; });
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

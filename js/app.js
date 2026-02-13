
const ENDPOINT = window.APP_CONFIG.endpoint;

function fmt(dt){ if(!dt) return '—'; const d=new Date(dt); if(isNaN(d)) return String(dt); return d.toLocaleString(); }
function fmtYN(v){ return v? 'SÌ':'NO'; }
function fmtAgo(min){ if(min==null) return '—'; if(min<1) return 'ora'; if(min===1) return '1 min'; return min+' min'; }
function toast(msg){ const t=document.getElementById('toast'); t.textContent=msg; t.classList.add('show'); setTimeout(()=>t.classList.remove('show'), 1800); }

function paintState(state){ document.getElementById('state-pill').textContent = state || '—'; }
function renderPeople(people){
  const ul = document.getElementById('people-list'); ul.innerHTML='';
  (people||[]).forEach(p=>{
    const li=document.createElement('li'); li.className='person';
    li.innerHTML=`<div>${p.name}</div><div class="badge ${p.onlineSmart?'in':'out'}">${p.onlineSmart?'IN':'OUT'}${p.lastLifeMinAgo!=null?' · '+fmtAgo(p.lastLifeMinAgo):''}</div>`;
    ul.appendChild(li);
  });
}
function renderMeta(m){
  document.getElementById('meta-time').textContent = fmt(m.meta?.nowIso||Date.now());
  const st=(m.state||'').toUpperCase();
  const flags=[]; if(m.vacanza) flags.push('vacanza'); if(m.override) flags.push('override'); flags.push(st.endsWith('_NIGHT')?'notte':'giorno');
  document.getElementById('meta-flags').textContent = flags.join(' · ');
  document.getElementById('last-event').textContent = m.lastEvent||'—';

  // Orari + prossimi eventi
  document.getElementById('alba').textContent = fmt(m.alba);
  document.getElementById('tramonto').textContent = fmt(m.tramonto);
  document.getElementById('ora').textContent = fmt(m.meta?.nowIso||Date.now());
  document.getElementById('notte').textContent = st.endsWith('_NIGHT')? 'NOTTE':'GIORNO';

  const next = (m.next || m.meta?.next || {});
  document.getElementById('next-piante-alba').textContent = fmt(next.pianteAlba);
  document.getElementById('next-piante-close').textContent = fmt(next.piantePostClose);
  document.getElementById('next-lateclose').textContent = fmt(next.lateClose);
}

async function loadModel(){
  try{ const model = await jsonp(ENDPOINT); paintState(model.state); renderPeople(model.people); renderMeta(model);}catch(e){ console.error(e); }
}

async function sendCmd(evt, val){
  try{
    const r = await fetch(ENDPOINT,{ method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({event:evt, value: !!val}) });
    const txt = await r.text();
    if(txt.trim()==='OK'){ toast('Comando inviato'); setTimeout(loadModel, 300); }
    else { toast('Errore comando: '+txt); }
  }catch(e){ toast('Errore rete'); }
}

function bind(){
  document.querySelectorAll('.seg').forEach(btn=>{
    btn.addEventListener('click',()=>{ sendCmd(btn.dataset.cmd, btn.dataset.val==='true'); });
  });
}

bind(); loadModel(); setInterval(loadModel, 15000);

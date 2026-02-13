const ENDPOINT = window.APP_CONFIG.endpoint;

// --- Helpers UI ---
function fmt(dt){ if(!dt) return '—'; const d=new Date(dt); if(isNaN(d)) return String(dt); return d.toLocaleString(); }
function fmtAgo(min){ if(min==null) return '—'; if(min<1) return 'ora'; if(min===1) return '1 min'; return min+' min'; }
function toast(msg){ const t=document.getElementById('toast'); if(!t) return; t.textContent=msg; t.classList.add('show'); setTimeout(()=>t.classList.remove('show'), 1600); }

// --- Render ---
function paintState(state){ const el=document.getElementById('state-pill'); if(el) el.textContent = state || '—'; }

function renderPeople(people){
  const ul = document.getElementById('people-list'); if(!ul) return;
  ul.innerHTML = '';
  (people||[]).forEach(p=>{
    const online = (p.onlineSmart===true) || (p.onlineRaw===true);
    const li = document.createElement('li');
    li.className = 'person';
    li.innerHTML = `<div>${p.name}</div>
      <div class="badge ${online?'in':'out'}">
        ${online?'IN':'OUT'}${p.lastLifeMinAgo!=null?' · '+fmtAgo(p.lastLifeMinAgo):''}
      </div>`;
    ul.appendChild(li);
  });
}

function renderMeta(m){
  const timeEl=document.getElementById('meta-time');
  if(timeEl) timeEl.textContent = fmt(m.meta?.nowIso||Date.now());

  const flags = [];
  if(m.vacanza) flags.push('vacanza');
  if(m.override) flags.push('override');
  const st=(m.state||'').toUpperCase();
  flags.push(st.endsWith('_NIGHT') ? 'notte':'giorno');

  const flagsEl=document.getElementById('meta-flags');
  if(flagsEl) flagsEl.textContent = flags.join(' · ');

  const le=document.getElementById('last-event');
  if(le) le.textContent = m.lastEvent || '—';

  // Orari
  const map = {
    alba: 'alba',
    tramonto: 'tramonto',
    ora: 'ora',
    notte: 'notte',
    nextAlba: 'next-piante-alba',
    nextClose: 'next-piante-close',
    nextLate: 'next-lateclose'
  };
  const next = (m.next || m.meta?.next || {});
  const byId = (id, val)=>{ const el=document.getElementById(id); if(el) el.textContent = val; };

  byId(map.alba, fmt(m.alba));
  byId(map.tramonto, fmt(m.tramonto));
  byId(map.ora, fmt(m.meta?.nowIso||Date.now()));
  byId(map.notte, st.endsWith('_NIGHT') ? 'NOTTE':'GIORNO');
  byId(map.nextAlba, fmt(next.pianteAlba));
  byId(map.nextClose, fmt(next.piantePostClose));
  byId(map.nextLate, fmt(next.lateClose));
}

// --- Load model ---
async function loadModel(){
  try{
    const model = await jsonp(ENDPOINT);
    paintState(model.state);
    renderPeople(model.people);
    renderMeta(model);
  }catch(e){ console.error('Load error', e); }
}

// --- Comandi via JSONP (no CORS) ---
async function sendCmd(evt, on){
  try{
    await jsonp(`${ENDPOINT}?admin=1&event=${encodeURIComponent(evt)}&value=${on?'true':'false'}`);
    toast('Comando inviato');
    setTimeout(loadModel, 300);
  }catch(e){ toast('Errore comando'); }
}

// --- Bind UI ---
function bind(){
  document.querySelectorAll('.seg').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const evt=btn.dataset.cmd;
      const val=(btn.dataset.val==='true');
      sendCmd(evt, val);
    });
  });
}

document.addEventListener('DOMContentLoaded', ()=>{ bind(); loadModel(); setInterval(loadModel, 15000); });

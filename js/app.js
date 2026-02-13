console.log('[LOAD] app.js');

const ENDPOINT = (window.APP_CONFIG && window.APP_CONFIG.endpoint) || null;
if(!ENDPOINT){
  console.error('[CONFIG] APP_CONFIG.endpoint mancante. Controlla /AUTOMAZIONE/config.js e il tag script corrispondente.');
}

function fmt(dt){ if(!dt) return '—'; const d=new Date(dt); if(isNaN(d)) return String(dt); return d.toLocaleString(); }
function fmtAgo(min){ if(min==null) return '—'; if(min<1) return 'ora'; if(min===1) return '1 min'; return min+' min'; }
function toast(msg){ const t=document.getElementById('toast'); if(!t) return; t.textContent=msg; t.classList.add('show'); setTimeout(()=>t.classList.remove('show'), 1600); }

function paintState(state){ const el=document.getElementById('state-pill'); if(el) el.textContent = state || '—'; }

function renderPeople(people){
  const ul = document.getElementById('people-list'); if(!ul) return;
  ul.innerHTML = '';
  (people||[]).forEach(p=>{
    // IN se onlineSmart || onlineRaw || online === true/IN
    const online =
      (p.onlineSmart===true) ||
      (p.onlineRaw===true)   ||
      (p.online===true)      ||
      (String(p.online||'').toUpperCase()==='IN');

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

  const next = (m.next || m.meta?.next || {});
  const set = (id, val)=>{ const el=document.getElementById(id); if(el) el.textContent = val; };

  set('alba', fmt(m.alba));
  set('tramonto', fmt(m.tramonto));
  set('ora', fmt(m.meta?.nowIso||Date.now()));
  set('notte', st.endsWith('_NIGHT')? 'NOTTE':'GIORNO');
  set('next-piante-alba',  fmt(next.pianteAlba));
  set('next-piante-close', fmt(next.piantePostClose));
  set('next-lateclose',    fmt(next.lateClose));
}

async function loadModel(){
  if(!ENDPOINT) return;
  try{
    const model = await jsonp(ENDPOINT);
    console.log('[MODEL]', model);
    paintState(model.state);
    renderPeople(model.people);
    renderMeta(model);
  }catch(e){ console.error('Load error', e); }
}

async function sendCmd(evt, on){
  if(!ENDPOINT) return;
  try{
    const url = `${ENDPOINT}?admin=1&event=${encodeURIComponent(evt)}&value=${on?'true':'false'}`;
    const res = await jsonp(url);
    console.log('[CMD]', evt, on, res);
    toast('Comando inviato');
    setTimeout(loadModel, 300);
  }catch(e){ console.error('Cmd error', e); toast('Errore comando'); }
}

function bind(){
  console.log('[BIND] attach handlers');
  document.querySelectorAll('.seg').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const evt=btn.dataset.cmd;
      const val=(btn.dataset.val==='true');
      console.log('[CLICK]', evt, val);
      sendCmd(evt, val);
    });
  });
}

document.addEventListener('DOMContentLoaded', ()=>{
  bind();
  loadModel();
  setInterval(loadModel, 15000);
});

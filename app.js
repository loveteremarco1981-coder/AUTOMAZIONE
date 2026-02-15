const $  = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);
const pick = (o,p)=>p.split('.').reduce((x,k)=>(x&&x[k]!==undefined)?x[k]:undefined,o);
const appendQS = (base, qs) => base + (base.includes('?')?'&':'?') + qs;

/* ————— SKELETON ————— */
function renderSkeleton(){
  $('#homeName').textContent = APP_CONFIG.title || 'Casa';

  // HOME tiles (include la tile STATO accanto a Override)
  $('#homeTiles').innerHTML = APP_CONFIG.tiles.map(t => `
    <article class="tile ${t.type} ${t.type!=='sensor'?'click':''}" data-id="${t.id}">
      <div><div class="label">${t.label}</div>${t.subtitle?`<div class="muted">${t.subtitle}</div>`:''}</div>
      <div class="value muted">${t.type==='sensor'?'—':(t.type==='switch'?'Off':'Esegui')}</div>
    </article>`).join('');
}

function bindActions(){
  // tabbar
  $('.tabbar').addEventListener('click', ev=>{
    const btn = ev.target.closest('.tab'); if(!btn) return;
    const target = btn.dataset.target; if(!target) return;
    // attiva tab
    $$('.tab').forEach(b=>b.classList.toggle('active', b===btn));
    // attiva vista
    $$('.view').forEach(v=>v.classList.remove('active'));
    $(`#view-${target}`).classList.add('active');
  });

  // click tile
  APP_CONFIG.tiles.forEach(t=>{
    const el=document.querySelector(`.tile[data-id="${t.id}"]`);
    if(!el || el.dataset.bound) return;

    if(t.type==='switch'){
      el.onclick=async ()=>{
        const isOn = el.classList.contains('on');
        const qs   = isOn ? t.off.url : t.on.url;   // admin=1&event=...
        const url  = appendQS(APP_CONFIG.endpoint, qs);
        try{ await fetch(url,{method:'GET',mode:'no-cors'}); }catch(e){}
      };
    }
    if(t.type==='scene'){
      el.onclick=async ()=>{
        if(t.action?.confirm && !confirm(t.action.confirm)) return;
        const url=appendQS(APP_CONFIG.endpoint, t.action.url);
        try{ await fetch(url,{method:'GET',mode:'no-cors'}); }catch(e){}
      };
    }
    el.dataset.bound='1';
  });
}

/* ————— DATA LOAD ————— */
async function loadState(){
  try{
    const model = await jsonp(APP_CONFIG.endpoint, APP_CONFIG.jsonpCallbackParam || 'callback');
    applyState(model);
    $('#ts').textContent = 'Aggiornato: ' + new Date().toLocaleTimeString();
  }catch(e){
    $('#ts').textContent = 'Errore di connessione';
  }
}

/* ————— APPLY ————— */
function applyState(model){
  // Persone (pillole)
  const people = Array.isArray(model.people) ? model.people : [];
  $('#people').innerHTML = people.map(p=>{
    const inHome = !!(p.onlineSmart || p.onlineRaw);
    return `<span class="pill ${inHome?'in':'out'}">${p.name} · ${inHome?'In':'Out'}</span>`;
  }).join('');

  // HOME tiles
  APP_CONFIG.tiles.forEach(t=>{
    const el=document.querySelector(`.tile[data-id="${t.id}"]`);
    if(!el) return;

    // Tile STATO
    if(t.type==='state'){
      const st = String(pick(model, t.path)||'').toUpperCase();
      const v  = el.querySelector('.value');
      v.textContent = st || '—';
      el.classList.remove('neutral','comfy','security');
      if(/^COMFY/.test(st))        el.classList.add('state','comfy');
      else if(/^SECURITY/.test(st))el.classList.add('state','security');
      else                         el.classList.add('state','neutral');
      return;
    }

    if(t.type==='sensor'){
      const v=pick(model,t.path);
      el.querySelector('.value').textContent = (t.format?t.format(v):v) ?? '—';
      el.classList.toggle('on', false);
    }
    if(t.type==='switch'){
      const on=!!pick(model,t.path);
      el.querySelector('.value').textContent = on ? 'On' : 'Off';
      el.classList.toggle('on', on);
    }
    if(t.type==='scene'){
      el.querySelector('.value').textContent = 'Esegui';
      el.classList.toggle('on', false);
    }
  });

  // AUTOMAZIONI (placeholder finché non esponi i log dal GAS)
  $('#log').innerHTML = `<div class="row"><div class="name">Nessun evento</div>
                         <div class="muted">Aggiungi endpoint log</div></div>`;
}

/* ————— BOOTSTRAP ————— */
renderSkeleton();
bindActions();
loadState();
setInterval(loadState, APP_CONFIG.pollMs);

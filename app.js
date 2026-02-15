const $  = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);
const pick = (o,p)=>p.split('.').reduce((x,k)=>(x&&x[k]!==undefined)?x[k]:undefined,o);

// URL helper
const appendQS = (base, qs) => base + (base.includes('?')?'&':'?') + qs;

// Render iniziale
function renderSkeleton(){
  $('#homeName').textContent = APP_CONFIG.title || 'Casa';

  // HOME tiles
  $('#homeTiles').innerHTML = APP_CONFIG.tiles.map(t => `
    <article class="tile ${t.type} ${t.type!=='sensor'?'click':''}" data-id="${t.id}">
      <div><div class="label">${t.label}</div>${t.subtitle?`<div class="muted">${t.subtitle}</div>`:''}</div>
      <div class="value muted">${t.type==='sensor'?'—':(t.type==='switch'?'Off':'Esegui')}</div>
    </article>`).join('');

  // STANZE
  $('#rooms').innerHTML = APP_CONFIG.rooms.map(r => `
    <section class="room">
      <h3>${r.name}</h3>
      <div class="tiles tiles-room">
        ${r.tiles.map(id => `<div class="tile-ref" data-ref="${id}"></div>`).join('')}
      </div>
    </section>`).join('');

  // Clona/crea virtual tiles nelle stanze
  APP_CONFIG.rooms.forEach(r=>{
    r.tiles.forEach(id=>{
      const host = document.querySelector(`.tile-ref[data-ref="${id}"]`);
      if(!host) return;
      if(APP_CONFIG.virtual?.[id]){
        host.outerHTML = `
          <article class="tile sensor">
            <div class="label">${APP_CONFIG.virtual[id].label}</div>
            <div class="value muted">—</div>
          </article>`;
        return;
      }
      const src = document.querySelector(`.tile[data-id="${id}"]`);
      if(src) host.replaceWith(src.cloneNode(true));
    });
  });
}

// Bind azioni (interruttori/scene)
function bindActions(){
  APP_CONFIG.tiles.forEach(t=>{
    const el = document.querySelector(`.tile[data-id="${t.id}"]`);
    if(!el || el.dataset.bound) return;

    if(t.type === 'switch'){
      el.onclick = async ()=>{
        const isOn = el.classList.contains('on');
        const qs   = isOn ? t.off.url : t.on.url;   // admin=1&event=...
        const url  = appendQS(APP_CONFIG.endpoint, qs);
        try{ await fetch(url,{method:'GET',mode:'no-cors'}); }
        catch(e){ /* ignora */ }
      };
    }
    if(t.type === 'scene'){
      el.onclick = async ()=>{
        if(t.action?.confirm && !confirm(t.action.confirm)) return;
        const url = appendQS(APP_CONFIG.endpoint, t.action.url);
        try{ await fetch(url,{method:'GET',mode:'no-cors'}); }
        catch(e){ /* ignora */ }
      };
    }
    el.dataset.bound = '1';
  });
}

// Carica stato dal tuo doGet (JSONP)
async function loadState(){
  try{
    const model = await jsonp(APP_CONFIG.endpoint, APP_CONFIG.jsonpCallbackParam || 'callback');
    applyState(model);
    $('#ts').textContent = 'Aggiornato: ' + new Date().toLocaleTimeString();
  }catch(e){
    $('#ts').textContent = 'Errore di connessione';
  }
}

// Aggiorna UI
function applyState(model){
  // Persone (pillole)
  const people = Array.isArray(model.people) ? model.people : [];
  $('#people').innerHTML = people.map(p=>{
    const inHome = !!(p.onlineSmart || p.onlineRaw);
    return `<span class="pill ${inHome?'in':'out'}">${p.name} · ${inHome?'In':'Out'}</span>`;
  }).join('');

  // HOME tile update
  APP_CONFIG.tiles.forEach(t=>{
    const el = document.querySelector(`.tile[data-id="${t.id}"]`);
    if(!el) return;

    // STATO → colore dinamico
    if(t.type === 'state'){
      const st = String(pick(model, t.path)||'').toUpperCase();
      const v  = el.querySelector('.value');
      v.textContent = st || '—';
      el.classList.remove('neutral','comfy','security');
      if(/^COMFY/.test(st))      el.classList.add('comfy');
      else if(/^SECURITY/.test(st)) el.classList.add('security');
      else                       el.classList.add('neutral');
      return;
    }

    if(t.type === 'sensor'){
      const v = pick(model, t.path);
      el.querySelector('.value').textContent = (t.format?t.format(v):v) ?? '—';
      el.classList.toggle('on', false);
    }
    if(t.type === 'switch'){
      const on = !!pick(model, t.path);
      el.querySelector('.value').textContent = on ? 'On' : 'Off';
      el.classList.toggle('on', on);
    }
    if(t.type === 'scene'){
      el.querySelector('.value').textContent = 'Esegui';
      el.classList.toggle('on', false);
    }
  });

  // Stanze: virtual (alba/tramonto)
  Object.entries(APP_CONFIG.virtual || {}).forEach(([id,vc])=>{
    const node = [...$$('.room .tile')].find(n=>n.querySelector('.label')?.textContent===vc.label);
    if(node){
      const val = pick(model, vc.path);
      node.querySelector('.value').textContent = (val==null || val==='') ? '—' : String(val).slice(0,16);
    }
  });

  // Automazioni — placeholder (quando esponi i log li mettiamo qui)
  $('#log').innerHTML = `<div class="row"><div class="name">Nessun evento</div>
                         <div class="muted">Aggiungi endpoint log</div></div>`;
}

// Bootstrap
renderSkeleton();
bindActions();
loadState();
setInterval(loadState, APP_CONFIG.pollMs);

/* Helpers */
const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);
const pick = (o,p)=>p.split('.').reduce((x,k)=>(x && x[k]!==undefined)?x[k]:undefined,o);
const withQS = (base, qs) => base + (base.includes('?')?'&':'?') + qs;

/* ---------- BUILD FAVORITES ---------- */
function renderFavorites(){
  const tiles = APP_CONFIG.tiles || [];
  // Ordine preferiti: se definito, altrimenti prendi switch/scene
  const favIds = (APP_CONFIG.favorites && APP_CONFIG.favorites.length)
    ? APP_CONFIG.favorites
    : tiles.filter(t => t.type==='switch' || t.type==='scene').map(t => t.id);

  const byId = new Map(tiles.map(t => [t.id,t]));
  $('#favoritesGrid').innerHTML = favIds.map(id=>{
    const t = byId.get(id); if(!t) return '';
    return `
      <article class="tile click" data-id="${t.id}" data-type="${t.type}">
        <div class="device-ico">
          <svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M7 7h10v2H7V7Zm0 4h10v2H7v-2Zm0 4h6v2H7v-2Z"/></svg>
        </div>
        <button class="edit-btn" title="Modifica">
          <svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41L18.37 3.3a1 1 0 0 0-1.41 0L15 5.25l3.75 3.75 1.96-1.96z"/></svg>
        </button>
        <div class="title">${t.label}</div>
        <div class="state">—</div>
      </article>
    `;
  }).join('');
}

/* ---------- BIND CLICKS ---------- */
function bindActions(){
  $('#favoritesGrid').addEventListener('click', async ev=>{
    const card = ev.target.closest('.tile'); if(!card) return;
    const id = card.dataset.id;
    const t = (APP_CONFIG.tiles||[]).find(x=>x.id===id);
    if(!t) return;
    if(t.type==='switch'){
      const isOn = card.classList.contains('on');
      const url = withQS(APP_CONFIG.endpoint, isOn ? t.off.url : t.on.url);
      try{ await fetch(url,{method:'GET',mode:'no-cors'}); }catch(_){}
    }
    if(t.type==='scene'){
      const url = withQS(APP_CONFIG.endpoint, t.action.url);
      try{ await fetch(url,{method:'GET',mode:'no-cors'}); }catch(_){}
    }
  });
}

/* ---------- STATE LOAD ---------- */
async function loadState(){
  try{
    const model = await jsonp(APP_CONFIG.endpoint, APP_CONFIG.jsonpCallbackParam || 'callback');
    apply(model);
    $('#ts').textContent = 'Aggiornamento: ' + new Date().toLocaleTimeString();
  }catch(e){
    $('#ts').textContent = 'Errore di connessione';
  }
}

/* ---------- APPLY UI ---------- */
function apply(m){
  // Top: nome casa
  $('#homeName').textContent = APP_CONFIG.title || 'Casa';

  // Weather pill
  const temp = pick(m, APP_CONFIG.paths?.weatherTemp || 'weather.tempC');
  if(temp != null) $('#weatherTemp').textContent = `${Math.round(temp)} °C`;

  // Dashboard values
  const offline = pick(m, APP_CONFIG.paths?.offlineCount || 'devicesOfflineCount');
  if(offline != null) $('#offlineCount').textContent = offline;

  const kwh = pick(m, APP_CONFIG.paths?.energyKwh || 'energy.kwh');
  if(kwh != null) $('#energyKwh').textContent = Number(kwh).toFixed(2);

  // Favorite tiles state
  (APP_CONFIG.tiles||[]).forEach(t=>{
    const el = document.querySelector(`.tile[data-id="${t.id}"]`);
    if(!el) return;
    if(t.type==='switch'){
      const on = !!pick(m, t.path);
      el.classList.toggle('on', on); // solo stile “attivo” (outline azzurro già nel CSS generale)
      el.querySelector('.state').textContent = on ? 'Acceso' : 'Spento';
    }else if(t.type==='sensor'){
      const v = pick(m, t.path);
      el.querySelector('.state').textContent = t.format ? t.format(v) : (v ?? '—');
    }else if(t.type==='scene'){
      el.querySelector('.state').textContent = 'Esegui';
    }
  });
}

/* ---------- TABS (solo navigazione, estetica identica) ---------- */
function initTabs(){
  $('.tabbar').addEventListener('click', ev=>{
    const tab = ev.target.closest('.tab'); if(!tab) return;
    const target = tab.dataset.target;
    $$('.tab').forEach(b=>b.classList.toggle('active', b===tab));
    $$('.view').forEach(v=>v.classList.remove('active'));
    const view = document.getElementById(`view-${target}`);
    if(view) view.classList.add('active');
  });
}

/* ---------- BOOT ---------- */
renderFavorites();
bindActions();
initTabs();
loadState();
setInterval(loadState, APP_CONFIG.pollMs || 10000);
``

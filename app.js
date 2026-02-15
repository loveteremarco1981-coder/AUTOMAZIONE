/* Utils */
const $  = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);
const pick = (o,p)=>p.split('.').reduce((x,k)=>(x && x[k]!==undefined)?x[k]:undefined,o);
const qsa = (base, qs) => base + (base.includes('?')?'&':'?') + qs;

/* Fallback: primo path valido */
const first = (model, paths, map)=> {
  for(const p of paths){
    const v = p==='__SELF__' ? model : pick(model,p);
    if(v!==undefined && v!==null) return map ? map(v) : v;
  }
  return undefined;
};

/* ---------- SKELETON ---------- */
function renderSkeleton(){
  $('#homeName').textContent = APP_CONFIG.title || 'Casa';

  // Favorites: ordine identico a ciò che vuoi vedere
  const tilesMap = new Map((APP_CONFIG.tiles||[]).map(t => [t.id, t]));
  const favIds = (APP_CONFIG.favorites && APP_CONFIG.favorites.length)
    ? APP_CONFIG.favorites
    : (APP_CONFIG.tiles||[]).map(t=>t.id);

  $('#favoritesGrid').innerHTML = favIds.map(id => {
    const t = tilesMap.get(id); if(!t) return '';
    return `
      <article class="tile ${t.type}" data-id="${t.id}">
        <div class="t-head">
          <div class="t-icon">
            <svg viewBox="0 0 24 24" width="18" height="18">
              <path fill="currentColor" d="M7 7h10v2H7V7zm0 4h10v2H7v-2zm0 4h6v2H7v-2z"/>
            </svg>
          </div>
          <div>
            <div class="t-title">${t.label}</div>
            ${t.subtitle ? `<div class="t-sub">${t.subtitle}</div>` : ``}
          </div>
        </div>
        <div class="t-value">${t.type==='switch' ? 'Spento' : (t.type==='scene' ? 'Esegui' : '—')}</div>
      </article>`;
  }).join('');
}

/* ---------- TAB BAR ---------- */
function initTabbar(){
  $('.tabbar').addEventListener('click', ev=>{
    const btn = ev.target.closest('.tab'); if(!btn) return;
    const target = btn.dataset.target;
    $$('.tab').forEach(b=>b.classList.toggle('active', b===btn));
    $$('.view').forEach(v=>v.classList.remove('active'));
    $(`#view-${target}`).classList.add('active');
    if(target==='devices') loadDevices();
    if(target==='routine') loadFlows();
  });

  // Menu -> navigazione rapida
  $('#view-menu').addEventListener('click', e=>{
    const m = e.target.closest('.menu-btn'); if(!m) return;
    const target = m.dataset.target;
    if(target) document.querySelector(`.tab[data-target="${target}"]`)?.click();
  });

  // Badge dots da config
  applyBadges();
}

/* ---------- TILE ACTIONS ---------- */
function bindTileActions(){
  (APP_CONFIG.tiles||[]).forEach(t=>{
    const el = document.querySelector(`.tile[data-id="${t.id}"]`);
    if(!el || el.dataset.bound) return;

    if(t.type==='switch'){
      el.onclick = async ()=>{
        const isOn = el.classList.contains('on');
        const url = qsa(APP_CONFIG.endpoint, isOn ? t.off.url : t.on.url);
        try{ await fetch(url,{method:'GET',mode:'no-cors'});}catch(e){}
      };
    }
    if(t.type==='scene'){
      el.onclick = async ()=>{
        if(t.action?.confirm && !confirm(t.action.confirm)) return;
        const url = qsa(APP_CONFIG.endpoint, t.action.url);
        try{ await fetch(url,{method:'GET',mode:'no-cors'});}catch(e){}
      };
    }

    el.dataset.bound='1';
  });
}

/* ---------- STATE LOAD ---------- */
async function loadState(){
  try{
    const model = await jsonp(APP_CONFIG.endpoint, APP_CONFIG.jsonpCallbackParam || 'callback');
    applyState(model);
    $('#ts').textContent = 'Aggiornamento: ' + new Date().toLocaleTimeString();
  }catch(e){
    $('#ts').textPerfetto Marco—lo faccio **identico all’interfaccia dello screenshot**, ma mantenendo le funzioni che ti servono (meteo, stato casa, preferiti, Log errori, Automazioni).  
Ho rifinito i dettagli visivi (gradient, card “pill” scure in un contenitore, card “Preferiti” azzurre, tab bar a 5 voci **Home / Dispositivi / Life / Routine / Menu** con i pallini arancioni).  

> 🔧 Nota: per coerenza con ciò che avevamo fatto, ho mappato:
> - **Life** ➜ vista **Automazioni** (scene/flow eseguibili)
> - **Routine** ➜ vista **Log** (errori delle automazioni, da `?logs=1`)
> - **Menu** contiene accessi rapidi a entrambe.  
> Così l’aspetto è *identico*, ma non perdi le funzioni richieste.

Di seguito i **3 file completi** da sostituire nel repo.

---

## `index.html` (SOSTITUISCI TUTTO)

```html
<!doctype html>
<html lang="it">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>Casa · Dashboard</title>
  <link rel="stylesheet" href="style.css"/>
</head>
<body>

  <!-- ===== TOP BAR (identica) ===== -->
  <header class="topbar">
    <div class="left">
      <div class="home-title">
        <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 3 2 12h3v9h6v-6h2v6h6v-9h3z"/></svg>
        <button class="title-btn" aria-label="Apri selezione casa">
          <span id="homeName">Casa</span>
          <svg class="chev" width="16" height="16" viewBox="0 0 24 24"><path fill="currentColor" d="M7 10l5 5 5-5z"/></svg>
        </button>
      </div>

      <!-- stato casa (pillole) -->
      <div id="statePills" class="state-pills"></div>
    </div>

    <div class="right">
      <button class="icon-btn" title="Notifiche" aria-label="Notifiche">
        <svg viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M12 2a6 6 0 0 0-6 6v4.3l-1.7 3.3A1 1 0 0 0 5.2 17H19a1 1 0 0 0 .9-1.5L18 12.3V8a6 6 0 0 0-6-6zM8 19a4 4 0 0 0 8 0"/></svg>
      </button>
      <button class="icon-btn" title="Nuovo">
        <svg viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M11 11V5h2v6h6v2h-6v6h-2v-6H5v-2z"/></svg>
      </button>
      <button class="icon-btn" title="Altro">
        <svg viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M12 7a2 2 0 110-4 2 2 0 010 4zm0 7a2 2 0 110-4 2 2 0 010 4zm0 7a2 2 0 110-4 2 2 0 010 4z"/></svg>
      </button>

      <!-- meteo: pill nera con puntino giallo e °C -->
      <div id="weatherChip" class="weather-chip" title="Meteo">
        <span class="dot-yellow"></span>
        <span id="weatherTemp">— °C</span>
      </div>
    </div>
  </header>

  <main>

    <!-- ===== VIEW: HOME ===== -->
    <section id="view-home" class="view active">

      <h3 class="section-label">Dashboard</h3>

      <!-- contenitore scuro con due pill-card -->
      <div class="dash-shell">
        <article class="pill-card" id="pill-offline">
          <div class="pill-icon">
            <svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M12 3 1 9l11 6 9-5.1V17h2V9L12 3zM3 13v6h8v-3L3 10v3z"/></svg>
          </div>
          <div class="pill-body">
            <div class="pill-title muted">Offline</div>
            <div class="pill-value"><span id="offlineCount">—</span> dispositivi</div>
          </div>
        </article>

        <article class="pill-card" id="pill-energy">
          <div class="pill-icon energy">
            <svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M11 21l6-10h-4l2-8-8 12h4z"/></svg>
          </div>
          <div class="pill-body">
            <div class="pill-title muted">Energy</div>
            <div class="pill-value"><span id="energyKwh">—</span> kWh</div>
          </div>
        </article>
      </div>

      <h3 class="section-label">Preferiti</h3>
      <section id="favoritesGrid" class="favorites-grid"><!-- tiles generate JS --></section>

      <div class="provider-row">
        <div class="provider" id="weatherProvider">The Weather Channel</div>
        <div class="updated muted" id="ts">Aggiornamento: —:—</div>
      </div>
    </section>

    <!-- ===== VIEW: DISPOSITIVI ===== -->
    <section id="view-devices" class="view">
      <h3 class="section-label">Dispositivi</h3>
      <div id="devicesList" class="list"></div>
      <div id="devicesEmpty" class="muted"></div>
    </section>

    <!-- ===== VIEW: LIFE (Automazioni) ===== -->
    <section id="view-life" class="view">
      <h3 class="section-label">Life</h3>
      <div id="flowsList" class="list"></div>
      <div id="flowsEmpty" class="muted"></div>
    </section>

    <!-- ===== VIEW: ROUTINE (Log) ===== -->
    <section id="view-routine" class="view">
      <div class="row-head">
        <h3 class="section-label">Routine</h3>
        <button id="btnRefreshLog" class="pill-btn">
          <svg width="18" height="18" viewBox="0 0 24 24"><path d="M21 12a9 9 0 1 1-3.5-7.1" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/><path d="M21 4v6h-6" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>
          Aggiorna
        </button>
      </div>
      <div id="log" class="list"></div>
      <div id="logEmpty" class="muted"></div>
    </section>

    <!-- ===== VIEW: MENU ===== -->
    <section id="view-menu" class="view">
      <h3 class="section-label">Menu</h3>
      <div class="menu-grid">
        <button class="menu-btn" data-target="home">Home</button>
        <button class="menu-btn" data-target="devices">Dispositivi</button>
        <button class="menu-btn" data-target="life">Life (Automazioni)</button>
        <button class="menu-btn" data-target="routine">Routine (Log errori)</button>
      </div>
    </section>

  </main>

  <!-- ===== TAB BAR (identica) ===== -->
  <footer class="tabbar">
    <button class="tab active" data-target="home" title="Home">
      <svg viewBox="0 0 24 24" width="22" height="22"><path fill="currentColor" d="M12 3 3 10v11h6v-6h6v6h6V10z"/></svg>
      <span>Home</span>
    </button>
    <button class="tab" data-target="devices" title="Dispositivi">
      <svg viewBox="0 0 24 24" width="22" height="22"><path fill="currentColor" d="M3 5h18v6H3V5zm0 8h8v6H3v-6zm10 0h8v6h-8v-6z"/></svg>
      <span>Dispositivi</span>
    </button>
    <button class="tab dot" data-target="life" title="Life">
      <svg viewBox="0 0 24 24" width="22" height="22"><path fill="currentColor" d="M5 4h14a2 2 0 0 1 2 2v12l-4-3H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"/></svg>
      <span>Life</span>
    </button>
    <button class="tab" data-target="routine" title="Routine">
      <svg viewBox="0 0 24 24" width="22" height="22"><path fill="currentColor" d="M8 5v14l11-7z"/></svg>
      <span>Routine</span>
      <i class="orange-dot"></i>
    </button>
    <button class="tab" data-target="menu" title="Menu">
      <svg viewBox="0 0 24 24" width="22" height="22"><path fill="currentColor" d="M3 6h18v2H3zm0 5h18v2H3zm0 5h18v2H3z"/></svg>
      <span>Menu</span>
      <i class="orange-dot"></i>
    </button>
  </footer>

  <!-- Scripts -->
  <script src="config.js"></script>
  <script src="jsonp.js"></script>
  <script src="app.js"></script>
</body>
</html>

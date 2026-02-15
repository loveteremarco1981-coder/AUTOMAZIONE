// app.js
(function(){
  const WEBAPP_URL = window.DASH.WEBAPP_URL;
  const REFRESH_MS = window.DASH.REFRESH_MS;
  const UNIT_KEY   = window.DASH.UNIT_KEY;

  // ---------- utils ----------
  const qs  = sel => document.querySelector(sel);
  const qsa = sel => Array.from(document.querySelectorAll(sel));

  function toNum(val){
    if (typeof val === 'number') return val;
    const s = String(val||'').replace(',', '.').replace(/[^\d.\-]/g,'').trim();
    const n = Number(s); return isFinite(n) ? n : null;
  }
  function cToF(c){ return c==null ? null : (c*9/5 + 32); }
  function fmtTemp(n, unit){
    if (n==null || !isFinite(n)) return '— °'+unit;
    const v = (unit==='F') ? cToF(n) : n;
    return Math.round(v) + '°' + unit;
  }
  function wmoEmoji(code){
    const m = {
      '0':'☀️','1':'🌤️','2':'⛅','3':'☁️',
      '45':'🌫️','48':'🌫️',
      '51':'🌦️','53':'🌦️','55':'🌦️',
      '61':'🌧️','63':'🌧️','65':'🌧️',
      '66':'🌧️❄️','67':'🌧️❄️',
      '71':'🌨️','73':'🌨️','75':'🌨️',
      '77':'❄️',
      '80':'🌦️','81':'🌧️','82':'⛈️',
      '85':'❄️','86':'❄️',
      '95':'⛈️','96':'⛈️','99':'⛈️'
    };
    return m[String(code)] || '⛅';
  }

  async function loadModel(){
    return await JSONP_FETCH.getJSON(WEBAPP_URL + '?t=' + Date.now());
  }
  async function loadLogs(){
    return await JSONP_FETCH.getJSON(WEBAPP_URL + '?logs=1&t=' + Date.now());
  }

  // ---------- render ----------
  function renderModel(model){
    const unit = (localStorage.getItem(UNIT_KEY)||'C').toUpperCase();

    // Meteo
    const w   = model.weather || {};
    const elT = qs('[data-weather-temp]');
    const elI = qs('[data-weather-emoji]');
    const elP = qs('[data-weather-provider]');

    if (elT) elT.textContent = fmtTemp(w.tempC, unit);
    if (elI) elI.textContent = wmoEmoji(w.icon);
    if (elP) elP.textContent = (w.provider||'').replace('Open‑','Open-');

    // Ultimo aggiornamento
    const elTs = qs('[data-last-update]');
    const nowIso = model.meta && model.meta.nowIso ? new Date(model.meta.nowIso) : new Date();
    if (elTs){
      const hh = String(nowIso.getHours()).padStart(2,'0');
      const mm = String(nowIso.getMinutes()).padStart(2,'0');
      const ss = String(nowIso.getSeconds()).padStart(2,'0');
      elTs.textContent = `${hh}:${mm}:${ss}`;
    }

    // People
    const people = Array.isArray(model.people) ? model.people : [];
    const online = people.filter(p => p.onlineSmart || p.onlineRaw).length;
    const elPSum = qs('[data-people-summary]');
    if (elPSum) elPSum.textContent = `${people.length} · ${online>0 ? 'Casa occupata' : 'Casa vuota'}`;

    const elPList = qs('[data-people-list]');
    if (elPList){
      elPList.innerHTML = '';
      people.forEach(p=>{
        const div = document.createElement('div');
        div.textContent = `${p.name} · ${(p.onlineSmart||p.onlineRaw) ? 'IN CASA':'OUT'}`;
        elPList.appendChild(div);
      });
    }

    // Energy
    const kwh = model.energy && model.energy.kwh;
    const elK = qs('[data-energy-kwh]');
    if (elK) elK.textContent = (kwh==null || !isFinite(kwh)) ? '— kWh' : `${kwh.toFixed(1)} kWh`;

    // Devices offline
    const off = (model.devicesOfflineCount==null?0:model.devicesOfflineCount);
    const elOff = qs('[data-devices-offline]');
    if (elOff) elOff.textContent = off;

    // Badge errori log
    const errs = model.alerts && model.alerts.logErrors || 0;
    const elBadge = qs('[data-log-badge]');
    if (elBadge){
      elBadge.textContent = errs>0 ? String(errs) : '';
      elBadge.style.display = errs>0 ? '' : 'none';
    }
  }

  // ---------- azioni (Preferiti/VIMAR) ----------
  async function callAdmin(eventName, extra={}){
    const params = new URLSearchParams({ admin:'1', event:eventName, t: Date.now() });
    Object.entries(extra).forEach(([k,v]) => params.set(k, v));
    const url = WEBAPP_URL + '?' + params.toString();
    return await JSONP_FETCH.getJSON(url);
  }

  function bindAdmin(){
    // Preferiti base
    qsa('[data-admin]').forEach(btn=>{
      btn.addEventListener('click', async ()=>{
        const evt = btn.getAttribute('data-admin');
        const val = btn.getAttribute('data-value');
        try{
          const payload = {}; if (val!=null) payload.value = String(val);
          await callAdmin(evt, payload);
          console.log('OK:', evt, payload);
          await refreshOnce(); // aggiorna UI dopo comando
        }catch(e){ console.error('Admin ERR', e); }
      });
    });
    // VIMAR opzionale
    qsa('[data-vimar]').forEach(btn=>{
      btn.addEventListener('click', async ()=>{
        const type = btn.getAttribute('data-vimar'); // shutter|thermo|hvac
        const id   = btn.getAttribute('data-id');
        const cmd  = btn.getAttribute('data-cmd') || btn.getAttribute('data-op');
        try{
          if (type==='shutter')      await callAdmin('vimar_shutter', { id, cmd });
          else if (type==='thermo')  await callAdmin('vimar_thermo',  { id, op: cmd });
          else if (type==='hvac')    await callAdmin('vimar_hvac',    { id, op: cmd });
          console.log('VIMAR OK:', type, id, cmd);
        }catch(e){ console.error('VIMAR ERR', e); }
      });
    });
  }

  // ---------- init & refresh ----------
  async function refreshOnce(){
    const model = await loadModel();
    renderModel(model);
  }

  function bindUnitToggle(){
    const elT = qs('[data-weather-temp]');
    if (!elT) return;
    elT.style.cursor = 'pointer';
    elT.title = 'Clic per cambiare unità °C/°F';
    elT.addEventListener('click', ()=>{
      const cur = (localStorage.getItem(UNIT_KEY)||'C').toUpperCase();
      const next = (cur==='C') ? 'F' : 'C';
      localStorage.setItem(UNIT_KEY, next);
      refreshOnce();
    });
  }

  function init(){
    if (!localStorage.getItem(UNIT_KEY)) localStorage.setItem(UNIT_KEY, 'C');
    bindAdmin();
    bindUnitToggle();
    refreshOnce();
    setInterval(refreshOnce, REFRESH_MS);
  }

  document.addEventListener('DOMContentLoaded', init);
})();

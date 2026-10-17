'use strict';

/* ============================================================
   RENDER
   ============================================================ */

function renderBanner(m) {
  const el = $('#state-banner'); if (!el) return;
  const st = String(m.state || '').toUpperCase();
  const map = { COMFY_DAY: 'sb-comfy-day', COMFY_NIGHT: 'sb-comfy-night', SECURITY_DAY: 'sb-security-day', SECURITY_NIGHT: 'sb-security-night' };
  const icon = { COMFY_DAY: 'sun', COMFY_NIGHT: 'moon', SECURITY_DAY: 'shield', SECURITY_NIGHT: 'shield' }[st] || 'home';
  el.className = 'state-banner ' + (map[st] || 'sb-security-day');

  const isSecurity = st.startsWith('SECURITY');
  const isNight = st.endsWith('NIGHT');
  const title = isSecurity ? 'Sicurezza' : (map[st] ? 'Comfort' : cap(st.toLowerCase().replace(/_/g, ' ')) || '—');
  // Stessa logica con cui l'app mostra lo stato delle telecamere nei Dispositivi
  const estOn = isSecurity || st === 'COMFY_NIGHT';
  const cams = isSecurity ? 'cam interne ed esterne attive' : estOn ? 'cam esterne attive' : 'cam spente';
  const sub = map[st] ? `${isNight ? 'Notte' : 'Giorno'} · ${cams}` : '';

  // Prossimo evento solare (alba o tramonto) ancora da venire
  const nx = m.next || {};
  const now = Date.now();
  const upcoming = [['Alba', nx.alba], ['Tramonto', nx.tramonto]]
    .map(([l, v]) => [l, v ? new Date(v) : null])
    .filter(([, d]) => d && !isNaN(d.getTime()) && d.getTime() > now)
    .sort((x, y) => x[1] - y[1])[0];

  el.innerHTML = `
    <span class="sb-ico">${svg(icon)}</span>
    <span class="sb-text">
      <span class="sb-title">${esc(title)}</span>
      ${sub ? `<span class="sb-sub">${esc(sub)}</span>` : ''}
    </span>
    ${upcoming ? `<span class="sb-next">${upcoming[0]} ${fmtTime(upcoming[1].toISOString())}</span>` : ''}
    <span class="sb-chev">${svg('chevron')}</span>`;
}

function renderCards(m) {
  const people = Array.isArray(m.people) ? m.people : [];
  const inCount = people.filter(p => p.onlineSmart).length;
  const el = $('#people-count'); if (el) el.textContent = inCount;
  const card = $('#card-presence'); if (card) card.classList.toggle('card-glow', inCount > 0);
}

function renderWeather(w) {
  if (!w) return;
  _wx = w;
  const tv = $('#temp-val'); if (tv && w.tempC != null)    tv.textContent = Math.round(w.tempC);
  const hv = $('#hum-val');  if (hv && w.humidity != null) hv.textContent = Math.round(w.humidity);
  const wv = $('#wind-val'); if (wv && w.windKmh != null)  wv.textContent = Math.round(w.windKmh);
  const pi = $('#weather-icon');
  const pt = $('#weather-pill-temp');
  if (pi) pi.innerHTML = weatherIcon(w.icon);
  if (pt) pt.textContent = w.tempC != null ? Math.round(w.tempC) + '°' : '—';
  updateHero();
}

function favGlyph(id) {
  return ({ tapparelle: 'icons/st/glyph-shutter.svg', piante: 'icons/st/glyph-plant.svg', vacanza: 'icons/st/glyph-suit.svg', override: 'icons/st/glyph-moon.svg' })[id] || 'icons/st/glyph-generic.svg';
}

function renderFavorites(m) {
  const grid = $('#fav-grid'); if (!grid) return;
  grid.innerHTML = '';

  (CONFIG.FAVORITES || []).forEach(f => {
    let isOn = false;
    if (f.id === 'tapparelle')      isOn = getShuttersUp();
    else if (f.id === 'vacanza')    isOn = !!m.vacanza;
    else if (f.id === 'override')   isOn = !!m.override;
    else if (f.stateKey)            isOn = !!m[f.stateKey];

    const isToggle = f.id === 'tapparelle' || f.kind === 'toggle';
    const statusText = f.id === 'tapparelle' ? (isOn ? 'Aperte' : 'Chiuse')
                     : f.kind === 'toggle'   ? (isOn ? 'Attivo' : 'Disattivo')
                     : f.kind === 'action'   ? 'Avvia' : '';

    const card = document.createElement('article');
    card.className = 'fav-card' + (isOn ? ' active' : '');
    card.style.setProperty('--fc', f.color || '#58a6ff');
    card.dataset.kind = f.kind || (f.id === 'tapparelle' ? 'toggle' : 'action');
    card.tabIndex = 0;
    card.setAttribute('role', 'button');
    if (isToggle) card.setAttribute('aria-pressed', String(isOn));
    card.setAttribute('aria-label', f.label || 'Azione');
    card.innerHTML = `
      <div class="fav-glyph" style="background:${esc(f.color || '#f0f0f0')}"><img src="${favGlyph(f.id)}" alt=""></div>
      <span class="fav-action" aria-hidden="true">${svg(f.kind === 'action' ? 'play' : 'power')}</span>
      <div class="fav-label">${esc(f.label)}</div>
      <div class="fav-sub">${esc(f.subtitle || '')}</div>
      ${statusText ? `<div class="fav-status">${statusText}</div>` : ''}`;

    const doAction = async () => {
      haptic();
      if (f.id === 'tapparelle') {
        const next = !isOn;
        toast(next ? 'Alzo le tapparelle…' : 'Abbasso le tapparelle…');
        const r = await callAdmin(next ? (f.upEvent || 'alza_tutto') : (f.downEvent || 'abbassa_tutto'), { manual: 'TRUE' });
        if (r && r.ok !== false) { setShuttersUp(next); markShutters(next ? 'up' : 'down'); }
        reloadSoon(800);
      } else if (f.id === 'vacanza') {
        const next = !isOn; toast(next ? 'Modalità vacanza attiva' : 'Modalità vacanza disattivata');
        await callAdmin('set_vacanza', { value: String(next) }); reloadSoon(500);
      } else if (f.id === 'override') {
        const next = !isOn; toast(next ? 'Override attivo' : 'Override disattivato');
        await callAdmin('set_override', { value: String(next) }); reloadSoon(500);
      } else if (f.kind === 'toggle' && f.toggleEvent) {
        const next = !isOn; toast(`${f.label}: ${next ? 'attivo' : 'disattivo'}`);
        await callAdmin(f.toggleEvent, { value: String(next) }); reloadSoon(500);
      } else if (f.kind === 'action' && f.event) {
        toast(`${f.label} in corso…`);
        await callAdmin(f.event);
      }
    };

    const trigger = () => {
      card.classList.remove('pulse'); void card.offsetWidth; card.classList.add('pulse');   // onda di colore al tocco
      setTimeout(() => card.classList.remove('pulse'), 650);
      busy(card, doAction);
    };
    card.addEventListener('click', trigger);
    card.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); trigger(); }
    });
    grid.appendChild(card);
  });
}

function renderPeopleChips(m) {
  const host = $('#people-chips'); if (!host) return;
  host.innerHTML = '';
  const people = Array.isArray(m.people) ? m.people : [];
  if (!people.length) { host.innerHTML = '<div class="empty-state">Nessuna persona configurata.</div>'; return; }

  const sorted = [...people].sort((a, b) => {
    if (a.onlineSmart !== b.onlineSmart) return a.onlineSmart ? -1 : 1;
    return String(a.name).localeCompare(String(b.name), 'it');
  });
  const inN = sorted.filter(p => p.onlineSmart).length;

  const head = document.createElement('div');
  head.className = 'fam-head';
  head.innerHTML = `
    <span class="fam-count"><b>${inN}</b> su ${sorted.length} in casa</span>
    <span class="fam-pips" aria-hidden="true">${sorted.map(p => `<i class="${p.onlineSmart ? 'on' : ''}"></i>`).join('')}</span>`;
  host.appendChild(head);

  const row = document.createElement('div');
  row.className = 'fam-row';
  host.appendChild(row);

  sorted.forEach((p, idx) => {
    const st = p.onlineSmart ? 'in' : 'out';
    const ini = String(p.name || '?').charAt(0).toUpperCase();
    const t = /(\d{1,2}:\d{2})/.exec(String(p.lastSeen || ''));
    const wifi = p.wifiOnline ? 'Wi‑Fi connesso' : 'Wi‑Fi non connesso';

    const b = document.createElement('button');
    b.type = 'button';
    b.className = `fam-person ${st}`;
    b.style.setProperty('--i', idx);
    b.setAttribute('aria-label', `${cap(p.name)}, ${p.onlineSmart ? 'in casa' : 'fuori'}, ${wifi}`);
    b.innerHTML = `
      <span class="fam-avatar ${avClass(p.name)}">${esc(ini)}<span class="fam-dot ${p.wifiOnline ? 'on' : ''}"></span></span>
      <span class="fam-name">${esc(cap(p.name))}</span>
      <span class="fam-state">${p.onlineSmart ? 'In casa' : 'Fuori'}</span>
      ${t ? `<span class="fam-time">dalle ${t[1]}</span>` : ''}`;
    b.addEventListener('click', () => { haptic(); activateTab('people'); });
    row.appendChild(b);
  });
}

function renderEvents(m) {
  const list = $('#events-list'); if (!list) return;
  list.innerHTML = '';
  const nx = m.next || {};

  const rows = [
    ['Alba',              nx.alba ? fmtTime(nx.alba) : null],
    ['Tramonto',          nx.tramonto ? fmtTime(nx.tramonto) : null],
    ['Apre tapparelle',   nx.shuttersOpenTime || null],
    ['Chiude tapparelle', nx.shuttersCloseTime || null],
  ].filter(r => r[1] && r[1] !== '—');

  if (!rows.length) { list.innerHTML = '<div class="empty-state">Nessun evento in programma.</div>'; return; }

  // Ordina per orario e mette in evidenza il prossimo (se tutti gli orari sono leggibili)
  const toMin = s => { const t = /(\d{1,2}):(\d{2})/.exec(String(s)); return t ? (+t[1]) * 60 + (+t[2]) : null; };
  // Mostra solo ore e minuti (lo script a volte manda data e secondi: "14/10/2026 09:43:14")
  const hm = s => { const t = /(\d{1,2}):(\d{2})/.exec(String(s)); return t ? t[1].padStart(2, '0') + ':' + t[2] : String(s); };
  const items = rows.map(([label, val]) => ({ label, val: hm(val), min: toMin(val) }));
  let nextIdx = -1;
  if (items.every(i => i.min !== null)) {
    items.sort((x, y) => x.min - y.min);
    const d = new Date(), nowMin = d.getHours() * 60 + d.getMinutes();
    nextIdx = items.findIndex(i => i.min > nowMin);
    if (nextIdx === -1) nextIdx = 0; // tutti già passati: il primo di domani
  }

  items.forEach((it, i) => {
    const row = document.createElement('div');
    row.className = 'event-row' + (i === nextIdx ? ' next' : '');
    row.innerHTML = `<span class="event-label">${esc(it.label)}</span><span class="event-val">${esc(it.val)}</span>`;
    list.appendChild(row);
  });
}

/* ---- Dispositivi ---- */
function renderDevices(m) {
  const DEV = CONFIG.DEVICES || {};

  /* App collegate (costruite una sola volta) */
  const appLinks = $('#app-links');
  if (appLinks && !appLinks.dataset.built) {
    appLinks.innerHTML = '';
    (DEV.APPS || []).forEach(app => {
      const card = document.createElement('a');
      card.className = 'app-link-card';
      card.href = '#';
      card.innerHTML = `
        <div class="app-link-icon" style="background:${esc(app.color || '#f0f0f0')}">${iconFromEmoji(app.icon || '📱', 'phone')}</div>
        <div class="app-link-info">
          <div class="app-link-name">${esc(app.label)}</div>
          <div class="app-link-sub">${esc(app.subtitle || '')}</div>
        </div>
        <span class="app-link-arrow">${svg('chevron')}</span>`;
      card.addEventListener('click', e => {
        e.preventDefault();
        const fallback = app.urlFallback || app.url;
        const t = setTimeout(() => { window.location.href = fallback; }, 2000);
        window.location.href = app.url;
        document.addEventListener('visibilitychange', function cancel() {
          if (document.hidden) { clearTimeout(t); document.removeEventListener('visibilitychange', cancel); }
        });
      });
      appLinks.appendChild(card);
    });
    appLinks.dataset.built = '1';
  }

  /* Tapparelle (costruite una sola volta) */
  const shutterList = $('#shutter-list');
  if (shutterList && !shutterList.dataset.built) {
    shutterList.innerHTML = '';
    (DEV.SHUTTERS || []).forEach(sh => {
      const card = document.createElement('div');
      card.className = 'shutter-card';
      card.innerHTML = `
        <span class="dev-icon t-blue">${iconFromEmoji(sh.icon || '🪟', 'shutter')}</span>
        <span class="shutter-text">
          <span class="shutter-label">${esc(sh.label)}</span>
          <span class="shutter-sub" data-label="${esc(sh.label)}"></span>
        </span>
        <div class="shutter-btns">
          <button class="sh-btn" type="button" data-ev="${esc(sh.upEvent)}"   title="Alza"     aria-label="Alza ${esc(sh.label)}">${svg('up')}</button>
          <button class="sh-btn" type="button" data-ev="${esc(sh.downEvent)}" title="Abbassa" aria-label="Abbassa ${esc(sh.label)}">${svg('down')}</button>
        </div>`;
      card.querySelectorAll('.sh-btn').forEach(b => {
        b.addEventListener('click', () => busy(b, async () => {
          haptic();
          const up = b.dataset.ev.startsWith('alza');
          const icon = card.querySelector('.dev-icon');
          icon.classList.add('moving');
          toast(`${up ? 'Alzo' : 'Abbasso'} ${sh.label}…`);
          const r = await callAdmin(b.dataset.ev, { manual: 'TRUE' });
          setTimeout(() => icon.classList.remove('moving'), 1800);
          if (r && r.ok !== false) {
            markShutters(up ? 'up' : 'down', /tutt/i.test(sh.label) ? 'ALL' : sh.label);
            if (/tutt/i.test(sh.label)) setShuttersUp(up);
          }
        }));
      });
      shutterList.appendChild(card);
    });
    shutterList.dataset.built = '1';
  }
  updateShutterSubs();

  /* Termostati (costruiti una sola volta) */
  const thermoList = $('#thermostat-list');
  if (thermoList && !thermoList.dataset.built) {
    thermoList.innerHTML = '';
    (DEV.THERMOSTATS || []).forEach(t => {
      const card = document.createElement('div');
      card.className = 'shutter-card';
      card.innerHTML = `
        <span class="dev-icon t-orange">${iconFromEmoji(t.icon || '🌡️', 'thermo')}</span>
        <span class="shutter-label">${esc(t.label)}</span>
        <div class="shutter-btns">
          <button class="sh-btn" type="button" data-ev="${esc(t.event)}" title="Applica" aria-label="Applica ${esc(t.label)}">${svg('play')}</button>
        </div>`;
      const b = card.querySelector('.sh-btn');
      b.addEventListener('click', () => busy(b, async () => {
        haptic();
        toast(`${t.label} in corso…`);
        await callAdmin(t.event);
      }));
      thermoList.appendChild(card);
    });
    thermoList.dataset.built = '1';
  }

  /* Telecamere */
  const camList = $('#camera-list');
  if (camList) {
    if (!camList.dataset.built) {
      camList.innerHTML = '';
      const groups = [
        { key: 'int', icon: 'camera', label: 'Cam interne' },
        { key: 'est', icon: 'video',  label: 'Cam esterne' },
      ];
      groups.forEach(g => {
        const camOn  = (DEV.CAMERAS || []).find(c => c.id === g.key + '_on');
        const camOff = (DEV.CAMERAS || []).find(c => c.id === g.key + '_off');
        if (!camOn || !camOff) return;

        const card = document.createElement('div');
        card.className = 'shutter-card';
        card.dataset.camKey = g.key;
        card.innerHTML = `
          <span class="dev-icon t-purple">${svg(g.icon)}</span>
          <span class="shutter-text">
            <span class="shutter-label">${g.label}</span>
            <span class="shutter-sub cam-sub"></span>
          </span>
          <div class="seg" role="group" aria-label="${g.label}">
            <button class="seg-btn" type="button" data-ev="${esc(camOn.event)}"  data-state="on">ON</button>
            <button class="seg-btn" type="button" data-ev="${esc(camOff.event)}" data-state="off">OFF</button>
          </div>`;

        card.querySelectorAll('.seg-btn').forEach(btn => {
          btn.addEventListener('click', () => busy(btn, async () => {
            haptic();
            const isOn = btn.dataset.state === 'on';
            toast(`${isOn ? 'Accendo' : 'Spengo'} ${g.label.toLowerCase()}…`);
            setCamButtons(card, isOn); // aggiornamento immediato
            const result = await callAdmin(btn.dataset.ev);
            if (result && result.ok === false) {
              toast('Comando non riuscito' + (result.error ? ': ' + result.error : ''), 'err');
              reloadSoon(500); // ripristina lo stato reale
            } else if (result) {
              toast(`${g.label}: ${isOn ? 'accese' : 'spente'}`, 'ok');
            } else {
              updateCamStates(MODEL || {});   // annullato o non riuscito: torna allo stato reale
            }
          }));
        });
        camList.appendChild(card);
      });
      camList.dataset.built = '1';
    }
    updateCamStates(m);
  }
}

function setCamButtons(card, isOn) {
  const sub = card.querySelector('.cam-sub'); if (sub) sub.textContent = isOn ? 'Attive' : 'Spente';
  card.querySelectorAll('.seg-btn').forEach(b => {
    const active = b.dataset.state === 'on' ? isOn : !isOn;
    b.classList.toggle('is-active', active);
    b.setAttribute('aria-pressed', String(active));
  });
}

function updateCamStates(m) {
  const stato = (m && m.state) ? String(m.state).toUpperCase() : '';
  const stateMap = {
    int: stato.startsWith('SECURITY'),
    est: stato.startsWith('SECURITY') || stato === 'COMFY_NIGHT',
  };
  $$('[data-cam-key]').forEach(card => setCamButtons(card, !!stateMap[card.dataset.camKey]));
}

function renderPeopleDetail(m) {
  const list = $('#people-detail');
  if (list) {
    list.innerHTML = '';
    const people = Array.isArray(m.people) ? m.people : [];
    const sorted = [...people].sort((a, b) => {
      if (a.onlineSmart !== b.onlineSmart) return a.onlineSmart ? -1 : 1;
      return String(a.name).localeCompare(String(b.name), 'it');
    });

    sorted.forEach(p => {
      const st = p.onlineSmart ? 'in' : 'out';
      const ini = String(p.name || '?').charAt(0).toUpperCase();
      const ago = p.lastSeen || '—';
      const wifi = p.wifiOnline ? 'Wi‑Fi connesso' : 'Wi‑Fi non connesso';

      const card = document.createElement('div');
      card.className = 'people-detail-card';
      card.innerHTML = `
        <div class="pdc-top">
          <div class="pdc-avatar ${st} ${avClass(p.name)}">${esc(ini)}</div>
          <div>
            <div class="pdc-name">${esc(cap(p.name))}</div>
            <div class="pdc-state ${st}">${st === 'in' ? 'In casa' : 'Fuori'} · ${esc(ago)}</div>
            <div class="pdc-ssid">${wifi}</div>
          </div>
        </div>
        <div class="pdc-actions">
          <button class="pdc-btn btn-in"  type="button">${svg('check')}Forza in casa</button>
          <button class="pdc-btn btn-out" type="button">${svg('x')}Forza fuori</button>
        </div>`;

      const force = (btn, event, okMsg) => busy(btn, async () => {
        haptic();
        toast(`Aggiorno ${cap(p.name)}…`);
        const r = await callAdmin(event, { name: p.name });
        if (r && r.ok !== false) toast(okMsg, 'ok');
        else if (r) toast('Operazione non riuscita. Riprova tra qualche secondo.', 'err');
        reloadSoon(800);
      });
      const bIn = card.querySelector('.btn-in'), bOut = card.querySelector('.btn-out');
      bIn.addEventListener('click',  () => force(bIn,  'force_in',  `${cap(p.name)} è in casa`));
      bOut.addEventListener('click', () => force(bOut, 'force_out', `${cap(p.name)} è fuori`));
      list.appendChild(card);
    });
  }

  const qa = $('#quick-actions');
  if (qa) {
    qa.innerHTML = '';
    [
      { icon: 'up',      label: 'Alza tutto',      fn: async () => { toast('Alzo le tapparelle…');   const r = await callAdmin('alza_tutto', { manual: 'TRUE' }); if (r && r.ok !== false) { setShuttersUp(true); markShutters('up'); } } },
      { icon: 'down',    label: 'Abbassa tutto',   fn: async () => { toast('Abbasso le tapparelle…'); const r = await callAdmin('abbassa_tutto'); if (r && r.ok !== false) { setShuttersUp(false); markShutters('down'); } } },
      { icon: 'leaf',    label: 'Annaffia piante', fn: async () => { toast('Avvio irrigazione…'); await callAdmin('piante'); } },
      { icon: 'plane',   label: 'Vacanza',         fn: async () => { const next = !MODEL?.vacanza;  toast(next ? 'Modalità vacanza attiva' : 'Modalità vacanza disattivata'); await callAdmin('set_vacanza',  { value: String(next) }); reloadSoon(500); } },
      { icon: 'shield',  label: 'Override',        fn: async () => { const next = !MODEL?.override; toast(next ? 'Override attivo' : 'Override disattivato'); await callAdmin('set_override', { value: String(next) }); reloadSoon(500); } },
      { icon: 'refresh', label: 'Aggiorna dati',   fn: () => loadAll(true) },
    ].forEach(a => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'qa-btn';
      btn.dataset.tone = ({ up: 'blue', down: 'blue', leaf: 'green', plane: 'amber', shield: 'red', refresh: 'purple' })[a.icon] || 'blue';
      btn.innerHTML = `<span class="qa-ico">${svg(a.icon)}</span><span>${a.label}</span>`;
      btn.addEventListener('click', () => busy(btn, async () => { haptic(); await a.fn(); }));
      qa.appendChild(btn);
    });
  }
}

function renderSettings(m) {
  const list = $('#settings-list');
  if (list) {
    list.innerHTML = '';
    const rowHtml = (r, control) => `
      <div class="setting-left">
        <span class="set-ico" data-tone="${r.tone}">${svg(r.icon)}</span>
        <div><div class="setting-label">${r.label}</div><div class="setting-sub">${r.sub}</div></div>
      </div>${control}`;

    [
      { label: 'Escludi tapparelle', sub: 'Blocca solo i movimenti automatici', key: 'shuttersExcluded', event: 'set_shutters_excluded', icon: 'shutter', tone: 'blue' },
      { label: 'Vacanza',            sub: 'Modalità assenza',                   key: 'vacanza',          event: 'set_vacanza',           icon: 'plane',   tone: 'amber' },
      { label: 'Override',           sub: 'Sospendi le automazioni',            key: 'override',         event: 'set_override',          icon: 'shield',  tone: 'red' },
    ].forEach(r => {
      const isOn = !!m[r.key];
      const row = document.createElement('div');
      row.className = 'setting-row';
      row.innerHTML = rowHtml(r, `<label class="toggle-wrap"><input type="checkbox" aria-label="${r.label}" ${isOn ? 'checked' : ''}><span class="toggle-slider"></span></label>`);
      const input = row.querySelector('input');
      input.addEventListener('change', async e => {
        const next = e.target.checked;
        toast(`${r.label}: ${next ? 'attivo' : 'disattivo'}`);
        const res = await callAdmin(r.event, { value: String(next) });
        if (!res) input.checked = !next; // comando non arrivato: ripristina l'interruttore
        else reloadSoon(500);
      });
      list.appendChild(row);
    });

    extraSettingRows(list, rowHtml, m);

    // Chiave di accesso (si cambia solo su questo dispositivo)
    const keyRow = document.createElement('div');
    keyRow.className = 'setting-row';
    keyRow.innerHTML = rowHtml({ label: 'Chiave di accesso', sub: 'Chiesta una sola volta su questo dispositivo', icon: 'lock', tone: 'green' },
      '<button class="small-btn" type="button">Cambia</button>');
    keyRow.querySelector('button').addEventListener('click', () => showLock('', true));
    list.appendChild(keyRow);

    // Forza il ricaricamento dell'app (utile dopo un aggiornamento dei file)
    const upd = document.createElement('div');
    upd.className = 'setting-row';
    upd.innerHTML = rowHtml({ label: 'Aggiorna app', sub: "Scarica l'ultima versione dei file", icon: 'refresh', tone: 'purple' },
      '<button class="small-btn" type="button">Aggiorna</button>');
    upd.querySelector('button').addEventListener('click', forceAppReload);
    list.appendChild(upd);
  }

  const info = $('#info-card');
  if (info) {
    const stato   = cap(String(m.state || '—').toLowerCase().replace(/_/g, ' '));
    const night   = m.notte ? 'Notte' : 'Giorno';
    const alba    = m.next?.alba ? fmtTime(m.next.alba) : '—';
    const tram    = m.next?.tramonto ? fmtTime(m.next.tramonto) : '—';
    const updated = m.meta?.nowIso ? fmtDateTime(m.meta.nowIso) : '—';
    const errors  = (m.alerts && Number(m.alerts.logErrors)) || 0;
    const ssidActive = (Array.isArray(m.people) ? m.people : []).filter(p => p.wifiOnline).map(p => cap(p.name)).join(', ') || '—';
    info.innerHTML = [
      ['Stato',      stato],
      ['Fase',       night],
      ['Alba',       alba],
      ['Tramonto',   tram],
      ['Aggiornato', updated],
      ['Errori log', String(errors)],
      ['Wi‑Fi attivo', ssidActive],
    ].map(([k, v]) => `<div class="info-row"><span class="info-key">${k}</span><span class="info-val">${esc(v)}</span></div>`).join('');
  }
}

/* ---- Log: righe compatte, filtri per tipo, errori in evidenza ---- */
const ROUTINE_RE = /^(WATCHDOG|SUPERVISOR|REPORT|HEARTBEAT)$/i;   // eventi di routine (modificabile): li nasconde il filtro "Senza routine"
let _logAll = [], _logFilter = 'all', _logErr24 = 0, _lastLogsFetch = 0;

const isErrLog = x =>
  /err|fail|timeout|exception/i.test(x.code || '') ||
  /(^|[^a-z])(error|errore|failed|fail|timeout|exception)([^a-z]|$)|HTTP_[45]\d\d/i.test(x.desc || '');
const logCode = x => String(x.code || '—').toUpperCase();
const logTime = x => { const d = x.ts ? new Date(x.ts) : null; return d && !isNaN(d.getTime()) ? d : null; };

function renderLogs(logs) {
  _logAll = Array.isArray(logs) ? logs : [];
  _logErr24 = _logAll.filter(x => { const d = logTime(x); return isErrLog(x) && d && Date.now() - d.getTime() < 864e5; }).length;
  updateErrorBadge(MODEL || {});
  drawLogs();
  try { notifyOnLogs(_logAll); } catch (_) {}
}

function drawLogs() {
  const list = $('#log-list'), empty = $('#log-empty'), chips = $('#log-chips'), sum = $('#log-summary');
  if (!list) return;
  const all = _logAll;
  const errs = all.filter(isErrLog);

  // Riepilogo errori in alto
  if (sum) {
    if (errs.length) {
      const l = errs[0], d = logTime(l);
      sum.innerHTML = `<button class="log-alert" type="button">
        <span class="log-alert-ico">${svg('alert')}</span>
        <span class="log-alert-txt">
          <span class="log-alert-title">${errs.length} ${errs.length === 1 ? 'errore recente' : 'errori recenti'}</span>
          <span class="log-alert-sub">${d ? fmtTime(l.ts) + ' · ' : ''}${esc(logCode(l))}${l.desc ? ' — ' + esc(l.desc) : ''}</span>
        </span>
        <span class="log-alert-go">${svg('chevron')}</span>
      </button>`;
    } else {
      sum.innerHTML = `<div class="log-ok">${svg('check')}<span>Nessun errore negli ultimi eventi</span></div>`;
    }
  }

  // Filtri per tipologia
  if (chips) {
    const counts = {};
    all.forEach(x => { const k = logCode(x); counts[k] = (counts[k] || 0) + 1; });
    const types = Object.keys(counts).sort((x, y) => counts[y] - counts[x]);
    const defs = [
      { id: 'all',       label: 'Tutti',         n: all.length },
      { id: 'err',       label: 'Errori',        n: errs.length, err: true },
      { id: 'noroutine', label: 'Senza routine', n: all.filter(x => !ROUTINE_RE.test(x.code || '')).length },
      ...types.map(t => ({ id: 'code:' + t, label: cap(t.toLowerCase()), n: counts[t] })),
    ];
    chips.innerHTML = defs.map(d =>
      `<button class="chip${_logFilter === d.id ? ' on' : ''}${d.err && d.n ? ' chip-err' : ''}" type="button" data-f="${esc(d.id)}">${esc(d.label)} <b>${d.n}</b></button>`
    ).join('');
  }

  const pass = x =>
    _logFilter === 'err' ? isErrLog(x) :
    _logFilter === 'noroutine' ? !ROUTINE_RE.test(x.code || '') :
    _logFilter.startsWith('code:') ? logCode(x) === _logFilter.slice(5) : true;
  const rows = all.filter(pass);

  list.innerHTML = '';
  if (!rows.length) {
    if (empty) { empty.textContent = all.length ? 'Nessun evento con questo filtro.' : 'Nessun evento registrato.'; empty.hidden = false; }
    return;
  }
  if (empty) empty.hidden = true;

  const dayLabel = d => {
    const same = (x, y) => x.toDateString() === y.toDateString();
    const now = new Date(), ieri = new Date(Date.now() - 864e5);
    return same(d, now) ? 'Oggi' : same(d, ieri) ? 'Ieri'
      : d.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });
  };

  let lastDay = '';
  rows.forEach(x => {
    const d = logTime(x);
    if (d) {
      const key = d.toDateString();
      if (key !== lastDay) {
        lastDay = key;
        const h = document.createElement('div');
        h.className = 'log-day';
        h.textContent = dayLabel(d);
        list.appendChild(h);
      }
    }
    const err = isErrLog(x), routine = ROUTINE_RE.test(x.code || '');
    const names = err && typeof presenceAt === 'function' ? presenceAt(x.ts) : null;
    const who = names ? `<span class="lr-who">In casa in quel momento: ${names.length ? esc(names.map(cap).join(', ')) : 'nessuno'}</span>` : '';
    const row = document.createElement('div');
    row.className = 'log-row' + (err ? ' log-err' : '') + (routine && !err ? ' log-routine' : '');
    row.tabIndex = 0;
    row.setAttribute('role', 'button');
    row.innerHTML = `
      <span class="lr-time">${d ? fmtTime(x.ts) : '—'}</span>
      <span class="lr-code">${esc(logCode(x))}</span>
      <span class="lr-desc">${esc(x.desc || '')}${x.note ? ' · ' + esc(x.note) : ''}</span>${who}`;
    const toggle = () => row.classList.toggle('open');      // tocca per vedere il testo intero
    row.addEventListener('click', toggle);
    row.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } });
    list.appendChild(row);
  });
}

function initLogUI() {
  $('#log-chips')?.addEventListener('click', e => {
    const b = e.target.closest('.chip'); if (!b) return;
    _logFilter = b.dataset.f || 'all';
    drawLogs();
  });
  $('#log-summary')?.addEventListener('click', e => {
    if (!e.target.closest('.log-alert')) return;
    _logFilter = _logFilter === 'err' ? 'all' : 'err';
    drawLogs();
  });
}

function updateErrorBadge(m) {
  const n = Math.max((m.alerts && Number(m.alerts.logErrors)) || 0, _logErr24);
  const dot = $('#dot-err'); if (dot) dot.hidden = !n;
  const badge = $('#badge-log'); if (badge) badge.hidden = !n;
}

function updateTs(m) {
  const el = $('#ts'); if (!el) return;
  el.textContent = m.meta?.nowIso ? fmtTime(m.meta.nowIso) : fmtTime(new Date().toISOString());
}


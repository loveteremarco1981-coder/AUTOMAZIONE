'use strict';
/* Righe aggiuntive di Impostazioni: scene, orari, termostato, notifiche, conferma, tema; scelta dell'aspetto */
function extraSettingRows(list, rowHtml, m) {
  const add = (r, control, handler) => {
    const row = document.createElement('div');
    row.className = 'setting-row';
    row.innerHTML = rowHtml(r, control);
    if (handler) handler(row);
    list.appendChild(row);
    return row;
  };
  const btn = txt => `<button class="small-btn" type="button">${txt}</button>`;
  const ro = isReadOnly();

  add({ label: 'Scene', sub: `${getScenes().length} scene a un tocco`, icon: 'play', tone: 'blue' }, ro ? '' : btn('Modifica'),
    row => row.querySelector('button')?.addEventListener('click', openScenesSheet));

  add({ label: 'Orari tapparelle', sub: scheduleSummary(m), icon: 'sun', tone: 'amber' }, ro ? '' : btn('Cambia'),
    row => row.querySelector('button')?.addEventListener('click', () => openScheduleSheet(m)));

  add({ label: 'Termostati', sub: termoSummary(m), icon: 'thermo', tone: 'amber' }, ro || !termo(m) ? '' : btn('Cambia'),
    row => row.querySelector('button')?.addEventListener('click', () => openTermostatoSheet(MODEL || m)));

  // Gestione manuale: lo script smette di comandare i termostati (lo storico continua)
  if (termo(m)) {
    const man = !!m.termostato.manuale;
    add({ label: 'Termostati: gestione manuale', sub: man ? 'Attiva: li comandi da casa, lo script registra soltanto' : 'Spenta: lo script regola la temperatura di ogni piano',
          icon: 'lock', tone: 'red' },
      `<label class="toggle-wrap"><input type="checkbox" aria-label="Termostati: gestione manuale" ${man ? 'checked' : ''} ${ro ? 'disabled' : ''}><span class="toggle-slider"></span></label>`,
      row => row.querySelector('input').addEventListener('change', async e => {
        const next = e.target.checked;
        const r = await callAdmin('set_termostato', { manuale: next ? '1' : '0' }, { noUndo: true });
        if (!r || r.ok === false) { e.target.checked = !next; if (r) toast('Lo script non ha registrato la modifica.', 'err'); return; }
        if (MODEL && r.termostato) { MODEL.termostato = r.termostato; saveModel(MODEL); }
        toast(next ? 'Gestione manuale: lo script non comanda più i termostati' : 'Lo script torna a comandare i termostati', 'ok', 3200);
        renderTermostatoCard(MODEL || m); renderSettings(MODEL || m);
      }));
  }

  const np = notifyPrefs();
  const nOn = np.presence || np.errors;
  add({ label: 'Notifiche', sub: nOn ? [np.presence && 'ingressi e uscite', np.errors && 'errori'].filter(Boolean).join(' e ') : 'Disattivate su questo dispositivo', icon: 'bell', tone: 'red' }, btn('Imposta'),
    row => row.querySelector('button').addEventListener('click', openNotifySheet));

  add({ label: 'Conferma con Annulla', sub: 'Qualche secondo per ripensarci prima di azioni delicate', icon: 'shield', tone: 'purple' },
    `<label class="toggle-wrap"><input type="checkbox" aria-label="Conferma con Annulla" ${undoEnabled() ? 'checked' : ''}><span class="toggle-slider"></span></label>`,
    row => row.querySelector('input').addEventListener('change', e => setUndoEnabled(e.target.checked)));

  renderSkinPick();
  if (skinPref() !== 'classico') return;      // Tinta, Lume e Giorno hanno già il loro tema
  add({ label: 'Tema', sub: 'Automatico segue il telefono', icon: 'palette', tone: 'green' },
    `<div class="seg theme-seg" role="group" aria-label="Tema">
       <button class="seg-btn" type="button" data-t="auto">Auto</button>
       <button class="seg-btn" type="button" data-t="light">Chiaro</button>
       <button class="seg-btn" type="button" data-t="dark">Scuro</button></div>`,
    row => {
      const sync = () => row.querySelectorAll('.seg-btn').forEach(b => {
        const on = b.dataset.t === themePref(); b.classList.toggle('is-active', on); b.setAttribute('aria-pressed', String(on));
      });
      sync();
      row.querySelectorAll('.seg-btn').forEach(b => b.addEventListener('click', () => { setThemePref(b.dataset.t); applyTheme(); sync(); }));
    });
}


/* ---- Aspetto: quattro riquadri con l'anteprima dei colori ---- */
function renderSkinPick() {
  const box = $('#skin-pick'); if (!box) return;
  const cur = skinPref();
  const anteprima = {
    tinta:    '<i style="background:linear-gradient(180deg,#1f4f86,#101216 70%)"></i><b style="background:#181b21"></b><b style="background:#181b21"></b><u style="background:#58a6ff"></u>',
    lume:     '<i style="background:#0c1118"></i><b style="background:#151c27"></b><b style="background:#151c27"></b><u style="background:#8fc1ff"></u>',
    giorno:   '<i style="background:#eff2f0"></i><b style="background:#fff;box-shadow:inset 0 0 0 1px rgba(20,32,28,.12)"></b><b style="background:#fff;box-shadow:inset 0 0 0 1px rgba(20,32,28,.12)"></b><u style="background:#1d6b52"></u>',
    classico: '<i style="background:radial-gradient(circle at 30% 20%,#3b4a8a,#0d1117 70%)"></i><b style="background:rgba(255,255,255,.12)"></b><b style="background:rgba(255,255,255,.12)"></b><u style="background:#58a6ff"></u>'
  };
  box.innerHTML = Object.entries(SKINS).map(([id, s]) => `
    <button type="button" class="skin-opt${id === cur ? ' is-active' : ''}" data-skin="${id}" role="radio" aria-checked="${id === cur}">
      <span class="skin-prev" aria-hidden="true">${anteprima[id]}</span>
      <span class="skin-nome">${s.nome}</span><span class="skin-sub">${s.sub}</span>
    </button>`).join('');
  const glass = $('#glass-card'); if (glass) glass.hidden = cur !== 'classico';
  box.querySelectorAll('.skin-opt').forEach(b => b.addEventListener('click', () => {
    if (b.dataset.skin === skinPref()) return;
    haptic();
    setSkinPref(b.dataset.skin);
    applyTheme();
    if (typeof renderSettings === 'function' && typeof MODEL !== 'undefined' && MODEL) renderSettings(MODEL); else renderSkinPick();
  }));
}

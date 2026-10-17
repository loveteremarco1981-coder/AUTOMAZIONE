'use strict';
/* Righe aggiuntive di Impostazioni: scene, orari, notifiche, conferma, tema */
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

  add({ label: 'Scene', sub: `${getScenes().length} scene a un tocco`, icon: 'play', tone: 'blue' }, btn('Modifica'),
    row => row.querySelector('button').addEventListener('click', openScenesSheet));

  add({ label: 'Orari tapparelle', sub: scheduleSummary(m), icon: 'sun', tone: 'amber' }, ro ? '' : btn('Cambia'),
    row => row.querySelector('button')?.addEventListener('click', () => openScheduleSheet(m)));

  const np = notifyPrefs();
  const nOn = np.presence || np.errors;
  add({ label: 'Notifiche', sub: nOn ? [np.presence && 'ingressi e uscite', np.errors && 'errori'].filter(Boolean).join(' e ') : 'Disattivate su questo dispositivo', icon: 'bell', tone: 'red' }, btn('Imposta'),
    row => row.querySelector('button').addEventListener('click', openNotifySheet));

  add({ label: 'Conferma con Annulla', sub: 'Qualche secondo per ripensarci prima di azioni delicate', icon: 'shield', tone: 'purple' },
    `<label class="toggle-wrap"><input type="checkbox" aria-label="Conferma con Annulla" ${undoEnabled() ? 'checked' : ''}><span class="toggle-slider"></span></label>`,
    row => row.querySelector('input').addEventListener('change', e => setUndoEnabled(e.target.checked)));

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

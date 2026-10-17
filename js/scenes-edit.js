'use strict';
/* ============================================================
   SCENE MODIFICABILI DALL'APP
   Le modifiche restano su questo dispositivo (localStorage).
   ============================================================ */
const ACTIONS = [
  { id: 'alza_tutto',        label: 'Alza le tapparelle',          params: { manual: 'TRUE' } },
  { id: 'abbassa_tutto',     label: 'Abbassa le tapparelle',       params: { manual: 'TRUE' } },
  { id: 'termostato_auto',   label: 'Termostato in automatico' },
  { id: 'off_termostato',    label: 'Termostato spento' },
  { id: 'spegni_clima',      label: 'Clima spento' },
  { id: 'ezviz_interne_on',  label: 'Telecamere interne accese' },
  { id: 'ezviz_interne_off', label: 'Telecamere interne spente' },
  { id: 'ezviz_esterne_on',  label: 'Telecamere esterne accese' },
  { id: 'ezviz_esterne_off', label: 'Telecamere esterne spente' },
  { id: 'piante',            label: 'Annaffia le piante' },
];
const SCENE_ICONS = ['sun', 'door', 'home', 'moon', 'play', 'leaf', 'shield', 'plane'];
const SCENE_TONES = ['blue', 'green', 'amber', 'purple', 'red'];

function getScenes() {
  try {
    const s = JSON.parse(localStorage.getItem('ui_scenes') || 'null');
    if (Array.isArray(s) && s.length) return s;
  } catch (_) {}
  return CONFIG.SCENES || DEFAULT_SCENES;
}
function saveScenes(list) {
  try { localStorage.setItem('ui_scenes', JSON.stringify(list)); } catch (_) {}
  renderScenes(true);
}
function resetScenes() {
  try { localStorage.removeItem('ui_scenes'); } catch (_) {}
  renderScenes(true);
}
const actionLabel = ev => (ACTIONS.find(a => a.id === ev) || {}).label || ev;

function openScenesSheet() {
  const wrap = document.createElement('div');
  wrap.className = 'se';
  openSheet('Scene', wrap);
  showSceneList(wrap);
}

function showSceneList(wrap) {
  setSheetTitle('Scene');
  const list = getScenes();
  wrap.innerHTML = `
    <p class="sheet-note">Tocca una scena per modificarla. Le modifiche valgono solo su questo dispositivo.</p>
    <div class="se-list"></div>
    <div class="sheet-actions">
      <button class="btn-primary" type="button" id="se-new">Nuova scena</button>
      <button class="btn-ghost" type="button" id="se-reset">Ripristina predefinite</button>
    </div>`;
  const host = wrap.querySelector('.se-list');
  list.forEach((sc, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'se-item';
    if (sc.tone) b.dataset.tone = sc.tone;
    b.innerHTML = `<span class="scene-ico">${svg(sc.icon || 'play')}</span>
      <span class="se-txt"><b>${esc(sc.label)}</b><small>${sc.steps.length} ${sc.steps.length === 1 ? 'azione' : 'azioni'}</small></span>
      <span class="se-go">${svg('chevron')}</span>`;
    b.addEventListener('click', () => showSceneEdit(wrap, i));
    host.appendChild(b);
  });
  wrap.querySelector('#se-new').addEventListener('click', () => showSceneEdit(wrap, -1));
  wrap.querySelector('#se-reset').addEventListener('click', () => {
    if (!confirm('Ripristinare le scene predefinite? Le tue modifiche su questo dispositivo andranno perse.')) return;
    resetScenes();
    showSceneList(wrap);
  });
}

function showSceneEdit(wrap, idx) {
  const list = getScenes().map(s => ({ ...s, steps: s.steps.map(x => ({ ...x })) }));
  const isNew = idx < 0;
  const sc = isNew ? { id: 'sc' + Date.now(), label: '', sub: '', icon: 'play', tone: 'blue', steps: [] } : list[idx];
  setSheetTitle(isNew ? 'Nuova scena' : 'Modifica scena');

  wrap.innerHTML = `
    <label class="fld"><span>Nome</span><input type="text" id="se-name" maxlength="24" placeholder="Per esempio: Cinema" value="${esc(sc.label)}"></label>
    <label class="fld"><span>Descrizione breve</span><input type="text" id="se-sub" maxlength="34" placeholder="Facoltativa" value="${esc(sc.sub || '')}"></label>
    <div class="fld"><span>Icona</span><div class="pick" id="se-icons"></div></div>
    <div class="fld"><span>Colore</span><div class="pick" id="se-tones"></div></div>
    <div class="fld"><span>Azioni, nell'ordine in cui toccate</span><div class="se-steps" id="se-steps"></div></div>
    <p class="sheet-error" id="se-err" role="alert"></p>
    <div class="sheet-actions">
      <button class="btn-primary" type="button" id="se-save">Salva</button>
      <button class="btn-ghost" type="button" id="se-back">Indietro</button>
      ${isNew ? '' : '<button class="btn-danger" type="button" id="se-del">Elimina</button>'}
    </div>`;

  const icons = wrap.querySelector('#se-icons'), tones = wrap.querySelector('#se-tones'), stepsHost = wrap.querySelector('#se-steps');
  const drawPicks = () => {
    icons.innerHTML = SCENE_ICONS.map(n => `<button type="button" class="pick-ico${sc.icon === n ? ' on' : ''}" data-v="${n}" aria-label="${n}">${svg(n)}</button>`).join('');
    tones.innerHTML = SCENE_TONES.map(t => `<button type="button" class="pick-tone${sc.tone === t ? ' on' : ''}" data-tone="${t}" data-v="${t}" aria-label="${t}"></button>`).join('');
  };
  const drawSteps = () => {
    stepsHost.innerHTML = ACTIONS.map(a => {
      const pos = sc.steps.findIndex(s => s.event === a.id);
      return `<button type="button" class="se-step${pos >= 0 ? ' on' : ''}" data-id="${a.id}"><span class="se-n">${pos >= 0 ? pos + 1 : ''}</span><span>${esc(a.label)}</span></button>`;
    }).join('');
  };
  drawPicks(); drawSteps();

  icons.addEventListener('click', e => { const b = e.target.closest('[data-v]'); if (!b) return; sc.icon = b.dataset.v; drawPicks(); });
  tones.addEventListener('click', e => { const b = e.target.closest('[data-v]'); if (!b) return; sc.tone = b.dataset.v; drawPicks(); });
  stepsHost.addEventListener('click', e => {
    const b = e.target.closest('[data-id]'); if (!b) return;
    const pos = sc.steps.findIndex(s => s.event === b.dataset.id);
    if (pos >= 0) sc.steps.splice(pos, 1);
    else { const a = ACTIONS.find(x => x.id === b.dataset.id); sc.steps.push(a.params ? { event: a.id, params: { ...a.params } } : { event: a.id }); }
    drawSteps();
  });

  wrap.querySelector('#se-back').addEventListener('click', () => showSceneList(wrap));
  wrap.querySelector('#se-del')?.addEventListener('click', () => {
    if (!confirm(`Eliminare la scena «${sc.label}»?`)) return;
    list.splice(idx, 1);
    saveScenes(list.length ? list : DEFAULT_SCENES);
    showSceneList(wrap);
  });
  wrap.querySelector('#se-save').addEventListener('click', () => {
    const name = wrap.querySelector('#se-name').value.trim();
    const err = wrap.querySelector('#se-err');
    if (!name) { err.textContent = 'Scrivi un nome per la scena.'; return; }
    if (!sc.steps.length) { err.textContent = 'Scegli almeno un’azione.'; return; }
    sc.label = name;
    sc.sub = wrap.querySelector('#se-sub').value.trim();
    if (isNew) list.push(sc); else list[idx] = sc;
    saveScenes(list);
    showSceneList(wrap);
  });
}

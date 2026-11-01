'use strict';
/* ============================================================
   TERMOSTATO VIMAR — impostazioni (base, delta, tempo, stagione)
   e stato in Dispositivi. Le regole le applica lo script
   (32.termostato.gs); qui si guardano e si cambiano i valori.
   ============================================================ */
const MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
const STAGIONE_NOME = { inverno: 'autunno-inverno', estate: 'primavera-estate' };

const termo = m => (m && m.termostato && m.termostato.cfg) ? m.termostato : null;
const gradi = n => (n === null || n === undefined || isNaN(Number(n))) ? '—' : String(Math.round(Number(n) * 10) / 10).replace('.', ',') + '°';
const durataTxt = min => min % 60 === 0 ? `${min / 60} ${min === 60 ? 'ora' : 'ore'}` : (min > 60 ? `${Math.floor(min / 60)} h ${min % 60} min` : `${min} min`);
const dataTxt = mmdd => { const [mm, dd] = String(mmdd || '').split('-').map(Number); return mm ? `${dd} ${MESI[mm - 1]}` : '—'; };
const oraTxt = ms => fmtTime(new Date(Number(ms)).toISOString());

function termoSummary(m) {
  const t = termo(m);
  if (!t) return 'Da attivare nello script';
  const c = t.cfg;
  return `Base ${gradi(c.base)} · delta ${gradi(c.delta)} · ${durataTxt(c.minuti)} · ${STAGIONE_NOME[t.stagione]}`;
}

/* ---- Scheda in Dispositivi ---- */
function renderTermostatoCard(m) {
  const el = $('#termo-card'); if (!el) return;
  const t = termo(m);
  if (!t) { el.hidden = true; return; }
  const c = t.cfg;
  const quando = x => x && x.ts ? ` <small>alle ${oraTxt(x.ts)}</small>` : '';
  let stato;
  if (t.sessione) stato = `In regolazione dalle ${oraTxt(t.sessione.inizio)} · controllo alle ${oraTxt(t.sessione.scadenza)}`;
  else if (t.ultima) stato = `${t.ultima.testo} (${shutterWhen(t.ultima.ts)})`;
  else if (!t.temp && !t.setpoint) stato = 'In attesa dei primi dati da IFTTT';
  else stato = 'Nessuna regolazione in corso';

  el.innerHTML = `
    <div class="termo-head">
      <span class="dev-icon t-orange">${svg('thermo')}</span>
      <span class="shutter-text">
        <span class="shutter-label">Termostato Vimar</span>
        <span class="shutter-sub">${esc(STAGIONE_NOME[t.stagione])}${c.stagione === 'auto' ? '' : ' (scelta a mano)'} · base ${gradi(c.base)}</span>
      </span>
      ${isReadOnly() ? '' : `<button class="small-btn" type="button" id="termo-edit">Cambia</button>`}
    </div>
    <div class="termo-vals">
      <div><span>Stanza</span><b>${gradi(t.temp && t.temp.v)}</b>${quando(t.temp)}</div>
      <div><span>Impostata</span><b>${gradi(t.setpoint && t.setpoint.v)}</b>${quando(t.setpoint)}</div>
      <div><span>Obiettivo</span><b>${gradi(t.obiettivo)}</b><small>base − ${gradi(c.delta)}</small></div>
    </div>
    <p class="termo-state${t.sessione ? ' on' : ''}">${esc(stato)}</p>`;
  el.hidden = false;
  el.querySelector('#termo-edit')?.addEventListener('click', () => openTermostatoSheet(MODEL || m));
}

/* ---- Pannello impostazioni ---- */
function openTermostatoSheet(m) {
  const t = termo(m);
  if (!t) { toast('Lo script non ha ancora la parte del termostato.', 'err', 3200); return; }
  const c = { ...t.cfg }, d = t.predefiniti || {};
  const [daM, daG] = String(c.invernoDa).split('-').map(Number);
  const [aM, aG] = String(c.invernoA).split('-').map(Number);
  const opt = (n, sel, lab) => `<option value="${n}"${n === sel ? ' selected' : ''}>${lab || n}</option>`;
  const giorni = sel => Array.from({ length: 31 }, (_, i) => opt(i + 1, sel)).join('');
  const mesi = sel => MESI.map((x, i) => opt(i + 1, sel, x)).join('');
  const minuti = [30, 45, 60, 90, 120, 150, 180, 240, 300, 360];
  if (!minuti.includes(c.minuti)) { minuti.push(c.minuti); minuti.sort((x, y) => x - y); }

  const wrap = document.createElement('div');
  wrap.className = 'se';
  wrap.innerHTML = `
    <p class="sheet-note">Se qualcuno porta il termostato sopra la base, lo script lo rimette alla base. Se dopo il tempo di regolazione la stanza non arriva a base − delta, lo mette in auto; a casa vuota, in primavera-estate lo spegne.</p>
    <div class="fld-row">
      <label class="fld"><span>Temperatura base</span><input type="number" id="tm-base" inputmode="decimal" min="15" max="25" step="0.5" value="${c.base}"></label>
      <label class="fld"><span>Delta</span><input type="number" id="tm-delta" inputmode="decimal" min="0.1" max="3" step="0.1" value="${c.delta}"></label>
    </div>
    <p class="fld-hint" id="tm-target"></p>
    <label class="fld"><span>Tempo di regolazione</span><select id="tm-min">${minuti.map(x => opt(x, c.minuti, durataTxt(x))).join('')}</select></label>
    <div class="fld"><span>Stagione</span>
      <div class="seg tm-seg" role="group" aria-label="Stagione">
        <button class="seg-btn" type="button" data-s="auto">Dalla data</button>
        <button class="seg-btn" type="button" data-s="inverno">Autunno-inverno</button>
        <button class="seg-btn" type="button" data-s="estate">Primavera-estate</button>
      </div>
    </div>
    <div class="fld"><span>Autunno-inverno: dal</span>
      <div class="fld-row"><select id="tm-da-g" aria-label="Giorno di inizio">${giorni(daG)}</select><select id="tm-da-m" aria-label="Mese di inizio">${mesi(daM)}</select></div>
    </div>
    <div class="fld"><span>al (compreso)</span>
      <div class="fld-row"><select id="tm-a-g" aria-label="Giorno di fine">${giorni(aG)}</select><select id="tm-a-m" aria-label="Mese di fine">${mesi(aM)}</select></div>
    </div>
    <p class="fld-hint">Il resto dell’anno è primavera-estate.</p>
    <p class="sheet-error" id="tm-err" role="alert"></p>
    <div class="sheet-actions">
      <button class="btn-primary" type="button" id="tm-save">Salva</button>
      <button class="btn-ghost" type="button" id="tm-reset">Ripristina predefiniti</button>
    </div>
    <p class="sheet-note small">Predefiniti: base ${gradi(d.base)}, delta ${gradi(d.delta)}, ${durataTxt(d.minuti || 120)}, stagione dalla data (autunno-inverno dal ${dataTxt(d.invernoDa)} al ${dataTxt(d.invernoA)}).</p>`;
  openSheet('Termostato', wrap);

  const $w = s => wrap.querySelector(s);
  const err = $w('#tm-err');
  const num = s => Number(String($w(s).value).replace(',', '.'));
  const showTarget = () => {
    const b = num('#tm-base'), dl = num('#tm-delta');
    $w('#tm-target').textContent = isNaN(b) || isNaN(dl) ? '' : `Temperatura considerata raggiunta: ${gradi(b - dl)}`;
  };
  const drawSeg = () => wrap.querySelectorAll('.tm-seg .seg-btn').forEach(b => {
    const on = b.dataset.s === c.stagione; b.classList.toggle('is-active', on); b.setAttribute('aria-pressed', String(on));
  });
  showTarget(); drawSeg();
  ['#tm-base', '#tm-delta'].forEach(s => $w(s).addEventListener('input', showTarget));
  wrap.querySelector('.tm-seg').addEventListener('click', e => { const b = e.target.closest('[data-s]'); if (!b) return; c.stagione = b.dataset.s; drawSeg(); });

  const pad = n => String(n).padStart(2, '0');
  const mmdd = (g, mm) => `${pad($w(mm).value)}-${pad($w(g).value)}`;
  const finito = (r, msg) => {
    if (r && r.ok !== false) {
      if (MODEL && r.termostato) { MODEL.termostato = r.termostato; saveModel(MODEL); renderTermostatoCard(MODEL); renderSettings(MODEL); }
      toast(msg, 'ok'); closeSheet(); reloadSoon(800);
    } else if (r) err.textContent = 'Lo script non ha accettato i valori' + (r.error ? ` (${r.error})` : '') + '.';
  };

  $w('#tm-save').addEventListener('click', e => busy(e.currentTarget, async () => {
    err.textContent = '';
    const base = num('#tm-base'), delta = num('#tm-delta');
    if (isNaN(base) || base < 15 || base > 25) { err.textContent = 'La base deve essere tra 15° e 25°.'; return; }
    if (isNaN(delta) || delta < 0.1 || delta > 3) { err.textContent = 'Il delta deve essere tra 0,1° e 3°.'; return; }
    const da = mmdd('#tm-da-g', '#tm-da-m'), a = mmdd('#tm-a-g', '#tm-a-m');
    const r = await callAdmin('set_termostato', { base, delta, minuti: $w('#tm-min').value, stagione: c.stagione, invernoDa: da, invernoA: a }, { noUndo: true });
    finito(r, 'Termostato: impostazioni salvate');
  }));
  $w('#tm-reset').addEventListener('click', e => busy(e.currentTarget, async () => {
    err.textContent = '';
    const r = await callAdmin('set_termostato', { reset: '1' }, { noUndo: true });
    finito(r, 'Termostato: valori predefiniti ripristinati');
  }));
}

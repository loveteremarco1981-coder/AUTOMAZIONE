'use strict';
/* ============================================================
   ORARI TAPPARELLE — mostra e cambia apertura e chiusura.
   Richiede il pezzo di script "set_schedule" (backend_extra.gs).
   ============================================================ */
function hhmm(v) {
  const t = /(\d{1,2}):(\d{2})/.exec(String(v || ''));
  return t ? String(t[1]).padStart(2, '0') + ':' + t[2] : '';
}

function scheduleSummary(m) {
  const s = m && m.schedule;
  if (s && (hhmm(s.open) || hhmm(s.close))) {
    return `Apre ${hhmm(s.open) || '—'} · chiude ${hhmm(s.close) || '—'}`;
  }
  return 'Apertura e chiusura automatiche';
}

function openScheduleSheet(m) {
  const s = (m && m.schedule) || {};
  const wrap = document.createElement('div');
  wrap.className = 'se';
  wrap.innerHTML = `
    <p class="sheet-note">Scegli a che ora le tapparelle si alzano e si abbassano da sole. Gli orari restano salvati nello script, quindi valgono per tutta la casa.</p>
    <label class="fld"><span>Apertura</span><input type="time" id="sc-open" value="${hhmm(s.open)}"></label>
    <label class="fld"><span>Chiusura</span><input type="time" id="sc-close" value="${hhmm(s.close)}"></label>
    <p class="sheet-error" id="sc-err" role="alert"></p>
    <div class="sheet-actions">
      <button class="btn-primary" type="button" id="sc-save">Salva</button>
      <button class="btn-ghost" type="button" id="sc-auto">Torna all’automatico</button>
    </div>`;
  openSheet('Orari tapparelle', wrap);

  const err = wrap.querySelector('#sc-err');
  const send = async (open, close, okMsg) => {
    err.textContent = '';
    const r = await callAdmin('set_schedule', { open, close });
    if (r && r.ok !== false) { toast(okMsg, 'ok'); closeSheet(); reloadSoon(500); }
    else if (r) err.textContent = 'Lo script non ha accettato gli orari' + (r.error ? ` (${r.error})` : '') + '.';
  };
  wrap.querySelector('#sc-save').addEventListener('click', () => {
    const o = wrap.querySelector('#sc-open').value, c = wrap.querySelector('#sc-close').value;
    if (!o || !c) { err.textContent = 'Imposta entrambi gli orari.'; return; }
    send(o, c, 'Orari salvati');
  });
  wrap.querySelector('#sc-auto').addEventListener('click', () => send('auto', 'auto', 'Orari automatici ripristinati'));
}

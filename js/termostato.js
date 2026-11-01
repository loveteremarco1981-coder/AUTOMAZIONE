'use strict';
/* ============================================================
   TERMOSTATI VIMAR comandati dallo script (32.termostato.gs).
   I termostati restano in Manuale; lo script attiva gli scenari
   Vimar "Comfort" e "Ridotta" secondo le fasce orarie, le presenze
   e le abitudini. Qui si vedono e si cambiano fasce e temperature.
   ============================================================ */
const MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
const STAGIONE_NOME = { inverno: 'autunno-inverno', estate: 'primavera-estate' };
const ZONE = [['giorno', 'Zona Giorno · 3° piano'], ['notte', 'Zona Notte · 4° piano']];
const COMANDO_NOME = { comfort: 'Comfort', ridotta: 'Ridotta', off: 'Spento' };

const termo = m => (m && m.termostato && m.termostato.zone) ? m.termostato : null;
const gradi = n => (n === null || n === undefined || isNaN(Number(n))) ? '—' : String(Math.round(Number(n) * 10) / 10).replace('.', ',') + '°';
const durataTxt = min => min % 60 === 0 ? `${min / 60} ${min === 60 ? 'ora' : 'ore'}` : (min > 60 ? `${Math.floor(min / 60)} h ${min % 60} min` : `${min} min`);
const dataTxt = mmdd => { const [mm, dd] = String(mmdd || '').split('-').map(Number); return mm ? `${dd} ${MESI[mm - 1]}` : '—'; };
const oraTxt = ms => fmtTime(new Date(Number(ms)).toISOString());

// Stato da mostrare: OFF (spento), A MANO (modifica rispettata), COMFORT, RIDOTTA, — (non noto)
function statoZona(z, t) {
  if (!z) return { cls: 'unk', txt: '—', tip: 'Stato non ancora ricevuto' };
  const spento = z.modo && /\boff\b|spent|disattiv|stop/i.test(String(z.modo.v));
  if (spento) return { cls: 'off', txt: 'OFF', tip: 'Spento' };
  // Con la gestione manuale o in primavera-estate lo script non comanda: conta solo il termostato
  const comanda = !t || (!t.manuale && t.stagione === 'inverno');
  if (!comanda) return z.modo && z.modo.v ? { cls: 'on', txt: 'ON', tip: `Modalità «${z.modo.v}»` } : { cls: 'unk', txt: '—', tip: 'Stato non ancora ricevuto' };
  if (z.hold) return { cls: 'man', txt: 'A MANO', tip: 'Modifica a mano rispettata dallo script' };
  if (z.comando === 'comfort') return { cls: 'on', txt: 'COMFORT', tip: `Comfort ${gradi(z.cfg && z.cfg.comfort)}` };
  if (z.comando === 'ridotta') return { cls: 'eco', txt: 'RIDOTTA', tip: `Ridotta ${gradi(z.cfg && z.cfg.ridotta)}` };
  if (z.modo && z.modo.v) return { cls: 'on', txt: 'ON', tip: `Modalità «${z.modo.v}»` };
  return { cls: 'unk', txt: '—', tip: 'Stato non ancora ricevuto' };
}
function onOffBadge(z, t) {
  const s = statoZona(z, t);
  return `<span class="onoff ${s.cls}" title="${esc(s.tip)}" aria-label="${esc(s.tip)}"><i></i>${s.txt}</span>`;
}

// "feriali 18:30 · weekend 17:00", oppure cosa manca per impararlo
function abitudiniTxt(t) {
  const a = t && t.abitudini;
  if (!a || (!a.feriali && !a.weekend)) {
    const n = a ? Math.max(a.giorniFeriali || 0, a.giorniWeekend || 0) : 0;
    return `le sto ancora imparando dallo storico (${n} ${n === 1 ? 'giorno' : 'giorni'} con un rientro; ne servono almeno 3 per tipo)`;
  }
  return [a.feriali && `feriali ${a.feriali}`, a.weekend && `weekend ${a.weekend}`].filter(Boolean).join(' · ');
}

/* ---- Home: tessera temperature (esterna, 3° piano = Zona Giorno, 4° piano = Zona Notte) ---- */
function renderTermoMini(m) {
  const t = termo(m);
  ZONE.forEach(([id]) => {
    const z = t && t.zone[id];
    const v = $('#tc-val-' + id), st = $('#tc-state-' + id);
    if (v) v.innerHTML = z && z.temp ? `${esc(gradi(z.temp.v).replace('°', ''))}<span class="unit">°</span>` : '—';
    if (st) st.innerHTML = z ? onOffBadge(z, t) : '';
  });
  $$('.tc-floor').forEach(b => {
    if (b.dataset.bound) return;
    b.dataset.bound = '1';
    b.addEventListener('click', () => { haptic(); activateTab('devices'); });
  });
}

function termoSummary(m) {
  const t = termo(m);
  if (!t) return 'Da attivare nello script';
  if (t.manuale) return 'Gestione manuale: lo script non li comanda';
  if (!t.versione) return 'Aggiorna lo script dei termostati';
  const z = t.zone;
  return `Comfort ${gradi(z.giorno.cfg.comfort)} / ridotta ${gradi(z.giorno.cfg.ridotta)} · ${STAGIONE_NOME[t.stagione]}`;
}

/* ---- Schede in Dispositivi ---- */
function renderTermostatoCard(m) {
  renderTermoMini(m);
  const el = $('#termo-card'); if (!el) return;
  const t = termo(m);
  if (!t) { el.hidden = true; return; }
  const quando = x => x && x.ts ? `<small>alle ${oraTxt(x.ts)}</small>` : '<small>&nbsp;</small>';

  const zona = ([id, nome]) => {
    const z = t.zone[id]; if (!z) return '';
    const c = z.cfg || {};
    const estate = t.stagione !== 'inverno';
    const prog = estate ? 'Nessuno' : z.programma ? `${COMANDO_NOME[z.programma]} ${gradi(c[z.programma])}` : '—';
    const fino = estate ? 'primavera-estate' : z.prossimo && z.prossimo.ts ? `fino alle ${oraTxt(z.prossimo.ts)}` : '&nbsp;';
    let stato;
    if (t.manuale) stato = 'Gestione manuale: lo script registra soltanto';
    else if (estate) stato = 'Primavera-estate: lo script non accende il riscaldamento';
    else if (z.hold) stato = z.hold.fino ? `${z.hold.motivo ? cap(z.hold.motivo) : 'Modifica a mano'}: torna al programma alle ${oraTxt(z.hold.fino)}` : `${cap(z.hold.motivo || 'Spento a mano')}: resta così finché non lo cambi`;
    else if (z.ultima) stato = `${z.ultima.testo} (${shutterWhen(z.ultima.ts)})`;
    else if (!z.temp && !z.setpoint) stato = 'In attesa dei primi dati da IFTTT';
    else stato = 'Il programma partirà al prossimo controllo';
    return `
      <div class="termo-zone" data-zona="${id}">
        <div class="termo-zone-head"><b>${esc(nome)} ${onOffBadge(z, t)}</b><span>max ${gradi(c.base)}</span></div>
        <div class="termo-vals">
          <div><span>Stanza</span><b>${gradi(z.temp && z.temp.v)}</b>${quando(z.temp)}</div>
          <div><span>Impostata</span><b>${gradi(z.setpoint && z.setpoint.v)}</b>${quando(z.setpoint)}</div>
          <div><span>Programma</span><b class="termo-prog">${esc(prog)}</b><small>${fino}</small></div>
        </div>
        <p class="termo-state${z.hold && !t.manuale && !estate ? ' on' : ''}">${esc(stato)}</p>
      </div>`;
  };

  el.innerHTML = `
    <div class="termo-head">
      <span class="dev-icon t-orange">${svg('thermo')}</span>
      <span class="shutter-text">
        <span class="shutter-label">Termostati Vimar</span>
        <span class="shutter-sub">${t.manuale ? '<b class="termo-man">Gestione manuale</b> · ' : ''}${esc(STAGIONE_NOME[t.stagione])}${t.cfg.stagione === 'auto' ? '' : ' (scelta a mano)'}</span>
      </span>
      ${isReadOnly() ? '' : `<button class="small-btn" type="button" id="termo-edit">Cambia</button>`}
    </div>
    ${ZONE.map(zona).join('')}
    <p class="termo-habits">${anticipoTxt(t)}</p>`;
  el.hidden = false;
  el.querySelector('#termo-edit')?.addEventListener('click', () => openTermostatoSheet(MODEL || m));
}

// Riga in fondo alla scheda: anticipo, rientro abituale, spento per sbaglio
function anticipoTxt(t) {
  const c = t.cfg || {}, oggi = t.anticipoOggi;
  if (t.manuale) return 'Gestione manuale attiva: lo script registra temperature e modifiche ma non comanda i termostati. Si spegne in Impostazioni.';
  if (t.stagione !== 'inverno') return 'Primavera-estate: lo script non accende il riscaldamento; a casa vuota spegne i termostati.';
  const spento = c.spento ? ` Spento a mano: riprende il programma dopo ${durataTxt(c.spento)}.` : '';
  if (!c.anticipo) return 'Anticipo sul rientro: spento.' + spento;
  let s = `Rientro abituale: ${esc(abitudiniTxt(t))}. Anticipo ${c.anticipo} min.` + spento;
  if (oggi && oggi.fase === 'attivo') s += ` Oggi programma acceso in anticipo per il rientro delle ${esc(oggi.ora)}.`;
  else if (oggi && oggi.fase === 'scaduto') s += ' Oggi nessun rientro dopo l’anticipo: di nuovo Ridotta.';
  else if (oggi && oggi.fase === 'rientrato') s += ' Oggi anticipo riuscito: siete rientrati.';
  return s;
}

/* ---- Pannello impostazioni ---- */
function openTermostatoSheet(m) {
  const t = termo(m);
  if (!t) { toast('Lo script non ha ancora la parte dei termostati.', 'err', 3200); return; }
  if (!t.versione) { toast('Carica prima il nuovo 32.termostato.gs nello script.', 'err', 3600); return; }
  const c = { ...t.cfg }, d = t.predefiniti || {};
  const [daM, daG] = String(c.invernoDa).split('-').map(Number);
  const [aM, aG] = String(c.invernoA).split('-').map(Number);
  const opt = (n, sel, lab) => `<option value="${n}"${n === sel ? ' selected' : ''}>${lab || n}</option>`;
  const giorni = sel => Array.from({ length: 31 }, (_, i) => opt(i + 1, sel)).join('');
  const mesi = sel => MESI.map((x, i) => opt(i + 1, sel, x)).join('');
  const gradiInput = (id, v, lab, min, max) =>
    `<label class="fld"><span>${lab}</span><input type="number" id="${id}" inputmode="decimal" min="${min}" max="${max}" step="0.5" value="${v}"></label>`;
  const zonaHtml = ([id, nome]) => {
    const z = t.zone[id].cfg;
    return `
      <div class="tm-zone">
        <h3>${nome}</h3>
        <div class="fld-row tm-3">
          ${gradiInput('tm-comfort-' + id, z.comfort, 'Comfort', 5, 30)}
          ${gradiInput('tm-ridotta-' + id, z.ridotta, 'Ridotta', 5, 30)}
          ${gradiInput('tm-base-' + id, z.base, 'Massimo', 15, 25)}
        </div>
        <label class="fld"><span>Fasce Comfort · lunedì–venerdì</span><input type="text" id="tm-fer-${id}" value="${esc(z.feriali)}" placeholder="06:30-08:30, 17:00-22:30" autocomplete="off"></label>
        <label class="fld"><span>Fasce Comfort · sabato e domenica</span><input type="text" id="tm-wk-${id}" value="${esc(z.weekend)}" placeholder="08:00-23:00" autocomplete="off"></label>
        <p class="fld-hint">Fuori dalle fasce: Ridotta. Separa le fasce con una virgola; lascia vuoto per Ridotta tutto il giorno.</p>
      </div>`;
  };
  const dz = (d.zone || {});

  const wrap = document.createElement('div');
  wrap.className = 'se';
  wrap.innerHTML = `
    <p class="sheet-note">I termostati restano in Manuale e lo script attiva gli scenari Vimar <b>Comfort</b> e <b>Ridotta</b> di ogni piano. Le temperature qui sotto devono essere le stesse salvate negli scenari Vimar: se ne cambi una, cambia anche lo scenario.</p>
    ${ZONE.map(zonaHtml).join('')}
    <div class="tm-zone">
      <h3>Automatismi (per tutta la casa)</h3>
      <label class="fld"><span>Modifica a mano: torna al programma</span><select id="tm-ritorno">${[0, 60, 120, 180, 240].map(x => opt(x, Number(c.ritorno || 0), x ? `dopo ${durataTxt(x)}` : 'Alla prossima fascia')).join('')}</select></label>
      <p class="fld-hint">Sopra il massimo lo script rimette subito il programma.</p>
      <label class="fld"><span>Anticipo sul rientro abituale</span><select id="tm-anticipo">${[0, 15, 30, 45, 60, 90, 120].map(x => opt(x, Number(c.anticipo || 0), x ? `${x} minuti prima` : 'Spento')).join('')}</select></label>
      <p class="fld-hint">A casa vuota (sempre in Ridotta) il programma riparte prima dell’ora abituale di rientro: ${esc(abitudiniTxt(t))}.</p>
      <label class="fld"><span>Spento a mano con persone in casa: riprendi dopo</span><select id="tm-spento">${[0, 30, 60, 90, 120, 180, 240].map(x => opt(x, Number(c.spento ?? 60), x ? durataTxt(x) : 'Mai')).join('')}</select></label>
    </div>
    <div class="tm-zone">
      <h3>Stagione (per tutta la casa)</h3>
      <div class="fld">
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
      <p class="fld-hint">Il resto dell’anno è primavera-estate: niente programma, e a casa vuota termostati spenti.</p>
    </div>
    <p class="sheet-error" id="tm-err" role="alert"></p>
    <div class="sheet-actions">
      <button class="btn-primary" type="button" id="tm-save">Salva</button>
      <button class="btn-ghost" type="button" id="tm-reset">Ripristina predefiniti</button>
    </div>
    <p class="sheet-note small">Predefiniti: ${ZONE.map(([id, nome]) => { const z = dz[id] || {}; return `${nome.split(' · ')[1]} comfort ${gradi(z.comfort)}, ridotta ${gradi(z.ridotta)}, feriali ${z.feriali}, weekend ${z.weekend}`; }).join('; ')}; anticipo ${d.anticipo ?? 30} minuti; stagione dalla data, autunno-inverno dal ${dataTxt(d.invernoDa)} al ${dataTxt(d.invernoA)}.</p>`;
  openSheet('Termostati', wrap);

  const $w = s => wrap.querySelector(s);
  const err = $w('#tm-err');
  const num = s => Number(String($w(s).value).replace(',', '.'));
  const drawSeg = () => wrap.querySelectorAll('.tm-seg .seg-btn').forEach(b => {
    const on = b.dataset.s === c.stagione; b.classList.toggle('is-active', on); b.setAttribute('aria-pressed', String(on));
  });
  drawSeg();
  wrap.querySelector('.tm-seg').addEventListener('click', e => { const b = e.target.closest('[data-s]'); if (!b) return; c.stagione = b.dataset.s; drawSeg(); });

  const pad = n => String(n).padStart(2, '0');
  const mmdd = (g, mm) => `${pad($w(mm).value)}-${pad($w(g).value)}`;
  const finito = (r, msg) => {
    if (r && r.ok !== false) {
      if (MODEL && r.termostato) { MODEL.termostato = r.termostato; saveModel(MODEL); renderTermostatoCard(MODEL); renderSettings(MODEL); }
      toast(msg, 'ok'); closeSheet(); reloadSoon(800);
    } else if (r) err.textContent = 'Lo script non ha accettato i valori' + (r.error ? ` (${r.error})` : '') + '.';
  };
  const fasciaOk = s => !s.trim() || s.split(/[,;]+/).every(x => /^\s*\d{1,2}[:.]\d{2}\s*[-–]\s*\d{1,2}[:.]\d{2}\s*$/.test(x));

  $w('#tm-save').addEventListener('click', e => busy(e.currentTarget, async () => {
    err.textContent = '';
    const params = { stagione: c.stagione, invernoDa: mmdd('#tm-da-g', '#tm-da-m'), invernoA: mmdd('#tm-a-g', '#tm-a-m'),
                     anticipo: $w('#tm-anticipo').value, spento: $w('#tm-spento').value, ritorno: $w('#tm-ritorno').value };
    for (const [id, nome] of ZONE) {
      const piano = nome.split(' · ')[1];
      const comfort = num('#tm-comfort-' + id), ridotta = num('#tm-ridotta-' + id), base = num('#tm-base-' + id);
      if ([comfort, ridotta].some(x => isNaN(x) || x < 5 || x > 30)) { err.textContent = `${piano}: le temperature devono essere tra 5° e 30°.`; return; }
      if (isNaN(base) || base < 15 || base > 25) { err.textContent = `${piano}: il massimo deve essere tra 15° e 25°.`; return; }
      if (ridotta > comfort) { err.textContent = `${piano}: la Ridotta non può superare il Comfort.`; return; }
      if (comfort > base) { err.textContent = `${piano}: il Comfort non può superare il massimo.`; return; }
      const fer = $w('#tm-fer-' + id).value, wk = $w('#tm-wk-' + id).value;
      if (!fasciaOk(fer) || !fasciaOk(wk)) { err.textContent = `${piano}: scrivi le fasce come 06:30-08:30, separate da una virgola.`; return; }
      Object.assign(params, { ['comfort_' + id]: comfort, ['ridotta_' + id]: ridotta, ['base_' + id]: base, ['feriali_' + id]: fer, ['weekend_' + id]: wk });
    }
    const r = await callAdmin('set_termostato', params, { noUndo: true });
    finito(r, 'Termostati: impostazioni salvate');
  }));
  $w('#tm-reset').addEventListener('click', e => busy(e.currentTarget, async () => {
    err.textContent = '';
    const r = await callAdmin('set_termostato', { reset: '1' }, { noUndo: true });
    finito(r, 'Termostati: valori predefiniti ripristinati');
  }));
}

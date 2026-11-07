'use strict';
/* ============================================================
   TERMOSTATI VIMAR: lo script fa da termostato (32.termostato.gs).
   Obiettivo = Comfort nelle fasce, Ridotta fuori (o a casa vuota),
   oppure una temperatura scelta al volo qui. Lo script accende
   (scenario "Scalda") e ferma (scenario "Ferma") ogni piano
   guardando la temperatura della stanza.
   ============================================================ */
const MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
const STAGIONE_NOME = { inverno: 'autunno-inverno', estate: 'primavera-estate' };
const ZONE = [['giorno', 'Zona Giorno · 3° piano'], ['notte', 'Zona Notte · 4° piano']];
const COMANDO_NOME = { comfort: 'Comfort', ridotta: 'Ridotta', off: 'Spento' };
const CALDAIA_NOME = { scalda: 'Scalda', ferma: 'Ferma', off: 'Spento', comfort: 'Comfort', ridotta: 'Ridotta' };

const termo = m => (m && m.termostato && m.termostato.zone) ? m.termostato : null;
const gradi = n => (n === null || n === undefined || isNaN(Number(n))) ? '—' : String(Math.round(Number(n) * 10) / 10).replace('.', ',') + '°';
const durataTxt = min => min % 60 === 0 ? `${min / 60} ${min === 60 ? 'ora' : 'ore'}` : (min > 60 ? `${Math.floor(min / 60)} h ${min % 60} min` : `${min} min`);
const dataTxt = mmdd => { const [mm, dd] = String(mmdd || '').split('-').map(Number); return mm ? `${dd} ${MESI[mm - 1]}` : '—'; };
const oraTxt = ms => fmtTime(new Date(Number(ms)).toISOString());
// "alle 22:30" se è oggi, altrimenti "fino a lunedì alle 06:00"
const GIORNI = ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato'];
function finoTxt(ms) {
  const d = new Date(Number(ms)), oggi = new Date();
  if (d.toDateString() === oggi.toDateString()) return `fino alle ${oraTxt(ms)}`;
  const domani = new Date(oggi); domani.setDate(oggi.getDate() + 1);
  return `fino a ${d.toDateString() === domani.toDateString() ? 'domani' : GIORNI[d.getDay()]} alle ${oraTxt(ms)}`;
}

// Stato da mostrare: OFF (spento), A MANO (modifica rispettata), COMFORT, RIDOTTA, — (non noto)
function statoZona(z, t) {
  if (!z) return { cls: 'unk', txt: '—', tip: 'Stato non ancora ricevuto' };
  const spento = z.modo && /\boff\b|spent|disattiv|stop/i.test(String(z.modo.v));
  if (spento) return { cls: 'off', txt: 'OFF', tip: 'Spento' };
  // Con la gestione manuale o in primavera-estate lo script non comanda: conta solo il termostato
  const comanda = !t || (!t.manuale && t.stagione === 'inverno');
  if (!comanda) return z.modo && z.modo.v ? { cls: 'on', txt: 'ON', tip: `Modalità «${z.modo.v}»` } : { cls: 'unk', txt: '—', tip: 'Stato non ancora ricevuto' };
  if (z.hold) return { cls: 'man', txt: 'A MANO', tip: 'Modifica a mano rispettata dallo script' };
  if (z.comando === 'scalda') return { cls: 'on', txt: 'SCALDA', tip: `Sta scaldando fino a ${gradi(z.obiettivo)}` };
  if (z.comando === 'ferma') return { cls: 'stop', txt: 'FERMO', tip: `Obiettivo ${gradi(z.obiettivo)} raggiunto` };
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
    b.addEventListener('click', () => {
      haptic();
      const tt = termo(MODEL || m), id = b.id === 'tc-floor-notte' || /notte/.test(b.dataset.zona || b.id) ? 'notte' : 'giorno';
      if (tt && tt.versione >= 3 && tt.zone[id]) openTermoRapido(id);
      else activateTab('devices');
    });
  });
  renderTermoAvviso(m);
}

// Avviso rosso in Home quando una zona ha un problema di sicurezza
function renderTermoAvviso(m) {
  const el = $('#termo-alert'); if (!el) return;
  const t = termo(m);
  const zone = t && !t.manuale && t.stagione === 'inverno' ? ZONE.filter(([id]) => avvisoZona(t.zone[id])) : [];
  if (!zone.length) { el.hidden = true; el.innerHTML = ''; return; }
  const [id] = zone[0], av = avvisoZona(t.zone[id]);
  const piani = zone.map(([zid]) => PIANO[zid]).join(' e ');
  el.innerHTML = `
    <span class="ib-ico">${svg('alert')}</span>
    <span class="ib-text">
      <span class="ib-title">Termostato ${esc(piani)}: ${esc(av.titolo)}</span>
      <span class="ib-sub">${esc(av.testo)}</span>
    </span>
    <span class="ib-btns">
      <a class="ib-btn" href="${esc(iftttLink())}" target="_blank" rel="noopener">Apri IFTTT</a>
      ${isReadOnly() ? '' : '<button class="ib-btn ib-done" type="button">Riprova</button>'}
    </span>`;
  el.hidden = false;
  el.querySelector('.ib-done')?.addEventListener('click', e => busy(e.currentTarget, async () => {
    haptic();
    const r = await callAdmin('termostato_auto', null, { noUndo: true });
    if (!r || r.ok === false) { if (r) toast('Lo script non ha registrato il comando.', 'err'); return; }
    toast('Comando rimandato: se il problema resta, l’avviso ricompare.', 'ok', 3500);
    reloadSoon(800);
  }));
}

// Tocco su un piano nella Home: riquadro con stanza, obiettivo e − / +
function openTermoRapido(id) {
  const wrap = document.createElement('div');
  wrap.className = 'se termo-rapido';
  const disegna = () => {
    const t = termo(MODEL);
    if (!t) { closeSheet(); return; }
    const nome = ZONE.find(([zid]) => zid === id)[1];
    wrap.innerHTML = `<div class="termo-card-in">${zonaHtml(t, [id, nome])}</div>
      <div class="sheet-actions"><button class="btn-ghost" type="button" id="tr-dettagli">Tutti i termostati</button></div>`;
    wrap.querySelectorAll('.termo-volo').forEach(b => bindVolo(b, disegna));
    wrap.querySelector('#tr-dettagli').addEventListener('click', () => { closeSheet(); activateTab('devices'); });
  };
  openSheet(PIANO[id], wrap);
  disegna();
}

function termoSummary(m) {
  const t = termo(m);
  if (!t) return 'Da attivare nello script';
  if (t.manuale) return 'Gestione manuale: lo script non li comanda';
  if (!t.versione) return 'Aggiorna lo script dei termostati';
  const z = t.zone;
  return `Comfort ${gradi(z.giorno.cfg.comfort)} / ridotta ${gradi(z.giorno.cfg.ridotta)} · ${STAGIONE_NOME[t.stagione]}`;
}

const quandoTxt = x => x && x.ts ? `<small>alle ${oraTxt(x.ts)}</small>` : '<small>&nbsp;</small>';
const PIANO = { giorno: '3° piano', notte: '4° piano' };

// Testo dell'avviso di sicurezza di una zona (null se non c'è)
function avvisoZona(z) {
const a = z && z.allarme; if (!a) return null;
if (a.tipo === 'temperatura') return {
  titolo: 'riscaldamento fermato per sicurezza',
  testo: `IFTTT non manda la temperatura della stanza ${a.da ? 'dalle ' + oraTxt(a.da) : 'da tempo'}. Controlla l’applet vimar_temp_${z.nome === 'notte' || /notte/i.test(z.nome) ? 'notte' : 'giorno'}: appena arriva una temperatura riparte da solo.` };
return {
  titolo: 'il termostato non risponde',
  testo: `${CALDAIA_NOME[a.comando] || 'Il comando'} non è stato confermato nemmeno al secondo tentativo. Controlla l’applet ${a.comando === 'scalda' ? 'comfort' : 'ridotta'}_${/notte/i.test(z.nome) ? 'notte' : 'giorno'} e lo scenario Vimar.` };
}

function zonaHtml(t, [id, nome]) {
  const z = t.zone[id]; if (!z) return '';
  const c = z.cfg || {};
  const estate = t.stagione !== 'inverno';
  const v3 = t.versione >= 3;
  const fino = estate ? 'primavera-estate' : z.volo ? `al volo fino alle ${oraTxt(z.volo.fino)}`
    : z.prossimo && z.prossimo.ts ? `${COMANDO_NOME[z.programma] || ''} ${finoTxt(z.prossimo.ts)}`
    : z.programma ? `${COMANDO_NOME[z.programma]} tutto il giorno` : '&nbsp;';
  const obiettivo = estate ? 'Nessuno' : v3 ? gradi(z.obiettivo !== null && z.obiettivo !== undefined ? z.obiettivo : (z.volo ? z.volo.v : c[z.programma]))
    : z.programma ? `${COMANDO_NOME[z.programma]} ${gradi(c[z.programma])}` : '—';
  const caldaia = z.comando ? CALDAIA_NOME[z.comando] || z.comando : '—';
  const terzo = v3
    ? `<div><span>Caldaia</span><b class="termo-prog">${esc(caldaia)}</b><small>${z.setpoint ? `termostato ${gradi(z.setpoint.v)}` : '&nbsp;'}</small></div>`
    : `<div><span>Impostata</span><b>${gradi(z.setpoint && z.setpoint.v)}</b>${quandoTxt(z.setpoint)}</div>`;
  const voloVal = z.volo ? z.volo.v : (typeof z.obiettivo === 'number' ? z.obiettivo : c[z.programma] || c.comfort);
  const volo = v3 && !estate && !isReadOnly() && !t.manuale ? `
      <div class="termo-volo" data-zona="${id}" data-v="${voloVal}" data-max="${c.base}">
        <span>Al volo</span>
        <button type="button" class="tv-btn" data-d="-0.5" aria-label="Mezzo grado in meno">−</button>
        <b class="tv-val">${gradi(voloVal)}</b>
        <button type="button" class="tv-btn" data-d="0.5" aria-label="Mezzo grado in più">+</button>
        ${z.volo ? '<button type="button" class="small-btn tv-reset">Programma</button>' : ''}
      </div>` : '';
  let stato;
  const av = !t.manuale && !estate ? avvisoZona(z) : null;
  if (av) stato = `${cap(av.titolo)}. ${av.testo}`;
  else if (t.manuale) stato = 'Gestione manuale: lo script registra soltanto';
  else if (estate) stato = 'Primavera-estate: lo script non accende il riscaldamento';
  else if (z.hold) stato = z.hold.fino ? `${z.hold.motivo ? cap(z.hold.motivo) : 'Modifica a mano'}: torna al programma alle ${oraTxt(z.hold.fino)}` : `${cap(z.hold.motivo || 'Spento a mano')}: resta così finché non lo cambi`;
  else if (z.ultima) stato = `${z.ultima.testo} · ${shutterWhen(z.ultima.ts)}`;
  else if (!z.temp && !z.setpoint) stato = 'In attesa dei primi dati da IFTTT';
  else stato = 'Il programma partirà al prossimo controllo';
  return `
    <div class="termo-zone" data-zona="${id}">
      <div class="termo-zone-head"><b>${esc(nome)} ${onOffBadge(z, t)}</b><span>max ${gradi(c.base)}</span></div>
      <div class="termo-vals">
        <div><span>Stanza</span><b>${gradi(z.temp && z.temp.v)}</b>${quandoTxt(z.temp)}</div>
        <div><span>Obiettivo</span><b>${esc(obiettivo)}</b><small>${fino}</small></div>
        ${terzo}
      </div>${volo}
      <p class="termo-state${av ? ' alert' : z.hold && !t.manuale && !estate ? ' on' : ''}">${esc(stato)}</p>
    </div>`;
}

/* ---- Schede in Dispositivi ---- */
function renderTermostatoCard(m) {
  renderTermoMini(m);
  const el = $('#termo-card'); if (!el) return;
  const t = termo(m);
  if (!t) { el.hidden = true; return; }
  el.innerHTML = `
    <div class="termo-head">
      <span class="dev-icon t-orange">${svg('thermo')}</span>
      <span class="shutter-text">
        <span class="shutter-label">Termostati Vimar</span>
        <span class="shutter-sub">${t.manuale ? '<b class="termo-man">Gestione manuale</b> · ' : ''}${esc(STAGIONE_NOME[t.stagione])}${t.cfg.stagione === 'auto' ? '' : ' (scelta a mano)'}</span>
      </span>
      ${isReadOnly() ? '' : `<button class="small-btn" type="button" id="termo-edit">Cambia</button>`}
    </div>
    ${ZONE.map(zz => zonaHtml(t, zz)).join('')}
    <p class="termo-habits">${anticipoTxt(t)}</p>`;
  el.hidden = false;
  el.querySelector('#termo-edit')?.addEventListener('click', () => openTermostatoSheet(MODEL || m));
  el.querySelectorAll('.termo-volo').forEach(b => bindVolo(b));
}

// − / + al volo: si aspetta un attimo che smetti di toccare, poi un solo invio
function bindVolo(box, dopo) {
  const zona = box.dataset.zona, max = Number(box.dataset.max);
  let v = Number(box.dataset.v), timer = null;
  const val = box.querySelector('.tv-val');
  const invia = async params => {
    box.classList.add('is-busy');
    const r = await callAdmin('set_termostato', params, { noUndo: true });
    box.classList.remove('is-busy');
    if (!r || r.ok === false) { if (r) toast(r.error ? `Non salvato: ${r.error}` : 'Lo script non ha registrato la temperatura.', 'err', 3200); return; }
    if (MODEL && r.termostato) { MODEL.termostato = r.termostato; saveModel(MODEL); renderTermostatoCard(MODEL); if (dopo) dopo(); }
    toast(params['volo_' + zona] === 'off' ? 'Torna il programma' : `${zona === 'giorno' ? '3°' : '4°'} piano: ${gradi(v)} fino al prossimo cambio di fascia`, 'ok', 2600);
  };
  box.querySelectorAll('.tv-btn').forEach(b => b.addEventListener('click', () => {
    haptic();
    v = Math.min(max, Math.max(8, Math.round((v + Number(b.dataset.d)) * 2) / 2));
    val.textContent = gradi(v);
    clearTimeout(timer);
    timer = setTimeout(() => invia({ ['volo_' + zona]: v }), 1200);
  }));
  box.querySelector('.tv-reset')?.addEventListener('click', () => { clearTimeout(timer); invia({ ['volo_' + zona]: 'off' }); });
}

// Riga in fondo alla scheda: anticipo, rientro abituale, spento per sbaglio
function anticipoTxt(t) {
  const c = t.cfg || {}, oggi = t.anticipoOggi;
  if (t.manuale) return 'Gestione manuale attiva: lo script registra temperature e modifiche ma non comanda i termostati. Si spegne in Impostazioni.';
  if (t.stagione !== 'inverno') return 'Primavera-estate: lo script non accende il riscaldamento; a casa vuota spegne i termostati.';
  const isteresi = c.isteresi ? `Scalda quando la stanza è sotto l’obiettivo di ${gradi(c.isteresi).replace('°', '')}°, si ferma quando lo raggiunge. ` : '';
  const spento = c.spento ? ` Spento a mano: riprende il programma dopo ${durataTxt(c.spento)}.` : '';
  if (!c.anticipo) return isteresi + 'Anticipo sul rientro: spento.' + spento;
  let s = isteresi + `Rientro abituale: ${esc(abitudiniTxt(t))}. Anticipo ${c.anticipo} min.` + spento;
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
          ${gradiInput('tm-base-' + id, z.base, 'Massimo', 16, 28)}
        </div>
        ${fasceHtml('tm-fer-' + id, 'Comfort lunedì–venerdì', z.feriali)}
        ${fasceHtml('tm-wk-' + id, 'Comfort sabato e domenica', z.weekend)}
        <p class="fld-hint">Nella barra: arancione Comfort, il resto Ridotta. "Tutto il giorno": Comfort sempre quando c’è qualcuno in casa (a casa vuota resta Ridotta).</p>
      </div>`;
  };
  const dz = (d.zone || {});

  const wrap = document.createElement('div');
  wrap.className = 'se';
  wrap.innerHTML = `
    <p class="sheet-note">Lo script fa da termostato: accende ogni piano con lo scenario Vimar <b>Scalda</b> e lo ferma con lo scenario <b>Ferma</b>, guardando la temperatura della stanza. Comfort e Ridotta li cambi qui quando vuoi. Il <b>Massimo</b> deve essere la temperatura salvata nello scenario Scalda del piano.</p>
    ${ZONE.map(zonaHtml).join('')}
    <div class="tm-zone">
      <h3>Automatismi (per tutta la casa)</h3>
      <div class="fld-row tm-3">
        ${gradiInput('tm-ferma', c.ferma ?? 15, 'Scenari Ferma', 5, 18)}
        <label class="fld"><span>Riparti sotto di</span><select id="tm-isteresi">${[0.2, 0.3, 0.5, 1].map(x => opt(x, Number(c.isteresi ?? 0.3), String(x).replace('.', ',') + '°')).join('')}</select></label>
      </div>
      <p class="fld-hint">"Scenari Ferma": la temperatura salvata negli scenari Ferma P3 e P4. "Riparti sotto di": quanto deve scendere la stanza sotto l’obiettivo prima di scaldare di nuovo.</p>
      <label class="fld"><span>Modifica a mano: torna al programma</span><select id="tm-ritorno">${[0, 60, 120, 180, 240].map(x => opt(x, Number(c.ritorno || 0), x ? `dopo ${durataTxt(x)}` : 'Alla prossima fascia')).join('')}</select></label>
      <p class="fld-hint">Se qualcuno cambia la temperatura sul termostato, il Vimar regola da solo fino a quel momento. Sopra il massimo lo script riprende subito.</p>
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
  wrap.querySelectorAll('.fx').forEach(bindFasce);

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
                     anticipo: $w('#tm-anticipo').value, spento: $w('#tm-spento').value, ritorno: $w('#tm-ritorno').value,
                     ferma: num('#tm-ferma'), isteresi: $w('#tm-isteresi').value };
    if (isNaN(params.ferma) || params.ferma < 5 || params.ferma > 18) { err.textContent = 'Scenari Ferma: tra 5° e 18°.'; return; }
    for (const [id, nome] of ZONE) {
      const piano = nome.split(' · ')[1];
      const comfort = num('#tm-comfort-' + id), ridotta = num('#tm-ridotta-' + id), base = num('#tm-base-' + id);
      if ([comfort, ridotta].some(x => isNaN(x) || x < 5 || x > 30)) { err.textContent = `${piano}: le temperature devono essere tra 5° e 30°.`; return; }
      if (isNaN(base) || base < 16 || base > 28) { err.textContent = `${piano}: il massimo deve essere tra 16° e 28°.`; return; }
      if (ridotta < params.ferma) { err.textContent = `${piano}: la Ridotta non può stare sotto la temperatura degli scenari Ferma.`; return; }
      if (ridotta > comfort) { err.textContent = `${piano}: la Ridotta non può superare il Comfort.`; return; }
      if (comfort > base) { err.textContent = `${piano}: il Comfort non può superare il Massimo.`; return; }
      const fer = $w('#tm-fer-' + id).value, wk = $w('#tm-wk-' + id).value;
      const fx = [fasceErrore(fer), fasceErrore(wk)].find(Boolean);
      if (fx || !fasciaOk(fer) || !fasciaOk(wk)) { err.textContent = `${piano}: ${fx || 'orari delle fasce non validi'}.`; return; }
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

/* ---- Fasce orarie: barra delle 24 ore + una riga per fascia ---- */
const hmMin = t => { const [h, m] = String(t).split(':').map(Number); return h * 60 + m; };
const minHm = x => `${String(Math.floor(x / 60) % 24).padStart(2, '0')}:${String(x % 60).padStart(2, '0')}`;
// "06:30-08:30, 17:00-22:30" → [[390, 510], [1020, 1350]]   (fine "00:00" o "24:00" = mezzanotte)
function fasceDa(testo) {
  return String(testo || '').split(/[,;]+/).map(x => x.trim()).filter(Boolean).map(x => {
    const m = /^(\d{1,2})[:.](\d{2})\s*[-–]\s*(\d{1,2})[:.](\d{2})$/.exec(x);
    if (!m) return null;
    const a = +m[1] * 60 + +m[2]; let b = +m[3] * 60 + +m[4]; if (b === 0) b = 1440;
    return [a, b];
  }).filter(Boolean);
}
const fasceTesto = l => l.map(([a, b]) => `${minHm(a)}-${b >= 1440 ? '24:00' : minHm(b)}`).join(', ');
function fasceErrore(testo) {
  const l = fasceDa(testo).slice().sort((x, y) => x[0] - y[0]);
  for (const [a, b] of l) if (b <= a) return `nella fascia ${minHm(a)}–${minHm(b)} la fine deve venire dopo l’inizio`;
  for (let i = 1; i < l.length; i++) if (l[i][0] < l[i - 1][1]) return 'due fasce si sovrappongono';
  return '';
}
// Tendina a quarti d'ora, sempre in 24 ore (00:00 … 24:00)
function orari(sel, da, a) {
  let h = '';
  const scelto = Math.round(sel / 15) * 15;
  for (let x = da; x <= a; x += 15) h += `<option value="${x}"${x === scelto ? ' selected' : ''}>${x === 1440 ? '24:00' : minHm(x)}</option>`;
  return h;
}
function fasceHtml(id, titolo, testo) {
  return `<div class="fx" data-id="${id}">
    <div class="fx-head"><span>${titolo}</span>
      <div class="seg fx-mode" role="group" aria-label="${titolo}">
        <button type="button" class="seg-btn" data-mode="orari">Orari</button>
        <button type="button" class="seg-btn" data-mode="tutto">Tutto il giorno</button>
      </div>
    </div>
    <div class="fx-bar" aria-hidden="true"><div class="fx-track"></div><div class="fx-ticks"><span>0</span><span>6</span><span>12</span><span>18</span><span>24</span></div></div>
    <div class="fx-list"></div>
    <button type="button" class="small-btn fx-add">+ Fascia</button>
    <input type="hidden" id="${id}" value="${esc(testo || '')}">
  </div>`;
}
function bindFasce(box) {
  const hidden = box.querySelector('input[type=hidden]');
  const list = box.querySelector('.fx-list'), track = box.querySelector('.fx-track');
  let fasce = fasceDa(hidden.value);
  const tuttoIlGiorno = l => l.length === 1 && l[0][0] === 0 && l[0][1] >= 1440;
  let modo = tuttoIlGiorno(fasce) ? 'tutto' : 'orari';
  let orariPrima = modo === 'orari' ? fasce : [];
  const salva = () => {
    hidden.value = fasceTesto(fasce);
    track.innerHTML = fasce.filter(([a, b]) => b > a).map(([a, b]) =>
      `<i style="left:${(a / 1440 * 100).toFixed(2)}%;width:${((b - a) / 1440 * 100).toFixed(2)}%"></i>`).join('');
  };
  const disegna = () => {
    box.classList.toggle('is-tutto', modo === 'tutto');
    box.querySelectorAll('.fx-mode .seg-btn').forEach(b => b.classList.toggle('is-active', b.dataset.mode === modo));
    if (modo === 'tutto') { list.innerHTML = '<p class="fx-empty">Comfort dalle 00:00 alle 24:00 (con qualcuno in casa)</p>'; salva(); return; }
    list.innerHTML = fasce.length ? fasce.map(([a, b], i) => `
      <div class="fx-row" data-i="${i}">
        <select class="fx-da" aria-label="Inizio">${orari(a, 0, 1425)}</select>
        <span class="fx-sep">→</span>
        <select class="fx-a" aria-label="Fine">${orari(b, 15, 1440)}</select>
        <button type="button" class="fx-del" aria-label="Togli la fascia">×</button>
      </div>`).join('') : '<p class="fx-empty">Nessuna fascia: Ridotta tutto il giorno</p>';
    salva();
  };
  list.addEventListener('change', e => {
    const row = e.target.closest('.fx-row'); if (!row || !e.target.value) return;
    const i = +row.dataset.i;
    if (e.target.classList.contains('fx-da')) fasce[i][0] = Number(e.target.value);
    else fasce[i][1] = Number(e.target.value);
    salva();
  });
  list.addEventListener('click', e => {
    const del = e.target.closest('.fx-del'); if (!del) return;
    fasce.splice(+del.closest('.fx-row').dataset.i, 1); disegna();
  });
  box.querySelectorAll('.fx-mode .seg-btn').forEach(b => b.addEventListener('click', () => {
    if (b.dataset.mode === modo) return;
    modo = b.dataset.mode;
    if (modo === 'tutto') { orariPrima = fasce; fasce = [[0, 1440]]; }
    else fasce = orariPrima.length ? orariPrima : [[420, 540]];
    disegna();
  }));
  box.querySelector('.fx-add').addEventListener('click', () => {
    const fine = fasce.reduce((m, f) => Math.max(m, f[1]), 0);
    const a = fasce.length ? Math.min(fine + 60, 1380) : 420;
    fasce.push([a, Math.min(a + 120, 1440)]);
    fasce.sort((x, y) => x[0] - y[0]); disegna();
  });
  disegna();
}

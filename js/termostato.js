'use strict';
/* ============================================================
   TERMOSTATI VIMAR (Zona Giorno, Zona Notte) — impostazioni per
   zona (base, delta, tempo), stagione comune e stato in Dispositivi.
   Le regole le applica lo script (32.termostato.gs).
   ============================================================ */
const MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
const STAGIONE_NOME = { inverno: 'autunno-inverno', estate: 'primavera-estate' };
const ZONE = [['giorno', 'Zona Giorno · 3° piano'], ['notte', 'Zona Notte · 4° piano']];

const termo = m => (m && m.termostato && m.termostato.zone) ? m.termostato : null;
const gradi = n => (n === null || n === undefined || isNaN(Number(n))) ? '—' : String(Math.round(Number(n) * 10) / 10).replace('.', ',') + '°';
const durataTxt = min => min % 60 === 0 ? `${min / 60} ${min === 60 ? 'ora' : 'ore'}` : (min > 60 ? `${Math.floor(min / 60)} h ${min % 60} min` : `${min} min`);
const dataTxt = mmdd => { const [mm, dd] = String(mmdd || '').split('-').map(Number); return mm ? `${dd} ${MESI[mm - 1]}` : '—'; };
const oraTxt = ms => fmtTime(new Date(Number(ms)).toISOString());

// true = acceso, false = spento, null = non ancora noto (dalla modalità mandata da IFTTT)
function termoAcceso(z) {
  if (!z || !z.modo || z.modo.v === undefined || z.modo.v === '') return null;
  return !/\boff\b|spent|disattiv|stop/i.test(String(z.modo.v));
}
// ON (verde) per Auto/Heat, ECO (giallo) per Eco, OFF (rosso), — (grigio) se non ancora noto
function onOffBadge(z) {
  const a = termoAcceso(z);
  const eco = a && /\beco/i.test(String(z.modo.v));
  const cls = a === null ? 'unk' : eco ? 'eco' : a ? 'on' : 'off';
  const txt = a === null ? '—' : eco ? 'ECO' : a ? 'ON' : 'OFF';
  const tip = a === null ? 'Stato non ancora ricevuto' : `${eco ? 'In Eco' : a ? 'Acceso' : 'Spento'} · modalità «${z.modo.v}»`;
  return `<span class="onoff ${cls}" title="${esc(tip)}" aria-label="${esc(tip)}"><i></i>${txt}</span>`;
}

// "Feriali 18:30 · weekend 17:00", oppure cosa manca per impararlo
function abitudiniTxt(t) {
  const a = t && t.abitudini;
  if (!a || (!a.feriali && !a.weekend)) {
    const n = a ? Math.max(a.giorniFeriali || 0, a.giorniWeekend || 0) : 0;
    return `Le sto ancora imparando dallo storico (${n} ${n === 1 ? 'giorno' : 'giorni'} con un rientro; ne servono almeno 3 per tipo).`;
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
    if (st) st.innerHTML = z ? onOffBadge(z) : '';
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
  return `Giorno ${gradi(t.zone.giorno.cfg.base)} · notte ${gradi(t.zone.notte.cfg.base)} · ${STAGIONE_NOME[t.stagione]}`;
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
    let stato;
    if (z.sessione) stato = `In regolazione dalle ${oraTxt(z.sessione.inizio)} · controllo alle ${oraTxt(z.sessione.scadenza)}`;
    else if (z.ultima) stato = `${z.ultima.testo} (${shutterWhen(z.ultima.ts)})`;
    else if (!z.temp && !z.setpoint) stato = 'In attesa dei primi dati da IFTTT';
    else stato = 'Nessuna regolazione in corso';
    return `
      <div class="termo-zone" data-zona="${id}">
        <div class="termo-zone-head"><b>${esc(nome)} ${onOffBadge(z)}</b><span>base ${gradi(z.cfg.base)} · ${durataTxt(z.cfg.minuti)}</span></div>
        <div class="termo-vals">
          <div><span>Stanza</span><b>${gradi(z.temp && z.temp.v)}</b>${quando(z.temp)}</div>
          <div><span>Impostata</span><b>${gradi(z.setpoint && z.setpoint.v)}</b>${quando(z.setpoint)}</div>
          <div><span>Obiettivo</span><b>${gradi(z.obiettivo)}</b><small>impostata − ${gradi(z.cfg.delta)}</small></div>
        </div>
        <p class="termo-state${z.sessione ? ' on' : ''}">${esc(stato)}</p>
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

// Riga in fondo alla scheda: anticipo e rientro abituale
function anticipoTxt(t) {
  const c = t.cfg || {}, oggi = t.anticipoOggi;
  if (t.manuale) return 'Gestione manuale attiva: lo script registra temperature e accensioni ma non comanda i termostati. Si spegne in Impostazioni.';
  if (!c.anticipo) return 'Anticipo sul rientro: spento.' + (c.spento ? ` Spento per sbaglio: Auto dopo ${durataTxt(c.spento)}.` : '');
  if (t.stagione !== 'inverno') return 'Anticipo sul rientro: attivo solo in autunno-inverno.';
  let s = `Rientro abituale: ${esc(abitudiniTxt(t))}. Anticipo ${c.anticipo} min.` + (c.spento ? ` Spento per sbaglio: Auto dopo ${durataTxt(c.spento)}.` : '');
  if (oggi && oggi.fase === 'auto') s += ` Oggi termostati in Auto per il rientro delle ${esc(oggi.ora)}.`;
  else if (oggi && oggi.fase === 'eco') s += ` Oggi nessun rientro dopo l’anticipo: di nuovo Eco.`;
  else if (oggi && oggi.fase === 'rientrato') s += ` Oggi anticipo riuscito: siete rientrati.`;
  return s;
}

/* ---- Pannello impostazioni ---- */
function openTermostatoSheet(m) {
  const t = termo(m);
  if (!t) { toast('Lo script non ha ancora la parte dei termostati.', 'err', 3200); return; }
  const c = { ...t.cfg }, d = t.predefiniti || {};
  const [daM, daG] = String(c.invernoDa).split('-').map(Number);
  const [aM, aG] = String(c.invernoA).split('-').map(Number);
  const opt = (n, sel, lab) => `<option value="${n}"${n === sel ? ' selected' : ''}>${lab || n}</option>`;
  const giorni = sel => Array.from({ length: 31 }, (_, i) => opt(i + 1, sel)).join('');
  const mesi = sel => MESI.map((x, i) => opt(i + 1, sel, x)).join('');
  const minutiOpts = sel => {
    const l = [30, 45, 60, 90, 120, 150, 180, 240, 300, 360];
    if (!l.includes(sel)) { l.push(sel); l.sort((x, y) => x - y); }
    return l.map(x => opt(x, sel, durataTxt(x))).join('');
  };
  const zonaHtml = ([id, nome]) => {
    const z = t.zone[id].cfg;
    return `
      <div class="tm-zone">
        <h3>${nome}</h3>
        <div class="fld-row">
          <label class="fld"><span>Base (massimo)</span><input type="number" id="tm-base-${id}" inputmode="decimal" min="15" max="25" step="0.5" value="${z.base}"></label>
          <label class="fld"><span>Delta</span><input type="number" id="tm-delta-${id}" inputmode="decimal" min="0.1" max="3" step="0.1" value="${z.delta}"></label>
        </div>
        <p class="fld-hint" id="tm-target-${id}"></p>
        <label class="fld"><span>Tempo di regolazione</span><select id="tm-min-${id}">${minutiOpts(z.minuti)}</select></label>
      </div>`;
  };
  const dz = (d.zone || {});

  const wrap = document.createElement('div');
  wrap.className = 'se';
  wrap.innerHTML = `
    <p class="sheet-note">Le temperature si impostano nell’app Vimar (programma Auto, Eco). Lo script sceglie la modalità: se qualcuno supera la base rimette quella zona in Auto; se dopo il tempo di regolazione la stanza non arriva alla temperatura impostata − delta, la rimette in Auto (o in Eco/spenta a casa vuota). La base deve essere almeno la T3 del programma Vimar.</p>
    ${ZONE.map(zonaHtml).join('')}
    <div class="tm-zone">
      <h3>Automatismi (per tutta la casa)</h3>
      <label class="fld"><span>Anticipo sul rientro abituale</span><select id="tm-anticipo">${[0, 15, 30, 45, 60, 90, 120].map(x => opt(x, Number(c.anticipo || 0), x ? `${x} minuti prima` : 'Spento')).join('')}</select></label>
      <p class="fld-hint">A casa vuota, in autunno-inverno, rimette Auto prima dell’ora abituale di rientro; se entro un’ora non rientra nessuno, torna in Eco. Rientro abituale: ${esc(abitudiniTxt(t))}</p>
      <label class="fld"><span>Spento per sbaglio: rimetti Auto dopo</span><select id="tm-spento">${[0, 30, 60, 90, 120, 180, 240].map(x => opt(x, Number(c.spento ?? 60), x ? durataTxt(x) : 'Mai')).join('')}</select></label>
      <p class="fld-hint">In autunno-inverno, con qualcuno in casa, una zona rimasta spenta più di questo tempo torna in Auto (controllo ogni 15 minuti). Per tenere spento un piano di proposito, attiva la gestione manuale.</p>
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
      <p class="fld-hint">Il resto dell’anno è primavera-estate.</p>
    </div>
    <p class="sheet-error" id="tm-err" role="alert"></p>
    <div class="sheet-actions">
      <button class="btn-primary" type="button" id="tm-save">Salva</button>
      <button class="btn-ghost" type="button" id="tm-reset">Ripristina predefiniti</button>
    </div>
    <p class="sheet-note small">Predefiniti: ${ZONE.map(([id, nome]) => { const z = dz[id] || {}; return `${nome.toLowerCase()} base ${gradi(z.base)}, delta ${gradi(z.delta)}, ${durataTxt(z.minuti || 120)}`; }).join('; ')}; anticipo ${d.anticipo || 30} minuti; spento per sbaglio dopo ${durataTxt(d.spento || 60)}; stagione dalla data, autunno-inverno dal ${dataTxt(d.invernoDa)} al ${dataTxt(d.invernoA)}.</p>`;
  openSheet('Termostati', wrap);

  const $w = s => wrap.querySelector(s);
  const err = $w('#tm-err');
  const num = s => Number(String($w(s).value).replace(',', '.'));
  const showTarget = id => {
    const b = num('#tm-base-' + id), dl = num('#tm-delta-' + id);
    $w('#tm-target-' + id).textContent = isNaN(b) || isNaN(dl) ? '' : `Raggiunta a temperatura impostata − ${gradi(dl)} (al massimo ${gradi(b - dl)})`;
  };
  const drawSeg = () => wrap.querySelectorAll('.tm-seg .seg-btn').forEach(b => {
    const on = b.dataset.s === c.stagione; b.classList.toggle('is-active', on); b.setAttribute('aria-pressed', String(on));
  });
  ZONE.forEach(([id]) => {
    showTarget(id);
    ['#tm-base-' + id, '#tm-delta-' + id].forEach(s => $w(s).addEventListener('input', () => showTarget(id)));
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

  $w('#tm-save').addEventListener('click', e => busy(e.currentTarget, async () => {
    err.textContent = '';
    const params = { stagione: c.stagione, invernoDa: mmdd('#tm-da-g', '#tm-da-m'), invernoA: mmdd('#tm-a-g', '#tm-a-m'), anticipo: $w('#tm-anticipo').value, spento: $w('#tm-spento').value };
    for (const [id, nome] of ZONE) {
      const base = num('#tm-base-' + id), delta = num('#tm-delta-' + id);
      if (isNaN(base) || base < 15 || base > 25) { err.textContent = `${nome}: la base deve essere tra 15° e 25°.`; return; }
      if (isNaN(delta) || delta < 0.1 || delta > 3) { err.textContent = `${nome}: il delta deve essere tra 0,1° e 3°.`; return; }
      params['base_' + id] = base; params['delta_' + id] = delta; params['minuti_' + id] = $w('#tm-min-' + id).value;
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

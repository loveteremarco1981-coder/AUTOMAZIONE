'use strict';
/* ============================================================
   OTTONE — struttura propria della Home (solo con l'aspetto Ottone).
   Al posto di "Scene" e "In questo momento":
     · intestazione con il nome della casa e lo stato a destra
     · "Comandi rapidi": tasselli quadrati delle scene e un tassello
       alto per le tapparelle, ottone quando è acceso
     · i due piani come schede con la temperatura grande, lo stato
       della caldaia e il tocco che apre il quadrante del termostato
     · l'esterno con temperatura e umidità in numeri grandi e sottili
   Il resto della Home (Preferiti, Persone, Eventi, Andamento) resta,
   con i colori di Ottone. Tutti i comandi usano le stesse funzioni
   dell'app: scene, tapparelle e termostati si comportano uguali.
   ============================================================ */

const isOttone = () => document.documentElement.dataset.skin === 'ottone';

function renderOttone(m) {
  let host = $('#ot-home');
  if (!isOttone()) { if (host) host.hidden = true; return; }
  const view = $('#view-home'); if (!view) return;
  if (!host) {
    host = document.createElement('div');
    host.id = 'ot-home';
    view.insertBefore(host, view.querySelector('.hero').nextSibling);
    host.addEventListener('click', otClick);
  }
  host.hidden = false;
  m = m || MODEL || {};
  const t = termo(m);
  const scene = (typeof getScenes === 'function' ? getScenes() : (CONFIG.SCENES || DEFAULT_SCENES)).slice(0, 4);
  const su = getShuttersUp(), rec = lastShutter(null);
  const w = _wx || m.weather || {};
  const num = (v, dec) => v === null || v === undefined || isNaN(Number(v)) ? '—' : (dec ? String(Math.round(Number(v) * 10) / 10).replace('.', ',') : String(Math.round(Number(v))));

  const tassello = (sc, i) => `<button type="button" class="ot-tile" data-scene="${i}" aria-label="Scena ${esc(sc.label)}">
      <span class="ot-ico">${svg(sc.icon || 'play')}</span><span class="ot-lab">${esc(sc.label)}</span></button>`;

  const piano = id => {
    const z = t && t.zone && t.zone[id];
    const nome = id === 'giorno' ? '3° piano' : '4° piano';
    const s = z ? statoZona(z, t) : { cls: 'unk', txt: '—' };
    const caldo = z && z.comando === 'scalda';
    const ob = z && typeof z.obiettivo === 'number' ? z.obiettivo : null;
    return `<button type="button" class="ot-room${caldo ? ' caldo' : ''}" data-piano="${id}" aria-label="${nome}: apri il termostato">
      <span class="ot-room-riga"><span class="ot-room-nome">${nome}</span><span class="onoff ${s.cls}">${esc(s.txt)}</span></span>
      <span class="ot-room-val"><b>${z && z.temp ? num(z.temp.v, 1) : '—'}°</b><small>${ob !== null ? `→ ${num(ob, 1)}°` : (z && z.modo ? esc(z.modo.v) : '')}</small></span>
    </button>`;
  };

  const persone = (Array.isArray(m.people) ? m.people : []).filter(p => p.onlineSmart).length;
  const stato = ($('#state-banner .sb-title') || $('#state-banner b') || {}).textContent || '';

  host.innerHTML = `
    <div class="ot-head">
      <h2 class="ot-titolo">Casa</h2>
      <span class="ot-badge">${svg('home')}<span>${persone ? `${persone} in casa` : 'Casa vuota'}</span></span>
    </div>

    <div class="ot-sez">Comandi rapidi</div>
    <div class="ot-quick">
      ${scene.map(tassello).join('')}
      <button type="button" class="ot-tile ot-tall${su ? ' on' : ''}" data-tapparelle aria-pressed="${su}" aria-label="Tapparelle: ${su ? 'abbassa' : 'alza'}">
        <span class="ot-ico">${svg(su ? 'up' : 'down')}</span>
        <span class="ot-lab">${rec ? (su ? 'Aperte' : 'Chiuse') : 'Tapparelle'}</span>
      </button>
    </div>

    ${t ? `<div class="ot-sez">Piani</div><div class="ot-rooms">${piano('giorno')}${piano('notte')}</div>` : ''}

    <div class="ot-fuori">
      <div><span>Temperatura °C</span><b>${num(w.tempC, 1)}°</b></div>
      <div><span>Umidità</span><b>${num(w.humidity)}%</b></div>
      <div><span>Vento</span><b>${num(w.windKmh)}<small> km/h</small></b></div>
    </div>`;
  void stato;
}

function otClick(e) {
  const sc = e.target.closest('[data-scene]');
  if (sc) {
    const lista = typeof getScenes === 'function' ? getScenes() : (CONFIG.SCENES || DEFAULT_SCENES);
    const s = lista[Number(sc.dataset.scene)];
    if (s) busy(sc, () => runScene(s));
    return;
  }
  if (e.target.closest('[data-tapparelle]')) {
    const card = $('#fav-grid .fav-card[data-fav="tapparelle"]');
    if (card) { card.click(); setTimeout(() => renderOttone(MODEL), 900); }
    else toast('Aggiungi le tapparelle ai Preferiti per usarle da qui.', 'info', 3000);
    return;
  }
  const p = e.target.closest('[data-piano]');
  if (p) { haptic(); openTermoRapido(p.dataset.piano); }
}

/* Quadrante del termostato (nel riquadro che si apre toccando un piano).
   Si gira trascinando il pallino (o toccando un punto dell'arco): mezzo grado alla volta,
   da 15° al Massimo del piano. Lasciato il dito, il valore parte come il − / + "al volo". */
const OT_MIN = 15;
const otAng = (v, min, max) => -135 + (Math.min(max, Math.max(min, v)) - min) / (max - min) * 270;
const otPt = (a, r) => { const rad = (a - 90) * Math.PI / 180; return [100 + r * Math.cos(rad), 100 + r * Math.sin(rad)]; };
const otArco = (a0, a1, r) => { const [x0, y0] = otPt(a0, r), [x1, y1] = otPt(a1, r); return `M${x0.toFixed(1)} ${y0.toFixed(1)} A${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1.toFixed(1)} ${y1.toFixed(1)}`; };

function otQuadrante(z, t) {
  const c = z.cfg || {};
  const min = OT_MIN, max = Number(c.base) || 23;
  const ob = typeof z.obiettivo === 'number' ? z.obiettivo : (z.volo ? z.volo.v : c[z.programma]);
  const st = z.temp && typeof z.temp.v === 'number' ? z.temp.v : null;
  const sola = typeof isReadOnly === 'function' && isReadOnly();
  const estate = t && t.stagione !== 'inverno';
  const attivo = !sola && !estate && !(t && t.manuale);
  let tacche = '';
  for (let v = min; v <= max + .001; v += .5) {
    const a = otAng(v, min, max), lungo = Math.abs(v - Math.round(v)) < .01;
    const [x0, y0] = otPt(a, lungo ? 74 : 78), [x1, y1] = otPt(a, 86);
    tacche += `<line x1="${x0.toFixed(1)}" y1="${y0.toFixed(1)}" x2="${x1.toFixed(1)}" y2="${y1.toFixed(1)}" class="${lungo ? 'l' : ''}"/>`;
  }
  const v0 = ob != null ? ob : min;
  const [kx, ky] = otPt(otAng(v0, min, max), 62);
  const [sx, sy] = st != null ? otPt(otAng(st, min, max), 92) : [0, 0];
  const motivo = z.volo ? (z.volo.origine === 'termostato' ? 'messo sul termostato' : 'scelto al volo')
               : z.programma === 'comfort' ? 'Comfort' : z.programma === 'ridotta' ? 'Ridotta' : '';
  return `<div class="ot-dial${attivo ? ' attivo' : ''}" data-min="${min}" data-max="${max}" data-v="${v0}">
    <svg viewBox="0 0 200 200" role="slider" aria-label="Obiettivo" aria-valuemin="${min}" aria-valuemax="${max}" aria-valuenow="${v0}" ${attivo ? 'tabindex="0"' : ''}>
      <g class="ot-dial-t">${tacche}</g>
      <path d="${otArco(-135, 135, 62)}" class="ot-dial-base"/>
      <path d="${otArco(-135, Math.max(-134.9, otAng(v0, min, max)), 62)}" class="ot-dial-arc"/>
      <circle cx="${kx.toFixed(1)}" cy="${ky.toFixed(1)}" r="10" class="ot-dial-knob"/>
      ${st != null ? `<circle cx="${sx.toFixed(1)}" cy="${sy.toFixed(1)}" r="4" class="ot-dial-stanza"/>` : ''}
    </svg>
    <div class="ot-dial-txt"><span class="ot-dial-mot">${motivo ? esc(motivo) : 'Obiettivo'}</span><b>${ob != null ? gradi(ob) : '—'}</b><small>${st != null ? `stanza ${gradi(st)}` : ''}</small></div>
    ${attivo ? '<p class="ot-dial-hint">Trascina il pallino per cambiare</p>' : ''}
  </div>`;
}

function otBindDial(wrap, zona, ridisegna) {
  const box = wrap.querySelector('.ot-dial.attivo'); if (!box) return;
  const svgEl = box.querySelector('svg'), arc = box.querySelector('.ot-dial-arc'), knob = box.querySelector('.ot-dial-knob');
  const txt = box.querySelector('.ot-dial-txt b'), mot = box.querySelector('.ot-dial-mot');
  const min = Number(box.dataset.min), max = Number(box.dataset.max);
  let v = Number(box.dataset.v), giu = false, cambiato = false;
  const mostra = () => {
    const a = otAng(v, min, max), [x, y] = otPt(a, 62);
    arc.setAttribute('d', otArco(-135, Math.max(-134.9, a), 62));
    knob.setAttribute('cx', x.toFixed(1)); knob.setAttribute('cy', y.toFixed(1));
    txt.textContent = gradi(v); svgEl.setAttribute('aria-valuenow', v);
  };
  const daPunto = e => {
    const r = svgEl.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width * 200 - 100, y = (e.clientY - r.top) / r.height * 200 - 100;
    let a = Math.atan2(x, -y) * 180 / Math.PI;                    // 0 in alto, positivo a destra
    if (a < -135 || a > 135) a = a < 0 && a < -157.5 ? 135 : a > 157.5 ? -135 : a;   // nel buco in basso: estremo più vicino
    a = Math.min(135, Math.max(-135, a));
    const nv = Math.round((min + (a + 135) / 270 * (max - min)) * 2) / 2;
    if (nv !== v) { v = nv; cambiato = true; mostra(); if (typeof haptic === 'function') haptic(); }
  };
  const invia = async () => {
    if (!cambiato) return;
    cambiato = false;
    mot.textContent = 'Invio…'; box.classList.add('is-busy');
    const r = await callAdmin('set_termostato', { ['volo_' + zona]: v }, { noUndo: true });
    box.classList.remove('is-busy');
    if (!r || r.ok === false) { if (r) toast(r.error ? `Non salvato: ${r.error}` : 'Lo script non ha registrato la temperatura.', 'err', 3200); ridisegna(); return; }
    if (MODEL && r.termostato) { MODEL.termostato = r.termostato; saveModel(MODEL); renderTermostatoCard(MODEL); if (typeof renderOttone === 'function') renderOttone(MODEL); }
    toast(`${zona === 'giorno' ? '3°' : '4°'} piano: ${gradi(v)} fino al prossimo cambio di fascia`, 'ok', 2600);
    ridisegna();
  };
  svgEl.addEventListener('pointerdown', e => { giu = true; try { svgEl.setPointerCapture(e.pointerId); } catch (_) {} daPunto(e); e.preventDefault(); });
  svgEl.addEventListener('pointermove', e => { if (giu) daPunto(e); });
  const fine = () => { if (!giu) return; giu = false; invia(); };
  svgEl.addEventListener('pointerup', fine);
  svgEl.addEventListener('pointercancel', fine);
  svgEl.addEventListener('keydown', e => {
    const d = e.key === 'ArrowUp' || e.key === 'ArrowRight' ? .5 : e.key === 'ArrowDown' || e.key === 'ArrowLeft' ? -.5 : 0;
    if (!d) return; e.preventDefault();
    v = Math.min(max, Math.max(min, v + d)); cambiato = true; mostra();
    clearTimeout(box._t); box._t = setTimeout(invia, 1000);
  });
}

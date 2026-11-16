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
      <span class="ot-room-top" aria-hidden="true">
        <svg viewBox="0 0 100 60" preserveAspectRatio="xMidYMid slice"><path d="M0 60 L0 34 L28 14 L56 34 L56 60 Z" class="ot-r1"/><path d="M44 60 L44 30 L70 10 L100 32 L100 60 Z" class="ot-r2"/><rect x="21" y="36" width="12" height="12" rx="1.5" class="ot-r3"/><rect x="65" y="34" width="12" height="12" rx="1.5" class="ot-r3"/></svg>
        <span class="onoff ${s.cls}">${esc(s.txt)}</span>
      </span>
      <span class="ot-room-nome">${nome}</span>
      <span class="ot-room-val"><b>${z && z.temp ? num(z.temp.v, 1) : '—'}°</b><small>${ob !== null ? `obiettivo ${num(ob, 1)}°` : (z && z.modo ? esc(z.modo.v) : '')}</small></span>
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
      <div class="ot-quick-grid">${scene.map(tassello).join('')}</div>
      <button type="button" class="ot-tall${su ? ' on' : ''}" data-tapparelle aria-pressed="${su}" aria-label="Tapparelle: ${su ? 'abbassa' : 'alza'}">
        <span class="ot-ico">${svg(su ? 'up' : 'down')}</span>
        <span class="ot-lab">Tapparelle</span>
        <span class="ot-sub">${rec ? (su ? 'Aperte' : 'Chiuse') : 'Tocca per alzare'}</span>
      </button>
    </div>

    ${t ? `<div class="ot-sez">Piani</div><div class="ot-rooms">${piano('giorno')}${piano('notte')}</div>` : ''}

    <div class="ot-sez">Fuori</div>
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

/* Quadrante del termostato (nel riquadro che si apre toccando un piano) */
function otQuadrante(z, t) {
  const c = z.cfg || {};
  const min = 15, max = Math.max(24, Number(c.base) || 23);
  const ob = typeof z.obiettivo === 'number' ? z.obiettivo : (z.volo ? z.volo.v : c[z.programma]);
  const st = z.temp && typeof z.temp.v === 'number' ? z.temp.v : null;
  const ang = v => -135 + (Math.min(max, Math.max(min, v)) - min) / (max - min) * 270;
  const pt = (a, r) => { const rad = (a - 90) * Math.PI / 180; return [100 + r * Math.cos(rad), 100 + r * Math.sin(rad)]; };
  const arco = (a0, a1, r) => { const [x0, y0] = pt(a0, r), [x1, y1] = pt(a1, r); return `M${x0.toFixed(1)} ${y0.toFixed(1)} A${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1.toFixed(1)} ${y1.toFixed(1)}`; };
  let tacche = '';
  for (let v = min; v <= max + .001; v += .5) {
    const a = ang(v), lungo = Math.abs(v - Math.round(v)) < .01;
    const [x0, y0] = pt(a, lungo ? 74 : 78), [x1, y1] = pt(a, 86);
    tacche += `<line x1="${x0.toFixed(1)}" y1="${y0.toFixed(1)}" x2="${x1.toFixed(1)}" y2="${y1.toFixed(1)}" class="${lungo ? 'l' : ''}"/>`;
  }
  const [kx, ky] = ob != null ? pt(ang(ob), 62) : [100, 38];
  const [sx, sy] = st != null ? pt(ang(st), 92) : [0, 0];
  return `<div class="ot-dial" aria-hidden="true">
    <svg viewBox="0 0 200 200">
      <g class="ot-dial-t">${tacche}</g>
      <path d="${arco(-135, 135, 62)}" class="ot-dial-base"/>
      ${ob != null ? `<path d="${arco(-135, ang(ob), 62)}" class="ot-dial-arc"/>` : ''}
      ${ob != null ? `<circle cx="${kx.toFixed(1)}" cy="${ky.toFixed(1)}" r="9" class="ot-dial-knob"/>` : ''}
      ${st != null ? `<circle cx="${sx.toFixed(1)}" cy="${sy.toFixed(1)}" r="4" class="ot-dial-stanza"/>` : ''}
    </svg>
    <div class="ot-dial-txt"><span>Obiettivo</span><b>${ob != null ? gradi(ob) : '—'}</b><small>${st != null ? `stanza ${gradi(st)}` : ''}</small></div>
  </div>`;
}

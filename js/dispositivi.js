'use strict';
/* ============================================================
   DISPOSITIVI PER GRUPPI
   La pagina mostra un tassello per gruppo (Tapparelle, Riscaldamento,
   Clima, Telecamere, App collegate) con lo stato in breve; toccandone
   uno si apre solo quella sezione, con "‹ Dispositivi" per tornare.
   Rientrando nella scheda Dispositivi si torna sempre ai gruppi.
   ============================================================ */

const DEV_GRUPPI = [
  { id: 'tapparelle',    nome: 'Tapparelle',    icon: 'shutter', tone: 'blue' },
  { id: 'riscaldamento', nome: 'Riscaldamento', icon: 'thermo',  tone: 'orange' },
  { id: 'clima',         nome: 'Clima',         icon: 'power',   tone: 'cyan' },
  { id: 'andamento',     nome: 'Andamento',     icon: 'chart',   tone: 'pink' },
  { id: 'telecamere',    nome: 'Telecamere',    icon: 'camera',  tone: 'purple' },
  { id: 'app',           nome: 'App collegate', icon: 'phone',   tone: 'green' }
];
let _devGruppo = null;

function devRiassunto(id, m) {
  if (id === 'tapparelle') return shutterText(lastShutter(null));
  if (id === 'riscaldamento') {
    const t = typeof termo === 'function' ? termo(m) : null;
    if (!t) return typeof termoSummary === 'function' ? termoSummary(m) : 'Termostati Vimar';
    const z = id2 => { const zz = t.zone[id2]; if (!zz) return ''; const s = statoZona(zz, t);
      const val = regolaVimar(t) && !tempFresca(zz) ? (typeof zz.obiettivo === 'number' ? gradi(zz.obiettivo) : '—') : (zz.temp ? gradi(zz.temp.v) : '—');
      return `${id2 === 'giorno' ? '3°' : '4°'} ${val} ${s.txt !== '—' ? s.txt.toLowerCase() : ''}`.trim(); };
    return [z('giorno'), z('notte')].filter(Boolean).join(' · ');
  }
  if (id === 'andamento') {
    if (typeof _hist === 'undefined' || !_hist.ok || !_hist.rows.length) return 'Grafici di temperature, riscaldamento e presenze';
    const g = k => { const v = lastVal(_hist.rows, k); return v === null ? null : String(Math.round(v * 10) / 10).replace('.', ',') + '°'; };
    return [['Fuori', g('temp')], ['3°', g('tg')], ['4°', g('tn')]].filter(x => x[1]).map(x => x.join(' ')).join(' · ') || 'Grafici di temperature, riscaldamento e presenze';
  }
  if (id === 'clima') return 'Condizionatore: accendi o spegni';
  if (id === 'telecamere') {
    const sub = k => { const c = $(`#camera-list .shutter-card[data-cam-key="${k}"] .cam-sub`); return c && c.textContent ? c.textContent.toLowerCase() : null; };
    const i = sub('int'), e = sub('est');
    return i || e ? `Interne ${i || '—'} · esterne ${e || '—'}` : 'Interne ed esterne';
  }
  if (id === 'app') { const n = ((CONFIG.DEVICES || {}).APPS || []).length; return n ? `${n} ${n === 1 ? 'app' : 'app'}` : 'Nessuna app'; }
  return '';
}

function devGruppiVisibili() {
  return DEV_GRUPPI.filter(g => {
    const p = $(`.dev-panel[data-group="${g.id}"]`); if (!p) return false;
    if (g.id === 'riscaldamento') return true;
    if (g.id === 'andamento') return typeof _hist !== 'undefined' && !!_hist.ok;
    return !!p.querySelector('.shutter-card, .app-link-card');
  });
}

function renderDevGroups(m) {
  const host = $('#dev-groups'); if (!host) return;
  m = m || MODEL || {};
  host.innerHTML = devGruppiVisibili().map(g => `
    <button type="button" class="dev-group" data-group="${g.id}" data-tone="${g.tone}">
      <span class="dev-group-ico">${svg(g.icon)}</span>
      <span class="dev-group-txt"><b>${g.nome}</b><small>${esc(devRiassunto(g.id, m))}</small></span>
      <span class="dev-group-go" aria-hidden="true">${svg('chevron')}</span>
    </button>`).join('');
  host.querySelectorAll('.dev-group').forEach(b => b.addEventListener('click', () => { haptic(); openDevGroup(b.dataset.group); }));
  openDevGroup(_devGruppo, true);
}

function openDevGroup(id, silenzioso) {
  const g = DEV_GRUPPI.find(x => x.id === id) || null;
  _devGruppo = g ? g.id : null;
  const view = $('#view-devices'); if (!view) return;
  const grid = $('#dev-groups'); if (grid) grid.hidden = !!g;
  $$('.dev-panel').forEach(p => { p.hidden = !g || p.dataset.group !== g.id; });
  const title = view.querySelector('.hero-title'), sub = $('#dev-sub');
  if (title) title.textContent = g ? g.nome : 'Dispositivi';
  if (sub) {
    if (g) {
      sub.innerHTML = '<button type="button" class="dev-back">' + svg('chevron') + 'Dispositivi</button>';
      sub.querySelector('.dev-back').addEventListener('click', () => { haptic(); openDevGroup(null); window.scrollTo({ top: 0 }); });
    } else sub.textContent = 'Scegli un gruppo.';
  }
  if (!silenzioso) window.scrollTo({ top: 0 });
  if (g && g.id === 'andamento' && !silenzioso && typeof animaGrafici === 'function') animaGrafici($('.dev-panel[data-group="andamento"]'));
}

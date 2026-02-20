function renderPeople(model){
  const host = document.querySelector('#peopleChips');
  if (!host) return;
  host.innerHTML = '';

  // 1) Mappa dai people (se esistono)
  const byName = {};
  const base = Array.isArray(model.people) ? model.people.slice() : [];
  base.forEach(p => {
    const k = String(p.name || '').trim().toLowerCase();
    if (!k) return;
    // copia “soft” per non mutare l’originale
    byName[k] = { ...p };
  });

  // 2) Integra con peopleLast: se un nome manca, crealo (OUT) e aggiungi l’orario
  (model.peopleLast || []).forEach(x => {
    const k = String(x.name || '').trim().toLowerCase();
    if (!k) return;
    if (!byName[k]) {
      byName[k] = {
        name: x.name,
        onlineSmart: false // di default OUT se non presente in people
      };
    }
    byName[k].lastInOut = {
      event: x.lastEvent,
      day:   x.lastDay,
      time:  x.lastTime,
      tsIso: x.lastWhenIso
    };
  });

  // 3) Array finale + ordinamento: prima chi è IN, poi alfabetico
  const people = Object.values(byName).sort((a,b) => {
    const A = a.onlineSmart ? 1 : 0;
    const B = b.onlineSmart ? 1 : 0;
    if (A !== B) return B - A;
    return (''+a.name).localeCompare(''+b.name, 'it');
  });

  if (!people.length){
    host.textContent = '—';
    return;
  }

  // 4) Disegno chip
  for (const p of people){
    const st   = p.onlineSmart ? 'in' : ((p.lastInOut && p.lastInOut.event === 'USCITA') ? 'out' : 'out');
    const time = (p.lastInOut && p.lastInOut.time && p.lastInOut.day) ? (p.lastInOut.time + ' • ' + p.lastInOut.day) : '—';

    const chip = document.createElement('div');
    chip.className = 'person-chip';
    chip.innerHTML = `
      <span class="person-dot ${st}"></span>
      <span class="person-name">${p.name || '—'}</span>
      <span class="person-meta ${st}">${st.toUpperCase()}</span>
      <span class="person-time">${time}</span>
    `;
    host.appendChild(chip);
  }
}

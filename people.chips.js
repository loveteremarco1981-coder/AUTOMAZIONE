(function(){
  const URL = window.CONFIG?.DOGET_URL;
  if(!URL) return;

  document.addEventListener("DOMContentLoaded", load);

  async function load(){
    let model;
    try{
      model = await fetch(URL+"?ts="+Date.now(),{cache:"no-store"}).then(r=>r.json());
    }catch(e){
      console.error("Errore fetch:",e);
      return;
    }

    renderPeople(model);
  }

  function renderPeople(model){
    const box = document.querySelector("#peopleChips");
    if(!box) return;

    box.innerHTML = "";

    const p = model?.people ?? [];
    const last = model?.peopleLast ?? [];

    // merge ultimi eventi
    const map = {};
    p.forEach(x => map[x.name.toLowerCase()] = x);

    last.forEach(l => {
      const k = l.name.toLowerCase();
      if(map[k]) map[k].lastInOut = l;
    });

    p.sort((a,b)=> (b.onlineSmart===true)-(a.onlineSmart===true));

    p.forEach(person => {
      const chip = document.createElement("div");
      chip.className = "person-chip";

      const status = person.onlineSmart ? "in" :
                     (person.lastInOut?.event==="USCITA" ? "out" : "out");

      const time = person.lastInOut 
        ? `${person.lastInOut.time} • ${person.lastInOut.day}`
        : "—";

      chip.innerHTML = `
        <span class="person-dot ${status}"></span>
        <span class="person-name">${person.name}</span>
        <span class="person-meta ${status.toLowerCase()}">${status.toUpperCase()}</span>
        <span class="person-time">${time}</span>
      `;
      box.appendChild(chip);
    });
  }
})();
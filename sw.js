// ============================================================
// sw.js — Casa · Automazione
// Rende l'app utilizzabile anche senza rete: conserva i file
// dell'app e, se la rete manca, li serve dalla copia salvata.
// I comandi (Apps Script) e il meteo passano SEMPRE dalla rete.
// ============================================================
'use strict';

const CACHE = 'casa-v3';

self.addEventListener('install', () => {
  // Nessun skipWaiting automatico: l'app mostra "Nuova versione disponibile"
  // e attiva l'aggiornamento solo quando l'utente tocca Aggiorna.
});

self.addEventListener('message', e => {
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;     // Apps Script, meteo, ecc.: sempre in rete

  const save = res => {
    if (res && res.ok) {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(req, copy));
    }
    return res;
  };

  // File con ?v=… : ogni versione ha il suo indirizzo, quindi la copia salvata è sempre quella giusta
  if (url.searchParams.has('v')) {
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(save)));
    return;
  }

  // Pagina e altri file: prima la rete (così trovi sempre l'ultima versione), la copia salvata solo se sei offline
  e.respondWith(
    fetch(req).then(save).catch(() =>
      caches.match(req).then(hit => hit || caches.match(self.registration.scope))
    )
  );
});

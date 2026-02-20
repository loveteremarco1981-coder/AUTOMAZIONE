
# Smart UI — PACK V3 (GitHub)

## Cosa contiene
- index.html (Persone + Banner + Shim, non tocca il resto)
- people.chips.css/js (chip IN/OUT + orario)
- banner-colors.css/js (solo barra centrale verde/rosso con testo bianco)
- jsonp.js + shim.js (fix per errori JSONP)
- icons/ (base: house + st icons)
- manifest.webmanifest, .nojekyll

## Installazione
1) Carica tutti i file nella root della Pages (AUTOMAZIONE/).
2) Fai PR + Merge.
3) In `config.js` aggiorna DOGET_URL se ridistribuisci la WebApp.
4) Hard refresh (Ctrl/Cmd + Shift + R).

## Test rapido (Console)
await fetch(window.CONFIG.DOGET_URL, {cache:'no-store'}).then(r=>r.status)
await fetch(window.CONFIG.DOGET_URL).then(r=>r.json())
JSONP.fetch(window.CONFIG.DOGET_URL).then(console.log)

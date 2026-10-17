'use strict';
/* ============================================================
   NOTIFICHE — avvisi quando qualcuno entra o esce e quando compare
   un errore. Funzionano mentre l'app è aperta o in background sul
   telefono (iPhone: app aggiunta alla Home). Per gli avvisi ad app
   chiusa serve il controllo via email dello script (backend_extra.gs).
   ============================================================ */
const notifyPrefs = () => {
  try { return Object.assign({ presence: false, errors: false }, JSON.parse(localStorage.getItem('ui_notify') || '{}')); }
  catch (_) { return { presence: false, errors: false }; }
};
const setNotifyPrefs = p => { try { localStorage.setItem('ui_notify', JSON.stringify(p)); } catch (_) {} };
const notifySupported = () => 'Notification' in window;

let _liveModel = null;      // ultimo modello arrivato dalla rete (non quello salvato)
let _seenErr = null;        // chiave dell'ultimo errore già visto

async function showNotice(title, body, tag) {
  if (document.visibilityState === 'visible') { toast(body, 'info', 4000); }
  if (!notifySupported() || Notification.permission !== 'granted') return;
  try {
    const reg = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : null;
    const opts = { body, tag, icon: 'icons/house-192.png', badge: 'icons/house-192.png' };
    if (reg && reg.showNotification) await reg.showNotification(title, opts);
    else new Notification(title, opts);
  } catch (_) {}
}

function notifyOnModel(prev, cur) {
  const p = notifyPrefs();
  if (!p.presence || !prev || !cur) return;
  const before = {};
  (prev.people || []).forEach(x => { before[x.name] = !!x.onlineSmart; });
  (cur.people || []).forEach(x => {
    const was = before[x.name];
    if (was === undefined || was === !!x.onlineSmart) return;
    showNotice('Casa', `${cap(x.name)} ${x.onlineSmart ? 'è entrato in casa' : 'è uscito di casa'}`, 'presence-' + x.name);
  });
}

function notifyOnLogs(logs) {
  const errs = (logs || []).filter(isErrLog).sort((a, b) => (logTime(b)?.getTime() || 0) - (logTime(a)?.getTime() || 0));
  const top = errs[0];
  const key = top ? `${top.ts}|${top.code}` : '';
  if (_seenErr === null) { _seenErr = key; return; }          // prima lettura: solo memorizzo
  if (key && key !== _seenErr) {
    _seenErr = key;
    if (notifyPrefs().errors) showNotice('Casa · errore', `${logCode(top)}${top.desc ? ': ' + top.desc : ''}`, 'err');
  }
}

async function enableNotifications() {
  if (!notifySupported()) return 'unsupported';
  if (Notification.permission === 'granted') return 'granted';
  try { return await Notification.requestPermission(); } catch (_) { return 'denied'; }
}

function openNotifySheet() {
  const wrap = document.createElement('div');
  wrap.className = 'se';
  const draw = () => {
    const p = notifyPrefs();
    const perm = notifySupported() ? Notification.permission : 'unsupported';
    const permTxt = perm === 'granted' ? 'Permesso concesso su questo dispositivo.'
      : perm === 'denied' ? 'Le notifiche sono bloccate: riattivale dalle impostazioni del telefono per questa app.'
      : perm === 'unsupported' ? 'Questo browser non supporta le notifiche. Su iPhone aggiungi l’app alla schermata Home.'
      : 'Alla prima attivazione il telefono chiederà il permesso.';
    wrap.innerHTML = `
      <p class="sheet-note">${permTxt}</p>
      <div class="tg-row"><div><b>Ingressi e uscite</b><small>Quando una persona entra o esce</small></div>
        <label class="toggle-wrap"><input type="checkbox" id="nt-presence" ${p.presence ? 'checked' : ''}><span class="toggle-slider"></span></label></div>
      <div class="tg-row"><div><b>Errori</b><small>Quando nel log compare un errore nuovo</small></div>
        <label class="toggle-wrap"><input type="checkbox" id="nt-errors" ${p.errors ? 'checked' : ''}><span class="toggle-slider"></span></label></div>
      <p class="sheet-note small">Gli avvisi arrivano finché l’app è aperta o in background sul telefono. Per riceverli anche ad app chiusa, attiva il controllo via email nello script.</p>`;
    ['presence', 'errors'].forEach(k => {
      wrap.querySelector('#nt-' + k).addEventListener('change', async e => {
        const next = notifyPrefs();
        next[k] = e.target.checked;
        if (e.target.checked) {
          const r = await enableNotifications();
          if (r !== 'granted') { next[k] = false; }
        }
        setNotifyPrefs(next);
        draw();
        renderSettings(MODEL || {});
      });
    });
  };
  openSheet('Notifiche', wrap);
  draw();
}

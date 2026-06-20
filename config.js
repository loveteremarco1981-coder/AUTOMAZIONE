// config.js — Configurazione App Casa
// Versione 3.0 — Solo 4 comandi iOS, nessun auto-out

const CONFIG = {
  // ── Endpoint Apps Script ──────────────────────────────────
  API_URL: 'https://script.google.com/macros/s/AKfycbzLysvf0upIAIg063iBLJnCoc43LNHAZx-w0HZFh6uPa9oIjZrsmXjgo4ntN2vU258/exec',

  // ── Polling ───────────────────────────────────────────────
  POLL_INTERVAL_MS: 60000,   // aggiorna ogni 60s
  POLL_ON_FOCUS:    true,    // aggiorna quando la pagina torna in focus

  // ── UI ────────────────────────────────────────────────────
  APP_NAME:   'Casa',
  APP_SUBTITLE: 'Automazione',

  // ── 4 comandi iOS (solo riferimento documentale) ──────────
  // 1. ssid_on  ?event=ssid_on&name=NOME&hold=480   → IN
  // 2. ssid_off ?event=ssid_off&name=NOME            → solo log
  // 3. mark_out ?event=mark_out&name=NOME&source=geofence → OUT
  // 4. mark_in  ?event=mark_in&name=NOME&source=geofence  → IN

  // ── Preferiti dashboard ───────────────────────────────────
  FAVORITES: [
    { id: 'alza',    label: 'Alza',    icon: '⬆️', event: 'alza_tutto'    },
    { id: 'abbassa', label: 'Abbassa', icon: '⬇️', event: 'abbassa_tutto' },
    { id: 'piante',  label: 'Piante',  icon: '🌿', event: 'piante'        },
  ],

  // ── Dispositivi ───────────────────────────────────────────
  DEVICES: {
    shutters: [
      { id: 'alza_tutto',    label: 'Alza tutto',    icon: '⬆️' },
      { id: 'abbassa_tutto', label: 'Abbassa tutto', icon: '⬇️' },
    ],
    thermostats: [
      { id: 'termostato_auto', label: 'Termostato Auto', icon: '🌡️' },
      { id: 'off_termostato',  label: 'Termostato Off',  icon: '❄️' },
      { id: 'spegni_clima',    label: 'Clima Off',        icon: '🌬️' },
    ],
    cameras: [
      { id: 'ezviz_interne_on',  label: 'Cam interne ON',  icon: '📷' },
      { id: 'ezviz_interne_off', label: 'Cam interne OFF', icon: '📷' },
      { id: 'ezviz_esterne_on',  label: 'Cam esterne ON',  icon: '📹' },
      { id: 'ezviz_esterne_off', label: 'Cam esterne OFF', icon: '📹' },
    ],
  },

  // ── Link app collegate ────────────────────────────────────
  APP_LINKS: [
    { label: 'IFTTT',       url: 'https://ifttt.com/activity',    icon: '⚡' },
    { label: 'Apps Script', url: 'https://script.google.com',     icon: '📜' },
    { label: 'GitHub',      url: 'https://github.com/loveteremarco1981-coder/AUTOMAZIONE', icon: '🐙' },
  ],
};

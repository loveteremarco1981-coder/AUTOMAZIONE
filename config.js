// ============================================================
// config.js — Automazione Casa PRO++++
// ============================================================

const CONFIG = {

  // ==========================================================
  // Apps Script Web App
  // ==========================================================

  DOGET_URL:
    'https://script.google.com/macros/s/AKfycbzLysvf0upIAIg063iBLJnCoc43LNHAZx-w0HZFh6uPa9oIjZrsmXjgo4ntN2vU258/exec',

  // ==========================================================
  // Aggiornamento dashboard
  // ==========================================================

  AUTO_REFRESH_MS: 60000,

  // ==========================================================
  // Meteo
  // ==========================================================

  WEATHER: {
    lat: 44.999,
    lon: 7.640,
    tz: 'Europe/Rome'
  },

  // ==========================================================
  // Preferiti Dashboard
  // ==========================================================

  FAVORITES: [

    {
      id: 'tapparelle',
      label: 'Tapparelle',
      subtitle: 'Apri / Chiudi',
      color: '#2563eb',
      upEvent: 'alza_tutto',
      downEvent: 'abbassa_tutto'
    },

    {
      id: 'piante',
      label: 'Piante',
      subtitle: 'Irrigazione',
      color: '#16a34a',
      kind: 'action',
      event: 'piante'
    },

    {
      id: 'vacanza',
      label: 'Vacanza',
      subtitle: 'Modalità vacanza',
      color: '#f59e0b',
      kind: 'toggle'
    },

    {
      id: 'override',
      label: 'Override',
      subtitle: 'Blocca automazioni',
      color: '#ef4444',
      kind: 'toggle'
    }

  ],

  // ==========================================================
  // Dispositivi
  // ==========================================================

  DEVICES: {

    SHUTTERS: [
      {
        label: 'Tutte',
        icon: '🪟',
        upEvent: 'alza_tutto',
        downEvent: 'abbassa_tutto'
      }
    ],

    THERMOSTATS: [

      {
        label: 'Termostato Auto',
        icon: '🌡️',
        event: 'termostato_auto'
      },

      {
        label: 'Termostato Off',
        icon: '❄️',
        event: 'off_termostato'
      },

      {
        label: 'Clima Off',
        icon: '🌬️',
        event: 'spegni_clima'
      }

    ],

    CAMERAS: [

      {
        id: 'int_on',
        label: 'Cam interne ON',
        event: 'ezviz_interne_on'
      },

      {
        id: 'int_off',
        label: 'Cam interne OFF',
        event: 'ezviz_interne_off'
      },

      {
        id: 'est_on',
        label: 'Cam esterne ON',
        event: 'ezviz_esterne_on'
      },

      {
        id: 'est_off',
        label: 'Cam esterne OFF',
        event: 'ezviz_esterne_off'
      }

    ],

    APPS: [

      {
        label: 'IFTTT',
        subtitle: 'Attività',
        icon: '⚡',
        color: '#000',
        url: 'https://ifttt.com/activity'
      },

      {
        label: 'Apps Script',
        subtitle: 'Google',
        icon: '📜',
        color: '#34a853',
        url: 'https://script.google.com'
      },

      {
        label: 'GitHub',
        subtitle: 'Repository',
        icon: '🐙',
        color: '#171515',
        url: 'https://github.com/loveteremarco1981-coder/AUTOMAZIONE'
      }

    ]

  }

};

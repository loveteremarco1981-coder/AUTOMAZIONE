# PRO_HOME_V3

Sistema domotico avanzato per gestione abitazione.

Tecnologie:

- Google Apps Script
- Google Sheets
- IFTTT
- GitHub Actions
- GitHub Pages
- iOS Shortcuts

---

# Architettura

iPhone

↓

IFTTT

↓

Apps Script

↓

State Engine

↓

Watchdog

↓

AutoRepair

↓

Backup

↓

Analytics

---

# Stati Supportati

- COMFY_DAY
- COMFY_NIGHT
- SECURITY_DAY
- SECURITY_NIGHT

---

# Weather Engine

Provider supportati:

- Open-Meteo
- OpenWeather

Funzioni:

- cache locale
- fallback automatico
- recovery automatica

---

# Health System

Controlla:

- trigger
- stato casa
- persone
- meteo
- tapparelle
- errori sistema

Produce:

- Health Status
- Health Score

---

# AutoRepair

Corregge automaticamente:

- HOUSE_INSIDE
- stato casa
- trigger mancanti
- trigger duplicati
- OUT_PENDING corrotti
- SECURITY_SEQUENCE bloccate
- cache meteo invalida

Non esegue:

- movimenti fisici
- comandi IFTTT
- backup
- analytics

---

# Backup

Salva:

- stato sistema
- persone
- meteo
- tapparelle
- health
- errori

Mantiene gli ultimi backup.

---

# Watchdog

Sequenza:

CHECK

↓

AUTOREPAIR

↓

RECHECK

↓

RESTORE

↓

HEALTH AUDIT

---

# Analytics

Statistiche:

- ingressi
- uscite
- GPS
- WiFi
- IFTTT
- Watchdog
- Backup
- Restore
- AutoRepair
- Notifiche

---

# Deploy

Push GitHub

↓

GitHub Action

↓

clasp push

↓

Apps Script

---

# Version

PRO_HOME_V3

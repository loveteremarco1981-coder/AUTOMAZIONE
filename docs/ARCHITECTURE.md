# ARCHITECTURE

Versione: PRO_HOME_V3

---

# Panorama Generale

```text
iPhone

↓

Shortcuts

↓

IFTTT

↓

Apps Script

↓

State Engine

↓

Weather

↓

Actions

↓

Health

↓

AutoRepair

↓

Backup

↓

Watchdog

↓

Analytics

↓

GitHub Dashboard
```

---

# Moduli Core

## Persone

Gestione presenza.

Sorgenti:

```text
Wi-Fi
GPS
Shortcut
```

---

## State Engine

Calcola:

```text
COMFY_DAY
COMFY_NIGHT
SECURITY_DAY
SECURITY_NIGHT
```

---

## Actions

Gestisce:

```text
IFTTT
Tapparelle
Clima
Telecamere
```

---

# Moduli Servizio

## Weather

Provider:

```text
Open-Meteo
OpenWeather
```

con cache locale.

---

## Health

Valuta salute sistema.

Produce:

```text
Health Status
Health Score
```

---

# Resilienza

## AutoRepair

Corregge anomalie logiche.

---

## Backup

Salva snapshot logico.

---

## Restore

Ripristina configurazione.

---

## Watchdog

Controlla:

```text
State
Presence
Triggers
Weather
Backup
```

---

# Analytics

Genera statistiche da:

```text
Log
```

---

# Dashboard Web

Repository:

```text
GitHub Pages
```

Tecnologie:

```text
HTML
CSS
JavaScript
```

Funzioni:

```text
Monitoraggio
Controllo
Log
Telecamere
Tapparelle
Termostati
```

---

# Deploy

```text
GitHub Push

↓

GitHub Actions

↓

clasp push

↓

Apps Script
```

---

# Filosofia

Priorità:

```text
1. Sicurezza

2. Affidabilità

3. Recovery

4. Automazione
```

Ogni modulo deve poter essere:

```text
controllato
riparato
ripristinato
```

automaticamente.

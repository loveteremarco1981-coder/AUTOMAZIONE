# BACKUP

Versione: PRO_HOME_V3

---

# Scopo

Consentire il ripristino logico del sistema in caso di:

- configurazione corrotta
- errori persistenti
- recovery Watchdog
- manutenzione

---

# Foglio Utilizzato

```text
Backup
```

---

# Funzione Principale

```javascript
backupSystem()
```

---

# Dati Salvati

## Stato

```javascript
STATE
```

---

## Presenza

```javascript
HOUSE_INSIDE
```

---

## Modalità

```javascript
VACATION
OVERRIDE
TEST_MODE
```

---

## Informazioni Sistema

```javascript
LAST_PERSON
HEALTH_STATUS
HEALTH_SCORE
LAST_ERROR
```

---

## Tapparelle

```javascript
SHUTTERS_STATE
```

Valori:

```text
DOWN
PIANTE
```

---

## Persone

Colonna:

```javascript
PEOPLE_JSON
```

Contiene:

```json
[
  {
    "name":"Marco",
    "state":"IN",
    "wifiState":"HOME"
  }
]
```

---

## Meteo

Salvati:

```javascript
WEATHER_PROVIDER
WEATHER_LAST_UPDATE
```

---

# Versione

```javascript
BACKUP_VERSION
```

Attualmente:

```text
PRO_HOME_V3
```

---

# Retention

```javascript
BACKUP_MAX_ROWS
```

Default:

```text
30 backup
```

---

# Anteprima

Funzione:

```javascript
previewLastBackup()
```

Non modifica il sistema.

---

# Restore

Funzione:

```javascript
restoreLastBackup()
```

---

# Restore Sicuro

NON esegue:

```text
applyActions()
sendIFTTT()
handleShutters()
comandi fisici
```

---

# Stato Finale

NON ripristina:

```javascript
backupData.state
```

Calcola sempre:

```javascript
getExpectedState_()
```

per evitare stati incoerenti.

---

# Sequenze Temporanee

Durante il restore vengono eliminate:

```javascript
OUT_PENDING
SECURITY_SEQUENCE
```

---

# Health Audit

Al termine:

```javascript
healthAudit()
```

---

# Dashboard

Se disponibile:

```javascript
updateDashboard()
```

---

# Report

Se disponibile:

```javascript
generateReport()
```

---

# Log

Categorie:

```text
BACKUP
RESTORE
RESTORE_ERROR
RESTORE_WARNING
```

---

# Risultati Salvati

```javascript
LAST_BACKUP_RESULT
LAST_RESTORE_RESULT
```

Accesso:

```javascript
getLastBackupResult()
getLastRestoreResult()
```

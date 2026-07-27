# AUTOREPAIR

Versione: PRO_HOME_V3

---

# Scopo

Correggere automaticamente incoerenze logiche.

Non esegue azioni fisiche.

---

# Funzione Principale

```javascript
autoRepair()
```

---

# Controlli

## HOUSE_INSIDE

Confronta:

```javascript
isAnyoneInside()
```

con:

```javascript
Config!B5
```

Ripara se necessario.

---

## Stato Casa

Legge:

```javascript
Config!B3
```

Verifica:

```javascript
getExpectedState_()
```

Ripristina lo stato corretto.

---

## Stato Tapparelle

Legge:

```javascript
S_STATE
```

Valori validi:

```text
DOWN
PIANTE
```

---

## OUT_PENDING

Controlla:

```javascript
OUT_PENDING
OUT_TS
OUT_PERSON
OUT_PEOPLE
```

Rimuove richieste bloccate.

---

## Security Sequence

Controlla:

```javascript
SECURITY_SEQ_ACTIVE
SECURITY_SEQ_TS
```

e trigger temporanei.

---

## Trigger

Verifica:

```javascript
getTriggerStatus()
```

Ripara tramite:

```javascript
repairTriggersIfNeeded()
```

---

## Cache Meteo

Verifica:

```javascript
W_DATA
W_TS
```

Rigenera cache tramite:

```javascript
getWeather()
```

---

## Test Mode

Non modifica:

```javascript
TEST_MODE
```

Genera solo warning.

---

# Azioni Vietate

AutoRepair NON esegue:

```text
IFTTT
Tapparelle
Clima
Backup
Analytics
Movimenti fisici
```

---

# Health Audit

Alla fine esegue:

```javascript
healthAudit()
```

---

# Lock

Property:

```javascript
AUTO_REPAIR_ACTIVE
AUTO_REPAIR_TS
```

---

# Timeout Lock

```text
5 minuti
```

---

# Salvataggio Risultato

Property:

```javascript
LAST_AUTO_REPAIR_RESULT
```

Accesso:

```javascript
getLastAutoRepairResult()
```

---

# Log

Categorie:

```text
AUTO_REPAIR
AUTO_REPAIR_ERROR
REPAIR
```

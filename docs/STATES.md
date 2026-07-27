# STATES

Versione: PRO_HOME_V3

---

# State Engine

Il sistema lavora esclusivamente con quattro stati.

---

# COMFY_DAY

```text
Persone presenti
+
Giorno
```

Caratteristiche:

- casa occupata
- modalità comfort
- telecamere disattivate

---

# COMFY_NIGHT

```text
Persone presenti
+
Notte
```

Caratteristiche:

- casa occupata
- modalità comfort
- protezione notturna

---

# SECURITY_DAY

```text
Nessuno presente
+
Giorno
```

Caratteristiche:

- casa vuota
- modalità sicurezza

---

# SECURITY_NIGHT

```text
Nessuno presente
+
Notte
```

Caratteristiche:

- casa vuota
- sicurezza completa

---

# Calcolo Stato

Funzione:

```javascript
getExpectedState_()
```

Utilizza:

```javascript
HOUSE_INSIDE
```

e:

```javascript
isNight()
```

---

# Stato Reale

Memorizzato in:

```javascript
Config!B3
```

---

# Stato Atteso

Calcolato dinamicamente.

---

# Validazione

Funzione:

```javascript
isValidState_()
```

Valori ammessi:

```text
COMFY_DAY
COMFY_NIGHT
SECURITY_DAY
SECURITY_NIGHT
```

---

# Correzione Automatica

AutoRepair verifica:

```javascript
Config!B3
```

e lo riallinea tramite:

```javascript
getExpectedState_()
```

senza eseguire azioni fisiche.

---

# Watchdog

Controlla:

```javascript
STATE
EXPECTED_STATE
```

Genera warning in caso di mismatch.

---

# Backup

Lo stato viene salvato.

Durante il restore viene ricalcolato.

---

# Regola Fondamentale

Lo stato NON è mai una sorgente primaria.

La sorgente primaria è:

```text
Presenza
+
Giorno/Notte
```

Lo stato è sempre una conseguenza.

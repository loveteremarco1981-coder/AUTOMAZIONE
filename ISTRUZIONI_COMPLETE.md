# Automazione Casa — Guida completa
## Codice nuovo + Shortcut iOS

---

## PARTE 1 — COME SOSTITUIRE IL CODICE

1. Apri Apps Script del progetto
2. Per ogni file `.gs` esistente: seleziona tutto il contenuto e sostituiscilo con il nuovo
3. I file da creare/sostituire sono (in ordine):
   - `01_utils.gs`
   - `02_config.gs`
   - `03_people.gs`
   - `04_state.gs`
   - `05_endpoint.gs`
   - `06_ifttt.gs`
   - `07_jobs.gs`
   - `08_triggers.gs`
   - `09_menu.gs`
4. Salva tutto
5. Vai su **Utility → Purge + Ensure + Eval** per resettare i trigger

---

## PARTE 2 — NUOVI PARAMETRI DA AGGIUNGERE AL FOGLIO CONFIG

Aggiungi queste righe nel foglio **Config** (colonna A = etichetta, colonna B = valore):

| Riga | A (etichetta)    | B (valore) | Descrizione |
|------|------------------|------------|-------------|
| B25  | IFTTT_BUFFER_MIN | 8          | Buffer extra timeout (latenza IFTTT) |
| B26  | EXIT_COOLDOWN_MIN| 15         | Cooldown post-uscita in minuti |

> Se le righe B25/B26 sono già occupate da altri dati, i valori default (8 e 15) vengono usati automaticamente.

---

## PARTE 3 — SHORTCUT iOS (per ogni iPhone della famiglia)

### STRATEGIA
iOS non permette trigger temporizzati arbitrari.
La soluzione è usare **due automazioni native iOS** basate su Wi-Fi:
- **Connessione al Wi-Fi di casa** → manda `ssid_on` (IN certo, azzera cooldown)
- **Disconnessione dal Wi-Fi di casa** → manda `ssid_off` (avvia pending OUT con guard)

Il geofence GPS è il **backup** per quando il telefono è fuori casa e non ha mai connesso il Wi-Fi.

### URL BASE
```
https://script.google.com/macros/s/[TUO_DEPLOYMENT_ID]/exec
```

---

### AUTOMAZIONE 1 — "Connesso al Wi-Fi di casa"

**Dove:** Impostazioni → Comandi Rapidi → Automazioni → Nuova Automazione
**Trigger:** Wi-Fi → [nome rete casa] → Si connette
**Azione:** Ottieni contenuto URL

```
URL: https://script.google.com/macros/s/[DEPLOYMENT_ID]/exec?event=ssid_on&name=[NOME]&hold=720
Metodo: GET
```

Sostituisci `[NOME]` con il nome della persona (es. `marco`, `silvia`, `viola`).
Ogni persona ha la sua automazione con il suo nome.

**Impostazioni automazione:**
- ✅ Esegui immediatamente (disabilita "Chiedi prima di eseguire")
- ✅ Attiva anche quando iPhone è bloccato

---

### AUTOMAZIONE 2 — "Disconnesso dal Wi-Fi di casa"

**Trigger:** Wi-Fi → [nome rete casa] → Si disconnette

```
URL: https://script.google.com/macros/s/[DEPLOYMENT_ID]/exec?event=ssid_off&name=[NOME]
Metodo: GET
```

---

### AUTOMAZIONE 3 — "Lascia area casa" (geofence backup)

**Trigger:** Posizione → [indirizzo casa, raggio 200m] → Esco dall'area

```
URL: https://script.google.com/macros/s/[DEPLOYMENT_ID]/exec?event=mark_out&name=[NOME]&source=geofence
Metodo: GET
```

Il sistema usa `source=geofence` per applicare il pending OUT (soft), non OUT diretto.

---

### SHORTCUT MANUALE — "Sono a casa" (opzionale, per override rapido)

Crea uno Shortcut manuale da lanciare dal widget:

```
URL: https://script.google.com/macros/s/[DEPLOYMENT_ID]/exec?event=life_ping&name=[NOME]
Metodo: GET
```

---

### COME CREARE L'AUTOMAZIONE SU iOS (passo per passo)

1. Apri **Comandi Rapidi** → tab **Automazioni**
2. Tocca **+** in alto a destra
3. Scorri fino a **Wi-Fi** sotto "Personali"
4. Scegli la tua rete → seleziona **"Si connette"**
5. Tocca **Avanti**
6. Tocca **Aggiungi azione** → cerca **"Ottieni contenuto URL"**
7. Incolla l'URL con i tuoi parametri
8. Assicurati che il metodo sia **GET**
9. Tocca **Avanti** → **Fine**
10. **Importante:** disabilita "Chiedi prima di eseguire" (altrimenti mostra una notifica)

> **Nota iOS 17+:** le automazioni Wi-Fi potrebbero richiedere un tap su notifica la prima volta. Dopo il primo ok, girano silenziose.

---

## PARTE 4 — COME FUNZIONA IL SISTEMA NUOVO

### Flusso SSID (affidabile, zero latenza)
```
iPhone si connette al Wi-Fi
  → ssid_on → F=IN, cooldown azzerato, lock SSID per 12h
  → evaluateStateNow → COMFY_*

iPhone si disconnette dal Wi-Fi
  → ssid_off → lock rimosso, pending OUT avviato (EXIT_GUARD_MIN)
  → pendingOutSweep_ (ogni 5min) controlla:
      - Se SSID è tornato → annulla OUT
      - Se ping recente → annulla OUT
      - Altrimenti → markOutNow_ → evaluateStateNow → SECURITY_*
```

### Flusso Geofence (backup GPS)
```
iPhone esce dal geofence (200m)
  → mark_out?source=geofence
  → Se SSID è ancora connesso → ignorato (es. vicino di casa)
  → Se non connesso → pending OUT con guard
```

### Protezioni falsi negativi
1. **SSID lock**: finché connesso al Wi-Fi, nessun timeout o geofence può fare OUT
2. **Exit cooldown configurabile**: 15 min (B26) invece di hardcoded 10
3. **Buffer IFTTT**: timeout effettivo = B15 + B25 (default 40+8=48 min)
4. **everyoneOutWithGrace_**: se tutti hanno F=OUT ma c'è un ping recente < 2×STRICT_LIFE, la casa non viene considerata vuota
5. **Pending OUT con conferma**: ssid_off non fa OUT diretto, aspetta EXIT_GUARD_MIN e controlla

---

## PARTE 5 — RISOLUZIONE PROBLEMI

### Override attivo da settimane (problema attuale!)
Il log mostra OVERRIDE=TRUE continuamente.
**Soluzione:** vai su **Config!B4** e imposta `FALSE`.
Poi esegui **Utility → Purge + Ensure + Eval**.

### Sistema non cambia stato
1. Controlla Config!B4 (Override) → deve essere FALSE
2. Controlla Config!B3 (Vacanza) → deve essere FALSE
3. Esegui **Utility → Diagnostica completa**
4. Verifica che i trigger siano attivi (Utility → Elenca trigger)

### Persona segnata OUT in casa
1. Verifica che l'automazione Wi-Fi sia attiva sul telefono
2. Controlla Comandi Rapidi → la shortcut gira quando connetti il Wi-Fi?
3. Dal menu: **FORZA IN** per ripristinare manualmente
4. Aumenta B26 (EXIT_COOLDOWN_MIN) se rientri spesso entro 15 min


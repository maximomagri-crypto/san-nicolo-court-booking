# Sprint 3.7 - Hardening & Release Candidate Report

Data: 2026-07-23

## 1) Performance

Interventi applicati:
- lazy loading route-level (`Dashboard`, `EventsPage`, `AdminUsersPage`, moduli auth)
- vendor chunk splitting (`firebase-vendor`, `react-vendor`, `router-vendor`)

Build output finale (chunk principali):
- `firebase-vendor`: 355.03 kB (108.18 kB gzip)
- `react-vendor`: 189.63 kB (59.65 kB gzip)
- `router-vendor`: 41.67 kB (14.89 kB gzip)
- `index`: 10.30 kB (3.33 kB gzip)

Esito:
- warning Vite su chunk > 500 kB: RISOLTO
- regressione performance vs 0.3.6: NON RILEVATA (chunk massimo ridotto da ~617 kB a ~355 kB)

## 2) Test & Qualita

Comandi eseguiti:
- `npm test`
- `npm run test:coverage`

Esiti:
- test: 18/18 verdi
- coverage globale (v8):
  - statements: 37.84%
  - branch: 57.14%
  - functions: 78.57%
  - lines: 37.84%

Nota:
- copertura forte su dominio/eventi, debole su UI/hook. Da incrementare nei prossimi sprint con test component/hook.

## 3) Sicurezza (firestore.rules)

Hardening applicato:
- allowlist esplicita dei Domain Event ammessi
- `notifications.create` limitata a tipi supportati
- `event_logs.create` limitata a eventi dominio noti
- `event_audit.create` limitata a eventi dominio noti
- `event_statistics` limitata al documento `global` e a campi contatore espliciti

Verifica ruoli (sintesi):
- utente non autenticato: nessun accesso sensibile
- utente ACTIVE: operazioni dominio consentite secondo regole, senza privilegi admin
- SUB_ADMIN/SUPER_ADMIN: lettura dati di audit/statistiche
- SUPER_ADMIN: unico ruolo con write su `booking_settings`

## 4) UX & Accessibilita

Interventi applicati:
- rimozione `alert()` bloccanti in auth, sostituite con feedback inline
- skip link per navigazione da tastiera
- focus visibility coerente su elementi interattivi
- autocomplete semantico su form login/register

## 5) RC Checklist

- build stabile: OK
- test automatici: OK
- warning build prioritari: OK
- regressione performance vs baseline 0.3.6: OK
- documentazione sprint aggiornata: OK
- milestone versione: `v0.4.0`

# Sprint 3.7 - Hardening & Release Candidate Stabilization Backlog

Data avvio: 2026-07-23
Baseline: v0.4.0-rc1

## Task 3.7.1 - Performance

- Analizzare il bundle con strumenti Vite/Rollup.
- Individuare i moduli più pesanti.
- Mantenere lazy loading delle pagine principali.
- Ridurre o eliminare warning chunk > 500 kB.

Criterio di accettazione:
- warning eliminato oppure motivato con misurazioni.

Stato corrente:
- build corrente senza warning prioritari.
- chunk massimo rilevato: firebase-vendor ~355 kB (sotto 500 kB).

## Task 3.7.2 - Sicurezza

- Revisione completa di firestore.rules.
- Verifica permessi USER, SUB_ADMIN, SUPER_ADMIN.
- Controllo scritture non intenzionali.

Criterio di accettazione:
- ogni collection critica con regole coerenti ai ruoli.

Stato corrente:
- applicato hardening su users/event_logs per flussi amministrativi.
- mantenuta allowlist eventi per scritture sensibili.

## Task 3.7.3 - Test & Qualita

- Verificare copertura aree principali del dominio.
- Aggiungere test solo su lacune reali.
- Eliminare duplicazioni.

Criterio di accettazione:
- nessuna regressione e copertura adeguata del Booking Core.

Stato corrente:
- suite verde 20/20.
- aggiunto test integrazione AdminUserService per audit log lifecycle.

## Task 3.7.4 - UX

- Uniformare stati di caricamento.
- Uniformare messaggi di errore.
- Verificare comportamento operazioni asincrone.

Criterio di accettazione:
- esperienza utente coerente in tutta l'app.

Stato corrente:
- migliorata coerenza annunci async e gestione stati caricamento su schermate principali.

## Task 3.7.5 - Accessibilita

- Navigazione da tastiera.
- Gestione focus.
- Etichette ARIA dove necessarie.
- Contrasto e leggibilità.

Criterio di accettazione:
- principali schermate usabili senza mouse.

Stato corrente:
- consolidati role/aria-live su feedback dinamici.
- focus visibility già attiva su elementi interattivi principali.

## Definition of Done Sprint 3.7 (extra)

- nessun warning di build prioritario aperto.
- nessuna regressione misurabile rispetto a v0.4.0-rc1.

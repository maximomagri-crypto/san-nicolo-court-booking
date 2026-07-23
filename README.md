# San Nicolo Court Booking

Applicazione di prenotazione campi basata su React + TypeScript + Vite + Firebase.

## Stato progetto

Milestone corrente: `v0.4.0`.

Il core funzionale e completo e il progetto e in fase **Sprint 3.7 - Hardening & Release Candidate**.

Funzionalita principali disponibili:
- gestione eventi di gioco
- gestione partecipanti
- waiting list con promozione automatica
- lifecycle conferme (`PENDING_CONFIRMATION`, `CONFIRMED`, `DECLINED`, `EXPIRED`)
- priorita prenotazione giornaliera (`GUARANTEED`, `NON_GUARANTEED`)
- completamento automatico partita
- domain events + dispatcher + handler infrastrutturali

## Comandi principali

- `npm run dev` - avvio locale
- `npm test` - test automatici
- `npm run test:coverage` - report copertura
- `npm run build` - build produzione

## Documentazione

- `ARCHITECTURE.md` - guida architetturale e DoD
- `BOOKING_ENGINE_DESIGN.md` - design e ADR
- `CHANGELOG.md` - cronologia sprint/versioni
- `docs/RETROSPECTIVE.md` - retrospettive sprint
- `docs/SPRINT_3_7_RC_REPORT.md` - report tecnico RC

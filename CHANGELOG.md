# Changelog

## v0.4.0 / Sprint 3.7 - Hardening & Release Candidate

### Added
- Lazy loading route-level per dashboard, eventi, area admin e moduli auth.
- Code splitting vendor (`firebase`, `react`, `react-router`) con chunk dedicati.
- Script `test:coverage` e report copertura con provider V8.
- Edge test aggiuntivo: evento pieno con formato non standard non deve risultare completato.
- Criteri DoD estesi per warning build prioritari e regressione performance.

### Changed
- UX auth: rimozione `alert()` bloccanti, messaggi inline uniformi e accessibili.
- Accessibilita: skip link, focus visibile coerente, autocomplete nei campi auth.
- Hardening `firestore.rules` su collection sensibili (`event_logs`, `event_statistics`, `event_audit`, `notifications`) con allowlist eventi e vincoli campi.
- Bundle ridotto e warning Vite su chunk > 500kB rimosso tramite splitting.

### Metrics
- Build chunk massimo ridotto da ~617kB a ~355kB (firebase-vendor).
- Test automatici: 18/18 verdi.

### Milestone
- Versione interna promossa a `v0.4.0`: passaggio da "core in costruzione" a "release candidate".

## v0.3.6 / Sprint 3.6

### Added
- Regola di priorita giornaliera in `BookingPolicy`: prima prenotazione `GUARANTEED`, successive `NON_GUARANTEED`.
- Stato di priorita persistito nel `GameEvent` tramite campo `bookingPriority`.
- Completamento automatico partita per flussi singolo/doppio (maxPlayers 2 o 4) con campi `isCompleted` e `completedAt`.
- Domain Event `GameCompleted` emesso solo su transizione reale a completato.
- Test unit dedicati alle nuove regole di `BookingPolicy`.

### Changed
- `createGameEvent` ora valuta sia conflitti campo sia storico prenotazioni utente giornaliere per assegnare la priorita.
- `joinGameEvent`, `leaveGameEvent`, `confirmParticipation`, `declineParticipation`, `expireConfirmations` aggiornano anche lo stato di completamento.
- Handler notifiche/statistiche aggiornati per supportare `GameCompleted`.
- `firestore.rules` estese per i nuovi campi dominio in `game_events`.
- Versione interna progetto aggiornata a `v0.3.6`.

## v0.3.5 / Sprint 3.5

### Added
- `DomainEventPublisher` per disaccoppiare `BookingService` dagli effetti collaterali.
- `EventDispatcher` con interfaccia comune `DomainEventHandler`.
- `NotificationHandler` per persistenza notifiche da eventi supportati.
- `StatisticsHandler` per aggiornamento contatori derivati dagli eventi.
- `AuditHandler` per tracciamento handler-level su `event_audit`.
- Test dedicati al dispatch eventi e al comportamento degli handler.

### Changed
- `BookingService` ora pubblica eventi tramite `DomainEventPublisher` invece di gestire direttamente i side effect infrastrutturali.
- `firestore.rules` estese per `notifications` (create), `event_logs` (create), `event_statistics` e `event_audit`.
- Versione interna progetto aggiornata a `v0.3.5`.

## v0.3.4 / Sprint 3.4

### Added
- Ciclo di vita del partecipante con stati `PENDING_CONFIRMATION`, `CONFIRMED`, `DECLINED`, `EXPIRED`.
- Metodi `confirmParticipation()`, `declineParticipation()` ed `expireConfirmations()` in `BookingService`.
- Domain Event persistiti `ParticipationConfirmed`, `ParticipationDeclined`, `ConfirmationExpired`.
- Test di integrazione dedicati per conferma, rifiuto e scadenza conferme.

### Changed
- `PlayerParticipation` e la waiting list promossa ora entrano nel `GameEvent` con stato `PENDING_CONFIRMATION`.
- `BookingPolicy` estesa con regole per il ciclo di conferma dei partecipanti.

## v0.3.3 / Sprint 3.3

### Added
- Iscrizione alla waiting list con ordinamento per posizione.
- Promozione automatica del primo utente in waiting list quando si libera un posto.
- Persistenza Domain Event `WaitlistJoined` e `WaitlistPromoted`.
- Test di integrazione dedicati per waiting list e promozione.

### Changed
- `leaveGameEvent` ora verifica la coda attiva e promuove il primo utente disponibile nello stesso flusso applicativo.
- Versione interna progetto aggiornata a `v0.3.3` per allineamento Sprint/versione.

## Sprint 3.2

### Added
- Gestione partecipanti al `GameEvent` con `PlayerJoined` e `PlayerLeft` in `BookingService`.
- Validazione partecipanti tramite `BookingPolicy` con motivi strutturati (`EVENT_FULL`, `PLAYER_ALREADY_JOINED`, `PLAYER_NOT_FOUND`, `EVENT_NOT_OPEN`, `EVENT_NOT_FOUND`).
- Emissione Domain Event persistita in `event_logs` per `PlayerJoined` e `PlayerLeft`.
- Test dedicati per join/leave partecipanti e scenario di rifiuto policy.

### Changed
- Regole Firestore `game_events` estese per consentire update controllato di `participants`, `status`, `updatedAt`.
- `createGameEvent` ora emette anche il Domain Event `GameScheduled`, completando il principio architetturale per le mutazioni attuali del `GameEvent`.

## Sprint 3.1

### Added
- Introduzione di `GameEvent` come aggregate root.
- Prima versione operativa di `BookingService` e `BookingAvailabilityService`.
- `BookingPolicy` minima con risultato strutturato (`allowed`, `reason`) e motivi espliciti (`USER_NOT_ACTIVE`, `INVALID_SLOT`, `SLOT_CONFLICT`, `BOOKING_WINDOW_CLOSED`, `FIELD_CLOSED`).
- Collection `game_events` definita come modello iniziale.
- Calendario con visualizzazione eventi.
- Test integrazione `create/read GameEvent` su `BookingService`.

### Changed
- Documentazione aggiornata con roadmap Sprint 3.1 in `BOOKING_ENGINE_DESIGN.md`.
- Guida architetturale creata in `ARCHITECTURE.md`.
- `BookingService.createGameEvent` ora applica la policy prima del salvataggio e restituisce esito strutturato.
- `EventsPage` ora mostra messaggi utente in base al motivo di policy.
- Regole Firestore estese per `game_events`, `waiting_list` e `booking_settings`.

### Fixed
- Corretto fallback dei test rispetto alla finestra di prenotazione (BR-004) con date dinamiche nel test integrazione.

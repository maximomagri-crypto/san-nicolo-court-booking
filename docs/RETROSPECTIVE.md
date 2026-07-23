# Sprint Retrospective

## Sprint 3.1

### Obiettivo
- Introdurre il Booking Core minimo per GameEvent.

### Deliverable
- GameEvent iniziale
- BookingPolicy minima BR-001..BR-005
- BookingService iniziale
- Calendario eventi
- Test create/read GameEvent

### Cosa ha funzionato
- Scope stretto rispettato: policy minima BR-001..BR-005, build stabile e test create/read GameEvent.
- Separazione chiara tra dominio e infrastruttura: BookingPolicy pura, BookingService come orchestratore.

### Cosa migliorare
- Definire prima i dati di test rispetto alla booking window per evitare falsi negativi.
- Inserire sempre un gate fisso: test + build + update changelog + retrospettiva breve.

### Decisioni confermate
- Risultato policy strutturato (allowed/reason) per UI e localizzazione futura.
- Centralizzazione nomi collection e configurazioni booking settings.

### Debito tecnico
- Strategia di code splitting per ridurre il warning bundle size > 500 kB.

### Stato Sprint
- APPROVATO

## Sprint 3.5

### Obiettivo
- Introdurre EventDispatcher e handler infrastrutturali senza cambiare il dominio.

### Deliverable
- DomainEventPublisher
- EventDispatcher
- NotificationHandler
- StatisticsHandler
- AuditHandler
- Test dispatch dedicati

### Cosa ha funzionato
- `BookingService` resta orchestratore e non conosce direttamente notifiche/statistiche.
- Handler estensibili con interfaccia unica `supports/handle`.
- Infrastruttura eventi verificata con test dedicati e build stabile.

### Cosa migliorare
- Lato sicurezza, alcune rules sono volutamente permissive e andranno raffinate quando il dispatch uscira dal client.
- La futura introduzione di Cloud Functions potra spostare parte degli handler fuori dal frontend.

### Decisioni confermate
- Domain Event e Infrastructure Event restano separati.
- Il dispatcher permette estensioni senza cambiare il dominio.

### Debito tecnico
- Valutare il passaggio del dispatch su backend/event bus.
- Hardening delle regole Firestore per collezioni infrastrutturali.

### Stato Sprint
- APPROVATO

## Sprint 3.6

### Obiettivo
- Introdurre regole avanzate di prenotazione mantenendo il dominio al centro (`BookingPolicy` -> `BookingService` -> Domain Event).

### Deliverable
- Vincolo "una prenotazione garantita al giorno" con fallback a prenotazione non garantita.
- Distinzione persistita tra `GUARANTEED` e `NON_GUARANTEED`.
- Completamento automatico partita su soglie singolo/doppio.
- Domain Event `GameCompleted` su transizione effettiva.
- Unit test policy + integration test di completamento.

### Cosa ha funzionato
- Le regole sono nate in `BookingPolicy` e sono state orchestrate da `BookingService` senza introdurre nuove componenti infrastrutturali.
- L'evento `GameCompleted` e risultato chiaro e non ridondante (solo quando lo stato cambia).

### Cosa migliorare
- La promozione priorita da non garantita a garantita dopo cancellazioni giornaliere resta fuori dallo scope e richiedera una strategia esplicita.

### Decisioni confermate
- Priorita prenotazione come dato dominio nel `GameEvent`.
- Completamento partita separato da `status` operativo (`OPEN`/`FULL`/`CANCELLED`).

### Debito tecnico
- Valutare un job/evento dedicato per ricalcolo priorita giornaliera in caso di cancellazioni.

### Stato Sprint
- APPROVATO

## Sprint 3.7 - Hardening & Release Candidate

### Obiettivo
- Consolidare il core funzionale con focus su performance, qualita, sicurezza, UX e accessibilita.

### Deliverable
- Code splitting e lazy loading route-level.
- Copertura test misurata con report automatico.
- Hardening regole Firestore su documenti sensibili.
- Migliorie UX/A11y su login, feedback errori, focus e keyboard navigation.
- Chiusura warning prioritario bundle size.

### Cosa ha funzionato
- Riduzione chunk principale tramite splitting vendor (`firebase` separato).
- Nessuna regressione funzionale: suite test interamente verde.
- Criteri DoD tecnici resi oggettivi e verificabili.

### Cosa migliorare
- La copertura e sbilanciata sul dominio/backend-like: servono test UI e hook per aumentare la confidenza end-user.
- Il controllo performance puo essere automatizzato ulteriormente con soglie CI sul size budget.

### Decisioni confermate
- Ottimizzazioni tecniche gestite in sprint dedicato per evitare coupling con evoluzioni funzionali.
- Milestone `v0.4.0` adottata per segnare la fase release candidate.

### Debito tecnico
- Introdurre test component/hook per aumentare copertura UI.
- Formalizzare budget bundle in CI (fail su regressione oltre soglia).

### Stato Sprint
- APPROVATO

## Sprint 3.4

### Obiettivo
- Introdurre il ciclo di vita delle conferme dei partecipanti.

### Deliverable
- Stati `PENDING_CONFIRMATION`, `CONFIRMED`, `DECLINED`, `EXPIRED`
- BookingPolicy estesa per le conferme
- `confirmParticipation()`, `declineParticipation()`, `expireConfirmations()`
- Domain Event di conferma persistiti
- Test integrazione dedicati

### Cosa ha funzionato
- Lo Sprint e rimasto concentrato solo sul ciclo di vita del partecipante.
- Il modello event-driven e stato mantenuto anche per conferme, rifiuti e scadenze.
- Waiting list e conferme si integrano senza introdurre notifiche o automazioni esterne.

### Cosa migliorare
- La crescita di `BookingService` conferma che waiting list e conferme andranno separate in servizi dedicati se la complessita aumenta.
- Serve una futura policy esplicita per il timeout reale delle conferme, oggi demandato al chiamante di `expireConfirmations()`.

### Decisioni confermate
- BookingPolicy resta il punto centrale della validazione.
- I Domain Event rappresentano il contratto stabile del dominio anche per il ciclo di conferma.
- Le notifiche restano fuori dal perimetro e arriveranno solo come conseguenza degli eventi nello Sprint successivo.

### Debito tecnico
- Estrarre in futuro `WaitingListService` e `DomainEventPublisher` dal servizio orchestratore.
- Definire il meccanismo schedulato che invochera `expireConfirmations()`.

### Stato Sprint
- APPROVATO

## Sprint 3.2

### Obiettivo
- Implementare la gestione dei partecipanti del GameEvent.

### Deliverable
- PlayerJoined
- PlayerLeft
- Validazione tramite BookingPolicy
- Persistenza Domain Event
- Test integrazione

### Cosa ha funzionato
- Separazione dominio/servizi mantenuta.
- Nessuna regressione introdotta nello Sprint.
- Build stabile e test passati.
- Nessuna funzionalita anticipata oltre il perimetro definito.

### Cosa migliorare
- Bundle size superiore a 500 kB, da trattare in uno Sprint dedicato performance/hardening.
- Formalizzare una checklist architetturale finale: ogni mutazione significativa del GameEvent deve essere verificata rispetto all'emissione di Domain Event.

### Decisioni confermate
- BookingPolicy resta pura e testabile.
- BookingService continua a orchestrare le operazioni applicative.
- Domain Event persistiti in event_logs per PlayerJoined e PlayerLeft.
- GameEvent confermato come Aggregate Root.

### Debito tecnico
- Ottimizzazione bundle.
- Strategia lazy loading.
- Valutazione futura di Cloud Functions per operazioni amministrative o asincrone.
- Allineare anche createGameEvent all'approccio "ogni mutazione significativa produce Domain Event".

### Stato Sprint
- APPROVATO

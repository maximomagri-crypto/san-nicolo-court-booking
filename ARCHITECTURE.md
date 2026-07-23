# Architecture Overview

## Scopo

`ARCHITECTURE.md` è una guida rapida per nuovi sviluppatori che devono orientarsi nel progetto.
Non sostituisce il design dettagliato di `BOOKING_ENGINE_DESIGN.md`, ma fornisce il percorso rapido per capire:

- la struttura del progetto;
- i principi architetturali;
- i layer dell'applicazione;
- le convenzioni di naming;
- dove aggiungere nuovi servizi;
- come vengono gestiti i Domain Event;
- il flusso di una richiesta dall'interfaccia utente fino a Firestore.

---

## 1. Struttura del progetto

### Cartelle principali

- `src/`
  - `components/` — componenti UI React.
  - `firebase/` — inizializzazione Firebase, auth, user profile, servizi Firestore.
  - `services/` — servizi applicativi e orchestratori del dominio.
  - `hooks/` — hook custom per la logica di stato e realtime.
  - `utils/` — helper e funzioni comuni.

### Documenti importanti

- `BOOKING_ENGINE_DESIGN.md` — design funzionale e di dominio.
- `ARCHITECTURE.md` — guida rapida all'architettura.
- `firestore.rules` — regole di sicurezza Firestore.

---

## 2. Principi architetturali

- Separazione tra UI e dominio: la UI consuma servizi e hook, non contiene logica di business complessa.
- Domain-first: il motore di prenotazione è guidato da `GameEvent`, `BookingPolicy` e Domain Event.
- Firestore read-optimized: i dati sono modellati per query rapide e prefissate.
- Event-driven: il lavoro secondario come notifiche e audit è scatenato da eventi di dominio.
- Incremental delivery: ogni sprint deve creare una versione funzionante e distribuibile.

---

## 3. Layer dell'applicazione

### UI Layer

- Gestisce la navigazione e la presentazione.
- Invoca servizi per operazioni di scrittura e lettura.
- Usa hook React per mantenere lo stato sincronizzato.

### Application Layer

- Contiene i servizi che orchestrano le operazioni del dominio.
- Esempi: `GameEventService`, `GameEventWaitlistService`, `GameEventNotificationService`, `GameEventConfirmationService`, `GameEventAdminService`.
- Riceve richieste dalla UI, applica la politica di validazione e aggiorna Firestore.
- Evoluzione prevista: se la complessita della waiting list cresce, la logica di inserimento, ordinamento, promozione, rimozione e ricalcolo posizioni va estratta in un servizio dedicato (`WaitingListService`), lasciando `BookingService` come puro orchestratore.
- Eventi infrastrutturali: `BookingService` pubblica Domain Event tramite `DomainEventPublisher`, che li inoltra a `EventDispatcher` e agli handler registrati (`NotificationHandler`, `StatisticsHandler`, `AuditHandler`).

### Domain Layer

- Modello principale: `GameEvent` come Aggregate Root.
- Oggetti chiave: `PlayerParticipation`, `BookingPolicy`, `Domain Event`.
- Regole: le business rule sono centralizzate in `BookingPolicy`.

### Infrastructure Layer

- Interagisce con Firebase Auth, Firestore e i servizi di notifiche.
- Contiene la logica di persistence dei documenti.
- Gestisce `notifications`, `event_logs`, `game_events`, `waiting_list`.

---

## 4. Convenzioni di naming

- `GameEvent` — aggregate root del dominio.
- `PlayerParticipation` — value object che rappresenta un partecipante.
- `BookingPolicy` — centralizza le regole di business.
- `GameEventService` — orchestratore principale del flusso evento.
- `GameEventWaitlistService` — gestisce la lista d'attesa.
- `GameEventConfirmationService` — gestisce richieste e scadenze di conferma.
- `GameEventNotificationService` — genera notifiche a partire dagli eventi.
- `GameEventAdminService` — gestisce override e chiusure.
- `event_logs` — audit amministrativo.
- `notifications` — documenti per le notifiche utente.
- `game_events` — documento principale per le prenotazioni.
- `waiting_list` — collezione per la coda di attesa.

---

## 5. Dove aggiungere nuovi servizi

- Nuovi orchestratori del dominio vanno in `src/services/`.
- Se servono nuovi dati Firestore, aggiungere collezioni o campi documentati in `BOOKING_ENGINE_DESIGN.md`.
- Le regole di business nuove o complesse vanno implementate in `BookingPolicy`.
- La waiting list puo vivere inizialmente dentro `BookingService`, ma oltre il livello base deve migrare in `WaitingListService` per isolare ordinamento, promozione e manutenzione della coda.
- Le azioni amministrative vanno in `GameEventAdminService`.
- Le notifiche basate su eventi vanno in `GameEventNotificationService`.

---

## 6. Domain Event

### Comportamento

- I Domain Event sono il meccanismo ufficiale per propagare modifiche.
- Gli eventi non sono solo notifiche, ma segnali di cambiamento di stato del dominio.
- Ogni mutazione significativa dell'Aggregate Root `GameEvent` deve generare esattamente un Domain Event persistito.
- Esempi principali:
  - `GameScheduled`
  - `PlayerJoined`
  - `PlayerLeft`
  - `WaitlistJoined`
  - `WaitlistPromoted`
  - `ConfirmationRequired`
  - `GameConfirmed`
  - `ConfirmationExpired`
  - `GameCompleted`
  - `GameCancelled`
  - `GameCompleted`
  - `FieldClosed`
  - `QuotaExceeded`

### Gestione

- I servizi applicativi generano gli eventi.
- I consumer (notifiche, audit, waitlist) reagiscono agli eventi.
- Firestore è aggiornato dal servizio che detiene l’aggregate root.

### Distinzione tra Domain Event e Infrastructure Event

- I `Domain Event` descrivono cosa e accaduto nel dominio: `GameScheduled`, `PlayerJoined`, `PlayerLeft`, `GameConfirmed`.
- Gli `Infrastructure Event` sono gli effetti tecnici conseguenti: scrittura in `event_logs`, creazione notifiche, push, aggiornamento statistiche.
- Il modello di dominio deve rimanere stabile anche se in futuro la reazione tecnica verra spostata su Cloud Functions o su un broker di messaggi.

---

## 7. Flusso di una richiesta

1. L'utente interagisce con la UI.
2. La UI chiama un servizio applicativo in `src/services/`.
3. Il servizio legge la configurazione e lo stato attuale da Firestore.
4. `BookingPolicy` valuta le regole del dominio.
5. Se la richiesta è valida, il servizio aggiorna `game_events`, `waiting_list` o altre collezioni.
6. Il servizio genera i Domain Event rilevanti.
7. I consumer di eventi creano notifiche in `notifications` e scrivono audit in `event_logs`.
8. La UI riceve l’aggiornamento in realtime tramite React hook e listener Firebase.

---

## 8. Come iniziare a lavorare su una nuova feature

1. Controlla `BOOKING_ENGINE_DESIGN.md` per le regole e il modello dati.
2. Aggiungi/aggiorna i servizi in `src/services/`.
3. Mantieni i Domain Event consistenti con le regole di business.
4. Aggiorna le regole Firestore in `firestore.rules` se introduci nuovi accessi.
5. Scrivi test di servizio e test di integrazione se possibile.
6. Verifica che lo sprint rimanga distribuibile e funzionante.

---

## 9. Versione e rollout

- `BOOKING_ENGINE_DESIGN.md` è il documento di design dettagliato.
- `ARCHITECTURE.md` è la guida rapida per la struttura e i principi.
- Mantieni entrambi aggiornati quando introduci cambiamenti architetturali significativi.

## 10. Governance degli Sprint

Ogni Sprint o Pull Request deve soddisfare questi quattro controlli:

1. Il codice compila.
2. I test dello Sprint passano.
3. La documentazione interessata è aggiornata (solo se necessario).
4. Il `CHANGELOG.md` viene aggiornato.

### Definition of Done

Uno Sprint e considerato chiuso solo se tutti i seguenti criteri sono soddisfatti:

1. Build senza errori.
2. Test automatici verdi.
3. `firestore.rules` aggiornato se necessario.
4. ADR o `ARCHITECTURE.md` aggiornati se l'architettura cambia.
5. `CHANGELOG.md` aggiornato.
6. `docs/RETROSPECTIVE.md` compilato.
7. Nessun TODO critico lasciato nel codice toccato.
8. Nessun warning di build considerato prioritario rimasto aperto.
9. Nessuna regressione performance rispetto alla versione baseline dello sprint precedente.

## 11. Regola permanente sugli eventi

- `createGameEvent` -> `GameScheduled`
- `joinGameEvent` -> `PlayerJoined`
- `leaveGameEvent` -> `PlayerLeft`
- `cancelGameEvent` -> `GameCancelled`
- `confirmGameEvent` -> `GameConfirmed`
- `expireGameEventConfirmation` -> `ConfirmationExpired`

Questa mappa e un criterio di qualita: ogni mutazione significativa del `GameEvent` deve produrre un solo Domain Event persistito e verificabile con test.

## 12. Regole avanzate prenotazione (Sprint 3.6)

- La prima prenotazione valida del giorno per utente e marcata `GUARANTEED`.
- Le prenotazioni successive nello stesso giorno sono `NON_GUARANTEED`.
- Il completamento partita e un dato dominio (`isCompleted`, `completedAt`) calcolato su partecipanti occupanti per soglie singolo/doppio (2 o 4).

### Pipeline infrastrutturale eventi

`BookingService` -> `DomainEventPublisher` -> `EventDispatcher` -> handlers registrati.

Questa pipeline evita che il dominio conosca notifiche, statistiche o altri effetti collaterali tecnici.

## 13. Quando creare un ADR

Creare un nuovo ADR quando una decisione soddisfa almeno uno di questi criteri:

1. Introduce un nuovo componente architetturale.
2. Modifica in modo sostanziale le responsabilita tra servizi o layer.
3. Cambia il modello di dominio o il comportamento dell'Aggregate Root.
4. Introduce una nuova tecnologia, infrastruttura o meccanismo di integrazione.
5. Ha effetti che vanno oltre il singolo Sprint e influenzano evoluzioni future.

Domanda pratica di controllo:

- Se questa modifica venisse rimossa tra sei mesi, qualcuno avrebbe bisogno di sapere perche era stata introdotta?
- Se si, probabilmente serve un ADR.
- Se no, e sufficiente documentarla nel `CHANGELOG.md` o nella pull request.

Non e necessario creare un ADR per refactor locali, fix puntuali o cambiamenti interni che non alterano responsabilita, confini o decisioni permanenti del sistema.

# Sprint 3.0 — Progettazione del Booking Engine

## Obiettivo

Progettare completamente il motore delle prenotazioni di San Nicolò Court Booking, senza scrivere codice React o Firestore. Il documento è una progettazione tecnica e funzionale completa, pronta per la successiva fase di implementazione.

---

## 1. Analisi delle Business Rules esistenti

### Regole già concordate

- Un solo campo da tennis.
- Slot configurabili (attualmente 90 minuti).
- Apertura prenotazioni settimanali.
- Una prenotazione garantita al giorno per utente.
- Prenotazioni eccedenti marcate come "cedibili".
- Trasformazione automatica da singolare a doppio.
- Lista d'attesa.
- Conferma presenza.
- Notifiche.
- Amministrazione.
- Chiusura campi e giornate.
- Modalità test.

### Considerazioni chiave

1. **Singolo campo**: tutte le regole di disponibilità e conflitto devono essere calcolate su un unico resource pool.
2. **Slot configurabili**: il booking engine non deve hardcodare 90 minuti, ma usare configurazione dinamica e gestire possibili futuri intervalli diversi.
3. **Ciclo settimanale**: la disponibilità e gli orari devono essere espressi su base settimana/settimanale, per permettere aperture ricorrenti e chiusure straordinarie.
4. **Prenotazione giornaliera garantita**: ogni utente può avere almeno una prenotazione attiva al giorno in condizioni normali.
5. **Prenotazioni cedibili**: oltre il livello garantito, alcune prenotazioni diventano marcate come cedibili, con regole specifiche di visibilità e gestione.
6. **Trasformazione singolare/doppio**: il sistema deve riconoscere e trasformare automaticamente una prenotazione singola in doppia quando le condizioni sono verificate.
7. **Lista d'attesa**: il motore deve gestire con regole chiare chi entra, chi scala e in che ordine.
8. **Conferma presenza**: la prenotazione deve essere confermata entro una finestra, altrimenti scade.
9. **Notifiche**: gli eventi devono generare notifiche a utenti e amministrazione.
10. **Amministrazione**: strumenti e regole di override amministrativo devono convivere con la logica standard.
11. **Chiusura campi/giornate**: il motore deve permettere blocchi temporanei totali o parziali.
12. **Modalità test**: deve esistere un modo per testare regole e scenari senza impattare i dati di produzione.

---

## 2. Modello Firestore definitivo

### Principi generali

- Ottimizzare per letture, perché il booking engine è read-heavy.
- Usare documenti con struttura chiara e query efficienti.
- Favorire indici semplici e prefissare campi su cui verranno effettuate ricerche e ordinamenti.
- Minimizzare le join e le chiamate multiple.
- Strutturare i dati per future estensioni multi-campo.

### Concetti di dominio

#### `GameEvent` (Aggregate Root)

- Descrizione: l’aggregate principale del motore, rappresenta una sessione di gioco prenotata sul campo.
- Contiene: orario, risorsa (`courtId`), partecipanti e stato della prenotazione.
- Ha la responsabilità di mantenere la consistenza dell’evento, inclusa la gestione della lista d’attesa associata.
- Stato possibile: `PENDING`, `CONFIRMED`, `CANCELLED`, `EXPIRED`, `COMPLETED`, `TRANSFERRED`.
- Tipi di evento: `SINGLE`, `DOUBLE`, `TRANSFERRED`, `CEDIBLE`.
- Ownership: un singolo `GameEvent` racchiude `PlayerParticipation`, `waitlistEntries` e riferimenti ai documenti di audit.

#### `PlayerParticipation` (Value Object)

- Descrizione: rappresenta la partecipazione di un giocatore a un `GameEvent`.
- Campi principali:
  - `userId: string`
  - `role: string` (`PRIMARY`, `SECONDARY`, `GUEST`)
  - `joinedAt: timestamp`
  - `isConfirmed: boolean`
  - `participationType: string` (`PLAYER`, `WAITLIST_CANDIDATE`)
- Motivazione: è un oggetto immutabile rispetto all’identità dell’utente, e appartiene all’aggregato dell’evento.

#### `BookingPolicy`

- Descrizione: il punto centrale delle regole di business.
- Funzione: esegue le valutazioni su disponibilità, quote, cediabilità, conferme e promozioni.
- Ruolo: diventa il motore di regole che i servizi consultano prima di creare o aggiornare un `GameEvent`.
- Vantaggi: evita logiche distribuite in più servizi, centralizza la governance delle regole e rende più semplice la validazione testabile.

### Collezioni principali

#### `users`

Funzione principale: profili utenti e autorizzazioni.

Campi principali:

- `uid: string`
- `displayName: string`
- `email: string`
- `role: string` (`USER`, `SUB_ADMIN`, `SUPER_ADMIN`)
- `status: string` (`ACTIVE`, `PENDING_APPROVAL`, `SUSPENDED`)
- `createdAt: timestamp`
- `lastLogin: timestamp`
- `approvedAt: timestamp | null`
- `approvedBy: string | null`
- `isProfileComplete: boolean`
- `phone?: string`
- `photoURL?: string`
- `statistics?: map` (solo amministrazione, non modificabile dall’utente)
- `bookingQuota: number` (numero di prenotazioni giornaliere o settimanali garantite)

Motivazione:

- I dati utente sono riferimenti base per tutte le operazioni di prenotazione e notifica.
- `bookingQuota` rende immediata la verifica dei limiti garantiti.
- `statistics` viene mantenuto come campo read-only per admin e analisi.

Indice consigliato:

- no index specifico necessario per `users/{uid}` come documento singolo.

#### `booking_settings`

Funzione: configurazione centrale del motore.

Campi principali:

- `slotDurationMinutes: number`
- `availabilityWindowDays: number`
- `weeklySchedule: map` con orari per ogni giorno
- `maxBookingsPerUserPerDay: number`
- `maxBookingsPerUserPerWeek: number`
- `automaticDoubleThreshold: number` (soglia per trasformazione singolo->doppio)
- `waitlistEnabled: boolean`
- `confirmationTimeoutMinutes: number`
- `testMode: boolean`

Motivazione:

- Centralizza i parametri del motore.
- Permette modifiche senza toccare il codice.
- Supporta modalità test grazie a un flag dedicato.

Indice consigliato:

- nessuno, accesso puntuale per documento.

#### `game_events`

Funzione: memorizzare gli eventi di gioco prenotati come aggregate root.

Campi principali:

- `eventId: string`
- `courtId: string` (anche se un solo campo, futuro upgrade multi-campo)
- `status: string` (`PENDING`, `CONFIRMED`, `CANCELLED`, `EXPIRED`, `COMPLETED`, `TRANSFERRED`)
- `eventType: string` (`SINGLE`, `DOUBLE`, `TRANSFERRED`, `CEDIBLE`)
- `slotStart: timestamp`
- `slotEnd: timestamp`
- `createdAt: timestamp`
- `updatedAt: timestamp`
- `guaranteed: boolean` (true se garantita al giorno)
- `isCediable: boolean`
- `originalEventId?: string` (per trasformazioni e passaggi)
- `confirmedAt?: timestamp`
- `confirmedByUserAt?: timestamp`
- `notes?: string`
- `cancellationReason?: string`
- `closedDayOverride?: boolean` (flag amministrazione)
- `players: array` di `PlayerParticipation`
- `waitlistEntries?: array` di `PlayerParticipation` (opzionale)

Motivazione:

- `game_events` è la rappresentazione persistente del `GameEvent` aggregate root.
- `players` è un array di `PlayerParticipation` che documenta chi partecipa all’evento.
- `waitlistEntries` può essere mantenuto come collection separata per query ma è concettualmente legato all’aggregate.
- `status` e `eventType` separati permettono logiche distinte.
- `slotStart`/`slotEnd` consentono query di sovrapposizione.
- `guaranteed` e `isCediable` rappresentano immediatamente i casi di business.

Indici consigliati:

- `courtId, slotStart` (per disponibilità del campo)
- `status, slotStart` (per eventi in attesa/da confermare)
- `slotStart, status` (per query di promozione e conferma)
- `eventType, slotStart` (per ricerca doppie e trasferimenti)

#### `waiting_list`

Funzione: gestire la lista d’attesa come entità accessibile.

Campi principali:

- `waitlistId: string`
- `eventId: string` (evento candidato)
- `userId: string`
- `requestedSlotStart: timestamp`
- `requestedSlotEnd: timestamp`
- `joinedAt: timestamp`
- `position: number`
- `status: string` (`ACTIVE`, `PROMOTED`, `CANCELLED`)
- `notes?: string`

Motivazione:

- Conceptualmente la waiting list è parte dell’aggregate `GameEvent`, perché la sua promozione e le sue regole appartengono all’evento.
- In Firestore però si mantiene una collezione autonoma per query efficienti, ordini e promozioni, oltre a ridurre il rischio di documenti troppo grandi.
- `position` e `joinedAt` determinano l’ordine senza dover ordinare su documenti event.
- La relazione `eventId` rende chiaro il legame con il `GameEvent` root.

Indici consigliati:

- `requestedSlotStart, position`
- `userId, status`

#### `notifications`

Funzione: inviare avvisi agli utenti.

Campi principali:

- `notificationId: string`
- `recipientUid: string`
- `type: string` (`PLAYER_JOINED`, `GAME_SCHEDULED`, `CONFIRMATION_REQUIRED`, `GAME_CONFIRMED`, `CONFIRMATION_EXPIRED`, `GAME_CANCELLED`, `WAITLIST_PROMOTED`, ecc.)
- `title: string`
- `body: string`
- `relatedEventId?: string`
- `createdAt: timestamp`
- `read: boolean`
- `metadata?: map`

Motivazione:

- Strutturare le notifiche come documenti consente tracking e filtro utente.
- `read` aggiornabile per segnalare lettura.

Indice consigliato:

- `recipientUid, createdAt`

#### `event_logs`

Funzione: audit degli eventi amministrativi e di sistema.

Campi principali:

- `eventId: string`
- `eventType: string`
- `actorUid: string`
- `targetUid?: string`
- `bookingId?: string`
- `timestamp: timestamp`
- `payload: map`

Motivazione:

- Audit centralizzato per sicurezza e tracciabilità.
- Il motore amministrativo scrive eventi, non il client.

Indici consigliati:

- `eventType, timestamp`
- `actorUid, timestamp`

#### `booking_audit` (opzionale)

Funzione: tracciare mutazioni transazionali e storico di trasformazioni.

Campi principali:

- `auditId: string`
- `gameEventId: string`
- `action: string`
- `actorUid: string`
- `timestamp: timestamp`
- `details: map`

Motivazione:

- Supporto debugging e storicizzazione se necessaria.
- Utile in casi complessi di trasformazione singola/doppia.

---

## 3. Booking Engine: servizi applicativi

### 3.1 GameEventService

Responsabilità:

- orchestrare la creazione, cancellazione, trasformazione e conferma degli eventi di gioco.
- coordinare i servizi specializzati.
- garantire consistenza delle operazioni e rollback semantico.

Responsabile di:

- `createGameEvent(userId, slotStart, slotEnd, options)`
- `cancelGameEvent(eventId, userId, reason)`
- `promoteWaitlistEntry(waitlistId)`
- `transformSingleToDouble(eventId)`
- `completeGameEvent(eventId)`

### 3.2 BookingPolicy

Responsabilità:

- centralizzare tutte le regole di business del motore.
- validare disponibilità, quote, cediabilità, trasformazioni e conferme.
- calcolare la priorità tra prenotazioni garantite, cedibili e candidate alla lista d’attesa.
- restituire esiti strutturati consultabili dai servizi applicativi.

Responsabile di:

- `evaluateSlotAvailability(...)`
- `evaluateUserQuota(...)`
- `evaluateEventType(...)`
- `evaluateClosedDay(...)`
- `isWaitlistCandidate(...)`
- `isConfirmationNeeded(...)`

### 3.3 BookingAvailabilityService

Responsabilità:

- calcolare la disponibilità del campo.
- costruire la vista degli slot prenotabili.
- filtrare prenotazioni garantite, cedibili e disponibili.

Responsabile di:

- `getAvailableSlots(dateRange)`
- `getConflictingBookings(slotStart, slotEnd)`
- `getGuaranteedBookingStatus(userId, date)`

### 3.4 GameEventWaitlistService

Responsabilità:

- gestire iscrizione, ordine e promozione della lista d’attesa.
- notificare quando una posizione si libera.
- monitorare la coerenza tra prenotazioni e lista.
- mantenere la relazione tra `waitlistEntries` e il `GameEvent` di riferimento.
- Se la waiting list cresce oltre il flusso base, questa responsabilita deve essere estratta da `BookingService` in un servizio dedicato (`WaitingListService`) per mantenere chiara la separazione tra orchestrazione e gestione della coda.

Responsabile di:

- `joinWaitlist(userId, desiredSlot)`
- `cancelWaitlistEntry(waitlistId)`
- `promoteNextEntry(slotStart)`
- `reorderWaitlistIfNeeded()`

### 3.5 GameEventNotificationService

Responsabilità:

- inviare notifiche in base agli eventi di dominio.
- generare documenti in `notifications`.
- marcare `read`/`unread`.

Responsabile di:

- `notifyPlayerJoined(...)`
- `notifyConfirmationRequired(...)`
- `notifyGameCancelled(...)`
- `notifyWaitlistPromoted(...)`
- `notifyGameScheduled(...)`
- `notifyGameCompleted(...)`

### 3.6 GameEventConfirmationService

Responsabilità:

- gestire la conferma presenza e le scadenze.
- passare eventi in stato `EXPIRED` se non confermati in tempo.

Responsabile di:

- `requestConfirmation(eventId)`
- `confirmAttendance(eventId, userId)`
- `expireUnconfirmedEvents()`

### 3.7 GameEventAdminService

Responsabilità:

- funzioni amministrative e override.
- chiusura campi/giornate.
- gestione di prenotazioni cedibili e trasferimenti.

Responsabile di:

- `closeDay(date, reason)`
- `openDay(date)`
- `markGameEventAsCediable(eventId)`
- `approveManualBooking(...)`

---

## 4. Business Rules Engine

### 4.1 Elenco regole

#### Regola 1 — Un solo campo

- Descrizione: la disponibilità deve essere calcolata come singola risorsa.
- Priorità: alta.
- Punto applicazione: `BookingAvailabilityService` e `BookingPolicy`.
- Dipendenze: `game_events` query, `booking_settings`.

#### Regola 2 — Slot configurabili

- Descrizione: la durata e il pattern degli slot sono parametrizzati.
- Priorità: alta.
- Punto applicazione: `BookingSettings`, `BookingAvailabilityService`.
- Dipendenze: `booking_settings.weeklySchedule`, `slotDurationMinutes`.

#### Regola 3 — Apertura prenotazioni settimanali

- Descrizione: disponibilità calcolata su una finestra settimanale esplicita.
- Priorità: alta.
- Punto applicazione: `BookingAvailabilityService`.
- Dipendenze: `booking_settings.availabilityWindowDays`.

#### Regola 4 — Una prenotazione garantita al giorno

- Descrizione: un utente può avere almeno una prenotazione garantita al giorno.
- Priorità: alta.
- Punto applicazione: `BookingPolicy`, `GameEventService`.
- Dipendenze: `users.bookingQuota`, stato utente, slot giornalieri.

#### Regola 5 — Prenotazioni eccedenti cedibili

- Descrizione: oltre il livello garantito, un evento può essere marcato come cedibile.
- Priorità: media.
- Punto applicazione: `BookingPolicy`, `GameEventAdminService`.
- Dipendenze: `game_events.isCediable`, `waiting_list`.

#### Regola 6 — Trasformazione singolare in doppio

- Descrizione: quando trovata una condizione di doppio, il sistema promuove/trasforma.
- Priorità: media.
- Punto applicazione: `GameEventService`, `BookingPolicy`.
- Dipendenze: `game_events.eventType`, `booking_settings.automaticDoubleThreshold`.

#### Regola 7 — Lista d'attesa

- Descrizione: gli utenti possono entrare in waiting list quando lo slot non è disponibile.
- Priorità: alta.
- Punto applicazione: `GameEventWaitlistService`.
- Dipendenze: `waiting_list`, `game_events`, notifiche.

#### Regola 8 — Conferma presenza

- Descrizione: il booking richiede conferma entro la finestra configurata.
- Priorità: alta.
- Punto applicazione: `GameEventConfirmationService`.
- Dipendenze: `notifications`, `booking_settings.confirmationTimeoutMinutes`.

#### Regola 9 — Notifiche

- Descrizione: i principali eventi di prenotazione generano notifiche ai destinatari.
- Priorità: alta.
- Punto applicazione: `GameEventNotificationService`.
- Dipendenze: eventi di dominio, `notifications`.

#### Regola 10 — Amministrazione

- Descrizione: gli admin gestiscono chiusure, eccezioni, cediabilità e override.
- Priorità: alta.
- Punto applicazione: `BookingPolicy`, `GameEventAdminService`.
- Dipendenze: `checks` sui ruoli admin, `event_logs`.

#### Regola 11 — Chiusura campi e giornate

- Descrizione: determinati giorni possono essere chiusi o riaperti manualmente.
- Priorità: media.
- Punto applicazione: `GameEventAdminService`, `BookingAvailabilityService`.
- Dipendenze: `booking_settings` e possibili `closedDays` collection o flags in `game_events`.

#### Regola 12 — Modalità test

- Descrizione: il sistema deve poter essere eseguito in test mode senza impattare gli utenti reali.
- Priorità: media.
- Punto applicazione: `BookingSettings` e servizi.
- Dipendenze: `booking_settings.testMode`.

---

## 5. Flussi completi

### 5.1 Creazione prenotazione

1. L’utente richiede uno slot.
2. `GameEventService` carica configurazione e dati utente.
3. `BookingAvailabilityService` calcola la disponibilità sul range.
4. `BookingPolicy` valuta:
   - utente `ACTIVE`;
   - slot valido e allineato a `slotDurationMinutes`;
   - nessun conflitto con eventi esistenti;
   - limite giornaliero/settimanale;
   - eventuale cediabilità;
   - idoneità alla lista d’attesa.
5. Se valido, crea documento `game_events` con status `PENDING` o `CONFIRMED`, e aggiunge `players: [PlayerParticipation]`.
6. Se il gioco non è immediatamente confermabile, lascia lo stato `PENDING` e invia richiesta di conferma.
7. Se lo slot è occupato ma il candidato può entrare in lista d’attesa, `GameEventWaitlistService` crea un entry in `waiting_list` con `status = ACTIVE`.
8. Genera evento di dominio `PlayerJoined` o `GameScheduled` e notifica.

### 5.2 Completamento doppio

1. Il sistema rileva una condizione per doppio (ad esempio due partecipazioni compatibili nello stesso slot).
2. `BookingPolicy` conferma la trasformazione.
3. `GameEventService` aggiorna l’evento:
   - `eventType = DOUBLE`
   - `slotEnd` e `slotStart` coerenti
   - `confirmedAt`/`updatedAt`
4. Genera evento di dominio `GameCompleted` o `DoubleMatchFormed`.
5. Notifica i partecipanti.

### 5.3 Cancellazione

1. L’utente o admin richiede cancellazione.
2. `GameEventService` verifica autorizzazione.
3. Se il gioco è `PENDING` o `CONFIRMED`, la cancellazione è semplice; se già scaduto, passa a `EXPIRED`.
4. Aggiorna `game_events.status = CANCELLED` e `cancellationReason`.
5. Se necessario, promuove la prima entry `ACTIVE` in `waiting_list` per lo stesso slot.
6. Genera evento di dominio `PlayerWithdrew` o `GameCancelled` e notifica.

### 5.4 Lista d'attesa

1. Utente chiede slot già occupato.
2. `GameEventWaitlistService` crea entry con posizione legata a `eventId`.
3. Quando un `GameEvent` si libera:
   - `promoteNextEntry` seleziona la prima `ACTIVE` per slot.
   - Crea o aggiorna un `GameEvent` con status `PENDING` o `CONFIRMED`.
4. Invia notifica di dominio `WaitlistPromoted` e richiede conferma.

### 5.5 Approvazione automatica

1. Se le regole la permettono, l’evento può essere confermato automaticamente.
2. `BookingPolicy` controlla soglie e condizioni.
3. Se supera i controlli, imposta `status = CONFIRMED` e `confirmedAt`.
4. Altrimenti, rimane `PENDING` e richiede conferma.

### 5.6 Conferma presenza

1. Il sistema invia richiesta di conferma all’utente.
2. `GameEventConfirmationService` registra conferma con `confirmedByUserAt`.
3. Se confermato, mantiene o aggiorna lo stato `CONFIRMED`.
4. In caso contrario, dopo `confirmationTimeoutMinutes` aggiorna a `EXPIRED`.
5. Genera evento di dominio `ConfirmationExpired` o `GameConfirmed`.

### 5.7 Scadenza conferma

1. Un job periodico o trigger calcola eventi `PENDING` scaduti.
2. `GameEventConfirmationService` aggiorna lo stato.
3. Promuove eventuale waiting list.
4. Notifica l’utente e gli admin se previsto.

---

## 6. Eventi di dominio

### Eventi principali

- `PlayerJoined`
  - Quando un giocatore viene registrato in un nuovo `GameEvent`.
  - Generato da `GameEventService`.

- `PlayerLeft`
  - Quando un giocatore abbandona o viene rimosso da un `GameEvent` prima della conferma.
  - Generato da `GameEventService`.

- `GameScheduled`
  - Quando un evento di gioco viene pianificato sul campo.
  - Generato da `GameEventService`.

- `GameConfirmed`
  - Quando un evento viene confermato dall’utente o automaticamente.
  - Generato da `GameEventConfirmationService`.

- `ConfirmationExpired`
  - Quando un evento non viene confermato entro il tempo previsto.
  - Generato da `GameEventConfirmationService`.

- `GameCancelled`
  - Quando l’utente o l’admin annulla l’evento.
  - Generato da `GameEventService`.

- `WaitlistJoined`
  - Quando un utente entra nella lista d’attesa.
  - Generato da `GameEventWaitlistService`.

- `WaitlistPromoted`
  - Quando un utente della lista d’attesa viene promosso su uno slot libero.
  - Generato da `GameEventWaitlistService`.

- `GameCompleted`
  - Quando un evento viene completato o trasformato in doppio.
  - Generato da `GameEventService`.

- `FieldClosed`
  - Quando il campo/giornata viene chiusa.
  - Generato da `GameEventAdminService`.

- `QuotaExceeded`
  - Quando un utente supera la soglia di prenotazioni garantite.
  - Generato da `BookingPolicy`.

---

## 7. Notifiche previste

Le notifiche sono generate in risposta agli eventi di dominio, non alle singole azioni client. Il `GameEventNotificationService` ascolta eventi come `PlayerJoined`, `GameScheduled`, `ConfirmationRequired`, `GameConfirmed`, `ConfirmationExpired`, `GameCancelled`, `WaitlistJoined`, `WaitlistPromoted`, `GameCompleted`, `FieldClosed` e `QuotaExceeded`.

### Tipologie e contenuti

#### `PlayerJoined`
- Destinatari: il giocatore che entra nell’evento.
- Contenuto: conferma iscrizione all’evento, ruolo nel match (`PRIMARY`, `SECONDARY`, `GUEST`), orario, stato del game.
- Metadata: `playerRole`, `eventId`, `eventType`.

#### `GameScheduled`
- Destinatari: tutti i partecipanti al `GameEvent` e, opzionalmente, gli admin.
- Contenuto: evento pianificato, slot, risorsa, stato iniziale (`PENDING`/`CONFIRMED`).
- Metadata: `eventId`, `slotStart`, `slotEnd`, `courtId`.

#### `ConfirmationRequired`
- Destinatari: utente principale o giocatori con evento `PENDING`.
- Contenuto: richiesta di conferma presenza, deadline, link o istruzioni.
- Metadata: `eventId`, `confirmationDeadline`, `requiredParticipants`.

#### `GameConfirmed`
- Destinatari: tutti i partecipanti e gli admin se previsto.
- Contenuto: evento confermato, orario definitivo, elenco partecipanti.
- Metadata: `eventId`, `confirmedAt`, `participantCount`.

#### `ConfirmationExpired`
- Destinatari: partecipante/i dell’evento scaduto e candidati in lista d’attesa.
- Contenuto: evento non confermato, slot liberato, possibile promozione dalla waitlist.
- Metadata: `eventId`, `expiredAt`, `nextWaitlistCandidate`.

#### `GameCancelled`
- Destinatari: partecipanti dell’evento e admin se la cancellazione è amministrativa.
- Contenuto: evento cancellato, motivo, eventuale istruzione per riprenotare o rollback.
- Metadata: `eventId`, `cancelledBy`, `cancellationReason`.

#### `WaitlistJoined`
- Destinatari: utente entrato in lista d’attesa.
- Contenuto: conferma ingresso in waitlist, posizione, slot desiderato.
- Metadata: `waitlistId`, `eventId`, `position`.

#### `WaitlistPromoted`
- Destinatari: utente promosso dalla waitlist.
- Contenuto: slot ora disponibile, azione richiesta (conferma presenza, completamento aggiornamento). 
- Metadata: `eventId`, `waitlistId`, `promotionPosition`.

#### `GameCompleted`
- Destinatari: partecipanti all’evento.
- Contenuto: conferma completamento dell’evento, stato finale, eventuale conversione in doppio.
- Metadata: `eventId`, `completionTime`, `finalEventType`.

#### `FieldClosed`
- Destinatari: admin e utenti con eventi influenzati dal blocco.
- Contenuto: calendario o campo chiuso, durata della chiusura, implicazioni per gli eventi programmati.
- Metadata: `closedDate`, `courtId`, `affectedEventIds`.

#### `QuotaExceeded`
- Destinatari: utente vicino o oltre il limite di prenotazioni guarantee.
- Contenuto: avviso sul limite quota, impatto sulla cediabilità e possibili azioni.
- Metadata: `userId`, `currentQuota`, `maxQuota`, `cedibilityStatus`.

### Strategia di notifica

- Ogni evento genera una notifica strutturata in `notifications` con `relatedEventId` e `metadata` specifico.
- Il servizio sceglie i destinatari in base al tipo di evento e alla relazione con il `GameEvent`.
- Domini `ConfirmationRequired` e `WaitlistPromoted` sono prioritari e possono generare follow-up temporizzati.
- Le notifiche admin per `FieldClosed` e `QuotaExceeded` sono separate da quelle utente, ma mantenute nello stesso modello documentale.

---

## 8. Sequenza di implementazione

Ogni sprint deve lasciare il progetto in uno stato funzionante e distribuibile.
La roadmap è organizzata in incrementi che aggiungono valore reale e mantengono la stabilità del progetto.

### Sprint 3.1 — Booking Core

- Obiettivo: creazione e visualizzazione di `GameEvent`.
- Modello dati Firestore: `game_events`, `booking_settings`.
- Servizi base: `GameEventService`, `BookingAvailabilityService`, `BookingPolicy` (focalizzazione iniziale).
- Funzionalità: creazione evento, visualizzazione degli eventi programmati, validazione slot di base.
- Build stabile: è possibile creare eventi, visualizzarli e distribuire l’app con un motore di prenotazione minimo.
- Test: creazione game event, visualizzazione lista eventi, controllo conflitti elementari.

### Sprint 3.2 — Partecipazione ai GameEvent

- Obiettivo: introduzione della partecipazione con `PlayerJoined` e `PlayerLeft`.
- Modello dati: `game_events` con array `players: PlayerParticipation`.
- Servizi: `GameEventService`, `GameEventWaitlistService` (base), `GameEventNotificationService` (se necessario).
- Funzionalità: join/leave di giocatori, aggiornamento partecipazioni, stato partecipazione.
- Build stabile: è possibile gestire la composizione del match e distribuire un sistema con partecipanti.
- Test: join/leave player, stato del `GameEvent`, consistenza `PlayerParticipation`.

### Sprint 3.3 — Lista d'attesa

- Obiettivo: implementare la waitlist come flusso core.
- Modello dati: `waiting_list`, relazione `eventId`, eventuale `game_events.waitlistEntries` concettuale.
- Servizi: `GameEventWaitlistService`, `BookingPolicy`, `GameEventService`.
- Funzionalità: join waitlist, promozioni, gestione posizioni e stato.
- Build stabile: è possibile inserire utenti in coda e promuovere il primo candidati in modo testabile.
- Test: accesso waitlist, promozione, coerenza di `position` e `status`.

### Sprint 3.4 — Conferme presenza

- Obiettivo: gestione dello stato `PENDING` e processi di conferma.
- Modello dati: ciclo di vita del partecipante con `PENDING_CONFIRMATION`, `CONFIRMED`, `DECLINED`, `EXPIRED`, oltre a `confirmedAt`, `confirmedByUserAt` e timeout di conferma.
- Servizi: `GameEventConfirmationService`, `BookingPolicy`, `GameEventService`.
- Funzionalità: accept/decline partecipazione, scadenza conferma, transizione a `EXPIRED`.
- Domain Event: `ParticipationConfirmed`, `ParticipationDeclined`, `ConfirmationExpired`.
- Build stabile: è possibile usare il sistema in produzione con conferme e scadenze automatiche.
- Test: richiesta conferma, conferma evento, scadenza e promozione waitlist.

### Sprint 3.5 — Notifiche come conseguenza degli eventi

- Obiettivo: introdurre le notifiche come reazione tecnica ai Domain Event gia presenti.
- Modello dati: `notifications`, `event_logs`, metadati evento per destinatari e stato lettura.
- Servizi: `GameEventNotificationService`, `EventDispatcher`, handler dedicati come `NotificationHandler`, `StatisticsHandler`, `AuditHandler`.
- Funzionalità: creazione notifiche a partire da `GameScheduled`, `PlayerJoined`, `PlayerLeft`, `WaitlistPromoted`, `GameConfirmed`, `ConfirmationExpired`.
- Build stabile: il dominio resta invariato, mentre la reazione infrastrutturale agli eventi diventa osservabile e testabile.
- Test: persistenza notifiche, mapping evento-destinatari, assenza di regressioni sui Domain Event.

### Sprint 3.6 — Regole avanzate e trasformazione automatica

- Obiettivo: centralizzare le regole avanzate nel `BookingPolicy`.
- Modello dati: `isCediable`, `guaranteed`, `bookingQuota`, `eventType`, `transfer`.
- Servizi: `BookingPolicy`, `GameEventService`, `GameEventAdminService`.
- Funzionalità: prenotazioni multiple nello stesso giorno, trasformazione automatica in doppio, vincoli temporali, priorita ed eccezioni.
- Build stabile: è possibile distribuire un motore di regole avanzate che governa lo stato degli eventi.
- Test: regole di quota, cediabilità, doppio match, coerente applicazione delle policy.

### Sprint 3.7 — Rifiniture e hardening

- Obiettivo: completare il flusso con notifiche e hardening.
- Modello dati: `notifications`, `event_logs`, `game_events`, `waiting_list`.
- Servizi: `GameEventNotificationService`, `GameEventAdminService`, `BookingPolicy`.
- Funzionalità: ottimizzazione bundle, code splitting, lazy loading, analisi performance, revisione Firestore Rules, copertura test, accessibilita e rifiniture UX.
- Build stabile: sistema completo con tracciamento, notifiche e strumenti amministrativi utilizzabili.
- Test: invio notifiche, storo audit, chiusure, modalità test, refactoring finale.

---

## 9. Report finale

### Obiettivo raggiunto

- Progettazione tecnica del motore di prenotazione completata.
- Definito modello Firestore, servizi, regole di business, flussi, eventi e notifiche.
- Stabilito roadmap multi-sprint con risultati funzionanti per ogni step.

### Cosa non è stato fatto

- Non sono stati scritti componenti React.
- Non è stato scritto codice Firestore.
- Non è stato eseguito alcun deploy.

### Raccomandazione

Procedere con una prima implementazione minimalista del modello dati e dei servizi core prima di introdurre la lista d’attesa e la trasformazione doppia. Questo consente di avere una build funzionante il prima possibile e riduce il rischio di regressioni.

---

## 10. Domain Event Map

Questa mappa del dominio è il riferimento rapido per comprendere quali eventi di dominio esistono, quali aggregate modificano, quale servizio li genera, quali documenti Firestore vengono toccati, e se producono notifiche e audit.

| Domain Event | Aggregate Root | Servizio | Documenti Firestore coinvolti | Notifica | Audit (`event_logs`) |
|---|---|---|---|:---:|:---:|
| `GameScheduled` | `GameEvent` | `GameEventService` | `game_events`, `notifications` | ✔ | ✔ |
| `PlayerJoined` | `GameEvent` | `GameEventService` | `game_events`, `notifications` | ✔ | ✔ |
| `PlayerLeft` | `GameEvent` | `GameEventService` | `game_events`, `notifications` | ✔ | ✔ |
| `WaitlistJoined` | `GameEvent` | `GameEventWaitlistService` | `waiting_list`, `game_events`, `notifications` | ✔ | ✔ |
| `WaitlistPromoted` | `GameEvent` | `GameEventWaitlistService` | `waiting_list`, `game_events`, `notifications` | ✔ | ✔ |
| `ConfirmationRequired` | `GameEvent` | `GameEventConfirmationService` | `notifications` | ✔ | ✖ |
| `GameConfirmed` | `GameEvent` | `GameEventConfirmationService` | `game_events`, `notifications` | ✔ | ✔ |
| `ConfirmationExpired` | `GameEvent` | `GameEventConfirmationService` | `game_events`, `waiting_list`, `notifications` | ✔ | ✔ |
| `GameCancelled` | `GameEvent` | `GameEventService` / `GameEventAdminService` | `game_events`, `notifications` | ✔ | ✔ |
| `GameCompleted` | `GameEvent` | `GameEventService` | `game_events`, `notifications` | ✔ | ✔ |
| `FieldClosed` | `Sistema` | `GameEventAdminService` | `booking_settings`, `game_events`, `notifications` | ✔ | ✔ |
| `QuotaExceeded` | `GameEvent` | `BookingPolicy` | `game_events`, `notifications` | ✔ | ✔ |

## 11. Decisioni Architetturali (ADR – Architecture Decision Record)

Queste decisioni documentano le scelte fondamentali del progetto e il loro motivo.

- **ADR-001**: `GameEvent` è l’Aggregate Root del dominio.
  - Rationale: rappresenta l’unità di consistenza dell’intero processo di prenotazione e partecipazione.

- **ADR-002**: Firestore è ottimizzato per le letture, accettando una moderata duplicazione dei dati.
  - Rationale: struttura `game_events`, `waiting_list`, `notifications` e `event_logs` per query efficienti e accesso rapido.

- **ADR-003**: Tutte le regole di business sono centralizzate in `BookingPolicy`.
  - Rationale: centralizzazione delle regole per evitare logiche duplicate in più servizi e ridurre il rischio di inconsistenze.

- **ADR-004**: I `Domain Event` rappresentano il meccanismo ufficiale di propagazione delle modifiche nel sistema.
  - Rationale: gli eventi di dominio separano la scrittura del modello dall’orchestrazione di notifiche, waitlist e auditing.

- **ADR-005**: La `waiting_list` è concettualmente parte del `GameEvent`, ma è implementata come collezione autonoma per garantire query efficienti e scalabilità.
  - Rationale: la relazione tra evento e waitlist è mantenuta con `eventId`, mentre la collezione autonoma evita documenti troppo grandi e rende possibili ordinamenti efficienti.

- **ADR-006**: Ogni mutazione significativa dell'Aggregate Root `GameEvent` deve generare esattamente un Domain Event persistito.
  - Rationale: la regola rende verificabile il modello event-driven, evita mutazioni silenziose del dominio e crea un criterio stabile di qualita per i test e gli Sprint successivi.

- **ADR-007**: Gli effetti collaterali tecnici dei Domain Event sono gestiti da `DomainEventPublisher` + `EventDispatcher` + handler registrati.
  - Rationale: il dominio resta disaccoppiato da notifiche, statistiche e audit infrastrutturale, consentendo estensioni future (es. Cloud Functions o message broker) senza modificare `BookingService`.

- **ADR-008**: La priorita giornaliera di prenotazione e una regola di dominio calcolata in `BookingPolicy` e persistita nel `GameEvent`.
  - Rationale: la prima prenotazione valida giornaliera resta garantita (`GUARANTEED`), le successive sono non garantite (`NON_GUARANTEED`), evitando logica implicita lato UI.

- **ADR-009**: Il completamento automatico partita e modellato come stato dominio separato (`isCompleted`, `completedAt`) con evento `GameCompleted` su transizione.
  - Rationale: mantenere distinto lo stato operativo (`OPEN`/`FULL`/`CANCELLED`) dal traguardo di completamento, preservando chiarezza dei flussi partecipanti.

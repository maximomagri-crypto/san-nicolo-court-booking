import { useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../firebase/AuthProvider'
import { BookingPolicyReason, createGameEvent } from '../services/BookingService'
import { useGameEvents } from '../hooks/useGameEvents'
import type { NewGameEvent } from '../types/booking'
import { formatDateLike } from '../utils/format'

function getPolicyMessage(reason?: BookingPolicyReason): string {
  switch (reason) {
    case BookingPolicyReason.USER_NOT_ACTIVE:
      return 'Utente non attivo: non puoi creare eventi.'
    case BookingPolicyReason.INVALID_SLOT:
      return 'Slot non valido: controlla orario di inizio, fine e durata configurata.'
    case BookingPolicyReason.SLOT_CONFLICT:
      return 'Slot non disponibile: esiste gia un evento sovrapposto.'
    case BookingPolicyReason.BOOKING_WINDOW_CLOSED:
      return 'La data scelta e fuori dalla finestra di prenotazione.'
    case BookingPolicyReason.FIELD_CLOSED:
      return 'Il campo e chiuso nella data selezionata.'
    default:
      return 'Prenotazione non consentita dalla policy.'
  }
}

export default function EventsPage() {
  const { profile } = useAuth()
  const { events, loading, error } = useGameEvents()
  const isAdmin = profile?.role === 'SUB_ADMIN' || profile?.role === 'SUPER_ADMIN'

  const [title, setTitle] = useState('Partita aperta')
  const [description, setDescription] = useState('Evento prenotazione campo')
  const [courtName, setCourtName] = useState('Court 1')
  const [startAt, setStartAt] = useState(() => {
    const now = new Date()
    now.setHours(now.getHours() + 1, 0, 0, 0)
    return now.toISOString().slice(0, 16)
  })
  const [endAt, setEndAt] = useState(() => {
    const later = new Date()
    later.setHours(later.getHours() + 2, 0, 0, 0)
    return later.toISOString().slice(0, 16)
  })
  const [maxPlayers, setMaxPlayers] = useState(4)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const visibleEvents = useMemo(
    () => events.filter((item) => item.status !== 'CANCELLED'),
    [events],
  )

  const handleCreateEvent = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSuccessMessage(null)
    setErrorMessage(null)
    setSaving(true)

    try {
      const startDate = new Date(startAt)
      const endDate = new Date(endAt)

      if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
        throw new Error('Entrambe le date devono essere valide.')
      }

      if (startDate >= endDate) {
        throw new Error('L’orario di fine deve essere successivo all’orario di inizio.')
      }

      const newEvent: NewGameEvent = {
        title,
        description,
        type: 'PRACTICE',
        courtName,
        startAt: startDate,
        endAt: endDate,
        maxPlayers,
        status: 'OPEN',
        isPublic: true,
        createdBy: profile?.uid ?? 'unknown',
        participants: [],
      }

      const result = await createGameEvent({
        event: newEvent,
        userStatus: profile?.status,
      })

      if (!result.ok) {
        throw new Error(getPolicyMessage(result.policy.reason))
      }

      setSuccessMessage('Evento creato con successo.')
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="events-root screen screen--visible" aria-label="Eventi sportivi">
      <div className="events-header">
        <div>
          <p className="events-context">Calendario prenotazioni</p>
          <h1 className="events-title">Eventi e disponibilità</h1>
          <p className="events-subtitle">Visualizza gli eventi e crea nuovi slot di allenamento se sei un amministratore.</p>
        </div>
        <Link className="admin-back-link" to="/">
          Torna alla dashboard
        </Link>
      </div>

      <div className="events-grid">
        <div className="events-list">
          <h2>Prossimi eventi</h2>

          {loading && <p>Caricamento eventi...</p>}
          {error && <p className="error-message">Errore: {String(error.message)}</p>}
          {!loading && visibleEvents.length === 0 && <p>Nessun evento programmato.</p>}

          {visibleEvents.map((item) => (
            <article key={item.id} className="event-card">
              <h3>{item.title}</h3>
              <p>{item.description}</p>
              <dl>
                <div>
                  <dt>Campo</dt>
                  <dd>{item.courtName}</dd>
                </div>
                <div>
                  <dt>Inizio</dt>
                  <dd>{formatDateLike(item.startAt)}</dd>
                </div>
                <div>
                  <dt>Fine</dt>
                  <dd>{formatDateLike(item.endAt)}</dd>
                </div>
                <div>
                  <dt>Stato</dt>
                  <dd>{item.status}</dd>
                </div>
                <div>
                  <dt>Partecipanti</dt>
                  <dd>{item.participants.length}/{item.maxPlayers}</dd>
                </div>
              </dl>
            </article>
          ))}
        </div>

        {isAdmin && (
          <div className="events-form-card">
            <h2>Crea nuovo evento</h2>
            <form onSubmit={handleCreateEvent}>
              <label>
                Titolo
                <input value={title} onChange={(event) => setTitle(event.target.value)} required />
              </label>
              <label>
                Descrizione
                <input value={description} onChange={(event) => setDescription(event.target.value)} required />
              </label>
              <label>
                Campo
                <input value={courtName} onChange={(event) => setCourtName(event.target.value)} required />
              </label>
              <label>
                Inizio
                <input type="datetime-local" value={startAt} onChange={(event) => setStartAt(event.target.value)} required />
              </label>
              <label>
                Fine
                <input type="datetime-local" value={endAt} onChange={(event) => setEndAt(event.target.value)} required />
              </label>
              <label>
                Max giocatori
                <input
                  type="number"
                  min={1}
                  value={maxPlayers}
                  onChange={(event) => setMaxPlayers(Number(event.target.value))}
                  required
                />
              </label>
              {successMessage && <p className="success-message">{successMessage}</p>}
              {errorMessage && <p className="error-message">{errorMessage}</p>}
              <button className="primary-btn" type="submit" disabled={saving}>
                {saving ? 'Salvataggio...' : 'Crea evento'}
              </button>
            </form>
          </div>
        )}
      </div>
    </section>
  )
}

import { useEffect, useState } from 'react'
import { onSnapshot, type Unsubscribe } from 'firebase/firestore'
import { getUpcomingGameEventsQuery } from '../services/BookingService'
import type { GameEvent, GameEventBase } from '../types/booking'

export function useGameEvents() {
  const [events, setEvents] = useState<GameEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)

    const unsubscribe: Unsubscribe = onSnapshot(
      getUpcomingGameEventsQuery(),
      (snapshot) => {
        const items = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...(doc.data() as GameEventBase),
        }))

        setEvents(items)
        setLoading(false)
      },
      (snapshotError) => {
        const error = snapshotError as unknown
        setError(error instanceof Error ? error : new Error(String(error)))
        setLoading(false)
      },
    )

    return () => unsubscribe()
  }, [])

  return { events, loading, error }
}

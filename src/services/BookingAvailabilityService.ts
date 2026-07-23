import { collection, getDocs, query, where, orderBy, Timestamp } from 'firebase/firestore'
import { FIRESTORE_COLLECTIONS } from '../firebase/collections'
import { db } from '../firebase/firebase'
import type { GameEventStatus } from '../types/booking'

const gameEventsCollectionRef = collection(db, FIRESTORE_COLLECTIONS.gameEvents)

export async function isTimeSlotAvailable(
  courtName: string,
  startAt: Date,
  endAt: Date,
): Promise<boolean> {
  const availabilityQuery = query(
    gameEventsCollectionRef,
    where('courtName', '==', courtName),
    where('startAt', '<', Timestamp.fromDate(endAt)),
    orderBy('startAt', 'asc'),
  )

  const snapshot = await getDocs(availabilityQuery)
  const hasConflict = snapshot.docs.some((doc) => {
    const data = doc.data() as { endAt?: Timestamp; status?: GameEventStatus }
    if (data.status === 'CANCELLED') {
      return false
    }

    if (!data.endAt || typeof data.endAt.toDate !== 'function') {
      return false
    }

    return data.endAt.toDate() > startAt
  })

  return !hasConflict
}

import { collection, doc, increment, serverTimestamp, setDoc } from 'firebase/firestore'
import { db } from '../../firebase/firebase'
import { FIRESTORE_COLLECTIONS } from '../../firebase/collections'
import type { DomainEvent } from '../DomainEvent'
import type { DomainEventHandler } from '../DomainEventHandler'

const statisticsCollectionRef = collection(db, FIRESTORE_COLLECTIONS.eventStatistics)

function getCounterField(eventType: string): string {
  if (eventType === 'GameScheduled') {
    return 'gamesScheduled'
  }

  if (eventType === 'PlayerJoined' || eventType === 'PlayerLeft') {
    return 'participationChanges'
  }

  if (eventType === 'ParticipationConfirmed') {
    return 'participationConfirmed'
  }

  if (eventType === 'ParticipationDeclined' || eventType === 'ConfirmationExpired') {
    return 'participationDropped'
  }

  if (eventType === 'WaitlistPromoted') {
    return 'waitlistPromotions'
  }

  if (eventType === 'GameCompleted') {
    return 'gamesCompleted'
  }

  return 'otherEvents'
}

export class StatisticsHandler implements DomainEventHandler {
  supports(_event: DomainEvent): boolean {
    return true
  }

  async handle(event: DomainEvent): Promise<void> {
    const statsRef = doc(statisticsCollectionRef, 'global')
    const counterField = getCounterField(event.type)

    await setDoc(
      statsRef,
      {
        totalEvents: increment(1),
        [counterField]: increment(1),
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    )
  }
}

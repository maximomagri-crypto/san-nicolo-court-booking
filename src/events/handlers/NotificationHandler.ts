import { collection, doc, serverTimestamp, setDoc } from 'firebase/firestore'
import { db } from '../../firebase/firebase'
import { FIRESTORE_COLLECTIONS } from '../../firebase/collections'
import type { DomainEvent } from '../DomainEvent'
import type { DomainEventHandler } from '../DomainEventHandler'

const notificationsCollectionRef = collection(db, FIRESTORE_COLLECTIONS.notifications)

const SUPPORTED_NOTIFICATION_EVENTS = new Set<string>([
  'GameScheduled',
  'PlayerJoined',
  'PlayerLeft',
  'WaitlistPromoted',
  'ParticipationConfirmed',
  'ParticipationDeclined',
  'GameCompleted',
])

export class NotificationHandler implements DomainEventHandler {
  supports(event: DomainEvent): boolean {
    return SUPPORTED_NOTIFICATION_EVENTS.has(event.type)
  }

  async handle(event: DomainEvent): Promise<void> {
    const notificationRef = doc(notificationsCollectionRef)

    await setDoc(notificationRef, {
      recipientUid: event.actorUid,
      type: event.type,
      title: `Evento ${event.type}`,
      body: `Aggiornamento relativo all'evento ${event.aggregateId}.`,
      relatedEventId: event.aggregateId,
      metadata: event.payload,
      read: false,
      createdAt: serverTimestamp(),
    })
  }
}

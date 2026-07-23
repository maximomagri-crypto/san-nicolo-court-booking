import { collection, doc, serverTimestamp, setDoc } from 'firebase/firestore'
import { db } from '../firebase/firebase'
import { FIRESTORE_COLLECTIONS } from '../firebase/collections'
import { createDefaultEventDispatcher } from './createDefaultEventDispatcher'
import type { DomainEvent, DomainEventType } from './DomainEvent'

const eventLogsCollectionRef = collection(db, FIRESTORE_COLLECTIONS.eventLogs)

export class DomainEventPublisher {
  private readonly dispatcher = createDefaultEventDispatcher()

  async publish(type: DomainEventType, actorUid: string, aggregateId: string, payload: Record<string, unknown>) {
    const eventRef = doc(eventLogsCollectionRef)
    const event: DomainEvent = {
      id: eventRef.id,
      type,
      actorUid,
      aggregateId,
      occurredAt: new Date(),
      payload,
    }

    await setDoc(eventRef, {
      eventType: event.type,
      actorUid: event.actorUid,
      bookingId: event.aggregateId,
      payload: event.payload,
      timestamp: serverTimestamp(),
    })

    await this.dispatcher.dispatch(event)
  }
}

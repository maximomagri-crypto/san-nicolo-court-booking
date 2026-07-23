import { collection, doc, serverTimestamp, setDoc } from 'firebase/firestore'
import { db } from '../../firebase/firebase'
import { FIRESTORE_COLLECTIONS } from '../../firebase/collections'
import type { DomainEvent } from '../DomainEvent'
import type { DomainEventHandler } from '../DomainEventHandler'

const eventAuditCollectionRef = collection(db, FIRESTORE_COLLECTIONS.eventAudit)

export class AuditHandler implements DomainEventHandler {
  supports(_event: DomainEvent): boolean {
    return true
  }

  async handle(event: DomainEvent): Promise<void> {
    const auditRef = doc(eventAuditCollectionRef)
    await setDoc(auditRef, {
      sourceEventId: event.id,
      sourceEventType: event.type,
      actorUid: event.actorUid,
      aggregateId: event.aggregateId,
      payload: event.payload,
      createdAt: serverTimestamp(),
    })
  }
}

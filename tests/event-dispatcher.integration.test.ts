import { beforeEach, describe, expect, it, vi } from 'vitest'

const firestoreMocks = vi.hoisted(() => {
  return {
    collection: vi.fn((_db: unknown, name: string) => ({ _tag: 'collection', name })),
    doc: vi.fn((collectionRef?: { name?: string }, id?: string) => ({
      id: id ?? 'generated-id',
      collection: collectionRef?.name ?? 'unknown',
    })),
    setDoc: vi.fn(),
    serverTimestamp: vi.fn(() => ({ _serverTimestamp: true })),
    increment: vi.fn((value: number) => ({ _increment: value })),
  }
})

vi.mock('firebase/firestore', () => firestoreMocks)
vi.mock('../src/firebase/firebase', () => ({ db: {} }))

describe('DomainEventPublisher + EventDispatcher integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('dispatches GameScheduled to notification, statistics, and audit handlers', async () => {
    const { DomainEventPublisher } = await import('../src/events/DomainEventPublisher')

    const publisher = new DomainEventPublisher()
    await publisher.publish('GameScheduled', 'u-1', 'event-1', { courtName: 'Court 1' })

    const notificationCall = firestoreMocks.setDoc.mock.calls.find(
      (call) => (call[1] as { relatedEventId?: string; type?: string }).type === 'GameScheduled',
    )
    const statisticsCall = firestoreMocks.setDoc.mock.calls.find(
      (call) => (call[1] as { totalEvents?: unknown }).totalEvents !== undefined,
    )
    const auditCall = firestoreMocks.setDoc.mock.calls.find(
      (call) => (call[1] as { sourceEventType?: string }).sourceEventType === 'GameScheduled',
    )
    const domainLogCall = firestoreMocks.setDoc.mock.calls.find(
      (call) => (call[1] as { eventType?: string }).eventType === 'GameScheduled',
    )

    expect(domainLogCall).toBeDefined()
    expect(notificationCall).toBeDefined()
    expect(statisticsCall).toBeDefined()
    expect(auditCall).toBeDefined()
  })

  it('does not create notification for unsupported event type but still updates stats and audit', async () => {
    const { DomainEventPublisher } = await import('../src/events/DomainEventPublisher')

    const publisher = new DomainEventPublisher()
    await publisher.publish('ConfirmationExpired', 'u-2', 'event-2', { participantUid: 'u-2' })

    const notificationCall = firestoreMocks.setDoc.mock.calls.find(
      (call) => (call[1] as { type?: string }).type === 'ConfirmationExpired',
    )
    const statisticsCall = firestoreMocks.setDoc.mock.calls.find(
      (call) => (call[1] as { totalEvents?: unknown }).totalEvents !== undefined,
    )
    const auditCall = firestoreMocks.setDoc.mock.calls.find(
      (call) => (call[1] as { sourceEventType?: string }).sourceEventType === 'ConfirmationExpired',
    )

    expect(notificationCall).toBeUndefined()
    expect(statisticsCall).toBeDefined()
    expect(auditCall).toBeDefined()
  })
})

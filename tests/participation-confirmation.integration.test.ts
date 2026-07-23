import { beforeEach, describe, expect, it, vi } from 'vitest'

const firestoreMocks = vi.hoisted(() => {
  return {
    collection: vi.fn(() => ({ _tag: 'collection' })),
    doc: vi.fn((_collectionRef?: unknown, id?: string) => ({ id: id ?? 'generated-id' })),
    getDoc: vi.fn(),
    getDocs: vi.fn(),
    addDoc: vi.fn(),
    updateDoc: vi.fn(),
    setDoc: vi.fn(),
    increment: vi.fn((value: number) => ({ _increment: value })),
    query: vi.fn(() => ({ _tag: 'query' })),
    orderBy: vi.fn(() => ({ _tag: 'orderBy' })),
    where: vi.fn(() => ({ _tag: 'where' })),
    serverTimestamp: vi.fn(() => ({ _serverTimestamp: true })),
    Timestamp: {
      fromDate: vi.fn((date: Date) => date),
    },
  }
})

vi.mock('firebase/firestore', () => firestoreMocks)
vi.mock('../src/firebase/firebase', () => ({ db: {} }))

describe('Participation confirmation integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    firestoreMocks.getDocs.mockResolvedValue({ docs: [] })
  })

  it('confirms a pending participant and emits ParticipationConfirmed', async () => {
    const eventSnapshot = {
      exists: () => true,
      id: 'event-c1',
      data: () => ({
        maxPlayers: 4,
        status: 'OPEN',
        participants: [
          {
            uid: 'u-1',
            displayName: 'Mario Rossi',
            email: 'mario@example.com',
            status: 'PENDING_CONFIRMATION',
            joinedAt: null,
          },
        ],
      }),
    }

    firestoreMocks.getDoc.mockResolvedValue(eventSnapshot)

    const { confirmParticipation } = await import('../src/services/BookingService')

    const result = await confirmParticipation({
      eventId: 'event-c1',
      participantUid: 'u-1',
      userStatus: 'ACTIVE',
    })

    expect(result).toEqual({
      ok: true,
      policy: { allowed: true },
      participantsCount: 1,
    })
    expect(firestoreMocks.updateDoc).toHaveBeenCalledTimes(1)

    const updatePayload = firestoreMocks.updateDoc.mock.calls[0][1] as {
      participants: Array<{ uid: string; status: string }>
    }
    expect(updatePayload.participants[0].status).toBe('CONFIRMED')

    const eventCall = firestoreMocks.setDoc.mock.calls.find(
      (call) => (call[1] as { eventType?: string }).eventType === 'ParticipationConfirmed',
    )
    expect(eventCall).toBeDefined()
    const eventPayload = eventCall?.[1] as { eventType: string; payload: { participantUid: string } }
    expect(eventPayload.eventType).toBe('ParticipationConfirmed')
    expect(eventPayload.payload.participantUid).toBe('u-1')
  })

  it('declines a pending participant, promotes waiting list, and emits ParticipationDeclined', async () => {
    const eventSnapshot = {
      exists: () => true,
      id: 'event-c2',
      data: () => ({
        maxPlayers: 2,
        status: 'FULL',
        participants: [
          {
            uid: 'u-1',
            displayName: 'Mario Rossi',
            email: 'mario@example.com',
            status: 'PENDING_CONFIRMATION',
            joinedAt: null,
          },
          {
            uid: 'u-2',
            displayName: 'Luigi Verdi',
            email: 'luigi@example.com',
            status: 'CONFIRMED',
            joinedAt: null,
          },
        ],
      }),
    }

    firestoreMocks.getDoc.mockResolvedValue(eventSnapshot)
    firestoreMocks.getDocs.mockResolvedValue({
      docs: [
        {
          id: 'wait-c2-1',
          data: () => ({
            eventId: 'event-c2',
            participant: { uid: 'u-3', displayName: 'Anna Bianchi', email: 'anna@example.com' },
            status: 'ACTIVE',
            position: 1,
            joinedAt: null,
          }),
        },
      ],
    })

    const { declineParticipation } = await import('../src/services/BookingService')

    const result = await declineParticipation({
      eventId: 'event-c2',
      participantUid: 'u-1',
      userStatus: 'ACTIVE',
    })

    expect(result).toEqual({
      ok: true,
      policy: { allowed: true },
      participantsCount: 3,
    })
    expect(firestoreMocks.updateDoc).toHaveBeenCalledTimes(2)

    const eventUpdatePayload = firestoreMocks.updateDoc.mock.calls[0][1] as {
      participants: Array<{ uid: string; status: string }>
      status: string
    }
    expect(eventUpdatePayload.participants[0].status).toBe('DECLINED')
    expect(eventUpdatePayload.participants[2].uid).toBe('u-3')
    expect(eventUpdatePayload.participants[2].status).toBe('PENDING_CONFIRMATION')
    expect(eventUpdatePayload.status).toBe('FULL')

    const declinedCall = firestoreMocks.setDoc.mock.calls.find(
      (call) => (call[1] as { eventType?: string }).eventType === 'ParticipationDeclined',
    )
    const promotedCall = firestoreMocks.setDoc.mock.calls.find(
      (call) => (call[1] as { eventType?: string }).eventType === 'WaitlistPromoted',
    )
    expect(declinedCall).toBeDefined()
    expect(promotedCall).toBeDefined()
    const declinedPayload = declinedCall?.[1] as { eventType: string }
    const promotedPayload = promotedCall?.[1] as { eventType: string }
    expect(declinedPayload.eventType).toBe('ParticipationDeclined')
    expect(promotedPayload.eventType).toBe('WaitlistPromoted')
  })

  it('expires pending confirmations and emits ConfirmationExpired for each expired participant', async () => {
    const eventSnapshot = {
      exists: () => true,
      id: 'event-c3',
      data: () => ({
        maxPlayers: 3,
        status: 'OPEN',
        participants: [
          {
            uid: 'u-1',
            displayName: 'Mario Rossi',
            email: 'mario@example.com',
            status: 'PENDING_CONFIRMATION',
            joinedAt: null,
          },
          {
            uid: 'u-2',
            displayName: 'Luigi Verdi',
            email: 'luigi@example.com',
            status: 'CONFIRMED',
            joinedAt: null,
          },
        ],
      }),
    }

    firestoreMocks.getDoc.mockResolvedValue(eventSnapshot)

    const { expireConfirmations } = await import('../src/services/BookingService')

    const result = await expireConfirmations({
      eventId: 'event-c3',
    })

    expect(result).toEqual({
      ok: true,
      expiredCount: 1,
      participantsCount: 2,
    })
    expect(firestoreMocks.updateDoc).toHaveBeenCalledTimes(1)

    const updatePayload = firestoreMocks.updateDoc.mock.calls[0][1] as {
      participants: Array<{ uid: string; status: string }>
      status: string
    }
    expect(updatePayload.participants[0].status).toBe('EXPIRED')
    expect(updatePayload.status).toBe('OPEN')

    const expiredCall = firestoreMocks.setDoc.mock.calls.find(
      (call) => (call[1] as { eventType?: string }).eventType === 'ConfirmationExpired',
    )
    expect(expiredCall).toBeDefined()
    const expiredPayload = expiredCall?.[1] as { eventType: string; payload: { participantUid: string } }
    expect(expiredPayload.eventType).toBe('ConfirmationExpired')
    expect(expiredPayload.payload.participantUid).toBe('u-1')
  })
})

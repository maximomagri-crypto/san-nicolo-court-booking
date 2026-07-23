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

describe('Waiting list integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('joins waiting list with next ordered position and emits WaitlistJoined', async () => {
    const eventSnapshot = {
      exists: () => true,
      id: 'event-w1',
      data: () => ({
        maxPlayers: 2,
        status: 'FULL',
        participants: [
          { uid: 'p-1', displayName: 'P1', email: 'p1@example.com', status: 'CONFIRMED', joinedAt: null },
          { uid: 'p-2', displayName: 'P2', email: 'p2@example.com', status: 'CONFIRMED', joinedAt: null },
        ],
      }),
    }

    firestoreMocks.getDoc.mockResolvedValue(eventSnapshot)
    firestoreMocks.getDocs.mockResolvedValue({
      docs: [
        {
          id: 'wait-1',
          data: () => ({
            eventId: 'event-w1',
            participant: { uid: 'u-old', displayName: 'Old User', email: 'old@example.com' },
            status: 'ACTIVE',
            position: 1,
            joinedAt: null,
          }),
        },
      ],
    })

    const { joinWaitingList } = await import('../src/services/BookingService')

    const result = await joinWaitingList({
      eventId: 'event-w1',
      userStatus: 'ACTIVE',
      participant: {
        uid: 'u-new',
        displayName: 'New User',
        email: 'new@example.com',
      },
    })

    expect(result).toEqual({
      ok: true,
      policy: { allowed: true },
      entryId: 'generated-id',
      position: 2,
    })
    const waitingListCall = firestoreMocks.setDoc.mock.calls.find(
      (call) => (call[1] as { status?: string; participant?: unknown }).status === 'ACTIVE',
    )
    expect(waitingListCall).toBeDefined()

    const waitingListPayload = waitingListCall?.[1] as {
      status: string
      position: number
      participant: { uid: string }
    }
    expect(waitingListPayload.status).toBe('ACTIVE')
    expect(waitingListPayload.position).toBe(2)
    expect(waitingListPayload.participant.uid).toBe('u-new')

    const domainCall = firestoreMocks.setDoc.mock.calls.find((call) => (call[1] as { eventType?: string }).eventType === 'WaitlistJoined')
    expect(domainCall).toBeDefined()

    const domainPayload = domainCall?.[1] as {
      eventType: string
      payload: { participantUid: string; position: number }
    }
    expect(domainPayload.eventType).toBe('WaitlistJoined')
    expect(domainPayload.payload.participantUid).toBe('u-new')
    expect(domainPayload.payload.position).toBe(2)
  })

  it('promotes first waiting user when a participant leaves and emits WaitlistPromoted', async () => {
    const eventSnapshot = {
      exists: () => true,
      id: 'event-w2',
      data: () => ({
        maxPlayers: 2,
        status: 'FULL',
        participants: [
          { uid: 'u-leave', displayName: 'Leave User', email: 'leave@example.com', status: 'CONFIRMED', joinedAt: null },
          { uid: 'u-stay', displayName: 'Stay User', email: 'stay@example.com', status: 'CONFIRMED', joinedAt: null },
        ],
      }),
    }

    firestoreMocks.getDoc.mockResolvedValue(eventSnapshot)
    firestoreMocks.getDocs.mockResolvedValue({
      docs: [
        {
          id: 'wait-10',
          data: () => ({
            eventId: 'event-w2',
            participant: { uid: 'u-promote', displayName: 'Promoted User', email: 'promote@example.com' },
            status: 'ACTIVE',
            position: 1,
            joinedAt: null,
          }),
        },
      ],
    })

    const { leaveGameEvent } = await import('../src/services/BookingService')

    const result = await leaveGameEvent({
      eventId: 'event-w2',
      userStatus: 'ACTIVE',
      participant: {
        uid: 'u-leave',
        displayName: 'Leave User',
        email: 'leave@example.com',
      },
    })

    expect(result).toEqual({
      ok: true,
      policy: { allowed: true },
      participantsCount: 2,
    })
    expect(firestoreMocks.updateDoc).toHaveBeenCalledTimes(2)

    const eventUpdatePayload = firestoreMocks.updateDoc.mock.calls[0][1] as {
      participants: Array<{ uid: string }>
      status: string
    }
    expect(eventUpdatePayload.participants).toHaveLength(2)
    expect(eventUpdatePayload.participants[0].uid).toBe('u-stay')
    expect(eventUpdatePayload.participants[1].uid).toBe('u-promote')
    expect(eventUpdatePayload.participants[1].status).toBe('PENDING_CONFIRMATION')
    expect(eventUpdatePayload.status).toBe('FULL')

    const queueUpdatePayload = firestoreMocks.updateDoc.mock.calls[1][1] as {
      status: string
    }
    expect(queueUpdatePayload.status).toBe('PROMOTED')

    const leftCall = firestoreMocks.setDoc.mock.calls.find((call) => (call[1] as { eventType?: string }).eventType === 'PlayerLeft')
    const promotedCall = firestoreMocks.setDoc.mock.calls.find((call) => (call[1] as { eventType?: string }).eventType === 'WaitlistPromoted')
    expect(leftCall).toBeDefined()
    expect(promotedCall).toBeDefined()

    const leftPayload = leftCall?.[1] as { eventType: string }
    const promotedPayload = promotedCall?.[1] as {
      eventType: string
      payload: { participantUid: string; waitingListEntryId: string }
    }
    expect(leftPayload.eventType).toBe('PlayerLeft')
    expect(promotedPayload.eventType).toBe('WaitlistPromoted')
    expect(promotedPayload.payload.participantUid).toBe('u-promote')
    expect(promotedPayload.payload.waitingListEntryId).toBe('wait-10')
  })
})

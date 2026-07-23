import { beforeEach, describe, expect, it, vi } from 'vitest'

const firestoreMocks = vi.hoisted(() => {
  return {
    collection: vi.fn(() => ({ _tag: 'collection' })),
    doc: vi.fn((_collectionRef?: unknown, id?: string) => ({ id: id ?? 'generated-log-id' })),
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

describe('BookingService participants integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    firestoreMocks.getDocs.mockResolvedValue({ docs: [] })
  })

  it('joins a participant, updates event, and emits PlayerJoined domain event', async () => {
    const eventSnapshot = {
      exists: () => true,
      id: 'event-1',
      data: () => ({
        maxPlayers: 2,
        status: 'OPEN',
        participants: [],
      }),
    }

    firestoreMocks.getDoc.mockResolvedValue(eventSnapshot)

    const { joinGameEvent } = await import('../src/services/BookingService')

    const result = await joinGameEvent({
      eventId: 'event-1',
      userStatus: 'ACTIVE',
      participant: {
        uid: 'u-1',
        displayName: 'Mario Rossi',
        email: 'mario@example.com',
      },
    })

    expect(result.ok).toBe(true)
    expect(firestoreMocks.updateDoc).toHaveBeenCalledTimes(1)

    const updatePayload = firestoreMocks.updateDoc.mock.calls[0][1] as {
      participants: Array<{ uid: string }>
      status: string
    }
    expect(updatePayload.participants).toHaveLength(1)
    expect(updatePayload.participants[0].uid).toBe('u-1')
    expect(updatePayload.participants[0].status).toBe('PENDING_CONFIRMATION')
    expect(updatePayload.status).toBe('OPEN')

    const domainCall = firestoreMocks.setDoc.mock.calls.find((call) => (call[1] as { eventType?: string }).eventType === 'PlayerJoined')
    expect(domainCall).toBeDefined()
    const domainPayload = domainCall?.[1] as { eventType: string; payload: { participantUid: string } }
    expect(domainPayload.eventType).toBe('PlayerJoined')
    expect(domainPayload.payload.participantUid).toBe('u-1')
  })

  it('leaves a participant, updates event, and emits PlayerLeft domain event', async () => {
    const eventSnapshot = {
      exists: () => true,
      id: 'event-2',
      data: () => ({
        maxPlayers: 4,
        status: 'FULL',
        participants: [
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

    const { leaveGameEvent } = await import('../src/services/BookingService')

    const result = await leaveGameEvent({
      eventId: 'event-2',
      userStatus: 'ACTIVE',
      participant: {
        uid: 'u-2',
        displayName: 'Luigi Verdi',
        email: 'luigi@example.com',
      },
    })

    expect(result.ok).toBe(true)
    expect(firestoreMocks.updateDoc).toHaveBeenCalledTimes(1)

    const updatePayload = firestoreMocks.updateDoc.mock.calls[0][1] as {
      participants: Array<{ uid: string }>
      status: string
    }
    expect(updatePayload.participants).toHaveLength(0)
    expect(updatePayload.status).toBe('OPEN')

    const domainCall = firestoreMocks.setDoc.mock.calls.find((call) => (call[1] as { eventType?: string }).eventType === 'PlayerLeft')
    expect(domainCall).toBeDefined()
    const domainPayload = domainCall?.[1] as { eventType: string; payload: { participantUid: string } }
    expect(domainPayload.eventType).toBe('PlayerLeft')
    expect(domainPayload.payload.participantUid).toBe('u-2')
  })

  it('rejects join when participant already exists', async () => {
    const eventSnapshot = {
      exists: () => true,
      id: 'event-3',
      data: () => ({
        maxPlayers: 4,
        status: 'OPEN',
        participants: [
          {
            uid: 'u-3',
            displayName: 'Anna Bianchi',
            email: 'anna@example.com',
            status: 'CONFIRMED',
            joinedAt: null,
          },
        ],
      }),
    }

    firestoreMocks.getDoc.mockResolvedValue(eventSnapshot)

    const { BookingPolicyReason, joinGameEvent } = await import('../src/services/BookingService')

    const result = await joinGameEvent({
      eventId: 'event-3',
      userStatus: 'ACTIVE',
      participant: {
        uid: 'u-3',
        displayName: 'Anna Bianchi',
        email: 'anna@example.com',
      },
    })

    expect(result).toEqual({
      ok: false,
      policy: {
        allowed: false,
        reason: BookingPolicyReason.PLAYER_ALREADY_JOINED,
      },
    })
    expect(firestoreMocks.updateDoc).not.toHaveBeenCalled()
    expect(firestoreMocks.setDoc).not.toHaveBeenCalled()
  })

  it('auto-completes singles game and emits GameCompleted when second occupying player joins', async () => {
    const eventSnapshot = {
      exists: () => true,
      id: 'event-4',
      data: () => ({
        maxPlayers: 2,
        status: 'OPEN',
        isCompleted: false,
        participants: [
          {
            uid: 'u-10',
            displayName: 'Player One',
            email: 'one@example.com',
            status: 'CONFIRMED',
            joinedAt: null,
          },
        ],
      }),
    }

    firestoreMocks.getDoc.mockResolvedValue(eventSnapshot)

    const { joinGameEvent } = await import('../src/services/BookingService')

    const result = await joinGameEvent({
      eventId: 'event-4',
      userStatus: 'ACTIVE',
      participant: {
        uid: 'u-11',
        displayName: 'Player Two',
        email: 'two@example.com',
      },
    })

    expect(result.ok).toBe(true)

    const updatePayload = firestoreMocks.updateDoc.mock.calls[0][1] as {
      status: string
      isCompleted: boolean
    }
    expect(updatePayload.status).toBe('FULL')
    expect(updatePayload.isCompleted).toBe(true)

    const gameCompletedCall = firestoreMocks.setDoc.mock.calls.find(
      (call) => (call[1] as { eventType?: string }).eventType === 'GameCompleted',
    )
    expect(gameCompletedCall).toBeDefined()
  })

  it('does not mark event completed for unsupported format even when full', async () => {
    const eventSnapshot = {
      exists: () => true,
      id: 'event-5',
      data: () => ({
        maxPlayers: 3,
        status: 'OPEN',
        isCompleted: false,
        participants: [
          {
            uid: 'u-20',
            displayName: 'Player A',
            email: 'a@example.com',
            status: 'CONFIRMED',
            joinedAt: null,
          },
          {
            uid: 'u-21',
            displayName: 'Player B',
            email: 'b@example.com',
            status: 'CONFIRMED',
            joinedAt: null,
          },
        ],
      }),
    }

    firestoreMocks.getDoc.mockResolvedValue(eventSnapshot)

    const { joinGameEvent } = await import('../src/services/BookingService')

    const result = await joinGameEvent({
      eventId: 'event-5',
      userStatus: 'ACTIVE',
      participant: {
        uid: 'u-22',
        displayName: 'Player C',
        email: 'c@example.com',
      },
    })

    expect(result.ok).toBe(true)

    const updatePayload = firestoreMocks.updateDoc.mock.calls[0][1] as {
      status: string
      isCompleted: boolean
    }
    expect(updatePayload.status).toBe('FULL')
    expect(updatePayload.isCompleted).toBe(false)

    const gameCompletedCall = firestoreMocks.setDoc.mock.calls.find(
      (call) => (call[1] as { eventType?: string }).eventType === 'GameCompleted',
    )
    expect(gameCompletedCall).toBeUndefined()
  })
})

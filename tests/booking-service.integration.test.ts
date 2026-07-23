import { beforeEach, describe, expect, it, vi } from 'vitest'

const firestoreMocks = vi.hoisted(() => {
  return {
    collection: vi.fn(() => ({ _tag: 'collection' })),
    doc: vi.fn((_collectionRef?: unknown, id?: string) => ({ id: id ?? 'generated-id' })),
    getDoc: vi.fn(),
    getDocs: vi.fn(),
    addDoc: vi.fn(),
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

describe('BookingService integration (create/read)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('creates and reads a game event when policy allows it', async () => {
    const startAt = new Date()
    startAt.setDate(startAt.getDate() + 1)
    startAt.setHours(10, 0, 0, 0)

    const endAt = new Date(startAt)
    endAt.setMinutes(endAt.getMinutes() + 90)

    const settingsSnapshot = {
      exists: () => true,
      data: () => ({
        slotDurationMinutes: 90,
        bookingWindowDays: 14,
        closedCourts: [],
        closedDateKeys: [],
      }),
    }

    const noConflictsSnapshot = { docs: [] }
    const noUserDailyEventsSnapshot = { docs: [] }

    const eventSnapshot = {
      exists: () => true,
      id: 'event-123',
      data: () => ({
        title: 'Partita test',
        description: 'Evento integrazione',
        type: 'PRACTICE',
        courtName: 'Court 1',
        startAt,
        endAt,
        maxPlayers: 4,
        status: 'OPEN',
        isPublic: true,
        createdBy: 'u-1',
        createdAt: null,
        participants: [],
      }),
    }

    firestoreMocks.getDoc
      .mockResolvedValueOnce(settingsSnapshot)
      .mockResolvedValueOnce(eventSnapshot)
    firestoreMocks.getDocs
      .mockResolvedValueOnce(noConflictsSnapshot)
      .mockResolvedValueOnce(noUserDailyEventsSnapshot)
    firestoreMocks.addDoc.mockResolvedValue({ id: 'event-123' })

    const { createGameEvent, getGameEventById } = await import('../src/services/BookingService')

    const result = await createGameEvent({
      userStatus: 'ACTIVE',
      event: {
        title: 'Partita test',
        description: 'Evento integrazione',
        type: 'PRACTICE',
        courtName: 'Court 1',
        startAt,
        endAt,
        maxPlayers: 4,
        status: 'OPEN',
        isPublic: true,
        createdBy: 'u-1',
        participants: [],
      },
    })

    expect(result).toEqual({ ok: true, eventId: 'event-123' })

    const createPayload = firestoreMocks.addDoc.mock.calls[0][1] as {
      bookingPriority: string
      isCompleted: boolean
    }
    expect(createPayload.bookingPriority).toBe('GUARANTEED')
    expect(createPayload.isCompleted).toBe(false)

    const domainCall = firestoreMocks.setDoc.mock.calls.find((call) => (call[1] as { eventType?: string }).eventType === 'GameScheduled')
    expect(domainCall).toBeDefined()

    const domainPayload = domainCall?.[1] as {
      eventType: string
      bookingId: string
      payload: { courtName: string }
    }
    expect(domainPayload.eventType).toBe('GameScheduled')
    expect(domainPayload.bookingId).toBe('event-123')
    expect(domainPayload.payload.courtName).toBe('Court 1')

    const fetched = await getGameEventById('event-123')
    expect(fetched?.id).toBe('event-123')
    expect(fetched?.title).toBe('Partita test')
  })

  it('marks second daily booking for same user as NON_GUARANTEED', async () => {
    const startAt = new Date()
    startAt.setDate(startAt.getDate() + 1)
    startAt.setHours(12, 0, 0, 0)

    const endAt = new Date(startAt)
    endAt.setMinutes(endAt.getMinutes() + 90)

    const settingsSnapshot = {
      exists: () => true,
      data: () => ({
        slotDurationMinutes: 90,
        bookingWindowDays: 14,
        closedCourts: [],
        closedDateKeys: [],
      }),
    }

    firestoreMocks.getDoc.mockResolvedValue(settingsSnapshot)
    firestoreMocks.getDocs
      .mockResolvedValueOnce({ docs: [] })
      .mockResolvedValueOnce({
        docs: [
          {
            id: 'existing-1',
            data: () => ({
              courtName: 'Court 2',
              startAt,
              endAt,
              status: 'OPEN',
              createdBy: 'u-1',
              bookingPriority: 'GUARANTEED',
            }),
          },
        ],
      })
    firestoreMocks.addDoc.mockResolvedValue({ id: 'event-456' })

    const { createGameEvent } = await import('../src/services/BookingService')

    const result = await createGameEvent({
      userStatus: 'ACTIVE',
      event: {
        title: 'Seconda prenotazione',
        description: 'Evento non garantito',
        type: 'PRACTICE',
        courtName: 'Court 1',
        startAt,
        endAt,
        maxPlayers: 4,
        status: 'OPEN',
        isPublic: true,
        createdBy: 'u-1',
        participants: [],
      },
    })

    expect(result).toEqual({ ok: true, eventId: 'event-456' })

    const createPayload = firestoreMocks.addDoc.mock.calls[0][1] as { bookingPriority: string }
    expect(createPayload.bookingPriority).toBe('NON_GUARANTEED')
  })
})

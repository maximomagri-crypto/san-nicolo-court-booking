import { describe, expect, it } from 'vitest'
import { BookingPolicyReason, evaluateBookingPolicy } from '../src/services/BookingPolicy'

function buildBaseEvent(startAt: Date, endAt: Date) {
  return {
    title: 'Partita',
    description: 'Test policy',
    type: 'PRACTICE' as const,
    courtName: 'Court 1',
    startAt,
    endAt,
    maxPlayers: 4,
    status: 'OPEN' as const,
    isPublic: true,
    createdBy: 'u-1',
    participants: [],
  }
}

function buildSettings() {
  return {
    slotDurationMinutes: 90,
    bookingWindowDays: 14,
    closedCourts: [],
    closedDateKeys: [],
  }
}

describe('BookingPolicy daily guarantee rules', () => {
  it('returns GUARANTEED for first booking of the day', () => {
    const now = new Date('2026-07-23T08:00:00.000Z')
    const startAt = new Date('2026-07-24T10:00:00.000Z')
    const endAt = new Date('2026-07-24T11:30:00.000Z')

    const result = evaluateBookingPolicy({
      userStatus: 'ACTIVE',
      gameEvent: buildBaseEvent(startAt, endAt),
      existingCourtEvents: [],
      existingUserEventsForDay: [],
      settings: buildSettings(),
      now,
    })

    expect(result).toEqual({
      allowed: true,
      bookingPriority: 'GUARANTEED',
    })
  })

  it('returns NON_GUARANTEED when user already has a guaranteed booking that day', () => {
    const now = new Date('2026-07-23T08:00:00.000Z')
    const startAt = new Date('2026-07-24T15:00:00.000Z')
    const endAt = new Date('2026-07-24T16:30:00.000Z')

    const result = evaluateBookingPolicy({
      userStatus: 'ACTIVE',
      gameEvent: buildBaseEvent(startAt, endAt),
      existingCourtEvents: [],
      existingUserEventsForDay: [
        {
          courtName: 'Court 2',
          startAt: new Date('2026-07-24T09:00:00.000Z'),
          endAt: new Date('2026-07-24T10:30:00.000Z'),
          status: 'OPEN',
          createdBy: 'u-1',
          bookingPriority: 'GUARANTEED',
        },
      ],
      settings: buildSettings(),
      now,
    })

    expect(result).toEqual({
      allowed: true,
      bookingPriority: 'NON_GUARANTEED',
    })
  })

  it('ignores cancelled daily bookings when computing guaranteed priority', () => {
    const now = new Date('2026-07-23T08:00:00.000Z')
    const startAt = new Date('2026-07-24T18:00:00.000Z')
    const endAt = new Date('2026-07-24T19:30:00.000Z')

    const result = evaluateBookingPolicy({
      userStatus: 'ACTIVE',
      gameEvent: buildBaseEvent(startAt, endAt),
      existingCourtEvents: [],
      existingUserEventsForDay: [
        {
          courtName: 'Court 1',
          startAt: new Date('2026-07-24T12:00:00.000Z'),
          endAt: new Date('2026-07-24T13:30:00.000Z'),
          status: 'CANCELLED',
          createdBy: 'u-1',
          bookingPriority: 'GUARANTEED',
        },
      ],
      settings: buildSettings(),
      now,
    })

    expect(result).toEqual({
      allowed: true,
      bookingPriority: 'GUARANTEED',
    })
  })

  it('keeps slot conflict as hard stop even with daily priority checks', () => {
    const now = new Date('2026-07-23T08:00:00.000Z')
    const startAt = new Date('2026-07-24T10:00:00.000Z')
    const endAt = new Date('2026-07-24T11:30:00.000Z')

    const result = evaluateBookingPolicy({
      userStatus: 'ACTIVE',
      gameEvent: buildBaseEvent(startAt, endAt),
      existingCourtEvents: [
        {
          courtName: 'Court 1',
          startAt: new Date('2026-07-24T10:30:00.000Z'),
          endAt: new Date('2026-07-24T12:00:00.000Z'),
          status: 'OPEN',
          createdBy: 'u-9',
          bookingPriority: 'GUARANTEED',
        },
      ],
      existingUserEventsForDay: [],
      settings: buildSettings(),
      now,
    })

    expect(result).toEqual({
      allowed: false,
      reason: BookingPolicyReason.SLOT_CONFLICT,
    })
  })
})

import type { UserStatus } from '../firebase/types'
import type {
  BookingPriority,
  BookingSettings,
  ExistingGameEventForPolicy,
  NewGameEvent,
  ParticipantPolicyInput,
  ParticipationConfirmationPolicyInput,
  WaitingListPolicyInput,
} from '../types/booking'

export const BookingPolicyReason = {
  USER_NOT_ACTIVE: 'USER_NOT_ACTIVE',
  SLOT_CONFLICT: 'SLOT_CONFLICT',
  INVALID_SLOT: 'INVALID_SLOT',
  BOOKING_WINDOW_CLOSED: 'BOOKING_WINDOW_CLOSED',
  FIELD_CLOSED: 'FIELD_CLOSED',
  EVENT_NOT_OPEN: 'EVENT_NOT_OPEN',
  EVENT_FULL: 'EVENT_FULL',
  PLAYER_ALREADY_JOINED: 'PLAYER_ALREADY_JOINED',
  PLAYER_NOT_FOUND: 'PLAYER_NOT_FOUND',
  EVENT_NOT_FOUND: 'EVENT_NOT_FOUND',
  WAITLIST_ALREADY_JOINED: 'WAITLIST_ALREADY_JOINED',
  WAITLIST_NOT_NEEDED: 'WAITLIST_NOT_NEEDED',
  PARTICIPATION_NOT_PENDING: 'PARTICIPATION_NOT_PENDING',
} as const

export type BookingPolicyReason = (typeof BookingPolicyReason)[keyof typeof BookingPolicyReason]

export interface BookingPolicyResult {
  allowed: boolean
  reason?: BookingPolicyReason
  bookingPriority?: BookingPriority
}

export interface BookingPolicyInput {
  userStatus: UserStatus | null | undefined
  gameEvent: NewGameEvent
  existingCourtEvents: ExistingGameEventForPolicy[]
  existingUserEventsForDay: ExistingGameEventForPolicy[]
  settings: BookingSettings
  now?: Date
}

function isOccupyingStatus(status: string): boolean {
  return status === 'PENDING_CONFIRMATION' || status === 'CONFIRMED'
}

function getDateKey(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart < bEnd && bStart < aEnd
}

export function evaluateBookingPolicy(input: BookingPolicyInput): BookingPolicyResult {
  const { userStatus, gameEvent, existingCourtEvents, existingUserEventsForDay, settings } = input
  const now = input.now ?? new Date()

  if (userStatus !== 'ACTIVE') {
    return { allowed: false, reason: BookingPolicyReason.USER_NOT_ACTIVE }
  }

  if (!(gameEvent.startAt instanceof Date) || !(gameEvent.endAt instanceof Date)) {
    return { allowed: false, reason: BookingPolicyReason.INVALID_SLOT }
  }

  if (Number.isNaN(gameEvent.startAt.getTime()) || Number.isNaN(gameEvent.endAt.getTime())) {
    return { allowed: false, reason: BookingPolicyReason.INVALID_SLOT }
  }

  if (gameEvent.startAt >= gameEvent.endAt) {
    return { allowed: false, reason: BookingPolicyReason.INVALID_SLOT }
  }

  const durationMinutes = (gameEvent.endAt.getTime() - gameEvent.startAt.getTime()) / 60000
  if (durationMinutes !== settings.slotDurationMinutes) {
    return { allowed: false, reason: BookingPolicyReason.INVALID_SLOT }
  }

  const latestAllowedDate = new Date(now)
  latestAllowedDate.setDate(latestAllowedDate.getDate() + settings.bookingWindowDays)
  if (gameEvent.startAt < now || gameEvent.startAt > latestAllowedDate) {
    return { allowed: false, reason: BookingPolicyReason.BOOKING_WINDOW_CLOSED }
  }

  const requestedDateKey = getDateKey(gameEvent.startAt)
  if (settings.closedCourts.includes(gameEvent.courtName) || settings.closedDateKeys.includes(requestedDateKey)) {
    return { allowed: false, reason: BookingPolicyReason.FIELD_CLOSED }
  }

  const hasConflict = existingCourtEvents.some((event) => {
    if (event.status === 'CANCELLED') {
      return false
    }

    if (event.courtName !== gameEvent.courtName) {
      return false
    }

    return overlaps(gameEvent.startAt, gameEvent.endAt, event.startAt, event.endAt)
  })

  if (hasConflict) {
    return { allowed: false, reason: BookingPolicyReason.SLOT_CONFLICT }
  }

  const hasGuaranteedBookingForDay = existingUserEventsForDay.some((event) => {
    if (event.status === 'CANCELLED') {
      return false
    }

    if (event.createdBy !== gameEvent.createdBy) {
      return false
    }

    if (getDateKey(event.startAt) !== requestedDateKey) {
      return false
    }

    const eventPriority = event.bookingPriority ?? 'GUARANTEED'
    return eventPriority === 'GUARANTEED'
  })

  return {
    allowed: true,
    bookingPriority: hasGuaranteedBookingForDay ? 'NON_GUARANTEED' : 'GUARANTEED',
  }
}

export function evaluateParticipantPolicy(input: ParticipantPolicyInput): BookingPolicyResult {
  if (input.userStatus !== 'ACTIVE') {
    return { allowed: false, reason: BookingPolicyReason.USER_NOT_ACTIVE }
  }

  if (input.eventStatus === 'CANCELLED') {
    return { allowed: false, reason: BookingPolicyReason.EVENT_NOT_OPEN }
  }

  const alreadyJoined = input.participants.some(
    (participant) => participant.uid === input.participantUid && isOccupyingStatus(participant.status),
  )
  const occupiedSlots = input.participants.filter((participant) => isOccupyingStatus(participant.status)).length

  if (input.action === 'JOIN') {
    if (alreadyJoined) {
      return { allowed: false, reason: BookingPolicyReason.PLAYER_ALREADY_JOINED }
    }

    if (occupiedSlots >= input.maxPlayers) {
      return { allowed: false, reason: BookingPolicyReason.EVENT_FULL }
    }

    return { allowed: true }
  }

  if (!alreadyJoined) {
    return { allowed: false, reason: BookingPolicyReason.PLAYER_NOT_FOUND }
  }

  return { allowed: true }
}

export function evaluateWaitingListPolicy(input: WaitingListPolicyInput): BookingPolicyResult {
  if (input.userStatus !== 'ACTIVE') {
    return { allowed: false, reason: BookingPolicyReason.USER_NOT_ACTIVE }
  }

  if (input.eventStatus === 'CANCELLED') {
    return { allowed: false, reason: BookingPolicyReason.EVENT_NOT_OPEN }
  }

  const alreadyParticipant = input.participants.some(
    (participant) => participant.uid === input.participantUid && isOccupyingStatus(participant.status),
  )
  if (alreadyParticipant) {
    return { allowed: false, reason: BookingPolicyReason.PLAYER_ALREADY_JOINED }
  }

  const alreadyQueued = input.waitingList.some(
    (entry) => entry.status === 'ACTIVE' && entry.participant.uid === input.participantUid,
  )
  if (alreadyQueued) {
    return { allowed: false, reason: BookingPolicyReason.WAITLIST_ALREADY_JOINED }
  }

  const occupiedSlots = input.participants.filter((participant) => isOccupyingStatus(participant.status)).length
  if (occupiedSlots < input.maxPlayers) {
    return { allowed: false, reason: BookingPolicyReason.WAITLIST_NOT_NEEDED }
  }

  return { allowed: true }
}

export function evaluateParticipationConfirmationPolicy(
  input: ParticipationConfirmationPolicyInput,
): BookingPolicyResult {
  if (input.eventStatus === 'CANCELLED') {
    return { allowed: false, reason: BookingPolicyReason.EVENT_NOT_OPEN }
  }

  const participant = input.participants.find((item) => item.uid === input.participantUid)
  if (!participant) {
    return { allowed: false, reason: BookingPolicyReason.PLAYER_NOT_FOUND }
  }

  if (participant.status !== 'PENDING_CONFIRMATION') {
    return { allowed: false, reason: BookingPolicyReason.PARTICIPATION_NOT_PENDING }
  }

  if (input.action === 'CONFIRM' || input.action === 'DECLINE') {
    if (input.userStatus !== 'ACTIVE') {
      return { allowed: false, reason: BookingPolicyReason.USER_NOT_ACTIVE }
    }
  }

  return { allowed: true }
}

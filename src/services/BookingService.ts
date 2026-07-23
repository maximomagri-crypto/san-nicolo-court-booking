import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  type Query,
} from 'firebase/firestore'
import { db } from '../firebase/firebase'
import { FIRESTORE_COLLECTIONS } from '../firebase/collections'
import { DomainEventPublisher } from '../events/DomainEventPublisher'
import type { UserStatus } from '../firebase/types'
import {
  BookingPolicyReason,
  evaluateBookingPolicy,
  evaluateParticipantPolicy,
  evaluateParticipationConfirmationPolicy,
  evaluateWaitingListPolicy,
  type BookingPolicyResult,
} from './BookingPolicy'
import type {
  BookingPriority,
  BookingSettings,
  ExistingGameEventForPolicy,
  GameEvent,
  GameEventBase,
  NewGameEvent,
  PlayerParticipation,
  PlayerParticipationStatus,
  WaitingListEntry,
  WaitingListStatus,
} from '../types/booking'

const gameEventsCollectionRef = collection(db, FIRESTORE_COLLECTIONS.gameEvents)
const bookingSettingsCollectionRef = collection(db, FIRESTORE_COLLECTIONS.bookingSettings)
const waitingListCollectionRef = collection(db, FIRESTORE_COLLECTIONS.waitingList)
const domainEventPublisher = new DomainEventPublisher()

const DEFAULT_BOOKING_SETTINGS: BookingSettings = {
  slotDurationMinutes: 90,
  bookingWindowDays: 14,
  closedCourts: [],
  closedDateKeys: [],
}

export type CreateGameEventResult =
  | { ok: true; eventId: string }
  | { ok: false; policy: BookingPolicyResult }

export type UpdateParticipantsInput = {
  eventId: string
  participant: {
    uid: string
    displayName: string
    email: string
  }
  userStatus: UserStatus | null | undefined
}

export type UpdateParticipantsResult =
  | { ok: true; policy: BookingPolicyResult; participantsCount: number }
  | { ok: false; policy: BookingPolicyResult }

export type UpdateParticipationStatusInput = {
  eventId: string
  participantUid: string
  userStatus?: UserStatus | null | undefined
}

export type ExpireConfirmationsInput = {
  eventId: string
}

export type ExpireConfirmationsResult =
  | { ok: true; expiredCount: number; participantsCount: number }
  | { ok: false; policy: BookingPolicyResult }

export type JoinWaitingListInput = {
  eventId: string
  participant: {
    uid: string
    displayName: string
    email: string
  }
  userStatus: UserStatus | null | undefined
}

export type JoinWaitingListResult =
  | { ok: true; policy: BookingPolicyResult; entryId: string; position: number }
  | { ok: false; policy: BookingPolicyResult }

type CreateGameEventInput = {
  event: NewGameEvent
  userStatus: UserStatus | null | undefined
}

function toDate(value: unknown): Date | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value
  }

  if (
    value &&
    typeof value === 'object' &&
    'toDate' in value &&
    typeof (value as { toDate: () => Date }).toDate === 'function'
  ) {
    const converted = (value as { toDate: () => Date }).toDate()
    return Number.isNaN(converted.getTime()) ? null : converted
  }

  return null
}

function isOccupyingParticipant(participant: PlayerParticipation): boolean {
  return participant.status === 'PENDING_CONFIRMATION' || participant.status === 'CONFIRMED'
}

function countOccupyingParticipants(participants: PlayerParticipation[]): number {
  return participants.filter((participant) => isOccupyingParticipant(participant)).length
}

function isCompletableGame(maxPlayers: number): boolean {
  return maxPlayers === 2 || maxPlayers === 4
}

function computeCompletionState(
  participants: PlayerParticipation[],
  maxPlayers: number,
  currentIsCompleted: boolean,
  currentCompletedAt: unknown,
) {
  const isCompleted = isCompletableGame(maxPlayers) && countOccupyingParticipants(participants) >= maxPlayers
  const completedAt = isCompleted ? (currentCompletedAt ?? serverTimestamp()) : null

  return {
    isCompleted,
    completedAt,
    justCompleted: !currentIsCompleted && isCompleted,
  }
}

function computeEventStatus(participants: PlayerParticipation[], maxPlayers: number, currentStatus?: string) {
  if (currentStatus === 'CANCELLED') {
    return 'CANCELLED' as const
  }

  return countOccupyingParticipants(participants) >= maxPlayers ? 'FULL' as const : 'OPEN' as const
}

function normalizeParticipants(raw: unknown): PlayerParticipation[] {
  if (!Array.isArray(raw)) {
    return []
  }

  return raw
    .map((item) => {
      if (!item || typeof item !== 'object') {
        return null
      }

      const typed = item as {
        uid?: unknown
        displayName?: unknown
        email?: unknown
        status?: unknown
        joinedAt?: unknown
      }

      if (
        typeof typed.uid !== 'string' ||
        typeof typed.displayName !== 'string' ||
        typeof typed.email !== 'string'
      ) {
        return null
      }

      if (
        typed.status !== 'PENDING_CONFIRMATION' &&
        typed.status !== 'CONFIRMED' &&
        typed.status !== 'DECLINED' &&
        typed.status !== 'EXPIRED'
      ) {
        return null
      }

      return {
        uid: typed.uid,
        displayName: typed.displayName,
        email: typed.email,
        status: typed.status,
        joinedAt: (typed.joinedAt as PlayerParticipation['joinedAt']) ?? null,
      } as PlayerParticipation
    })
    .filter((participant): participant is PlayerParticipation => participant !== null)
}

async function emitDomainEvent(
  eventType:
    | 'GameScheduled'
    | 'PlayerJoined'
    | 'PlayerLeft'
    | 'WaitlistJoined'
    | 'WaitlistPromoted'
    | 'ParticipationConfirmed'
    | 'ParticipationDeclined'
    | 'ConfirmationExpired'
    | 'GameCompleted',
  actorUid: string,
  eventId: string,
  payload: Record<string, unknown>,
) {
  await domainEventPublisher.publish(eventType, actorUid, eventId, payload)
}

async function prepareWaitingListPromotions(eventId: string, participants: PlayerParticipation[], maxPlayers: number) {
  const waitingListEntries = await getActiveWaitingListEntries(eventId)
  const availableSlots = Math.max(0, maxPlayers - countOccupyingParticipants(participants))
  const promotedEntries = waitingListEntries.slice(0, availableSlots)

  const promotedParticipants: PlayerParticipation[] = promotedEntries.map((entry) => ({
    uid: entry.participant.uid,
    displayName: entry.participant.displayName,
    email: entry.participant.email,
    status: 'PENDING_CONFIRMATION',
    joinedAt: serverTimestamp(),
  }))

  return {
    participants: [...participants, ...promotedParticipants],
    promotedEntries,
  }
}

async function persistWaitingListPromotions(eventId: string, promotedEntries: WaitingListEntry[]) {
  for (const entry of promotedEntries) {
    await updateDoc(doc(waitingListCollectionRef, entry.id), {
      status: 'PROMOTED',
      promotedAt: serverTimestamp(),
    })

    await emitDomainEvent('WaitlistPromoted', entry.participant.uid, eventId, {
      participantUid: entry.participant.uid,
      waitingListEntryId: entry.id,
    })
  }
}

function updateParticipantStatus(
  participants: PlayerParticipation[],
  participantUid: string,
  nextStatus: PlayerParticipationStatus,
) {
  return participants.map((participant) =>
    participant.uid === participantUid ? { ...participant, status: nextStatus } : participant,
  )
}

function normalizeWaitingListEntries(raw: unknown): WaitingListEntry[] {
  if (!Array.isArray(raw)) {
    return []
  }

  return raw
    .map((item) => {
      if (!item || typeof item !== 'object') {
        return null
      }

      const typed = item as {
        id?: unknown
        eventId?: unknown
        participant?: unknown
        status?: unknown
        position?: unknown
        joinedAt?: unknown
        promotedAt?: unknown
      }

      if (typeof typed.id !== 'string' || typeof typed.eventId !== 'string' || typeof typed.position !== 'number') {
        return null
      }

      if (typed.status !== 'ACTIVE' && typed.status !== 'PROMOTED' && typed.status !== 'CANCELLED') {
        return null
      }

      const participant = typed.participant as { uid?: unknown; displayName?: unknown; email?: unknown } | undefined
      if (
        !participant ||
        typeof participant.uid !== 'string' ||
        typeof participant.displayName !== 'string' ||
        typeof participant.email !== 'string'
      ) {
        return null
      }

      return {
        id: typed.id,
        eventId: typed.eventId,
        participant: {
          uid: participant.uid,
          displayName: participant.displayName,
          email: participant.email,
        },
        status: typed.status as WaitingListStatus,
        position: typed.position,
        joinedAt: (typed.joinedAt as WaitingListEntry['joinedAt']) ?? null,
        promotedAt: (typed.promotedAt as WaitingListEntry['promotedAt']) ?? undefined,
      } as WaitingListEntry
    })
    .filter((entry): entry is WaitingListEntry => entry !== null)
}

async function getActiveWaitingListEntries(eventId: string): Promise<WaitingListEntry[]> {
  const waitingListQuery = query(
    waitingListCollectionRef,
    where('eventId', '==', eventId),
    where('status', '==', 'ACTIVE'),
    orderBy('position', 'asc'),
  )

  const snapshot = await getDocs(waitingListQuery)
  return normalizeWaitingListEntries(
    snapshot.docs.map((item) => ({
      id: item.id,
      ...(item.data() as Record<string, unknown>),
    })),
  )
}

async function getBookingSettings(): Promise<BookingSettings> {
  const docRef = doc(bookingSettingsCollectionRef, 'default')
  const snapshot = await getDoc(docRef)

  if (!snapshot.exists()) {
    return DEFAULT_BOOKING_SETTINGS
  }

  const data = snapshot.data() as Partial<BookingSettings>
  return {
    slotDurationMinutes:
      typeof data.slotDurationMinutes === 'number' ? data.slotDurationMinutes : DEFAULT_BOOKING_SETTINGS.slotDurationMinutes,
    bookingWindowDays:
      typeof data.bookingWindowDays === 'number' ? data.bookingWindowDays : DEFAULT_BOOKING_SETTINGS.bookingWindowDays,
    closedCourts: Array.isArray(data.closedCourts) ? data.closedCourts.filter((item): item is string => typeof item === 'string') : [],
    closedDateKeys: Array.isArray(data.closedDateKeys)
      ? data.closedDateKeys.filter((item): item is string => typeof item === 'string')
      : [],
  }
}

async function getExistingEventsForCourt(courtName: string, startAt: Date, endAt: Date): Promise<ExistingGameEventForPolicy[]> {
  const candidateQuery = query(
    gameEventsCollectionRef,
    where('courtName', '==', courtName),
    where('startAt', '<', Timestamp.fromDate(endAt)),
    orderBy('startAt', 'asc'),
  )

  const snapshot = await getDocs(candidateQuery)
  return snapshot.docs
    .map((item) => {
      const data = item.data() as {
        courtName?: string
        startAt?: Timestamp | Date
        endAt?: Timestamp | Date
        status?: 'OPEN' | 'FULL' | 'CANCELLED'
        createdBy?: string
        bookingPriority?: BookingPriority
      }

      const eventStartAt = toDate(data.startAt)
      const eventEndAt = toDate(data.endAt)
      if (!eventStartAt || !eventEndAt) {
        return null
      }

      if (eventEndAt <= startAt) {
        return null
      }

      return {
        courtName: data.courtName ?? courtName,
        startAt: eventStartAt,
        endAt: eventEndAt,
        status: data.status ?? 'OPEN',
        createdBy: data.createdBy,
        bookingPriority: data.bookingPriority,
      } as ExistingGameEventForPolicy
    })
    .filter((item): item is ExistingGameEventForPolicy => item !== null)
}

async function getExistingUserEventsForDay(userUid: string, date: Date): Promise<ExistingGameEventForPolicy[]> {
  const dayStart = new Date(date)
  dayStart.setHours(0, 0, 0, 0)

  const dayEnd = new Date(dayStart)
  dayEnd.setDate(dayEnd.getDate() + 1)

  const userDayQuery = query(
    gameEventsCollectionRef,
    where('createdBy', '==', userUid),
    where('startAt', '>=', Timestamp.fromDate(dayStart)),
    where('startAt', '<', Timestamp.fromDate(dayEnd)),
    orderBy('startAt', 'asc'),
  )

  const snapshot = await getDocs(userDayQuery)
  return snapshot.docs
    .map((item) => {
      const data = item.data() as {
        courtName?: string
        startAt?: Timestamp | Date
        endAt?: Timestamp | Date
        status?: 'OPEN' | 'FULL' | 'CANCELLED'
        createdBy?: string
        bookingPriority?: BookingPriority
      }

      const eventStartAt = toDate(data.startAt)
      const eventEndAt = toDate(data.endAt)
      if (!eventStartAt || !eventEndAt) {
        return null
      }

      return {
        courtName: data.courtName ?? '',
        startAt: eventStartAt,
        endAt: eventEndAt,
        status: data.status ?? 'OPEN',
        createdBy: data.createdBy,
        bookingPriority: data.bookingPriority,
      } as ExistingGameEventForPolicy
    })
    .filter((item): item is ExistingGameEventForPolicy => item !== null)
}

export function getUpcomingGameEventsQuery(): Query<GameEventBase> {
  return query(gameEventsCollectionRef, orderBy('startAt', 'asc')) as Query<GameEventBase>
}

export function gameEventDocRef(eventId: string) {
  return doc(db, FIRESTORE_COLLECTIONS.gameEvents, eventId)
}

export async function createGameEvent(input: CreateGameEventInput): Promise<CreateGameEventResult> {
  const settings = await getBookingSettings()
  const existingCourtEvents = await getExistingEventsForCourt(input.event.courtName, input.event.startAt, input.event.endAt)
  const existingUserEventsForDay = await getExistingUserEventsForDay(input.event.createdBy, input.event.startAt)
  const policy = evaluateBookingPolicy({
    userStatus: input.userStatus,
    gameEvent: input.event,
    existingCourtEvents,
    existingUserEventsForDay,
    settings,
  })

  if (!policy.allowed) {
    return { ok: false, policy }
  }

  const bookingPriority = policy.bookingPriority ?? 'GUARANTEED'
  const completion = computeCompletionState(input.event.participants, input.event.maxPlayers, false, null)

  const docRef = await addDoc(gameEventsCollectionRef, {
    ...input.event,
    bookingPriority,
    isCompleted: completion.isCompleted,
    completedAt: completion.completedAt,
    createdAt: serverTimestamp(),
  })

  await emitDomainEvent('GameScheduled', input.event.createdBy, docRef.id, {
    courtName: input.event.courtName,
    startAt: input.event.startAt,
    endAt: input.event.endAt,
    participantsCount: input.event.participants.length,
    bookingPriority,
  })

  if (completion.justCompleted) {
    await emitDomainEvent('GameCompleted', input.event.createdBy, docRef.id, {
      participantsCount: input.event.participants.length,
      maxPlayers: input.event.maxPlayers,
    })
  }

  return { ok: true, eventId: docRef.id }
}

export async function getGameEventById(eventId: string): Promise<GameEvent | null> {
  const snapshot = await getDoc(gameEventDocRef(eventId))
  if (!snapshot.exists()) {
    return null
  }

  const data = snapshot.data() as GameEventBase
  return {
    id: snapshot.id,
    ...data,
  }
}

export async function joinWaitingList(input: JoinWaitingListInput): Promise<JoinWaitingListResult> {
  const eventSnapshot = await getDoc(gameEventDocRef(input.eventId))
  if (!eventSnapshot.exists()) {
    return { ok: false, policy: { allowed: false, reason: BookingPolicyReason.EVENT_NOT_FOUND } }
  }

  const eventData = eventSnapshot.data() as Partial<GameEventBase>
  const participants = normalizeParticipants(eventData.participants)
  const maxPlayers = typeof eventData.maxPlayers === 'number' ? eventData.maxPlayers : 0
  const eventStatus = eventData.status === 'CANCELLED' || eventData.status === 'FULL' || eventData.status === 'OPEN' ? eventData.status : 'OPEN'
  const waitingListEntries = await getActiveWaitingListEntries(input.eventId)

  const policy = evaluateWaitingListPolicy({
    action: 'JOIN',
    userStatus: input.userStatus,
    eventStatus,
    maxPlayers,
    participants,
    waitingList: waitingListEntries,
    participantUid: input.participant.uid,
  })

  if (!policy.allowed) {
    return { ok: false, policy }
  }

  const position = waitingListEntries.length + 1
  const entryRef = doc(waitingListCollectionRef)
  await setDoc(entryRef, {
    eventId: input.eventId,
    participant: input.participant,
    status: 'ACTIVE',
    position,
    joinedAt: serverTimestamp(),
  })

  await emitDomainEvent('WaitlistJoined', input.participant.uid, input.eventId, {
    participantUid: input.participant.uid,
    position,
  })

  return { ok: true, policy, entryId: entryRef.id, position }
}

export async function joinGameEvent(input: UpdateParticipantsInput): Promise<UpdateParticipantsResult> {
  const snapshot = await getDoc(gameEventDocRef(input.eventId))
  if (!snapshot.exists()) {
    return { ok: false, policy: { allowed: false, reason: BookingPolicyReason.EVENT_NOT_FOUND } }
  }

  const data = snapshot.data() as Partial<GameEventBase>
  const participants = normalizeParticipants(data.participants)
  const maxPlayers = typeof data.maxPlayers === 'number' ? data.maxPlayers : 0
  const eventStatus = data.status === 'CANCELLED' || data.status === 'FULL' || data.status === 'OPEN' ? data.status : 'OPEN'

  const policy = evaluateParticipantPolicy({
    action: 'JOIN',
    userStatus: input.userStatus,
    eventStatus,
    maxPlayers,
    participants,
    participantUid: input.participant.uid,
  })

  if (!policy.allowed) {
    return { ok: false, policy }
  }

  const nextParticipants: PlayerParticipation[] = [
    ...participants,
    {
      uid: input.participant.uid,
      displayName: input.participant.displayName,
      email: input.participant.email,
      status: 'PENDING_CONFIRMATION',
      joinedAt: serverTimestamp(),
    },
  ]

  const nextStatus = computeEventStatus(nextParticipants, maxPlayers, data.status)
  const completion = computeCompletionState(
    nextParticipants,
    maxPlayers,
    data.isCompleted === true,
    (data as { completedAt?: unknown }).completedAt ?? null,
  )
  await updateDoc(gameEventDocRef(input.eventId), {
    participants: nextParticipants,
    status: nextStatus,
    isCompleted: completion.isCompleted,
    completedAt: completion.completedAt,
    updatedAt: serverTimestamp(),
  })

  await emitDomainEvent('PlayerJoined', input.participant.uid, input.eventId, {
    participantUid: input.participant.uid,
    participantsCount: nextParticipants.length,
  })

  if (completion.justCompleted) {
    await emitDomainEvent('GameCompleted', input.participant.uid, input.eventId, {
      participantsCount: nextParticipants.length,
      maxPlayers,
    })
  }

  return { ok: true, policy, participantsCount: nextParticipants.length }
}

export async function leaveGameEvent(input: UpdateParticipantsInput): Promise<UpdateParticipantsResult> {
  const snapshot = await getDoc(gameEventDocRef(input.eventId))
  if (!snapshot.exists()) {
    return { ok: false, policy: { allowed: false, reason: BookingPolicyReason.EVENT_NOT_FOUND } }
  }

  const data = snapshot.data() as Partial<GameEventBase>
  const participants = normalizeParticipants(data.participants)
  const maxPlayers = typeof data.maxPlayers === 'number' ? data.maxPlayers : 0
  const eventStatus = data.status === 'CANCELLED' || data.status === 'FULL' || data.status === 'OPEN' ? data.status : 'OPEN'

  const policy = evaluateParticipantPolicy({
    action: 'LEAVE',
    userStatus: input.userStatus,
    eventStatus,
    maxPlayers,
    participants,
    participantUid: input.participant.uid,
  })

  if (!policy.allowed) {
    return { ok: false, policy }
  }

  const nextParticipants = participants.filter((participant) => participant.uid !== input.participant.uid)
  const { participants: finalParticipants, promotedEntries } = data.status === 'CANCELLED'
    ? { participants: nextParticipants, promotedEntries: [] as WaitingListEntry[] }
    : await prepareWaitingListPromotions(input.eventId, nextParticipants, maxPlayers)
  const nextStatus = computeEventStatus(finalParticipants, maxPlayers, data.status)
  const completion = computeCompletionState(
    finalParticipants,
    maxPlayers,
    data.isCompleted === true,
    (data as { completedAt?: unknown }).completedAt ?? null,
  )

  await updateDoc(gameEventDocRef(input.eventId), {
    participants: finalParticipants,
    status: nextStatus,
    isCompleted: completion.isCompleted,
    completedAt: completion.completedAt,
    updatedAt: serverTimestamp(),
  })

  await emitDomainEvent('PlayerLeft', input.participant.uid, input.eventId, {
    participantUid: input.participant.uid,
    participantsCount: finalParticipants.length,
  })

  await persistWaitingListPromotions(input.eventId, promotedEntries)

  return { ok: true, policy, participantsCount: finalParticipants.length }
}

export async function confirmParticipation(input: UpdateParticipationStatusInput): Promise<UpdateParticipantsResult> {
  const snapshot = await getDoc(gameEventDocRef(input.eventId))
  if (!snapshot.exists()) {
    return { ok: false, policy: { allowed: false, reason: BookingPolicyReason.EVENT_NOT_FOUND } }
  }

  const data = snapshot.data() as Partial<GameEventBase>
  const participants = normalizeParticipants(data.participants)
  const eventStatus = data.status === 'CANCELLED' || data.status === 'FULL' || data.status === 'OPEN' ? data.status : 'OPEN'
  const maxPlayers = typeof data.maxPlayers === 'number' ? data.maxPlayers : 0

  const policy = evaluateParticipationConfirmationPolicy({
    action: 'CONFIRM',
    userStatus: input.userStatus,
    eventStatus,
    participants,
    participantUid: input.participantUid,
  })

  if (!policy.allowed) {
    return { ok: false, policy }
  }

  const nextParticipants = updateParticipantStatus(participants, input.participantUid, 'CONFIRMED')
  const completion = computeCompletionState(
    nextParticipants,
    maxPlayers,
    data.isCompleted === true,
    (data as { completedAt?: unknown }).completedAt ?? null,
  )
  await updateDoc(gameEventDocRef(input.eventId), {
    participants: nextParticipants,
    status: computeEventStatus(nextParticipants, maxPlayers, data.status),
    isCompleted: completion.isCompleted,
    completedAt: completion.completedAt,
    updatedAt: serverTimestamp(),
  })

  await emitDomainEvent('ParticipationConfirmed', input.participantUid, input.eventId, {
    participantUid: input.participantUid,
  })

  if (completion.justCompleted) {
    await emitDomainEvent('GameCompleted', input.participantUid, input.eventId, {
      participantsCount: nextParticipants.length,
      maxPlayers,
    })
  }

  return { ok: true, policy, participantsCount: nextParticipants.length }
}

export async function declineParticipation(input: UpdateParticipationStatusInput): Promise<UpdateParticipantsResult> {
  const snapshot = await getDoc(gameEventDocRef(input.eventId))
  if (!snapshot.exists()) {
    return { ok: false, policy: { allowed: false, reason: BookingPolicyReason.EVENT_NOT_FOUND } }
  }

  const data = snapshot.data() as Partial<GameEventBase>
  const participants = normalizeParticipants(data.participants)
  const eventStatus = data.status === 'CANCELLED' || data.status === 'FULL' || data.status === 'OPEN' ? data.status : 'OPEN'
  const maxPlayers = typeof data.maxPlayers === 'number' ? data.maxPlayers : 0

  const policy = evaluateParticipationConfirmationPolicy({
    action: 'DECLINE',
    userStatus: input.userStatus,
    eventStatus,
    participants,
    participantUid: input.participantUid,
  })

  if (!policy.allowed) {
    return { ok: false, policy }
  }

  const declinedParticipants = updateParticipantStatus(participants, input.participantUid, 'DECLINED')
  const { participants: finalParticipants, promotedEntries } = data.status === 'CANCELLED'
    ? { participants: declinedParticipants, promotedEntries: [] as WaitingListEntry[] }
    : await prepareWaitingListPromotions(input.eventId, declinedParticipants, maxPlayers)
  const completion = computeCompletionState(
    finalParticipants,
    maxPlayers,
    data.isCompleted === true,
    (data as { completedAt?: unknown }).completedAt ?? null,
  )

  await updateDoc(gameEventDocRef(input.eventId), {
    participants: finalParticipants,
    status: computeEventStatus(finalParticipants, maxPlayers, data.status),
    isCompleted: completion.isCompleted,
    completedAt: completion.completedAt,
    updatedAt: serverTimestamp(),
  })

  await emitDomainEvent('ParticipationDeclined', input.participantUid, input.eventId, {
    participantUid: input.participantUid,
  })

  if (completion.justCompleted) {
    await emitDomainEvent('GameCompleted', input.participantUid, input.eventId, {
      participantsCount: finalParticipants.length,
      maxPlayers,
    })
  }

  await persistWaitingListPromotions(input.eventId, promotedEntries)

  return { ok: true, policy, participantsCount: finalParticipants.length }
}

export async function expireConfirmations(input: ExpireConfirmationsInput): Promise<ExpireConfirmationsResult> {
  const snapshot = await getDoc(gameEventDocRef(input.eventId))
  if (!snapshot.exists()) {
    return { ok: false, policy: { allowed: false, reason: BookingPolicyReason.EVENT_NOT_FOUND } }
  }

  const data = snapshot.data() as Partial<GameEventBase>
  const participants = normalizeParticipants(data.participants)
  const eventStatus = data.status === 'CANCELLED' || data.status === 'FULL' || data.status === 'OPEN' ? data.status : 'OPEN'
  if (eventStatus === 'CANCELLED') {
    return { ok: false, policy: { allowed: false, reason: BookingPolicyReason.EVENT_NOT_OPEN } }
  }

  const maxPlayers = typeof data.maxPlayers === 'number' ? data.maxPlayers : 0
  const pendingParticipants = participants.filter((participant) => participant.status === 'PENDING_CONFIRMATION')
  const expiredCount = pendingParticipants.length

  if (expiredCount === 0) {
    return { ok: true, expiredCount: 0, participantsCount: participants.length }
  }

  const expiredParticipants = participants.map((participant) =>
    participant.status === 'PENDING_CONFIRMATION' ? { ...participant, status: 'EXPIRED' as const } : participant,
  )
  const { participants: finalParticipants, promotedEntries } = await prepareWaitingListPromotions(
    input.eventId,
    expiredParticipants,
    maxPlayers,
  )
  const completion = computeCompletionState(
    finalParticipants,
    maxPlayers,
    data.isCompleted === true,
    (data as { completedAt?: unknown }).completedAt ?? null,
  )

  await updateDoc(gameEventDocRef(input.eventId), {
    participants: finalParticipants,
    status: computeEventStatus(finalParticipants, maxPlayers, data.status),
    isCompleted: completion.isCompleted,
    completedAt: completion.completedAt,
    updatedAt: serverTimestamp(),
  })

  for (const participant of pendingParticipants) {
    await emitDomainEvent('ConfirmationExpired', participant.uid, input.eventId, {
      participantUid: participant.uid,
    })
  }

  await persistWaitingListPromotions(input.eventId, promotedEntries)

  if (completion.justCompleted) {
    const actorUid = typeof data.createdBy === 'string' && data.createdBy.length > 0 ? data.createdBy : 'system'
    await emitDomainEvent('GameCompleted', actorUid, input.eventId, {
      participantsCount: finalParticipants.length,
      maxPlayers,
    })
  }

  return { ok: true, expiredCount, participantsCount: finalParticipants.length }
}

export { BookingPolicyReason }

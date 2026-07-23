import type { FieldValue, Timestamp } from 'firebase/firestore'

export type GameEventStatus = 'OPEN' | 'FULL' | 'CANCELLED'
export type GameEventType = 'MATCH' | 'PRACTICE' | 'TRAINING'
export type BookingPriority = 'GUARANTEED' | 'NON_GUARANTEED'
export type PlayerParticipationStatus = 'PENDING_CONFIRMATION' | 'CONFIRMED' | 'DECLINED' | 'EXPIRED'
export type WaitingListStatus = 'ACTIVE' | 'PROMOTED' | 'CANCELLED'
export type TimestampValue = Timestamp | FieldValue | null
export type DateValue = Date | Timestamp | FieldValue | null

export interface PlayerParticipation {
  uid: string
  displayName: string
  email: string
  status: PlayerParticipationStatus
  joinedAt: TimestampValue
}

export interface GameEventBase {
  title: string
  description: string
  type: GameEventType
  courtName: string
  startAt: TimestampValue
  endAt: TimestampValue
  maxPlayers: number
  status: GameEventStatus
  isPublic: boolean
  createdBy: string
  createdAt: TimestampValue
  bookingPriority?: BookingPriority
  isCompleted?: boolean
  completedAt?: TimestampValue
  participants: PlayerParticipation[]
}

export interface GameEvent extends GameEventBase {
  id: string
}

export interface NewGameEvent {
  title: string
  description: string
  type: GameEventType
  courtName: string
  startAt: Date
  endAt: Date
  maxPlayers: number
  status: GameEventStatus
  isPublic: boolean
  createdBy: string
  bookingPriority?: BookingPriority
  isCompleted?: boolean
  completedAt?: TimestampValue
  participants: PlayerParticipation[]
}

export interface ExistingGameEventForPolicy {
  courtName: string
  startAt: Date
  endAt: Date
  status: GameEventStatus
  createdBy?: string
  bookingPriority?: BookingPriority
}

export interface BookingSettings {
  slotDurationMinutes: number
  bookingWindowDays: number
  closedCourts: string[]
  closedDateKeys: string[]
}

export interface WaitingListEntry {
  id: string
  eventId: string
  participant: Pick<PlayerParticipation, 'uid' | 'displayName' | 'email'>
  status: WaitingListStatus
  position: number
  joinedAt: TimestampValue
  promotedAt?: TimestampValue
}

export type ParticipantPolicyAction = 'JOIN' | 'LEAVE'
export type ParticipationConfirmationAction = 'CONFIRM' | 'DECLINE' | 'EXPIRE'

export type WaitingListPolicyAction = 'JOIN'

export interface ParticipantPolicyInput {
  action: ParticipantPolicyAction
  userStatus: 'ACTIVE' | 'PENDING_APPROVAL' | 'SUSPENDED' | null | undefined
  eventStatus: GameEventStatus
  maxPlayers: number
  participants: PlayerParticipation[]
  participantUid: string
}

export interface WaitingListPolicyInput {
  action: WaitingListPolicyAction
  userStatus: 'ACTIVE' | 'PENDING_APPROVAL' | 'SUSPENDED' | null | undefined
  eventStatus: GameEventStatus
  maxPlayers: number
  participants: PlayerParticipation[]
  waitingList: WaitingListEntry[]
  participantUid: string
}

export interface ParticipationConfirmationPolicyInput {
  action: ParticipationConfirmationAction
  userStatus?: 'ACTIVE' | 'PENDING_APPROVAL' | 'SUSPENDED' | null | undefined
  eventStatus: GameEventStatus
  participants: PlayerParticipation[]
  participantUid: string
}

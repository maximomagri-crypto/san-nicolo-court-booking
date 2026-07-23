export const DOMAIN_EVENT_TYPES = {
  GameScheduled: 'GameScheduled',
  PlayerJoined: 'PlayerJoined',
  PlayerLeft: 'PlayerLeft',
  WaitlistJoined: 'WaitlistJoined',
  WaitlistPromoted: 'WaitlistPromoted',
  ParticipationConfirmed: 'ParticipationConfirmed',
  ParticipationDeclined: 'ParticipationDeclined',
  ConfirmationExpired: 'ConfirmationExpired',
  GameCompleted: 'GameCompleted',
} as const

export type DomainEventType = (typeof DOMAIN_EVENT_TYPES)[keyof typeof DOMAIN_EVENT_TYPES]

export interface DomainEvent {
  id: string
  type: DomainEventType
  actorUid: string
  aggregateId: string
  occurredAt: Date
  payload: Record<string, unknown>
}

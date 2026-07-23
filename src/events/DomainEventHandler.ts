import type { DomainEvent } from './DomainEvent'

export interface DomainEventHandler {
  supports(event: DomainEvent): boolean
  handle(event: DomainEvent): Promise<void>
}

import type { DomainEvent } from './DomainEvent'
import type { DomainEventHandler } from './DomainEventHandler'

export class EventDispatcher {
  private readonly handlers: DomainEventHandler[]

  constructor(handlers: DomainEventHandler[]) {
    this.handlers = handlers
  }

  async dispatch(event: DomainEvent): Promise<void> {
    for (const handler of this.handlers) {
      if (!handler.supports(event)) {
        continue
      }

      await handler.handle(event)
    }
  }
}

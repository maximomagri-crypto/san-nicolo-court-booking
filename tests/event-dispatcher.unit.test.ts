import { describe, expect, it, vi } from 'vitest'
import { EventDispatcher } from '../src/events/EventDispatcher'
import type { DomainEvent } from '../src/events/DomainEvent'
import type { DomainEventHandler } from '../src/events/DomainEventHandler'

function buildEvent(): DomainEvent {
  return {
    id: 'evt-1',
    type: 'GameScheduled',
    actorUid: 'u-1',
    aggregateId: 'agg-1',
    occurredAt: new Date('2026-07-23T10:00:00.000Z'),
    payload: {},
  }
}

describe('EventDispatcher resilience', () => {
  it('continues dispatch when a handler throws', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    const failingHandler: DomainEventHandler = {
      supports: () => true,
      handle: vi.fn(async () => {
        throw new Error('simulated failure')
      }),
    }

    const succeedingHandler: DomainEventHandler = {
      supports: () => true,
      handle: vi.fn(async () => undefined),
    }

    const dispatcher = new EventDispatcher([failingHandler, succeedingHandler])

    await expect(dispatcher.dispatch(buildEvent())).resolves.toBeUndefined()
    expect(failingHandler.handle).toHaveBeenCalledTimes(1)
    expect(succeedingHandler.handle).toHaveBeenCalledTimes(1)
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1)

    consoleErrorSpy.mockRestore()
  })

  it('skips handlers that do not support the event', async () => {
    const unsupportedHandler: DomainEventHandler = {
      supports: () => false,
      handle: vi.fn(async () => undefined),
    }

    const supportedHandler: DomainEventHandler = {
      supports: () => true,
      handle: vi.fn(async () => undefined),
    }

    const dispatcher = new EventDispatcher([unsupportedHandler, supportedHandler])

    await dispatcher.dispatch(buildEvent())

    expect(unsupportedHandler.handle).not.toHaveBeenCalled()
    expect(supportedHandler.handle).toHaveBeenCalledTimes(1)
  })
})

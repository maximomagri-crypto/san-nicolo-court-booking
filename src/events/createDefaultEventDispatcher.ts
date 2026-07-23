import { EventDispatcher } from './EventDispatcher'
import { AuditHandler } from './handlers/AuditHandler'
import { NotificationHandler } from './handlers/NotificationHandler'
import { StatisticsHandler } from './handlers/StatisticsHandler'

export function createDefaultEventDispatcher(): EventDispatcher {
  return new EventDispatcher([
    new NotificationHandler(),
    new StatisticsHandler(),
    new AuditHandler(),
  ])
}

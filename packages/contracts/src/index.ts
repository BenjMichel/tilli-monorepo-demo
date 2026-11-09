import { z } from 'zod';
import { MissionAwardedV1, MissionUnstaffedV1 } from './dispatch';
import { OrderCancelledV1, OrderPlacedV1 } from './ordering';

export { eventSchema } from './envelope';
export { MissionAwardedV1, MissionUnstaffedV1 } from './dispatch';
export { Fabric, OrderCancelledV1, OrderPlacedV1 } from './ordering';

export const IntegrationEvent = z.union([OrderPlacedV1, OrderCancelledV1, MissionAwardedV1, MissionUnstaffedV1]);
export type IntegrationEvent = z.infer<typeof IntegrationEvent>;

export type IntegrationEventKey = `${IntegrationEvent['type']}.v${IntegrationEvent['version']}`;

/** The integration event of a given key, e.g. `EventOf<'OrderPlaced.v1'>` is `OrderPlacedV1`. */
export type EventOf<K extends IntegrationEventKey> = Extract<
  IntegrationEvent,
  { type: K extends `${infer T}.v${string}` ? T : never }
>;

export function keyOf(event: Pick<IntegrationEvent, 'type' | 'version'>): IntegrationEventKey {
  return `${event.type}.v${event.version}` as IntegrationEventKey;
}

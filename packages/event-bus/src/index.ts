import { type EventOf, type IntegrationEvent, type IntegrationEventKey, keyOf } from '@tilli/contracts';

export type EventHandler<E> = (event: E) => Promise<void>;

/**
 * In-process bus for the modular monolith. Handlers run one after the other and a
 * failing handler fails the publish, so the outbox relay can retry the event later.
 */
export class InMemoryEventBus {
  private readonly handlers = new Map<IntegrationEventKey, EventHandler<IntegrationEvent>[]>();
  readonly published: IntegrationEvent[] = [];

  subscribe<K extends IntegrationEventKey>(key: K, handler: EventHandler<EventOf<K>>): void {
    const handlers = this.handlers.get(key) ?? [];
    handlers.push(handler as EventHandler<IntegrationEvent>);
    this.handlers.set(key, handlers);
  }

  async publish(event: IntegrationEvent): Promise<void> {
    this.published.push(event);
    for (const handler of this.handlers.get(keyOf(event)) ?? []) {
      await handler(event);
    }
  }
}

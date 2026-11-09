import type { OrderPlacedV1 } from '@tilli/contracts';
import type { OrderSnapshot } from '../domain/order';
import type { IntegrationEventPublisher, OrderOutbox } from './ports';

/** Publishes the outbox as integration events; an entry is marked processed only after success. */
export class OrderingEventRelay {
  constructor(
    private readonly outbox: OrderOutbox,
    private readonly publisher: IntegrationEventPublisher,
  ) {}

  async run(): Promise<number> {
    const entries = await this.outbox.pending();
    for (const { id, occurredAt, event } of entries) {
      const envelope = { eventId: id, version: 1 as const, occurredAt: occurredAt.toISOString() };
      switch (event.type) {
        case 'OrderPlaced':
          await this.publisher.publish({
            ...envelope,
            type: 'OrderPlaced',
            payload: toOrderPlacedPayload(event.order),
          });
          break;
        case 'OrderCancelled':
          await this.publisher.publish({
            ...envelope,
            type: 'OrderCancelled',
            payload: { orderId: event.orderId, reason: event.reason },
          });
          break;
        case 'OrderCompleted':
          // Internal for now: no other context needs it yet.
          break;
      }
      await this.outbox.markProcessed(id);
    }
    return entries.length;
  }
}

function toOrderPlacedPayload(order: OrderSnapshot): OrderPlacedV1['payload'] {
  return {
    orderId: order.id,
    items: order.items.map((item) => ({
      garmentType: item.garmentType,
      fabric: item.fabric,
      alterations: item.alterations.map((alteration) => ({
        code: alteration.code,
        priceCents: alteration.price.cents,
      })),
    })),
    address: { ...order.address },
    slots: order.slots.map((slot) => ({ start: slot.start.toISOString(), end: slot.end.toISOString() })),
    customer: { ...order.customer },
    totalCents: order.total.cents,
    priceGridVersion: order.priceGridVersion,
  };
}

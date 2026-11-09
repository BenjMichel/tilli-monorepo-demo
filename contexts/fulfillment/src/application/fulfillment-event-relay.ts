import type { IntegrationEventPublisher, InterventionOutbox } from './ports';

/** Publishes the outbox as integration events; an entry is marked processed only after success. */
export class FulfillmentEventRelay {
  constructor(
    private readonly outbox: InterventionOutbox,
    private readonly publisher: IntegrationEventPublisher,
  ) {}

  async run(): Promise<number> {
    const entries = await this.outbox.pending();
    for (const { id, occurredAt, event } of entries) {
      const envelope = { eventId: id, version: 1 as const, occurredAt: occurredAt.toISOString() };
      switch (event.type) {
        case 'InterventionStarted':
          await this.publisher.publish({
            ...envelope,
            type: 'InterventionStarted',
            payload: {
              interventionId: event.interventionId,
              orderId: event.orderId,
              startedAt: event.startedAt.toISOString(),
            },
          });
          break;
        case 'InterventionCompleted':
          await this.publisher.publish({
            ...envelope,
            type: 'InterventionCompleted',
            payload: {
              interventionId: event.interventionId,
              orderId: event.orderId,
              completedAt: event.completedAt.toISOString(),
            },
          });
          break;
        default:
          // Scheduled, appointment, cancellations: for the tailor app and the admin view later.
          break;
      }
      await this.outbox.markProcessed(id);
    }
    return entries.length;
  }
}

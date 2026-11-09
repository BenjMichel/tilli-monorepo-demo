import type { IntegrationEvent } from '@tilli/contracts';
import type { OrderEvent } from '../domain/order-events';
import type { PriceGrid } from '../domain/price-grid';

export interface Clock {
  now(): Date;
}

export interface OrderIdGenerator {
  next(): string;
}

export interface PriceGrids {
  /** The grid quotes and new orders are priced with. */
  current(): PriceGrid;
}

export type OutboxEntry = {
  readonly id: string;
  readonly occurredAt: Date;
  readonly event: OrderEvent;
};

export interface OrderOutbox {
  pending(): Promise<OutboxEntry[]>;
  markProcessed(id: string): Promise<void>;
}

export interface IntegrationEventPublisher {
  publish(event: IntegrationEvent): Promise<void>;
}

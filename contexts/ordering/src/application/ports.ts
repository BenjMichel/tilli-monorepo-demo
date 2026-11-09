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
  /** The grid new quotes are computed with. */
  current(): PriceGrid;

  /** Grids are never deleted: an order is priced with the version its quote used. */
  byVersion(version: string): PriceGrid | null;
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

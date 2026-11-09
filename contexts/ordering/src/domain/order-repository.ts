import type { Order, OrderId } from './order';

export interface OrderRepository {
  /** Throws OrderNotFound when no order has this id. */
  get(id: OrderId): Promise<Order>;

  /**
   * Persists the order together with its pending events (outbox).
   * Throws OrderConcurrencyConflict when the stored version moved since the order was loaded.
   */
  save(order: Order): Promise<void>;
}

export class OrderNotFound extends Error {
  constructor(id: OrderId) {
    super(`Order ${id} not found`);
    this.name = 'OrderNotFound';
  }
}

export class OrderConcurrencyConflict extends Error {
  constructor(id: OrderId, expectedVersion: number, actualVersion: number) {
    super(`Order ${id} was modified concurrently (expected v${expectedVersion}, found v${actualVersion})`);
    this.name = 'OrderConcurrencyConflict';
  }
}

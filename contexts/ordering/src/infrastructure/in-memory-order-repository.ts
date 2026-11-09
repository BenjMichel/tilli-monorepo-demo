import type { Clock, OrderOutbox, OutboxEntry } from '../application/ports';
import { Order, type OrderId, type OrderSnapshot } from '../domain/order';
import { OrderConcurrencyConflict, OrderNotFound, type OrderRepository } from '../domain/order-repository';

const systemClock: Clock = { now: () => new Date() };

/** Saves the order and its events together, as a database transaction with an outbox table would. */
export class InMemoryOrderRepository implements OrderRepository, OrderOutbox {
  private readonly snapshots = new Map<OrderId, OrderSnapshot>();
  private readonly processed = new Set<string>();
  readonly outbox: OutboxEntry[] = [];

  constructor(private readonly clock: Clock = systemClock) {}

  async get(id: OrderId): Promise<Order> {
    const snapshot = this.snapshots.get(id);
    if (!snapshot) throw new OrderNotFound(id);
    return Order.restore(snapshot);
  }

  async save(order: Order): Promise<void> {
    const storedVersion = this.snapshots.get(order.id)?.version ?? 0;
    if (storedVersion !== order.version) {
      throw new OrderConcurrencyConflict(order.id, order.version, storedVersion);
    }
    const version = order.version + 1;
    this.snapshots.set(order.id, { ...order.toSnapshot(), version });
    const occurredAt = this.clock.now();
    this.outbox.push(
      ...order.pullEvents().map((event, index) => ({ id: `${order.id}:v${version}:${index}`, occurredAt, event })),
    );
  }

  async pending(): Promise<OutboxEntry[]> {
    return this.outbox.filter((entry) => !this.processed.has(entry.id));
  }

  async markProcessed(id: string): Promise<void> {
    this.processed.add(id);
  }
}

import type { Clock, OrderOutbox, OutboxEntry } from '../../application/ports';
import { Order, type OrderId, type OrderSnapshot } from '../../domain/order';
import type { OrderEvent } from '../../domain/order-events';
import { OrderConcurrencyConflict, OrderNotFound, type OrderRepository } from '../../domain/order-repository';
import { fromJson, type SqlDatabase, toJson } from './sql';

const systemClock: Clock = { now: () => new Date() };

type OrderRow = { version: number; snapshot: unknown };
type OutboxRow = { id: string; occurred_at: Date | string; event: unknown };

/**
 * Orders in PostgreSQL. Saving writes the order and its events in one transaction, and only
 * if the stored version is still the one the order was loaded with (optimistic locking).
 */
export class PostgresOrderRepository implements OrderRepository, OrderOutbox {
  constructor(
    private readonly db: SqlDatabase,
    private readonly clock: Clock = systemClock,
  ) {}

  async get(id: OrderId): Promise<Order> {
    const { rows } = await this.db.query<OrderRow>('select version, snapshot from ordering.orders where id = $1', [id]);
    const row = rows[0];
    if (!row) throw new OrderNotFound(id);
    return Order.restore({ ...fromJson<OrderSnapshot>(row.snapshot), version: row.version });
  }

  async save(order: Order): Promise<void> {
    const expected = order.version;
    const version = expected + 1;
    const snapshot = toJson({ ...order.toSnapshot(), version });

    await this.db.transaction(async (tx) => {
      const written =
        expected === 0
          ? await tx.query(
              `insert into ordering.orders (id, version, snapshot) values ($1, $2, $3::jsonb)
               on conflict (id) do nothing returning id`,
              [order.id, version, snapshot],
            )
          : await tx.query(
              `update ordering.orders set version = $2, snapshot = $3::jsonb, updated_at = now()
               where id = $1 and version = $4 returning id`,
              [order.id, version, snapshot, expected],
            );
      if (written.rows.length === 0) {
        const { rows } = await tx.query<{ version: number }>('select version from ordering.orders where id = $1', [
          order.id,
        ]);
        throw new OrderConcurrencyConflict(order.id, expected, rows[0]?.version ?? 0);
      }

      const occurredAt = this.clock.now();
      for (const [index, event] of order.pullEvents().entries()) {
        await tx.query('insert into ordering.outbox (id, occurred_at, event) values ($1, $2, $3::jsonb)', [
          `${order.id}:v${version}:${index}`,
          occurredAt,
          toJson(event),
        ]);
      }
    });
  }

  async pending(): Promise<OutboxEntry[]> {
    const { rows } = await this.db.query<OutboxRow>(
      'select id, occurred_at, event from ordering.outbox where processed_at is null order by position',
    );
    return rows.map((row) => ({
      id: row.id,
      occurredAt: new Date(row.occurred_at),
      event: fromJson<OrderEvent>(row.event),
    }));
  }

  async markProcessed(id: string): Promise<void> {
    await this.db.query('update ordering.outbox set processed_at = now() where id = $1', [id]);
  }
}

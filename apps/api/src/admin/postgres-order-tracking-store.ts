import type { SqlDatabase } from '../infrastructure/postgres/database';
import type { OrderTrackingRow, OrderTrackingStore } from './order-tracking';

/** Schema `admin`: the ops read model. It can be dropped and rebuilt, it owns no fact. */
export const ADMIN_MIGRATIONS = [
  {
    id: '0001_order_tracking',
    sql: `
      create schema if not exists admin;

      create table admin.order_tracking (
        order_id   text primary key,
        placed_at  timestamptz,
        status     text not null,
        row        jsonb not null,
        updated_at timestamptz not null default now()
      );
      create index order_tracking_placed_at on admin.order_tracking (placed_at desc nulls last);
    `,
  },
] as const;

export class PostgresOrderTrackingStore implements OrderTrackingStore {
  constructor(private readonly db: SqlDatabase) {}

  async find(orderId: string): Promise<OrderTrackingRow | null> {
    const { rows } = await this.db.query<{ row: OrderTrackingRow }>(
      'select row from admin.order_tracking where order_id = $1',
      [orderId],
    );
    return rows[0]?.row ?? null;
  }

  async save(row: OrderTrackingRow): Promise<void> {
    await this.db.query(
      `insert into admin.order_tracking (order_id, placed_at, status, row) values ($1, $2, $3, $4::jsonb)
       on conflict (order_id) do update
       set placed_at = excluded.placed_at, status = excluded.status, row = excluded.row, updated_at = now()`,
      [row.orderId, row.placedAt, row.status, JSON.stringify(row)],
    );
  }

  async list(): Promise<OrderTrackingRow[]> {
    const { rows } = await this.db.query<{ row: OrderTrackingRow }>(
      'select row from admin.order_tracking order by placed_at desc nulls last, order_id',
    );
    return rows.map(({ row }) => row);
  }
}

import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { DEMO_PRICE_GRID, PARIS_SERVICE_AREA } from '../../src';
import type { OrderOutbox } from '../../src/application/ports';
import { Order, OrderId } from '../../src/domain/order';
import { OrderConcurrencyConflict, OrderNotFound, type OrderRepository } from '../../src/domain/order-repository';
import { InMemoryOrderRepository } from '../../src/infrastructure/in-memory-order-repository';
import { ORDERING_MIGRATIONS } from '../../src/infrastructure/postgres/migrations';
import { PostgresOrderRepository } from '../../src/infrastructure/postgres/postgres-order-repository';
import { DRESSY_PANTS_HEM, LEA, MONDAY_MORNING, NOW, PARIS_11_ADDRESS } from '../fixtures';

type Repository = OrderRepository & OrderOutbox;

let db: PGlite;
beforeAll(async () => {
  db = await PGlite.create();
  for (const migration of ORDERING_MIGRATIONS) await db.exec(migration.sql);
});
afterAll(() => db.close());

const clock = { now: () => NOW };
const implementations: [string, () => Promise<Repository>][] = [
  ['in memory', async () => new InMemoryOrderRepository(clock)],
  [
    'PostgreSQL',
    async () => {
      await db.exec('truncate ordering.orders, ordering.outbox');
      return new PostgresOrderRepository(db, clock);
    },
  ],
];

const anOrder = (id = 'o-1') =>
  Order.place({
    id: OrderId(id),
    items: [DRESSY_PANTS_HEM],
    address: PARIS_11_ADDRESS,
    slots: [MONDAY_MORNING],
    customer: LEA,
    now: NOW,
    grid: DEMO_PRICE_GRID,
    serviceArea: PARIS_SERVICE_AREA,
  });

describe.each(implementations)('Order repository (%s)', (_name, aRepository) => {
  let orders: Repository;
  beforeEach(async () => {
    orders = await aRepository();
  });

  it('gives back the order it saved, dates included, one version up', async () => {
    const order = anOrder();
    await orders.save(order);

    const loaded = await orders.get(order.id);

    expect(loaded.toSnapshot()).toEqual({ ...order.toSnapshot(), version: 1 });
    expect(loaded.toSnapshot().slots[0]?.start).toBeInstanceOf(Date);
  });

  it('fails on an unknown order', async () => {
    await expect(orders.get(OrderId('nope'))).rejects.toThrow(OrderNotFound);
  });

  it('refuses a save from a stale copy, and keeps the outbox untouched', async () => {
    await orders.save(anOrder());
    await orders.markProcessed((await orders.pending())[0]?.id ?? '');
    const first = await orders.get(OrderId('o-1'));
    const second = await orders.get(OrderId('o-1'));
    first.cancel('customer request');
    second.cancel('duplicate');

    await orders.save(first);
    await expect(orders.save(second)).rejects.toThrow(OrderConcurrencyConflict);

    expect((await orders.pending()).map((entry) => entry.event)).toEqual([
      { type: 'OrderCancelled', orderId: 'o-1', reason: 'customer request' },
    ]);
  });

  it('refuses to create the same order twice', async () => {
    await orders.save(anOrder());
    await expect(orders.save(anOrder())).rejects.toThrow(OrderConcurrencyConflict);
  });

  it('keeps events in the outbox, in order, until they are processed', async () => {
    const order = anOrder();
    await orders.save(order);
    const reloaded = await orders.get(order.id);
    reloaded.cancel('customer request');
    await orders.save(reloaded);

    const pending = await orders.pending();
    expect(pending.map(({ id, event }) => [id, event.type])).toEqual([
      ['o-1:v1:0', 'OrderPlaced'],
      ['o-1:v2:0', 'OrderCancelled'],
    ]);
    expect(pending[0]?.occurredAt).toEqual(NOW);
    const placed = pending[0]?.event;
    expect(placed?.type === 'OrderPlaced' && placed.order.placedAt).toEqual(NOW);

    await orders.markProcessed('o-1:v1:0');
    expect((await orders.pending()).map((entry) => entry.id)).toEqual(['o-1:v2:0']);
  });
});

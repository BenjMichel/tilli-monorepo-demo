import { IntegrationEvent, OrderCancelledV1, OrderPlacedV1 } from '@tilli/contracts';
import { InMemoryEventBus } from '@tilli/event-bus';
import { describe, expect, it } from 'vitest';
import { UnknownPriceGridVersion } from '../../src/application/place-order';
import { OrderCannotBeCancelled } from '../../src/domain/errors';
import { Money } from '../../src/domain/money';
import { PriceGrid } from '../../src/domain/price-grid';
import {
  DEMO_PRICE_GRID,
  InMemoryPriceGrids,
  InMemoryOrderRepository,
  OrderId,
  PARIS_SERVICE_AREA,
  createOrderingModule,
} from '../../src';
import { DRESSY_PANTS_HEM, LEA, MONDAY_MORNING, NOW, PARIS_11_ADDRESS } from '../fixtures';

function aRunningOrdering(grids: PriceGrid[] = [DEMO_PRICE_GRID]) {
  let sequence = 0;
  const bus = new InMemoryEventBus();
  const orders = new InMemoryOrderRepository({ now: () => NOW });
  const ordering = createOrderingModule({
    orders,
    grids: new InMemoryPriceGrids(grids),
    serviceArea: PARIS_SERVICE_AREA,
    ids: { next: () => `o-${++sequence}` },
    clock: { now: () => NOW },
    publisher: bus,
  });
  return { bus, orders, ordering };
}

describe('Ordering funnel', () => {
  it('quotes at step 1, places the order at step 2 and publishes OrderPlaced v1', async () => {
    const { bus, ordering } = aRunningOrdering();

    const offered = ordering.queries.getQuote.alterationsFor('pants', 'dressy');
    expect(offered.find((alteration) => alteration.code === 'hem-simple')?.price).toEqual(Money(1700));
    const quote = ordering.queries.getQuote.execute([DRESSY_PANTS_HEM]);

    const placed = await ordering.commands.placeOrder.execute({
      items: [DRESSY_PANTS_HEM],
      address: PARIS_11_ADDRESS,
      slots: [MONDAY_MORNING],
      customer: LEA,
      quotedPriceGridVersion: quote.priceGridVersion,
    });
    await ordering.relay.run();

    expect(placed).toEqual({ orderId: 'o-1', totalCents: 1700 });
    const event = OrderPlacedV1.parse(bus.published[0]);
    expect(event.payload).toMatchObject({
      orderId: 'o-1',
      items: [{ garmentType: 'pants', fabric: 'dressy', alterations: [{ code: 'hem-simple', priceCents: 1700 }] }],
      address: { postalCode: '75011' },
      slots: [{ start: '2026-11-16T09:00:00.000Z', end: '2026-11-16T11:00:00.000Z' }],
      totalCents: 1700,
      priceGridVersion: DEMO_PRICE_GRID.version,
    });
  });

  it('keeps the prices of the quote when a new grid is published between the two steps', async () => {
    const newGrid = new PriceGrid('demo-2027-01', [
      { garmentType: 'pants', alteration: { code: 'hem-simple', label: 'Ourlet simple (x2)' }, prices: { basic: Money(1300), dressy: Money(1800) } },
    ]);
    const { bus, ordering } = aRunningOrdering([DEMO_PRICE_GRID, newGrid]);
    expect(ordering.queries.getQuote.execute([DRESSY_PANTS_HEM]).total).toEqual(Money(1800));

    const placed = await ordering.commands.placeOrder.execute({
      items: [DRESSY_PANTS_HEM],
      address: PARIS_11_ADDRESS,
      slots: [MONDAY_MORNING],
      customer: LEA,
      quotedPriceGridVersion: DEMO_PRICE_GRID.version,
    });
    await ordering.relay.run();

    expect(placed.totalCents).toBe(1700);
    expect(OrderPlacedV1.parse(bus.published[0]).payload).toMatchObject({
      totalCents: 1700,
      priceGridVersion: DEMO_PRICE_GRID.version,
    });
  });

  it('refuses a quote made with an unknown grid version', async () => {
    const { bus, ordering } = aRunningOrdering();

    await expect(
      ordering.commands.placeOrder.execute({
        items: [DRESSY_PANTS_HEM],
        address: PARIS_11_ADDRESS,
        slots: [MONDAY_MORNING],
        customer: LEA,
        quotedPriceGridVersion: 'made-up',
      }),
    ).rejects.toThrow(UnknownPriceGridVersion);
    expect(bus.published).toEqual([]);
  });

  it('publishes OrderCancelled v1 when the customer cancels', async () => {
    const { bus, ordering } = aRunningOrdering();
    const { orderId } = await ordering.commands.placeOrder.execute({
      items: [DRESSY_PANTS_HEM],
      address: PARIS_11_ADDRESS,
      slots: [MONDAY_MORNING],
      customer: LEA,
      quotedPriceGridVersion: DEMO_PRICE_GRID.version,
    });

    await ordering.commands.cancelOrder.execute({ orderId, reason: 'customer request' });
    await ordering.relay.run();

    expect(bus.published.map((event) => IntegrationEvent.parse(event).type)).toEqual(['OrderPlaced', 'OrderCancelled']);
    expect(OrderCancelledV1.parse(bus.published[1]).payload).toEqual({ orderId: 'o-1', reason: 'customer request' });
  });

  it('refuses to cancel once the intervention started, even if both happen at the same time', async () => {
    const { orders, ordering } = aRunningOrdering();
    const { orderId } = await ordering.commands.placeOrder.execute({
      items: [DRESSY_PANTS_HEM],
      address: PARIS_11_ADDRESS,
      slots: [MONDAY_MORNING],
      customer: LEA,
      quotedPriceGridVersion: DEMO_PRICE_GRID.version,
    });

    const startedByTailor = (async () => {
      const order = await orders.get(OrderId(orderId));
      order.recordInterventionStarted();
      await orders.save(order);
    })();
    const cancelledByCustomer = ordering.commands.cancelOrder.execute({ orderId, reason: 'customer request' });

    const [started, cancelled] = await Promise.allSettled([startedByTailor, cancelledByCustomer]);
    expect(started.status).toBe('fulfilled');
    expect(cancelled.status === 'rejected' && cancelled.reason).toBeInstanceOf(OrderCannotBeCancelled);
    expect((await orders.get(OrderId(orderId))).status).toBe('placed');
  });
});

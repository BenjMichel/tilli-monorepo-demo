import { describe, expect, it } from 'vitest';
import { AreaNotServed, InvalidOrder, OrderCannotBeCancelled } from '../../src/domain/errors';
import { Money } from '../../src/domain/money';
import { Order, OrderId, type PlaceOrder } from '../../src/domain/order';
import { DEMO_PRICE_GRID } from '../../src/infrastructure/demo-price-grid';
import { PARIS_SERVICE_AREA } from '../../src/infrastructure/demo-service-area';
import { DRESSY_PANTS_HEM, LEA, MONDAY_MORNING, NOW, PARIS_11_ADDRESS } from '../fixtures';

function place(overrides: Partial<PlaceOrder> = {}): Order {
  return Order.place({
    id: OrderId('o-1'),
    items: [DRESSY_PANTS_HEM],
    address: PARIS_11_ADDRESS,
    slots: [MONDAY_MORNING],
    customer: LEA,
    now: NOW,
    grid: DEMO_PRICE_GRID,
    serviceArea: PARIS_SERVICE_AREA,
    ...overrides,
  });
}

function aPlacedOrder(): Order {
  const order = place();
  order.pullEvents();
  return order;
}

describe('Order', () => {
  describe('placing', () => {
    it('freezes the price computed from the grid and announces the order', () => {
      const order = place();

      expect(order.status).toBe('placed');
      expect(order.total).toEqual(Money(1700));
      const [event] = order.pullEvents();
      expect(event?.type).toBe('OrderPlaced');
      expect(event?.type === 'OrderPlaced' && event.order.priceGridVersion).toBe(DEMO_PRICE_GRID.version);
    });

    it('refuses an address outside the service area', () => {
      expect(() => place({ address: { ...PARIS_11_ADDRESS, postalCode: '78000', city: 'Versailles' } })).toThrow(
        AreaNotServed,
      );
    });

    it('requires at least one time slot, each in the future and ending after it starts', () => {
      expect(() => place({ slots: [] })).toThrow(InvalidOrder);
      expect(() =>
        place({ slots: [{ start: new Date('2026-11-08T09:00:00Z'), end: new Date('2026-11-08T11:00:00Z') }] }),
      ).toThrow('Time slots must be in the future');
      expect(() => place({ slots: [{ start: MONDAY_MORNING.end, end: MONDAY_MORNING.start }] })).toThrow(InvalidOrder);
    });

    it('requires complete customer details', () => {
      expect(() => place({ customer: { ...LEA, phone: ' ' } })).toThrow('Missing customer details: phone');
      expect(() => place({ customer: { ...LEA, email: 'lea.example.com' } })).toThrow('Invalid customer email');
    });

    it('keeps its price when the grid changes afterwards', () => {
      const order = aPlacedOrder();
      const restored = Order.restore(order.toSnapshot());

      expect(restored.total).toEqual(Money(1700));
      expect(restored.toSnapshot().priceGridVersion).toBe(DEMO_PRICE_GRID.version);
    });
  });

  describe('cancelling', () => {
    it('cancels a placed order', () => {
      const order = aPlacedOrder();

      order.cancel('customer request');

      expect(order.status).toBe('cancelled');
      expect(order.pullEvents()).toEqual([{ type: 'OrderCancelled', orderId: 'o-1', reason: 'customer request' }]);
    });

    it('is no longer possible once the tailor started working', () => {
      const order = aPlacedOrder();
      order.recordInterventionStarted();

      expect(() => order.cancel('customer request')).toThrow(OrderCannotBeCancelled);
      expect(order.status).toBe('placed');
    });

    it('ignores a second cancellation', () => {
      const order = aPlacedOrder();
      order.cancel('customer request');
      order.pullEvents();

      order.cancel('again');

      expect(order.pullEvents()).toEqual([]);
    });
  });

  describe('completing', () => {
    it('completes a placed order, once', () => {
      const order = aPlacedOrder();

      order.complete();
      order.complete();

      expect(order.status).toBe('completed');
      expect(order.pullEvents()).toEqual([{ type: 'OrderCompleted', orderId: 'o-1' }]);
      expect(() => order.cancel('too late')).toThrow(OrderCannotBeCancelled);
    });

    it('stays cancelled when the work of a late-cancelled order is completed anyway', () => {
      const order = aPlacedOrder();
      order.cancel('customer request');
      order.pullEvents();

      order.complete();

      expect(order.status).toBe('cancelled');
      expect(order.pullEvents()).toEqual([]);
    });
  });
});

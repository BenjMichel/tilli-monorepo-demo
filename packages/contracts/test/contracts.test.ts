import { describe, expect, it } from 'vitest';
import { IntegrationEvent, OrderPlacedV1, keyOf } from '../src';

const anOrderPlaced = {
  eventId: 'evt-1',
  type: 'OrderPlaced',
  version: 1,
  occurredAt: '2026-11-09T10:00:00Z',
  payload: {
    orderId: 'o-1',
    items: [{ garmentType: 'pants', fabric: 'dressy', alterations: [{ code: 'hem-simple', priceCents: 1700 }] }],
    address: { street: '12 rue Oberkampf', postalCode: '75011', city: 'Paris' },
    slots: [{ start: '2026-11-16T09:00:00Z', end: '2026-11-16T11:00:00Z' }],
    customer: { firstName: 'Léa', lastName: 'Martin', phone: '+33600000000', email: 'lea@example.com' },
    totalCents: 1700,
    priceGridVersion: 'v14',
  },
};

describe('integration event contracts', () => {
  it('accepts a well-formed OrderPlaced v1', () => {
    expect(OrderPlacedV1.parse(anOrderPlaced)).toEqual(anOrderPlaced);
    expect(keyOf(IntegrationEvent.parse(anOrderPlaced))).toBe('OrderPlaced.v1');
  });

  it('rejects an order without items or slots', () => {
    expect(OrderPlacedV1.safeParse({ ...anOrderPlaced, payload: { ...anOrderPlaced.payload, items: [] } }).success).toBe(false);
    expect(OrderPlacedV1.safeParse({ ...anOrderPlaced, payload: { ...anOrderPlaced.payload, slots: [] } }).success).toBe(false);
  });

  it('rejects an unknown fabric', () => {
    const silk = { ...anOrderPlaced.payload.items[0], fabric: 'silk' };
    expect(OrderPlacedV1.safeParse({ ...anOrderPlaced, payload: { ...anOrderPlaced.payload, items: [silk] } }).success).toBe(false);
  });

  it('rejects another version of the same event type', () => {
    expect(OrderPlacedV1.safeParse({ ...anOrderPlaced, version: 2 }).success).toBe(false);
  });
});

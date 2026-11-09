import { describe, expect, it } from 'vitest';
import { ApiError, httpApi } from '../src/api';

function aFetch(status: number, body: unknown) {
  const calls: { url: string; init: RequestInit | undefined }[] = [];
  const fetchFn = async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  };
  return { calls, fetchFn: fetchFn as typeof fetch };
}

describe('httpApi', () => {
  it('asks the catalog for a garment and a fabric', async () => {
    const { calls, fetchFn } = aFetch(200, []);
    await httpApi('/api', fetchFn).alterationsFor('pants', 'dressy');
    expect(calls[0]?.url).toBe('/api/catalog/alterations?garmentType=pants&fabric=dressy');
  });

  it('posts the order as JSON, with dates in ISO format', async () => {
    const { calls, fetchFn } = aFetch(201, { orderId: 'o-1', totalCents: 1700 });
    const placed = await httpApi('/api', fetchFn).placeOrder({
      items: [{ garmentType: 'pants', fabric: 'dressy', alterationCodes: ['hem-simple'] }],
      address: { street: '12 rue Oberkampf', postalCode: '75011', city: 'Paris' },
      slots: [{ start: new Date('2026-11-16T09:00:00Z'), end: new Date('2026-11-16T11:00:00Z') }],
      customer: { firstName: 'Léa', lastName: 'Martin', phone: '+33600000000', email: 'lea@example.com' },
      quotedPriceGridVersion: 'demo-2026-11',
    });
    expect(placed).toEqual({ orderId: 'o-1', totalCents: 1700 });
    expect(calls[0]?.url).toBe('/api/orders');
    expect(calls[0]?.init?.method).toBe('POST');
    expect(JSON.parse(String(calls[0]?.init?.body)).slots[0].start).toBe('2026-11-16T09:00:00.000Z');
  });

  it('turns a refusal into an ApiError carrying its code', async () => {
    const { fetchFn } = aFetch(422, { error: 'AREA_NOT_SERVED', message: 'Tilli does not serve postal code 69001' });
    const refusal = httpApi('/api', fetchFn).quote([]);
    await expect(refusal).rejects.toBeInstanceOf(ApiError);
    await expect(refusal).rejects.toMatchObject({ status: 422, code: 'AREA_NOT_SERVED' });
  });
});

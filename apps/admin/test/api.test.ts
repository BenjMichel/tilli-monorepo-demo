import { describe, expect, it } from 'vitest';
import { ApiError, httpApi } from '../src/api';

function aFetch(status: number, body?: unknown) {
  const calls: { url: string; init: RequestInit | undefined }[] = [];
  const fetchFn = async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    return new Response(body === undefined ? null : JSON.stringify(body), { status });
  };
  return { calls, fetchFn: fetchFn as typeof fetch };
}

describe('httpApi', () => {
  it('reads the tracking projection', async () => {
    const { calls, fetchFn } = aFetch(200, []);
    expect(await httpApi('/api', fetchFn).listOrders()).toEqual([]);
    expect(calls[0]?.url).toBe('/api/admin/orders');
  });

  it('sends the cancellation to Ordering with its reason', async () => {
    const { calls, fetchFn } = aFetch(204);
    await httpApi('/api', fetchFn).cancelOrder('order-1', 'Client injoignable');
    expect(calls[0]?.url).toBe('/api/orders/order-1/cancel');
    expect(calls[0]?.init?.method).toBe('POST');
    expect(JSON.parse(String(calls[0]?.init?.body))).toEqual({ reason: 'Client injoignable' });
  });

  it('turns a refusal into an ApiError carrying its code', async () => {
    const { fetchFn } = aFetch(409, { error: 'ORDER_CANNOT_BE_CANCELLED', message: 'started' });
    await expect(httpApi('/api', fetchFn).cancelOrder('order-1', 'x')).rejects.toMatchObject({
      constructor: ApiError,
      status: 409,
      code: 'ORDER_CANNOT_BE_CANCELLED',
    });
  });
});

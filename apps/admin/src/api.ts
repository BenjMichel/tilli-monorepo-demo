/**
 * Client of the admin routes of the API. The admin reads the tracking projection and,
 * to act, sends a command to the context that owns the order (Ordering).
 */

export type TrackingStatus =
  | 'searching-tailor'
  | 'unstaffed'
  | 'tailor-assigned'
  | 'in-progress'
  | 'completed'
  | 'cancelled';

export type OrderTrackingRow = {
  readonly orderId: string;
  readonly placedAt: string | null;
  readonly postalCode: string | null;
  readonly totalCents: number | null;
  readonly status: TrackingStatus;
  readonly tailorId: string | null;
  readonly appointment: { readonly start: string; readonly end: string } | null;
};

export type AdminApi = {
  listOrders(): Promise<OrderTrackingRow[]>;
  cancelOrder(orderId: string, reason: string): Promise<void>;
};

/** A refusal of the API, with the stable error code it published. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function httpApi(baseUrl = '/api', fetchFn: typeof fetch = (...args) => fetch(...args)): AdminApi {
  async function call(path: string, init?: { method: 'POST'; body: unknown }): Promise<unknown> {
    const response = await fetchFn(
      `${baseUrl}${path}`,
      init && { method: init.method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(init.body) },
    );
    const body: unknown = response.status === 204 ? null : await response.json().catch(() => null);
    if (!response.ok) {
      const { error, message } = (body ?? {}) as { error?: unknown; message?: unknown };
      throw new ApiError(
        response.status,
        typeof error === 'string' ? error : 'UNEXPECTED_RESPONSE',
        typeof message === 'string' ? message : `HTTP ${response.status}`,
      );
    }
    return body;
  }

  return {
    listOrders: async () => (await call('/admin/orders')) as OrderTrackingRow[],
    cancelOrder: async (orderId, reason) => {
      await call(`/orders/${encodeURIComponent(orderId)}/cancel`, { method: 'POST', body: { reason } });
    },
  };
}

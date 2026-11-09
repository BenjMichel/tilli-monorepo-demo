/**
 * Client of the website routes of the API. The site only knows these JSON shapes,
 * never the code of a bounded context.
 */

export type Fabric = 'basic' | 'dressy';
export type Money = { readonly cents: number };

export type OfferedAlteration = { readonly code: string; readonly label: string; readonly price: Money };

export type ItemRequest = {
  readonly garmentType: string;
  readonly fabric: Fabric;
  readonly alterationCodes: readonly string[];
};

export type Quote = {
  readonly items: readonly {
    readonly garmentType: string;
    readonly fabric: Fabric;
    readonly alterations: readonly OfferedAlteration[];
    readonly subtotal: Money;
  }[];
  readonly total: Money;
  readonly priceGridVersion: string;
};

export type TimeSlot = { readonly start: Date; readonly end: Date };

export type PlaceOrderRequest = {
  readonly items: readonly ItemRequest[];
  readonly address: { readonly street: string; readonly postalCode: string; readonly city: string };
  readonly slots: readonly TimeSlot[];
  readonly customer: {
    readonly firstName: string;
    readonly lastName: string;
    readonly phone: string;
    readonly email: string;
  };
  /** The grid version of the quote shown at step 1: the customer pays that price. */
  readonly quotedPriceGridVersion: string;
};

export type PlacedOrder = { readonly orderId: string; readonly totalCents: number };

export type TilliApi = {
  alterationsFor(garmentType: string, fabric: Fabric): Promise<OfferedAlteration[]>;
  quote(items: readonly ItemRequest[]): Promise<Quote>;
  placeOrder(request: PlaceOrderRequest): Promise<PlacedOrder>;
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

export function httpApi(baseUrl = '/api', fetchFn: typeof fetch = (...args) => fetch(...args)): TilliApi {
  async function call<T>(path: string, init?: { method: 'POST'; body: unknown }): Promise<T> {
    const response = await fetchFn(
      `${baseUrl}${path}`,
      init && { method: init.method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(init.body) },
    );
    const body: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const { error, message } = (body ?? {}) as { error?: unknown; message?: unknown };
      throw new ApiError(
        response.status,
        typeof error === 'string' ? error : 'UNEXPECTED_RESPONSE',
        typeof message === 'string' ? message : `HTTP ${response.status}`,
      );
    }
    return body as T;
  }

  return {
    alterationsFor: (garmentType, fabric) =>
      call(`/catalog/alterations?${new URLSearchParams({ garmentType, fabric })}`),
    quote: (items) => call('/quotes', { method: 'POST', body: { items } }),
    placeOrder: (request) => call('/orders', { method: 'POST', body: request }),
  };
}

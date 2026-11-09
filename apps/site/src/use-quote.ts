import { useEffect, useState } from 'react';
import type { Quote, TilliApi } from './api';
import { type CartItem, describeError, toItemRequests } from './funnel';

export type QuoteState =
  | { readonly status: 'empty' }
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly quote: Quote }
  | { readonly status: 'error'; readonly message: string };

/** Recomputes the quote on the API each time the cart changes: the price grid lives there, not here. */
export function useQuote(api: TilliApi, cart: readonly CartItem[]): QuoteState {
  const [state, setState] = useState<QuoteState>({ status: 'empty' });
  useEffect(() => {
    if (cart.length === 0) {
      setState({ status: 'empty' });
      return;
    }
    let stale = false;
    setState({ status: 'loading' });
    api.quote(toItemRequests(cart)).then(
      (quote) => stale || setState({ status: 'ready', quote }),
      (error: unknown) => stale || setState({ status: 'error', message: describeError(error) }),
    );
    return () => {
      stale = true;
    };
  }, [api, cart]);
  return state;
}

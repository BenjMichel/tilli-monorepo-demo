import { useCallback, useEffect, useRef, useState } from 'react';
import type { AdminApi, OrderTrackingRow } from './api';
import { describeError } from './tracking';

export type OrdersState = {
  readonly rows: readonly OrderTrackingRow[] | null;
  readonly error: string | null;
  readonly refreshedAt: Date | null;
  readonly refresh: () => Promise<void>;
};

/**
 * Polls the tracking projection: tailors accept and work in their own app, so the
 * admin has no other way to learn that an order moved. Keeps the last rows on error.
 */
export function useOrders(api: AdminApi, refreshMs: number): OrdersState {
  const [rows, setRows] = useState<readonly OrderTrackingRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshedAt, setRefreshedAt] = useState<Date | null>(null);
  const mounted = useRef(true);

  const refresh = useCallback(async () => {
    try {
      const next = await api.listOrders();
      if (!mounted.current) return;
      setRows(next);
      setError(null);
      setRefreshedAt(new Date());
    } catch (caught) {
      if (mounted.current) setError(describeError(caught));
    }
  }, [api]);

  useEffect(() => {
    mounted.current = true;
    void refresh();
    const timer = setInterval(() => void refresh(), refreshMs);
    return () => {
      mounted.current = false;
      clearInterval(timer);
    };
  }, [refresh, refreshMs]);

  return { rows, error, refreshedAt, refresh };
}

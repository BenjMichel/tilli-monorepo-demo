import { useCallback, useEffect, useRef, useState } from 'react';
import { describeError } from './schedule';

export type Polled<T> = {
  readonly data: T | null;
  readonly error: string | null;
  readonly refresh: () => Promise<void>;
};

/**
 * Polls a read of the API: offers arrive and expire, and the ops team may cancel an
 * intervention, without the app being told. Keeps the last data on error.
 */
export function usePolled<T>(load: () => Promise<T>, refreshMs: number): Polled<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);

  const refresh = useCallback(async () => {
    try {
      const next = await load();
      if (!mounted.current) return;
      setData(next);
      setError(null);
    } catch (caught) {
      if (mounted.current) setError(describeError(caught));
    }
  }, [load]);

  useEffect(() => {
    mounted.current = true;
    void refresh();
    const timer = setInterval(() => void refresh(), refreshMs);
    return () => {
      mounted.current = false;
      clearInterval(timer);
    };
  }, [refresh, refreshMs]);

  return { data, error, refresh };
}

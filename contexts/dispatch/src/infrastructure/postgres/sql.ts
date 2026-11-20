/**
 * The little this context needs from a PostgreSQL driver. The composition root passes node-postgres
 * in production and PGlite in tests. Declared here, not in a shared package: contexts only share
 * contracts (ADR 0002), and each one owns its schema.
 */
export interface SqlExecutor {
  query<Row>(text: string, params?: unknown[]): Promise<{ rows: Row[] }>;
}

export interface SqlDatabase extends SqlExecutor {
  /** Runs `work` in one transaction: committed if it resolves, rolled back if it throws. */
  transaction<T>(work: (tx: SqlExecutor) => Promise<T>): Promise<T>;
}

/** A migration of this context's schema. Applied once, in order, by the composition root. */
export type Migration = { readonly id: string; readonly sql: string };

/** JSON for jsonb columns. Dates are tagged so they come back as dates, not strings. */
export function toJson(value: unknown): string {
  return JSON.stringify(value, function (this: Record<string, unknown>, key, current: unknown) {
    const raw = this[key];
    return raw instanceof Date ? { $date: raw.toISOString() } : current;
  });
}

/** Reverses toJson on a jsonb value the driver already parsed. */
export function fromJson<T>(value: unknown): T {
  return revive(value) as T;
}

function revive(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(revive);
  if (value === null || typeof value !== 'object') return value;
  const entries = Object.entries(value);
  if (entries.length === 1 && entries[0]?.[0] === '$date' && typeof entries[0][1] === 'string') {
    return new Date(entries[0][1]);
  }
  return Object.fromEntries(entries.map(([key, item]) => [key, revive(item)]));
}

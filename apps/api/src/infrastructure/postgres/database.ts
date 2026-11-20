import type { Pool, PoolClient } from 'pg';

/**
 * What the platform needs from PostgreSQL. Each context declares the subset it uses; this one
 * adds `exec` (several statements at once) for migrations. Implemented by node-postgres below
 * and, in tests, by PGlite as is.
 */
export interface SqlExecutor {
  query<Row>(text: string, params?: unknown[]): Promise<{ rows: Row[] }>;
  exec(text: string): Promise<unknown>;
}

export interface SqlDatabase extends SqlExecutor {
  transaction<T>(work: (tx: SqlExecutor) => Promise<T>): Promise<T>;
}

/** node-postgres pool behind the SqlDatabase port. A transaction holds one pooled connection. */
export function pgDatabase(pool: Pool): SqlDatabase {
  const executor = (client: Pool | PoolClient): SqlExecutor => ({
    query: async <Row>(text: string, params?: unknown[]) => {
      const result = await client.query(text, params);
      return { rows: result.rows as Row[] };
    },
    exec: (text: string) => client.query(text),
  });

  return {
    ...executor(pool),
    async transaction<T>(work: (tx: SqlExecutor) => Promise<T>): Promise<T> {
      const client = await pool.connect();
      try {
        await client.query('begin');
        const result = await work(executor(client));
        await client.query('commit');
        return result;
      } catch (error) {
        await client.query('rollback').catch(() => {});
        throw error;
      } finally {
        client.release();
      }
    },
  };
}

import { DISPATCH_MIGRATIONS } from '@tilli/dispatch';
import { FULFILLMENT_MIGRATIONS } from '@tilli/fulfillment';
import { ORDERING_MIGRATIONS } from '@tilli/ordering';
import { ADMIN_MIGRATIONS } from '../../admin/postgres-order-tracking-store';
import type { SqlDatabase } from './database';

/** Every schema, one per context plus the admin read model (ADR 0002), in the order they are created. */
const SCHEMAS = [
  { schema: 'ordering', migrations: ORDERING_MIGRATIONS },
  { schema: 'dispatch', migrations: DISPATCH_MIGRATIONS },
  { schema: 'fulfillment', migrations: FULFILLMENT_MIGRATIONS },
  { schema: 'admin', migrations: ADMIN_MIGRATIONS },
] as const;

/**
 * Applies the migrations not applied yet, all in one transaction. The advisory lock makes
 * instances starting together wait for each other instead of migrating twice.
 * Returns the migrations applied, as `schema/id`.
 */
export function migrate(db: SqlDatabase): Promise<string[]> {
  return db.transaction(async (tx) => {
    await tx.query('select pg_advisory_xact_lock(hashtext($1))', ['tilli:migrations']);
    await tx.exec(`
      create table if not exists public.schema_migrations (
        schema     text not null,
        id         text not null,
        applied_at timestamptz not null default now(),
        primary key (schema, id)
      )
    `);
    const { rows } = await tx.query<{ schema: string; id: string }>('select schema, id from public.schema_migrations');
    const done = new Set(rows.map((row) => `${row.schema}/${row.id}`));

    const applied: string[] = [];
    for (const { schema, migrations } of SCHEMAS) {
      for (const migration of migrations) {
        const key = `${schema}/${migration.id}`;
        if (done.has(key)) continue;
        await tx.exec(migration.sql);
        await tx.query('insert into public.schema_migrations (schema, id) values ($1, $2)', [schema, migration.id]);
        applied.push(key);
      }
    }
    return applied;
  });
}

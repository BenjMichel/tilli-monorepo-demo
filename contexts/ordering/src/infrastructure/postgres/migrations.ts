import type { Migration } from './sql';

/**
 * Schema `ordering`, owned by this context alone: no other context reads or joins it (ADR 0002).
 * The aggregate is stored as a jsonb snapshot; columns only exist for what is queried or locked.
 * Never edit a migration once it has shipped: add the next one.
 */
export const ORDERING_MIGRATIONS: readonly Migration[] = [
  {
    id: '0001_orders_and_outbox',
    sql: `
      create schema if not exists ordering;

      create table ordering.orders (
        id         text primary key,
        version    integer not null check (version > 0),
        snapshot   jsonb not null,
        updated_at timestamptz not null default now()
      );

      -- Transactional outbox (ADR 0003): written in the same transaction as the order.
      create table ordering.outbox (
        position     bigint generated always as identity primary key,
        id           text not null unique,
        occurred_at  timestamptz not null,
        event        jsonb not null,
        processed_at timestamptz
      );
      create index outbox_pending on ordering.outbox (position) where processed_at is null;
    `,
  },
];

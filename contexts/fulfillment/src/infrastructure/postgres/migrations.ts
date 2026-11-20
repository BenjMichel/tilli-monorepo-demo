import type { Migration } from './sql';

/**
 * Schema `fulfillment`, owned by this context alone (ADR 0002). It is the only schema holding the
 * customer's contact details (ADR 0003): access to it should be restricted accordingly.
 * Never edit a migration once it has shipped: add the next one.
 */
export const FULFILLMENT_MIGRATIONS: readonly Migration[] = [
  {
    id: '0001_interventions_drafts_and_outbox',
    sql: `
      create schema if not exists fulfillment;

      create table fulfillment.interventions (
        id         text primary key,
        tailor_id  text not null,
        version    integer not null check (version > 0),
        snapshot   jsonb not null,
        updated_at timestamptz not null default now()
      );
      -- "Mes interventions" in the tailor app.
      create index interventions_tailor on fulfillment.interventions (tailor_id);

      -- What Fulfillment keeps from an order while Dispatch looks for a tailor.
      create table fulfillment.intervention_drafts (
        order_id   text primary key,
        draft      jsonb not null,
        updated_at timestamptz not null default now()
      );

      -- Transactional outbox (ADR 0003): written in the same transaction as the intervention.
      create table fulfillment.outbox (
        position     bigint generated always as identity primary key,
        id           text not null unique,
        occurred_at  timestamptz not null,
        event        jsonb not null,
        processed_at timestamptz
      );
      create index outbox_pending on fulfillment.outbox (position) where processed_at is null;
    `,
  },
];

import type { Migration } from './sql';

/**
 * Schema `dispatch`, owned by this context alone (ADR 0002). It holds no personal data:
 * a mission only knows the postal code of the order (ADR 0003).
 * Never edit a migration once it has shipped: add the next one.
 */
export const DISPATCH_MIGRATIONS: readonly Migration[] = [
  {
    id: '0001_missions_outbox_and_wave_timers',
    sql: `
      create schema if not exists dispatch;

      create table dispatch.missions (
        id         text primary key,
        version    integer not null check (version > 0),
        snapshot   jsonb not null,
        updated_at timestamptz not null default now()
      );
      -- "Mes propositions": offers @> [{ candidateId, status: 'pending' }].
      create index missions_offers on dispatch.missions using gin ((snapshot -> 'offers') jsonb_path_ops);

      -- Transactional outbox (ADR 0003): written in the same transaction as the mission.
      create table dispatch.outbox (
        position     bigint generated always as identity primary key,
        id           text not null unique,
        occurred_at  timestamptz not null,
        event        jsonb not null,
        processed_at timestamptz
      );
      create index outbox_pending on dispatch.outbox (position) where processed_at is null;

      -- Wave deadlines survive a restart: the API polls the due ones.
      create table dispatch.wave_timers (
        mission_id text not null,
        wave       integer not null,
        due_at     timestamptz not null,
        primary key (mission_id, wave)
      );
      create index wave_timers_due on dispatch.wave_timers (due_at);
    `,
  },
];

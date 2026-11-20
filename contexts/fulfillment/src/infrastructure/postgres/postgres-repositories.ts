import type { Clock, InterventionOutbox, OutboxEntry } from '../../application/ports';
import type { InterventionId, OrderId, TailorId } from '../../domain/ids';
import { Intervention, type InterventionSnapshot } from '../../domain/intervention';
import type { InterventionDraft, InterventionDraftRepository } from '../../domain/intervention-draft';
import type { InterventionEvent } from '../../domain/intervention-events';
import {
  InterventionConcurrencyConflict,
  InterventionNotFound,
  type InterventionRepository,
} from '../../domain/intervention-repository';
import { fromJson, type SqlDatabase, toJson } from './sql';

const systemClock: Clock = { now: () => new Date() };

type InterventionRow = { version: number; snapshot: unknown };
type OutboxRow = { id: string; occurred_at: Date | string; event: unknown };

/** Interventions in PostgreSQL, saved with their events in one transaction (optimistic locking). */
export class PostgresInterventionRepository implements InterventionRepository, InterventionOutbox {
  constructor(
    private readonly db: SqlDatabase,
    private readonly clock: Clock = systemClock,
  ) {}

  async get(id: InterventionId): Promise<Intervention> {
    const { rows } = await this.db.query<InterventionRow>(
      'select version, snapshot from fulfillment.interventions where id = $1',
      [id],
    );
    const row = rows[0];
    if (!row) throw new InterventionNotFound(id);
    return restore(row);
  }

  async exists(id: InterventionId): Promise<boolean> {
    const { rows } = await this.db.query('select 1 from fulfillment.interventions where id = $1', [id]);
    return rows.length > 0;
  }

  async findByTailor(tailorId: TailorId): Promise<Intervention[]> {
    const { rows } = await this.db.query<InterventionRow>(
      'select version, snapshot from fulfillment.interventions where tailor_id = $1 order by id',
      [tailorId],
    );
    return rows.map(restore);
  }

  async save(intervention: Intervention): Promise<void> {
    const expected = intervention.version;
    const version = expected + 1;
    const snapshot = toJson({ ...intervention.toSnapshot(), version });

    await this.db.transaction(async (tx) => {
      const written =
        expected === 0
          ? await tx.query(
              `insert into fulfillment.interventions (id, tailor_id, version, snapshot) values ($1, $2, $3, $4::jsonb)
               on conflict (id) do nothing returning id`,
              [intervention.id, intervention.tailorId, version, snapshot],
            )
          : await tx.query(
              `update fulfillment.interventions set version = $2, snapshot = $3::jsonb, updated_at = now()
               where id = $1 and version = $4 returning id`,
              [intervention.id, version, snapshot, expected],
            );
      if (written.rows.length === 0) {
        const { rows } = await tx.query<{ version: number }>(
          'select version from fulfillment.interventions where id = $1',
          [intervention.id],
        );
        throw new InterventionConcurrencyConflict(intervention.id, expected, rows[0]?.version ?? 0);
      }

      const occurredAt = this.clock.now();
      for (const [index, event] of intervention.pullEvents().entries()) {
        await tx.query('insert into fulfillment.outbox (id, occurred_at, event) values ($1, $2, $3::jsonb)', [
          `${intervention.id}:v${version}:${index}`,
          occurredAt,
          toJson(event),
        ]);
      }
    });
  }

  async pending(): Promise<OutboxEntry[]> {
    const { rows } = await this.db.query<OutboxRow>(
      'select id, occurred_at, event from fulfillment.outbox where processed_at is null order by position',
    );
    return rows.map((row) => ({
      id: row.id,
      occurredAt: new Date(row.occurred_at),
      event: fromJson<InterventionEvent>(row.event),
    }));
  }

  async markProcessed(id: string): Promise<void> {
    await this.db.query('update fulfillment.outbox set processed_at = now() where id = $1', [id]);
  }
}

export class PostgresInterventionDraftRepository implements InterventionDraftRepository {
  constructor(private readonly db: SqlDatabase) {}

  async find(orderId: OrderId): Promise<InterventionDraft | null> {
    const { rows } = await this.db.query<{ draft: unknown }>(
      'select draft from fulfillment.intervention_drafts where order_id = $1',
      [orderId],
    );
    return rows[0] ? fromJson<InterventionDraft>(rows[0].draft) : null;
  }

  async save(draft: InterventionDraft): Promise<void> {
    await this.db.query(
      `insert into fulfillment.intervention_drafts (order_id, draft) values ($1, $2::jsonb)
       on conflict (order_id) do update set draft = excluded.draft, updated_at = now()`,
      [draft.orderId, toJson(draft)],
    );
  }
}

function restore(row: InterventionRow): Intervention {
  return Intervention.restore({ ...fromJson<InterventionSnapshot>(row.snapshot), version: row.version });
}

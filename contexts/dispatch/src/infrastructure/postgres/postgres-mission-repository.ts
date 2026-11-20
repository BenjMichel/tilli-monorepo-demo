import type { Clock } from '../../application/clock';
import type { MissionOutbox, OutboxEntry } from '../../application/ports';
import type { CandidateId, MissionId } from '../../domain/ids';
import { Mission, type MissionSnapshot } from '../../domain/mission';
import type { MissionEvent } from '../../domain/mission-events';
import { MissionConcurrencyConflict, MissionNotFound, type MissionRepository } from '../../domain/mission-repository';
import { fromJson, type SqlDatabase, toJson } from './sql';

const systemClock: Clock = { now: () => new Date() };

type MissionRow = { version: number; snapshot: unknown };
type OutboxRow = { id: string; occurred_at: Date | string; event: unknown };

/**
 * Missions in PostgreSQL. Saving writes the mission and its events in one transaction, and only
 * if the stored version is still the one the mission was loaded with: when two tailors accept
 * at once, the second save fails and AcceptOffer retries against the awarded mission.
 */
export class PostgresMissionRepository implements MissionRepository, MissionOutbox {
  constructor(
    private readonly db: SqlDatabase,
    private readonly clock: Clock = systemClock,
  ) {}

  async get(id: MissionId): Promise<Mission> {
    const { rows } = await this.db.query<MissionRow>('select version, snapshot from dispatch.missions where id = $1', [
      id,
    ]);
    const row = rows[0];
    if (!row) throw new MissionNotFound(id);
    return restore(row);
  }

  async exists(id: MissionId): Promise<boolean> {
    const { rows } = await this.db.query('select 1 from dispatch.missions where id = $1', [id]);
    return rows.length > 0;
  }

  async findWithPendingOfferFor(candidateId: CandidateId): Promise<Mission[]> {
    const { rows } = await this.db.query<MissionRow>(
      `select version, snapshot from dispatch.missions where snapshot -> 'offers' @> $1::jsonb order by id`,
      [JSON.stringify([{ candidateId, status: 'pending' }])],
    );
    return rows.map(restore);
  }

  async save(mission: Mission): Promise<void> {
    const expected = mission.version;
    const version = expected + 1;
    const snapshot = toJson({ ...mission.toSnapshot(), version });

    await this.db.transaction(async (tx) => {
      const written =
        expected === 0
          ? await tx.query(
              `insert into dispatch.missions (id, version, snapshot) values ($1, $2, $3::jsonb)
               on conflict (id) do nothing returning id`,
              [mission.id, version, snapshot],
            )
          : await tx.query(
              `update dispatch.missions set version = $2, snapshot = $3::jsonb, updated_at = now()
               where id = $1 and version = $4 returning id`,
              [mission.id, version, snapshot, expected],
            );
      if (written.rows.length === 0) {
        const { rows } = await tx.query<{ version: number }>('select version from dispatch.missions where id = $1', [
          mission.id,
        ]);
        throw new MissionConcurrencyConflict(mission.id, expected, rows[0]?.version ?? 0);
      }

      const occurredAt = this.clock.now();
      for (const [index, event] of mission.pullEvents().entries()) {
        await tx.query('insert into dispatch.outbox (id, occurred_at, event) values ($1, $2, $3::jsonb)', [
          `${mission.id}:v${version}:${index}`,
          occurredAt,
          toJson(event),
        ]);
      }
    });
  }

  async pending(): Promise<OutboxEntry[]> {
    const { rows } = await this.db.query<OutboxRow>(
      'select id, occurred_at, event from dispatch.outbox where processed_at is null order by position',
    );
    return rows.map((row) => ({
      id: row.id,
      occurredAt: new Date(row.occurred_at),
      event: fromJson<MissionEvent>(row.event),
    }));
  }

  async markProcessed(id: string): Promise<void> {
    await this.db.query('update dispatch.outbox set processed_at = now() where id = $1', [id]);
  }
}

function restore(row: MissionRow): Mission {
  return Mission.restore({ ...fromJson<MissionSnapshot>(row.snapshot), version: row.version });
}

import type { WaveTimer } from '../../application/ports';
import { MissionId } from '../../domain/ids';
import type { SqlDatabase } from './sql';

export type WaveExpiry = { readonly missionId: MissionId; readonly wave: number; readonly at: Date };

type TimerRow = { mission_id: string; wave: number; due_at: Date | string };

/**
 * Wave deadlines kept in the database, so a restart does not leave a mission waiting forever.
 * The composition root polls `fireDue`; a timer is only deleted once its handler succeeded,
 * and ExpireWave ignores stale waves, so firing twice is harmless.
 */
export class PostgresWaveTimer implements WaveTimer {
  constructor(private readonly db: SqlDatabase) {}

  async schedule({ missionId, wave, at }: WaveExpiry): Promise<void> {
    await this.db.query(
      `insert into dispatch.wave_timers (mission_id, wave, due_at) values ($1, $2, $3)
       on conflict (mission_id, wave) do nothing`,
      [missionId, wave, at],
    );
  }

  /**
   * Runs `fire` for every timer due at `now`, oldest first, and returns how many succeeded.
   * A failing timer is reported to `onError` and kept for the next poll; the others still run.
   */
  async fireDue(
    now: Date,
    fire: (expiry: WaveExpiry) => Promise<void>,
    onError: (expiry: WaveExpiry, error: unknown) => void = () => {},
  ): Promise<number> {
    const { rows } = await this.db.query<TimerRow>(
      'select mission_id, wave, due_at from dispatch.wave_timers where due_at <= $1 order by due_at, mission_id',
      [now],
    );
    let fired = 0;
    for (const row of rows) {
      const expiry = { missionId: MissionId(row.mission_id), wave: row.wave, at: new Date(row.due_at) };
      try {
        await fire(expiry);
      } catch (error) {
        onError(expiry, error);
        continue;
      }
      await this.db.query('delete from dispatch.wave_timers where mission_id = $1 and wave = $2', [
        row.mission_id,
        row.wave,
      ]);
      fired++;
    }
    return fired;
  }
}

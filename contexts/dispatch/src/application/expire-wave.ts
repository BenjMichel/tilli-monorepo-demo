import type { MissionId } from '../domain/ids';
import type { MissionRepository } from '../domain/mission-repository';
import type { Clock } from './clock';
import { retryOnConflict } from './retry-on-conflict';

export type ExpireWaveCommand = {
  readonly missionId: MissionId;
  readonly wave: number;
};

/**
 * Fired by the wave timer. A wave entirely declined lets the next one start early, so
 * the timer of an older wave can fire while a newer wave is running: it is ignored.
 */
export class ExpireWave {
  constructor(
    private readonly missions: MissionRepository,
    private readonly clock: Clock,
    private readonly maxAttempts = 3,
  ) {}

  execute(command: ExpireWaveCommand): Promise<'expired' | 'stale'> {
    return retryOnConflict(this.maxAttempts, async () => {
      const mission = await this.missions.get(command.missionId);
      if (mission.waveCount !== command.wave) return 'stale' as const;

      mission.expireWave(this.clock.now());
      await this.missions.save(mission);
      return 'expired' as const;
    });
  }
}

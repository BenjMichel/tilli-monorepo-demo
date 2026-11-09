import type { CandidateRepository } from '../domain/candidate-repository';
import type { CandidateSelectionPolicy } from '../domain/candidate-selection-policy';
import type { MissionId } from '../domain/ids';
import type { MissionRepository } from '../domain/mission-repository';
import type { Clock } from './clock';
import { retryOnConflict } from './retry-on-conflict';

export type LaunchNextWaveCommand = {
  readonly missionId: MissionId;
};

export type LaunchNextWaveResult =
  | { readonly outcome: 'launched'; readonly wave: number; readonly candidateCount: number }
  | { readonly outcome: 'unstaffed' }
  | { readonly outcome: 'not-needed' };

/**
 * Triggered when a mission opens, when a wave expires and when a whole wave declined.
 * Safe to call twice: once offers are pending or the mission is settled, it does nothing.
 */
export class LaunchNextWave {
  constructor(
    private readonly missions: MissionRepository,
    private readonly candidates: CandidateRepository,
    private readonly policy: CandidateSelectionPolicy,
    private readonly clock: Clock,
    private readonly waveDurationMs: number,
    private readonly maxAttempts = 3,
  ) {}

  execute(command: LaunchNextWaveCommand): Promise<LaunchNextWaveResult> {
    return retryOnConflict(this.maxAttempts, async (): Promise<LaunchNextWaveResult> => {
      const mission = await this.missions.get(command.missionId);
      if (!mission.needsNextWave) return { outcome: 'not-needed' };

      const wave = mission.waveCount + 1;
      const selected = this.policy.selectWave({
        requirements: mission.requirements,
        candidates: await this.candidates.findActive(),
        alreadySolicited: mission.solicitedCandidateIds,
        wave,
      });

      const now = this.clock.now();
      let result: LaunchNextWaveResult;
      if (selected.length === 0) {
        mission.declareUnstaffed();
        result = { outcome: 'unstaffed' };
      } else {
        mission.launchWave(selected, new Date(now.getTime() + this.waveDurationMs), now);
        result = { outcome: 'launched', wave, candidateCount: selected.length };
      }
      await this.missions.save(mission);
      return result;
    });
  }
}

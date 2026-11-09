import type { CandidateId, MissionId } from '../domain/ids';
import type { MissionRepository } from '../domain/mission-repository';
import type { Clock } from './clock';
import { retryOnConflict } from './retry-on-conflict';

export type AcceptOfferCommand = {
  readonly missionId: MissionId;
  readonly candidateId: CandidateId;
};

/**
 * A tailor accepts an offer. When two acceptances race, the repository rejects the
 * second save; we reload and let the aggregate answer with the up-to-date state.
 */
export class AcceptOffer {
  constructor(
    private readonly missions: MissionRepository,
    private readonly clock: Clock,
    private readonly maxAttempts = 3,
  ) {}

  execute(command: AcceptOfferCommand): Promise<void> {
    return retryOnConflict(this.maxAttempts, async () => {
      const mission = await this.missions.get(command.missionId);
      mission.accept(command.candidateId, this.clock.now());
      await this.missions.save(mission);
    });
  }
}

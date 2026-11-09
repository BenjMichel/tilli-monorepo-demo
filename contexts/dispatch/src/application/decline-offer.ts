import type { CandidateId, MissionId } from '../domain/ids';
import type { MissionRepository } from '../domain/mission-repository';
import { retryOnConflict } from './retry-on-conflict';

export type DeclineOfferCommand = {
  readonly missionId: MissionId;
  readonly candidateId: CandidateId;
};

export class DeclineOffer {
  constructor(
    private readonly missions: MissionRepository,
    private readonly maxAttempts = 3,
  ) {}

  execute(command: DeclineOfferCommand): Promise<void> {
    return retryOnConflict(this.maxAttempts, async () => {
      const mission = await this.missions.get(command.missionId);
      mission.decline(command.candidateId);
      await this.missions.save(mission);
    });
  }
}

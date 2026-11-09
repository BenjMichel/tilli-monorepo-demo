import type { CandidateId, MissionId } from '../domain/ids';
import { MissionConcurrencyConflict, type MissionRepository } from '../domain/mission-repository';
import type { Clock } from './clock';

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

  async execute(command: AcceptOfferCommand): Promise<void> {
    for (let attempt = 1; ; attempt++) {
      const mission = await this.missions.get(command.missionId);
      mission.accept(command.candidateId, this.clock.now());
      try {
        await this.missions.save(mission);
        return;
      } catch (error) {
        if (error instanceof MissionConcurrencyConflict && attempt < this.maxAttempts) continue;
        throw error;
      }
    }
  }
}

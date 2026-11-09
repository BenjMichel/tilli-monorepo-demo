import type { CandidateSelectionPolicy } from '../domain/candidate-selection-policy';
import { missionIdForOrder, type OrderId } from '../domain/ids';
import { Mission } from '../domain/mission';
import type { MissionRepository } from '../domain/mission-repository';
import type { MissionRequirements } from '../domain/mission-requirements';

export type OpenMissionCommand = {
  readonly orderId: OrderId;
  readonly requirements: MissionRequirements;
};

export class OpenMission {
  constructor(
    private readonly missions: MissionRepository,
    private readonly policy: CandidateSelectionPolicy,
  ) {}

  async execute(command: OpenMissionCommand): Promise<'opened' | 'already-open'> {
    const id = missionIdForOrder(command.orderId);
    if (await this.missions.exists(id)) return 'already-open';

    const mission = Mission.open({
      id,
      orderId: command.orderId,
      requirements: command.requirements,
      maxWaves: this.policy.maxWaves,
    });
    await this.missions.save(mission);
    return 'opened';
  }
}

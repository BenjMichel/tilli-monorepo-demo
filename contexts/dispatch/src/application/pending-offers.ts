import type { CandidateId, MissionId } from '../domain/ids';
import type { MissionRepository } from '../domain/mission-repository';
import type { Fabric, GarmentType } from '../domain/mission-requirements';
import type { TimeSlot } from '../domain/time-slot';

/** What a tailor sees before accepting: the district, never the customer. */
export type PendingOfferView = {
  readonly missionId: MissionId;
  readonly postalCode: string;
  readonly slots: readonly TimeSlot[];
  readonly garmentTypes: readonly GarmentType[];
  readonly fabrics: readonly Fabric[];
  readonly expiresAt: Date | null;
};

/** "Propositions en attente" in the tailor app. */
export class PendingOffers {
  constructor(private readonly missions: MissionRepository) {}

  async list(candidateId: CandidateId): Promise<PendingOfferView[]> {
    const missions = await this.missions.findWithPendingOfferFor(candidateId);
    return missions.map((mission) => ({
      missionId: mission.id,
      postalCode: mission.requirements.area.postalCode,
      slots: mission.requirements.slots,
      garmentTypes: mission.requirements.garmentTypes,
      fabrics: mission.requirements.fabrics,
      expiresAt: mission.currentWaveDeadline,
    }));
  }
}

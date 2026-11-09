import type { CandidateId, MissionId } from './ids';
import type { Mission } from './mission';

export interface MissionRepository {
  /** Throws MissionNotFound when no mission has this id. */
  get(id: MissionId): Promise<Mission>;

  exists(id: MissionId): Promise<boolean>;

  /** Missions where this candidate has an offer still waiting for an answer. */
  findWithPendingOfferFor(candidateId: CandidateId): Promise<Mission[]>;

  /**
   * Persists the mission together with its pending events (outbox).
   * Throws MissionConcurrencyConflict when the stored version moved since the mission was loaded.
   */
  save(mission: Mission): Promise<void>;
}

export class MissionNotFound extends Error {
  constructor(id: MissionId) {
    super(`Mission ${id} not found`);
    this.name = 'MissionNotFound';
  }
}

export class MissionConcurrencyConflict extends Error {
  constructor(id: MissionId, expectedVersion: number, actualVersion: number) {
    super(`Mission ${id} was modified concurrently (expected v${expectedVersion}, found v${actualVersion})`);
    this.name = 'MissionConcurrencyConflict';
  }
}

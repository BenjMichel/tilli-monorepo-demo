import type { InterventionId, TailorId } from './ids';
import type { Intervention } from './intervention';

export interface InterventionRepository {
  /** Throws InterventionNotFound when no intervention has this id. */
  get(id: InterventionId): Promise<Intervention>;

  exists(id: InterventionId): Promise<boolean>;

  /** "Mes interventions" in the tailor app. */
  findByTailor(tailorId: TailorId): Promise<Intervention[]>;

  /**
   * Persists the intervention together with its pending events (outbox).
   * Throws InterventionConcurrencyConflict when the stored version moved since it was loaded.
   */
  save(intervention: Intervention): Promise<void>;
}

export class InterventionNotFound extends Error {
  constructor(id: InterventionId) {
    super(`Intervention ${id} not found`);
    this.name = 'InterventionNotFound';
  }
}

export class InterventionConcurrencyConflict extends Error {
  constructor(id: InterventionId, expectedVersion: number, actualVersion: number) {
    super(`Intervention ${id} was modified concurrently (expected v${expectedVersion}, found v${actualVersion})`);
    this.name = 'InterventionConcurrencyConflict';
  }
}

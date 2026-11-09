import type { Clock } from '../application/clock';
import type { MissionOutbox, OutboxEntry } from '../application/ports';
import type { CandidateId, MissionId } from '../domain/ids';
import { Mission, type MissionSnapshot } from '../domain/mission';
import { MissionConcurrencyConflict, MissionNotFound, type MissionRepository } from '../domain/mission-repository';

const systemClock: Clock = { now: () => new Date() };

/**
 * Stores snapshots, never live instances, so concurrent use cases each work on their own copy.
 * Saving writes the mission and its events together, as a database transaction with an outbox table would.
 */
export class InMemoryMissionRepository implements MissionRepository, MissionOutbox {
  private readonly snapshots = new Map<MissionId, MissionSnapshot>();
  private readonly processed = new Set<string>();
  readonly outbox: OutboxEntry[] = [];

  constructor(private readonly clock: Clock = systemClock) {}

  async get(id: MissionId): Promise<Mission> {
    const snapshot = this.snapshots.get(id);
    if (!snapshot) throw new MissionNotFound(id);
    return Mission.restore(snapshot);
  }

  async exists(id: MissionId): Promise<boolean> {
    return this.snapshots.has(id);
  }

  async findWithPendingOfferFor(candidateId: CandidateId): Promise<Mission[]> {
    return [...this.snapshots.values()]
      .filter((snapshot) =>
        snapshot.offers.some((offer) => offer.candidateId === candidateId && offer.status === 'pending'),
      )
      .map((snapshot) => Mission.restore(snapshot));
  }

  async save(mission: Mission): Promise<void> {
    const storedVersion = this.snapshots.get(mission.id)?.version ?? 0;
    if (storedVersion !== mission.version) {
      throw new MissionConcurrencyConflict(mission.id, mission.version, storedVersion);
    }
    const version = mission.version + 1;
    this.snapshots.set(mission.id, { ...mission.toSnapshot(), version });
    const occurredAt = this.clock.now();
    this.outbox.push(
      ...mission.pullEvents().map((event, index) => ({ id: `${mission.id}:v${version}:${index}`, occurredAt, event })),
    );
  }

  async pending(): Promise<OutboxEntry[]> {
    return this.outbox.filter((entry) => !this.processed.has(entry.id));
  }

  async markProcessed(id: string): Promise<void> {
    this.processed.add(id);
  }
}

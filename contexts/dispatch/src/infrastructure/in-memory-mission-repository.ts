import type { MissionId } from '../domain/ids';
import { Mission, type MissionSnapshot } from '../domain/mission';
import type { MissionEvent } from '../domain/mission-events';
import {
  MissionConcurrencyConflict,
  MissionNotFound,
  type MissionRepository,
} from '../domain/mission-repository';

/** Stores snapshots, never live instances, so concurrent use cases each work on their own copy. */
export class InMemoryMissionRepository implements MissionRepository {
  private readonly snapshots = new Map<MissionId, MissionSnapshot>();
  readonly outbox: MissionEvent[] = [];

  async get(id: MissionId): Promise<Mission> {
    const snapshot = this.snapshots.get(id);
    if (!snapshot) throw new MissionNotFound(id);
    return Mission.restore(snapshot);
  }

  async save(mission: Mission): Promise<void> {
    const storedVersion = this.snapshots.get(mission.id)?.version ?? 0;
    if (storedVersion !== mission.version) {
      throw new MissionConcurrencyConflict(mission.id, mission.version, storedVersion);
    }
    this.snapshots.set(mission.id, { ...mission.toSnapshot(), version: mission.version + 1 });
    this.outbox.push(...mission.pullEvents());
  }
}

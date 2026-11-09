import { type OrderId, missionIdForOrder } from '../domain/ids';
import type { MissionRepository } from '../domain/mission-repository';
import { retryOnConflict } from './retry-on-conflict';

export class CloseMission {
  constructor(
    private readonly missions: MissionRepository,
    private readonly maxAttempts = 3,
  ) {}

  /** An order cancelled before its mission was opened leaves nothing to close. */
  async execute(command: { orderId: OrderId }): Promise<'closed' | 'unknown'> {
    const id = missionIdForOrder(command.orderId);
    if (!(await this.missions.exists(id))) return 'unknown';

    return retryOnConflict(this.maxAttempts, async () => {
      const mission = await this.missions.get(id);
      mission.close();
      await this.missions.save(mission);
      return 'closed' as const;
    });
  }
}

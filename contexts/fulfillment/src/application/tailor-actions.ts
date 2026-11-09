import type { InterventionId, TailorId } from '../domain/ids';
import type { Intervention } from '../domain/intervention';
import type { TimeSlot } from '../domain/intervention-draft';
import type { InterventionRepository } from '../domain/intervention-repository';
import type { Clock } from './ports';
import { retryOnConflict } from './retry-on-conflict';

type TailorCommand = { readonly interventionId: InterventionId; readonly tailorId: TailorId };

/** What a tailor does from the app once the mission is theirs. */
export class TailorActions {
  constructor(
    private readonly interventions: InterventionRepository,
    private readonly clock: Clock,
    private readonly maxAttempts = 3,
  ) {}

  confirmAppointment(command: TailorCommand & { readonly slot: TimeSlot }): Promise<void> {
    return this.apply(command.interventionId, (intervention) =>
      intervention.confirmAppointment(command.tailorId, command.slot),
    );
  }

  start(command: TailorCommand): Promise<void> {
    return this.apply(command.interventionId, (intervention) => intervention.start(command.tailorId, this.clock.now()));
  }

  complete(command: TailorCommand): Promise<void> {
    return this.apply(command.interventionId, (intervention) =>
      intervention.complete(command.tailorId, this.clock.now()),
    );
  }

  private apply(id: InterventionId, change: (intervention: Intervention) => void): Promise<void> {
    return retryOnConflict(this.maxAttempts, async () => {
      const intervention = await this.interventions.get(id);
      change(intervention);
      await this.interventions.save(intervention);
    });
  }
}

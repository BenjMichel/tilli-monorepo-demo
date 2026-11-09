import type { InterventionId, TailorId } from './ids';
import type { InterventionStatus } from './intervention-status';

export abstract class FulfillmentError extends Error {
  abstract readonly code: string;

  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class NotAssignedTailor extends FulfillmentError {
  readonly code = 'NOT_ASSIGNED_TAILOR';

  constructor(interventionId: InterventionId, tailorId: TailorId) {
    super(`Tailor ${tailorId} is not assigned to intervention ${interventionId}`);
  }
}

export class InvalidTransition extends FulfillmentError {
  readonly code = 'INVALID_TRANSITION';

  constructor(action: string, status: InterventionStatus) {
    super(`Cannot ${action} an intervention that is ${status}`);
  }
}

export class TooEarlyToStart extends FulfillmentError {
  readonly code = 'TOO_EARLY_TO_START';

  constructor(appointmentStart: Date) {
    super(`The intervention cannot start before its appointment (${appointmentStart.toISOString()})`);
  }
}

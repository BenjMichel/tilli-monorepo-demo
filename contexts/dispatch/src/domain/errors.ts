import type { CandidateId, MissionId } from './ids';
import type { MissionStatus, OfferStatus } from './mission-status';

export abstract class DispatchError extends Error {
  abstract readonly code: string;

  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class MissionAlreadyAwarded extends DispatchError {
  readonly code = 'MISSION_ALREADY_AWARDED';

  constructor(missionId: MissionId) {
    super(`Mission ${missionId} is already awarded`);
  }
}

export class MissionNotOffering extends DispatchError {
  readonly code = 'MISSION_NOT_OFFERING';

  constructor(missionId: MissionId, status: MissionStatus) {
    super(`Mission ${missionId} is ${status}, not offering`);
  }
}

export class OfferNotFound extends DispatchError {
  readonly code = 'OFFER_NOT_FOUND';

  constructor(missionId: MissionId, candidateId: CandidateId) {
    super(`Candidate ${candidateId} has no offer for mission ${missionId}`);
  }
}

export class OfferNotPending extends DispatchError {
  readonly code = 'OFFER_NOT_PENDING';

  constructor(candidateId: CandidateId, status: OfferStatus) {
    super(`Offer to candidate ${candidateId} is ${status}`);
  }
}

export class OfferExpired extends DispatchError {
  readonly code = 'OFFER_EXPIRED';

  constructor(candidateId: CandidateId) {
    super(`Offer to candidate ${candidateId} has expired`);
  }
}

export class WaveStillActive extends DispatchError {
  readonly code = 'WAVE_STILL_ACTIVE';

  constructor(missionId: MissionId) {
    super(`Mission ${missionId} still has pending offers`);
  }
}

export class WaveNotYetExpired extends DispatchError {
  readonly code = 'WAVE_NOT_YET_EXPIRED';

  constructor(missionId: MissionId) {
    super(`Current wave of mission ${missionId} has not reached its deadline`);
  }
}

export class InvalidAppointment extends DispatchError {
  readonly code = 'INVALID_APPOINTMENT';
}

export class InvalidWave extends DispatchError {
  readonly code = 'INVALID_WAVE';
}

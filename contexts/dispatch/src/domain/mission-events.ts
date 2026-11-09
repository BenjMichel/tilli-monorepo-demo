import type { CandidateId, MissionId, OrderId } from './ids';
import type { TimeSlot } from './time-slot';

export type MissionOpened = {
  readonly type: 'MissionOpened';
  readonly missionId: MissionId;
  readonly orderId: OrderId;
};

export type OfferWaveLaunched = {
  readonly type: 'OfferWaveLaunched';
  readonly missionId: MissionId;
  readonly wave: number;
  readonly candidateIds: readonly CandidateId[];
  readonly expiresAt: Date;
};

export type OfferDeclined = {
  readonly type: 'OfferDeclined';
  readonly missionId: MissionId;
  readonly candidateId: CandidateId;
};

export type OfferWaveExpired = {
  readonly type: 'OfferWaveExpired';
  readonly missionId: MissionId;
  readonly wave: number;
  readonly expiredCandidateIds: readonly CandidateId[];
};

export type MissionAwarded = {
  readonly type: 'MissionAwarded';
  readonly missionId: MissionId;
  readonly orderId: OrderId;
  readonly candidateId: CandidateId;
  readonly appointment: TimeSlot;
  readonly withdrawnCandidateIds: readonly CandidateId[];
};

export type MissionUnstaffed = {
  readonly type: 'MissionUnstaffed';
  readonly missionId: MissionId;
  readonly orderId: OrderId;
  readonly waves: number;
};

export type MissionClosed = {
  readonly type: 'MissionClosed';
  readonly missionId: MissionId;
  readonly withdrawnCandidateIds: readonly CandidateId[];
};

export type MissionEvent =
  | MissionOpened
  | OfferWaveLaunched
  | OfferDeclined
  | OfferWaveExpired
  | MissionAwarded
  | MissionUnstaffed
  | MissionClosed;

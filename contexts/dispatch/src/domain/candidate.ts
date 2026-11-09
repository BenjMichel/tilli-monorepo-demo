import type { GeoPoint } from './geo-point';
import type { CandidateId } from './ids';
import type { Fabric, GarmentType } from './mission-requirements';
import type { TimeSlot } from './time-slot';

/** A tailor seen from the dispatch point of view: only what helps decide who gets an offer. */
export type Candidate = {
  readonly id: CandidateId;
  readonly base: GeoPoint;
  readonly radiusKm: number;
  readonly garmentTypes: readonly GarmentType[];
  readonly fabrics: readonly Fabric[];
  readonly availabilities: readonly TimeSlot[];
  /** Missions awarded over the recent period, used to spread work fairly. */
  readonly recentAwards: number;
};

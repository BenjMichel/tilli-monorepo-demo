import type { Candidate } from '../src/domain/candidate';
import type { GeoPoint } from '../src/domain/geo-point';
import { CandidateId } from '../src/domain/ids';
import { MissionRequirements } from '../src/domain/mission-requirements';
import { TimeSlot } from '../src/domain/time-slot';

export const PARIS_11: GeoPoint = { latitude: 48.859, longitude: 2.38 };
export const PARIS_15: GeoPoint = { latitude: 48.8417, longitude: 2.2999 }; // ~6 km from PARIS_11
export const VERSAILLES: GeoPoint = { latitude: 48.8049, longitude: 2.1204 }; // ~20 km from PARIS_11

export const MONDAY_MORNING = TimeSlot(new Date('2026-11-16T09:00:00Z'), new Date('2026-11-16T11:00:00Z'));
export const MONDAY_EVENING = TimeSlot(new Date('2026-11-16T18:00:00Z'), new Date('2026-11-16T20:00:00Z'));
export const MONDAY_ALL_DAY = TimeSlot(new Date('2026-11-16T08:00:00Z'), new Date('2026-11-16T21:00:00Z'));

export function someRequirements(overrides: Partial<MissionRequirements> = {}): MissionRequirements {
  return MissionRequirements({
    area: { postalCode: '75011', location: PARIS_11 },
    slots: [MONDAY_MORNING, MONDAY_EVENING],
    garmentTypes: ['pants'],
    fabrics: ['basic'],
    ...overrides,
  });
}

export function aCandidate(id: string, overrides: Partial<Omit<Candidate, 'id'>> = {}): Candidate {
  return {
    id: CandidateId(id),
    base: PARIS_11,
    radiusKm: 10,
    garmentTypes: ['pants', 'dress'],
    fabrics: ['basic', 'dressy'],
    availabilities: [MONDAY_ALL_DAY],
    recentAwards: 0,
    ...overrides,
  };
}

import type { Candidate } from './candidate';
import { distanceKm } from './geo-point';
import type { CandidateId } from './ids';
import type { MissionRequirements } from './mission-requirements';
import { isWithin } from './time-slot';

export type WaveRequest = {
  readonly requirements: MissionRequirements;
  readonly candidates: readonly Candidate[];
  readonly alreadySolicited: ReadonlySet<CandidateId>;
  /** 1-based number of the wave about to be launched. */
  readonly wave: number;
};

type ScoredCandidate = {
  readonly id: CandidateId;
  readonly matchingSlots: number;
  readonly distanceKm: number;
  readonly recentAwards: number;
};

/**
 * Domain service of the core domain: decides who receives the next wave of offers.
 * 1. filter: in range, skilled for every garment and fabric, available on a slot, not yet solicited
 * 2. rank: more matching slots, then closer, then fewer recent awards (fairness), then id (determinism)
 * 3. size: the wave number picks the size, waves widening as they go
 */
export class CandidateSelectionPolicy {
  constructor(private readonly waveSizes: readonly number[]) {
    if (waveSizes.length === 0 || waveSizes.some((size) => !(size >= 1))) {
      throw new RangeError('Wave sizes must be a non-empty list of sizes >= 1 (Infinity allowed)');
    }
  }

  /** The policy decides how many waves a mission gets before it is declared unstaffed. */
  get maxWaves(): number {
    return this.waveSizes.length;
  }

  selectWave(request: WaveRequest): CandidateId[] {
    const size = this.waveSizes[Math.min(request.wave, this.waveSizes.length) - 1] ?? 0;
    return request.candidates
      .filter((candidate) => !request.alreadySolicited.has(candidate.id))
      .map((candidate) => score(candidate, request.requirements))
      .filter((scored): scored is ScoredCandidate => scored !== null)
      .sort(byRank)
      .slice(0, size)
      .map((scored) => scored.id);
  }
}

function score(candidate: Candidate, requirements: MissionRequirements): ScoredCandidate | null {
  const distance = distanceKm(candidate.base, requirements.area.location);
  if (distance > candidate.radiusKm) return null;

  const hasSkills =
    requirements.garmentTypes.every((garment) => candidate.garmentTypes.includes(garment)) &&
    requirements.fabrics.every((fabric) => candidate.fabrics.includes(fabric));
  if (!hasSkills) return null;

  const matchingSlots = requirements.slots.filter((slot) =>
    candidate.availabilities.some((availability) => isWithin(slot, availability)),
  ).length;
  if (matchingSlots === 0) return null;

  return { id: candidate.id, matchingSlots, distanceKm: distance, recentAwards: candidate.recentAwards };
}

function byRank(a: ScoredCandidate, b: ScoredCandidate): number {
  return (
    b.matchingSlots - a.matchingSlots ||
    a.distanceKm - b.distanceKm ||
    a.recentAwards - b.recentAwards ||
    a.id.localeCompare(b.id)
  );
}

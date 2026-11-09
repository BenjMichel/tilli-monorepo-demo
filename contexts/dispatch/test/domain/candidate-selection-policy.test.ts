import { describe, expect, it } from 'vitest';
import type { Candidate } from '../../src/domain/candidate';
import { CandidateSelectionPolicy, type WaveRequest } from '../../src/domain/candidate-selection-policy';
import { CandidateId } from '../../src/domain/ids';
import { TimeSlot } from '../../src/domain/time-slot';
import { aCandidate, MONDAY_EVENING, MONDAY_MORNING, PARIS_15, someRequirements, VERSAILLES } from '../fixtures';

const policy = new CandidateSelectionPolicy([3, 5, Infinity]);

function request(candidates: Candidate[], overrides: Partial<WaveRequest> = {}): WaveRequest {
  return { requirements: someRequirements(), candidates, alreadySolicited: new Set(), wave: 1, ...overrides };
}

const ids = (...values: string[]) => values.map(CandidateId);

describe('CandidateSelectionPolicy', () => {
  describe('eligibility', () => {
    it('keeps only candidates whose radius covers the mission area', () => {
      const selected = policy.selectWave(
        request([
          aCandidate('versailles-short-radius', { base: VERSAILLES, radiusKm: 10 }),
          aCandidate('versailles-long-radius', { base: VERSAILLES, radiusKm: 25 }),
        ]),
      );

      expect(selected).toEqual(ids('versailles-long-radius'));
    });

    it('requires every garment type and every fabric of the mission', () => {
      const selected = policy.selectWave(
        request(
          [
            aCandidate('pants-only', { garmentTypes: ['pants'], fabrics: ['basic', 'dressy'] }),
            aCandidate('basic-only', { garmentTypes: ['pants', 'coat'], fabrics: ['basic'] }),
            aCandidate('all-round', { garmentTypes: ['pants', 'coat'], fabrics: ['basic', 'dressy'] }),
          ],
          { requirements: someRequirements({ garmentTypes: ['pants', 'coat'], fabrics: ['dressy'] }) },
        ),
      );

      expect(selected).toEqual(ids('all-round'));
    });

    it('requires availability covering at least one of the customer slots', () => {
      const selected = policy.selectWave(
        request([
          aCandidate('available-morning', { availabilities: [MONDAY_MORNING] }),
          aCandidate('only-part-of-the-morning', {
            availabilities: [TimeSlot(new Date('2026-11-16T09:00:00Z'), new Date('2026-11-16T10:00:00Z'))],
          }),
          aCandidate('unavailable', { availabilities: [] }),
        ]),
      );

      expect(selected).toEqual(ids('available-morning'));
    });

    it('never selects a candidate already solicited for the mission', () => {
      const selected = policy.selectWave(
        request([aCandidate('alice'), aCandidate('bob')], { alreadySolicited: new Set(ids('alice')) }),
      );

      expect(selected).toEqual(ids('bob'));
    });
  });

  describe('ranking', () => {
    it('prefers candidates available on more of the customer slots', () => {
      const selected = policy.selectWave(
        request([
          aCandidate('morning-only', { availabilities: [MONDAY_MORNING] }),
          aCandidate('morning-and-evening', { availabilities: [MONDAY_MORNING, MONDAY_EVENING], base: PARIS_15 }),
        ]),
      );

      expect(selected).toEqual(ids('morning-and-evening', 'morning-only'));
    });

    it('then prefers the closest candidates', () => {
      const selected = policy.selectWave(request([aCandidate('paris-15', { base: PARIS_15 }), aCandidate('paris-11')]));

      expect(selected).toEqual(ids('paris-11', 'paris-15'));
    });

    it('then spreads the work towards candidates with fewer recent missions', () => {
      const selected = policy.selectWave(
        request([aCandidate('busy', { recentAwards: 8 }), aCandidate('quiet', { recentAwards: 1 })]),
      );

      expect(selected).toEqual(ids('quiet', 'busy'));
    });

    it('breaks remaining ties by id so that a wave is reproducible', () => {
      const selected = policy.selectWave(request([aCandidate('bob'), aCandidate('alice')]));

      expect(selected).toEqual(ids('alice', 'bob'));
    });
  });

  describe('wave size', () => {
    const tenCandidates = Array.from({ length: 10 }, (_, index) => aCandidate(`c${index}`, { recentAwards: index }));

    it('widens the circle wave after wave', () => {
      expect(policy.selectWave(request(tenCandidates, { wave: 1 }))).toHaveLength(3);
      expect(policy.selectWave(request(tenCandidates, { wave: 2 }))).toHaveLength(5);
      expect(policy.selectWave(request(tenCandidates, { wave: 3 }))).toHaveLength(10);
    });

    it('offers the best-ranked candidates first', () => {
      expect(policy.selectWave(request(tenCandidates))).toEqual(ids('c0', 'c1', 'c2'));
    });

    it('returns no one when no candidate is eligible', () => {
      expect(policy.selectWave(request([aCandidate('far', { base: VERSAILLES })]))).toEqual([]);
    });

    it('gives a mission as many waves as configured sizes', () => {
      expect(policy.maxWaves).toBe(3);
      expect(() => new CandidateSelectionPolicy([])).toThrow(RangeError);
      expect(() => new CandidateSelectionPolicy([3, 0])).toThrow(RangeError);
    });
  });
});

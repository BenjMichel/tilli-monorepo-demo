import { describe, expect, it } from 'vitest';
import {
  InvalidWave,
  MissionAlreadyAwarded,
  MissionNotOffering,
  OfferExpired,
  OfferNotFound,
  OfferNotPending,
  WaveNotYetExpired,
  WaveStillActive,
} from '../../src/domain/errors';
import { CandidateId, MissionId, OrderId } from '../../src/domain/ids';
import { Mission } from '../../src/domain/mission';
import { someRequirements } from '../fixtures';

const T0 = new Date('2026-11-02T09:00:00Z');
const minutesAfterT0 = (minutes: number) => new Date(T0.getTime() + minutes * 60_000);
const DEADLINE = minutesAfterT0(30);

const alice = CandidateId('alice');
const bob = CandidateId('bob');
const carol = CandidateId('carol');
const dave = CandidateId('dave');

function anOpenMission(maxWaves = 3): Mission {
  const mission = Mission.open({ id: MissionId('m-1'), orderId: OrderId('o-1'), requirements: someRequirements(), maxWaves });
  mission.pullEvents();
  return mission;
}

function aMissionOfferedTo(candidates: CandidateId[], maxWaves = 3): Mission {
  const mission = anOpenMission(maxWaves);
  mission.launchWave(candidates, DEADLINE, T0);
  mission.pullEvents();
  return mission;
}

const statusOf = (mission: Mission, candidateId: CandidateId) =>
  mission.offers.find((offer) => offer.candidateId === candidateId)?.status;

describe('Mission', () => {
  describe('opening', () => {
    it('starts open, without any offer', () => {
      const mission = Mission.open({ id: MissionId('m-1'), orderId: OrderId('o-1'), requirements: someRequirements(), maxWaves: 3 });

      expect(mission.status).toBe('open');
      expect(mission.offers).toEqual([]);
      expect(mission.pullEvents()).toEqual([{ type: 'MissionOpened', missionId: 'm-1', orderId: 'o-1' }]);
    });

    it('requires at least one wave', () => {
      expect(() => Mission.open({ id: MissionId('m-1'), orderId: OrderId('o-1'), requirements: someRequirements(), maxWaves: 0 })).toThrow(RangeError);
    });
  });

  describe('launching a wave', () => {
    it('sends an offer to every candidate of the wave at once', () => {
      const mission = anOpenMission();

      mission.launchWave([alice, bob, carol], DEADLINE, T0);

      expect(mission.status).toBe('offering');
      expect(mission.offers.map((offer) => [offer.candidateId, offer.status])).toEqual([
        [alice, 'pending'],
        [bob, 'pending'],
        [carol, 'pending'],
      ]);
      expect(mission.pullEvents()).toEqual([
        { type: 'OfferWaveLaunched', missionId: 'm-1', wave: 1, candidateIds: [alice, bob, carol], expiresAt: DEADLINE },
      ]);
    });

    it('refuses a new wave while offers are still pending', () => {
      const mission = aMissionOfferedTo([alice]);

      expect(() => mission.launchWave([bob], DEADLINE, T0)).toThrow(WaveStillActive);
    });

    it('never solicits the same candidate twice for a mission', () => {
      const mission = aMissionOfferedTo([alice]);
      mission.decline(alice);

      expect(() => mission.launchWave([alice, bob], DEADLINE, T0)).toThrow(InvalidWave);
      expect(() => anOpenMission().launchWave([bob, bob], DEADLINE, T0)).toThrow(InvalidWave);
    });

    it('rejects an empty wave and a deadline in the past', () => {
      expect(() => anOpenMission().launchWave([], DEADLINE, T0)).toThrow(InvalidWave);
      expect(() => anOpenMission().launchWave([alice], T0, T0)).toThrow(InvalidWave);
    });

    it('stops after the maximum number of waves', () => {
      const mission = aMissionOfferedTo([alice], 2);
      mission.decline(alice);
      mission.launchWave([bob], DEADLINE, T0);
      mission.decline(bob);

      expect(mission.status).toBe('unstaffed');
      expect(mission.needsNextWave).toBe(false);
      expect(() => mission.launchWave([carol], DEADLINE, T0)).toThrow(MissionNotOffering);
    });
  });

  describe('accepting an offer', () => {
    it('awards the mission to the first candidate who accepts and withdraws the other offers', () => {
      const mission = aMissionOfferedTo([alice, bob, carol]);

      mission.accept(bob, minutesAfterT0(5));

      expect(mission.status).toBe('awarded');
      expect(mission.awardedTo).toBe(bob);
      expect(statusOf(mission, alice)).toBe('withdrawn');
      expect(statusOf(mission, bob)).toBe('accepted');
      expect(statusOf(mission, carol)).toBe('withdrawn');
      expect(mission.pullEvents()).toEqual([
        { type: 'MissionAwarded', missionId: 'm-1', orderId: 'o-1', candidateId: bob, withdrawnCandidateIds: [alice, carol] },
      ]);
    });

    it('turns down a second acceptance: the mission is already awarded', () => {
      const mission = aMissionOfferedTo([alice, bob]);
      mission.accept(alice, minutesAfterT0(5));

      expect(() => mission.accept(bob, minutesAfterT0(5))).toThrow(MissionAlreadyAwarded);
      expect(mission.awardedTo).toBe(alice);
    });

    it('treats a repeated acceptance from the winner as a no-op', () => {
      const mission = aMissionOfferedTo([alice, bob]);
      mission.accept(alice, minutesAfterT0(5));
      mission.pullEvents();

      mission.accept(alice, minutesAfterT0(6));

      expect(mission.awardedTo).toBe(alice);
      expect(mission.pullEvents()).toEqual([]);
    });

    it('refuses an acceptance once the wave deadline has passed', () => {
      const mission = aMissionOfferedTo([alice]);

      expect(() => mission.accept(alice, DEADLINE)).toThrow(OfferExpired);
      expect(mission.status).toBe('offering');
    });

    it('refuses a candidate who was not solicited', () => {
      const mission = aMissionOfferedTo([alice]);

      expect(() => mission.accept(dave, minutesAfterT0(5))).toThrow(OfferNotFound);
    });

    it('refuses an offer the candidate already declined', () => {
      const mission = aMissionOfferedTo([alice, bob]);
      mission.decline(alice);

      expect(() => mission.accept(alice, minutesAfterT0(5))).toThrow(OfferNotPending);
    });
  });

  describe('declining an offer', () => {
    it('lets the next wave start early once every candidate of the wave has declined', () => {
      const mission = aMissionOfferedTo([alice, bob]);

      mission.decline(alice);
      mission.decline(bob);

      expect(mission.status).toBe('offering');
      expect(mission.needsNextWave).toBe(true);
      mission.launchWave([carol], minutesAfterT0(60), minutesAfterT0(10));
      expect(statusOf(mission, carol)).toBe('pending');
    });

    it('leaves the mission unstaffed when the last wave is entirely declined', () => {
      const mission = aMissionOfferedTo([alice], 1);

      mission.decline(alice);

      expect(mission.status).toBe('unstaffed');
      expect(mission.pullEvents()).toEqual([
        { type: 'OfferDeclined', missionId: 'm-1', candidateId: alice },
        { type: 'MissionUnstaffed', missionId: 'm-1', orderId: 'o-1', waves: 1 },
      ]);
    });
  });

  describe('expiring a wave', () => {
    it('expires the pending offers so that a wider wave can follow', () => {
      const mission = aMissionOfferedTo([alice, bob]);
      mission.decline(alice);
      mission.pullEvents();

      mission.expireWave(DEADLINE);

      expect(statusOf(mission, alice)).toBe('declined');
      expect(statusOf(mission, bob)).toBe('expired');
      expect(mission.needsNextWave).toBe(true);
      expect(mission.pullEvents()).toEqual([
        { type: 'OfferWaveExpired', missionId: 'm-1', wave: 1, expiredCandidateIds: [bob] },
      ]);
    });

    it('leaves the mission unstaffed after the last wave', () => {
      const mission = aMissionOfferedTo([alice], 1);

      mission.expireWave(DEADLINE);

      expect(mission.status).toBe('unstaffed');
    });

    it('refuses to expire a wave before its deadline', () => {
      const mission = aMissionOfferedTo([alice]);

      expect(() => mission.expireWave(minutesAfterT0(29))).toThrow(WaveNotYetExpired);
    });

    it('ignores a late timer once the mission is awarded', () => {
      const mission = aMissionOfferedTo([alice]);
      mission.accept(alice, minutesAfterT0(5));
      mission.pullEvents();

      mission.expireWave(DEADLINE);

      expect(mission.status).toBe('awarded');
      expect(mission.pullEvents()).toEqual([]);
    });
  });

  describe('declaring the mission unstaffed when nobody is left to solicit', () => {
    it('gives up before the last wave', () => {
      const mission = aMissionOfferedTo([alice], 3);
      mission.decline(alice);
      mission.pullEvents();

      mission.declareUnstaffed();

      expect(mission.status).toBe('unstaffed');
      expect(mission.pullEvents()).toEqual([
        { type: 'MissionUnstaffed', missionId: 'm-1', orderId: 'o-1', waves: 1 },
      ]);
    });

    it('waits for the pending offers of the current wave', () => {
      const mission = aMissionOfferedTo([alice]);

      expect(() => mission.declareUnstaffed()).toThrow(WaveStillActive);
    });
  });

  describe('closing after the order is cancelled', () => {
    it('withdraws the pending offers', () => {
      const mission = aMissionOfferedTo([alice, bob]);

      mission.close();

      expect(mission.status).toBe('closed');
      expect(mission.pullEvents()).toEqual([
        { type: 'MissionClosed', missionId: 'm-1', withdrawnCandidateIds: [alice, bob] },
      ]);
    });

    it('leaves an awarded mission untouched', () => {
      const mission = aMissionOfferedTo([alice]);
      mission.accept(alice, minutesAfterT0(5));
      mission.pullEvents();

      mission.close();

      expect(mission.status).toBe('awarded');
      expect(mission.pullEvents()).toEqual([]);
    });
  });

  describe('snapshots', () => {
    it('restores an independent copy', () => {
      const mission = aMissionOfferedTo([alice, bob]);
      const copy = Mission.restore(mission.toSnapshot());

      copy.accept(alice, minutesAfterT0(5));

      expect(copy.status).toBe('awarded');
      expect(mission.status).toBe('offering');
    });
  });
});

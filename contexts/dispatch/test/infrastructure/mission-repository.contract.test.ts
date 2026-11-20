import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AcceptOffer } from '../../src/application/accept-offer';
import type { MissionOutbox } from '../../src/application/ports';
import { CandidateId, MissionId, OrderId } from '../../src/domain/ids';
import { Mission } from '../../src/domain/mission';
import {
  MissionConcurrencyConflict,
  MissionNotFound,
  type MissionRepository,
} from '../../src/domain/mission-repository';
import { InMemoryMissionRepository } from '../../src/infrastructure/in-memory-mission-repository';
import { DISPATCH_MIGRATIONS } from '../../src/infrastructure/postgres/migrations';
import { PostgresMissionRepository } from '../../src/infrastructure/postgres/postgres-mission-repository';
import { PostgresWaveTimer } from '../../src/infrastructure/postgres/postgres-wave-timer';
import { MONDAY_MORNING, someRequirements } from '../fixtures';

type Repository = MissionRepository & MissionOutbox;

const T0 = new Date('2026-11-09T09:00:00Z');
const DEADLINE = new Date(T0.getTime() + 30 * 60_000);
const clock = { now: () => T0 };
const alice = CandidateId('alice');
const bob = CandidateId('bob');
const carol = CandidateId('carol');

let db: PGlite;
beforeAll(async () => {
  db = await PGlite.create();
  for (const migration of DISPATCH_MIGRATIONS) await db.exec(migration.sql);
});
afterAll(() => db.close());

const implementations: [string, () => Promise<Repository>][] = [
  ['in memory', async () => new InMemoryMissionRepository(clock)],
  [
    'PostgreSQL',
    async () => {
      await db.exec('truncate dispatch.missions, dispatch.outbox, dispatch.wave_timers');
      return new PostgresMissionRepository(db, clock);
    },
  ],
];

function aMissionOfferedTo(id: string, candidates: CandidateId[]): Mission {
  const mission = Mission.open({
    id: MissionId(id),
    orderId: OrderId(id.replace('mission-', '')),
    requirements: someRequirements(),
    maxWaves: 3,
  });
  mission.launchWave(candidates, DEADLINE, T0);
  return mission;
}

describe.each(implementations)('Mission repository (%s)', (_name, aRepository) => {
  let missions: Repository;
  beforeEach(async () => {
    missions = await aRepository();
  });

  it('gives back the mission it saved, dates included, one version up', async () => {
    const mission = aMissionOfferedTo('mission-o-1', [alice, bob]);
    await missions.save(mission);

    const loaded = await missions.get(mission.id);

    expect(loaded.toSnapshot()).toEqual({ ...mission.toSnapshot(), version: 1 });
    expect(await missions.exists(mission.id)).toBe(true);
    expect(await missions.exists(MissionId('nope'))).toBe(false);
    await expect(missions.get(MissionId('nope'))).rejects.toThrow(MissionNotFound);
  });

  it('finds the missions where a tailor still has an offer to answer', async () => {
    await missions.save(aMissionOfferedTo('mission-o-1', [alice, bob]));
    await missions.save(aMissionOfferedTo('mission-o-2', [bob, carol]));
    const declined = await missions.get(MissionId('mission-o-1'));
    declined.decline(bob);
    await missions.save(declined);

    const ids = async (candidate: CandidateId) =>
      (await missions.findWithPendingOfferFor(candidate)).map((mission) => mission.id).sort();

    expect(await ids(alice)).toEqual(['mission-o-1']);
    expect(await ids(bob)).toEqual(['mission-o-2']);
    expect(await ids(CandidateId('dave'))).toEqual([]);
  });

  it('awards the mission once when two tailors accept at the same time', async () => {
    await missions.save(aMissionOfferedTo('mission-o-1', [alice, bob]));
    const acceptOffer = new AcceptOffer(missions, clock);

    const results = await Promise.allSettled([
      acceptOffer.execute({
        missionId: MissionId('mission-o-1'),
        candidateId: alice,
        appointmentStart: MONDAY_MORNING.start,
      }),
      acceptOffer.execute({
        missionId: MissionId('mission-o-1'),
        candidateId: bob,
        appointmentStart: MONDAY_MORNING.start,
      }),
    ]);

    expect(results.map((result) => result.status).sort()).toEqual(['fulfilled', 'rejected']);
    const awarded = (await missions.pending()).filter((entry) => entry.event.type === 'MissionAwarded');
    expect(awarded).toHaveLength(1);
  });

  it('refuses a save from a stale copy', async () => {
    await missions.save(aMissionOfferedTo('mission-o-1', [alice, bob]));
    const first = await missions.get(MissionId('mission-o-1'));
    const second = await missions.get(MissionId('mission-o-1'));
    first.decline(alice);
    second.decline(bob);

    await missions.save(first);
    await expect(missions.save(second)).rejects.toThrow(MissionConcurrencyConflict);
  });

  it('keeps events in the outbox, in order, until they are processed', async () => {
    await missions.save(aMissionOfferedTo('mission-o-1', [alice]));

    const pending = await missions.pending();
    expect(pending.map(({ id, event }) => [id, event.type])).toEqual([
      ['mission-o-1:v1:0', 'MissionOpened'],
      ['mission-o-1:v1:1', 'OfferWaveLaunched'],
    ]);
    const launched = pending[1]?.event;
    expect(launched?.type === 'OfferWaveLaunched' && launched.expiresAt).toEqual(DEADLINE);

    await missions.markProcessed('mission-o-1:v1:0');
    expect((await missions.pending()).map((entry) => entry.id)).toEqual(['mission-o-1:v1:1']);
  });
});

describe('PostgreSQL wave timer', () => {
  beforeEach(() => db.exec('truncate dispatch.wave_timers'));

  it('fires due waves once, oldest first, and keeps the failing ones for the next poll', async () => {
    const timer = new PostgresWaveTimer(db);
    const at = (minutes: number) => new Date(T0.getTime() + minutes * 60_000);
    await timer.schedule({ missionId: MissionId('m-2'), wave: 1, at: at(20) });
    await timer.schedule({ missionId: MissionId('m-1'), wave: 1, at: at(10) });
    await timer.schedule({ missionId: MissionId('m-1'), wave: 1, at: at(10) });
    await timer.schedule({ missionId: MissionId('m-3'), wave: 1, at: at(60) });

    const fired: string[] = [];
    const errors: string[] = [];
    const firing = (failOn: string) => async (expiry: { missionId: string; wave: number; at: Date }) => {
      if (expiry.missionId === failOn) throw new Error('database unavailable');
      fired.push(`${expiry.missionId}@${expiry.at.toISOString()}`);
    };

    expect(await timer.fireDue(at(30), firing('m-2'), (expiry) => errors.push(expiry.missionId))).toBe(1);
    expect(await timer.fireDue(at(30), firing('none'))).toBe(1);
    expect(await timer.fireDue(at(30), firing('none'))).toBe(0);

    expect(fired).toEqual(['m-1@2026-11-09T09:10:00.000Z', 'm-2@2026-11-09T09:20:00.000Z']);
    expect(errors).toEqual(['m-2']);
  });
});

import { describe, expect, it } from 'vitest';
import { AcceptOffer } from '../../src/application/accept-offer';
import type { Clock } from '../../src/application/clock';
import { MissionAlreadyAwarded } from '../../src/domain/errors';
import { CandidateId, MissionId, OrderId } from '../../src/domain/ids';
import { Mission } from '../../src/domain/mission';
import { MissionConcurrencyConflict, type MissionRepository } from '../../src/domain/mission-repository';
import { InMemoryMissionRepository } from '../../src/infrastructure/in-memory-mission-repository';

const T0 = new Date('2026-11-02T09:00:00Z');
const fixedClock = (now: Date): Clock => ({ now: () => now });

const missionId = MissionId('m-1');
const alice = CandidateId('alice');
const bob = CandidateId('bob');

async function aRepositoryWithAMissionOfferedTo(candidates: CandidateId[]) {
  const repository = new InMemoryMissionRepository();
  const mission = Mission.open({ id: missionId, orderId: OrderId('o-1'), maxWaves: 3 });
  mission.launchWave(candidates, new Date(T0.getTime() + 30 * 60_000), T0);
  await repository.save(mission);
  repository.outbox.length = 0;
  return repository;
}

describe('AcceptOffer', () => {
  it('awards the mission to the first of two simultaneous acceptances', async () => {
    const repository = await aRepositoryWithAMissionOfferedTo([alice, bob]);
    const acceptOffer = new AcceptOffer(repository, fixedClock(T0));

    const [aliceResult, bobResult] = await Promise.allSettled([
      acceptOffer.execute({ missionId, candidateId: alice }),
      acceptOffer.execute({ missionId, candidateId: bob }),
    ]);

    expect(aliceResult.status).toBe('fulfilled');
    expect(bobResult.status).toBe('rejected');
    expect(bobResult.status === 'rejected' && bobResult.reason).toBeInstanceOf(MissionAlreadyAwarded);

    const mission = await repository.get(missionId);
    expect(mission.awardedTo).toBe(alice);
    expect(repository.outbox.filter((event) => event.type === 'MissionAwarded')).toHaveLength(1);
  });

  it('relies on the repository version check when both acceptances load the same mission', async () => {
    const repository = await aRepositoryWithAMissionOfferedTo([alice, bob]);
    const withoutRetry = new AcceptOffer(repository, fixedClock(T0), 1);

    const [, bobResult] = await Promise.allSettled([
      withoutRetry.execute({ missionId, candidateId: alice }),
      withoutRetry.execute({ missionId, candidateId: bob }),
    ]);

    expect(bobResult.status === 'rejected' && bobResult.reason).toBeInstanceOf(MissionConcurrencyConflict);
    expect((await repository.get(missionId)).awardedTo).toBe(alice);
  });

  it('gives up after repeated concurrency conflicts', async () => {
    const inner = await aRepositoryWithAMissionOfferedTo([alice]);
    let saves = 0;
    const alwaysConflicting: MissionRepository = {
      get: (id) => inner.get(id),
      save: async (mission) => {
        saves++;
        throw new MissionConcurrencyConflict(mission.id, mission.version, mission.version + 1);
      },
    };

    await expect(
      new AcceptOffer(alwaysConflicting, fixedClock(T0), 3).execute({ missionId, candidateId: alice }),
    ).rejects.toThrow(MissionConcurrencyConflict);
    expect(saves).toBe(3);
  });
});

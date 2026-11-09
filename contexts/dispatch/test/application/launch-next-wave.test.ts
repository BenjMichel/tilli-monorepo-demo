import { describe, expect, it } from 'vitest';
import type { Clock } from '../../src/application/clock';
import { LaunchNextWave } from '../../src/application/launch-next-wave';
import type { Candidate } from '../../src/domain/candidate';
import { CandidateSelectionPolicy } from '../../src/domain/candidate-selection-policy';
import { CandidateId, MissionId, OrderId } from '../../src/domain/ids';
import { Mission } from '../../src/domain/mission';
import { InMemoryCandidateRepository } from '../../src/infrastructure/in-memory-candidate-repository';
import { InMemoryMissionRepository } from '../../src/infrastructure/in-memory-mission-repository';
import { aCandidate, MONDAY_MORNING, someRequirements, VERSAILLES } from '../fixtures';

const T0 = new Date('2026-11-16T07:00:00Z');
const THIRTY_MINUTES = 30 * 60_000;
const missionId = MissionId('m-1');
const clockAt = (now: Date): Clock => ({ now: () => now });

async function setUp(candidates: Candidate[], waveSizes = [2, 3]) {
  const policy = new CandidateSelectionPolicy(waveSizes);
  const missions = new InMemoryMissionRepository();
  await missions.save(
    Mission.open({
      id: missionId,
      orderId: OrderId('o-1'),
      requirements: someRequirements(),
      maxWaves: policy.maxWaves,
    }),
  );
  missions.outbox.length = 0;
  const launchAt = (now: Date) =>
    new LaunchNextWave(missions, new InMemoryCandidateRepository(candidates), policy, clockAt(now), THIRTY_MINUTES);
  return { missions, launchAt };
}

describe('LaunchNextWave', () => {
  it('sends the first wave to the best candidates with a deadline', async () => {
    const { missions, launchAt } = await setUp([aCandidate('alice'), aCandidate('bob'), aCandidate('carol')]);

    const result = await launchAt(T0).execute({ missionId });

    expect(result).toEqual({ outcome: 'launched', wave: 1, candidateCount: 2 });
    expect(missions.outbox.map((entry) => entry.event)).toEqual([
      {
        type: 'OfferWaveLaunched',
        missionId,
        wave: 1,
        candidateIds: [CandidateId('alice'), CandidateId('bob')],
        expiresAt: new Date(T0.getTime() + THIRTY_MINUTES),
      },
    ]);
  });

  it('does nothing while the current wave still has pending offers', async () => {
    const { launchAt } = await setUp([aCandidate('alice'), aCandidate('bob'), aCandidate('carol')]);
    await launchAt(T0).execute({ missionId });

    expect(await launchAt(T0).execute({ missionId })).toEqual({ outcome: 'not-needed' });
  });

  it('widens to the next candidates once the first wave expired', async () => {
    const { missions, launchAt } = await setUp([aCandidate('alice'), aCandidate('bob'), aCandidate('carol')]);
    await launchAt(T0).execute({ missionId });
    const afterDeadline = new Date(T0.getTime() + THIRTY_MINUTES);
    const mission = await missions.get(missionId);
    mission.expireWave(afterDeadline);
    await missions.save(mission);

    const result = await launchAt(afterDeadline).execute({ missionId });

    expect(result).toEqual({ outcome: 'launched', wave: 2, candidateCount: 1 });
    expect((await missions.get(missionId)).offers.at(-1)?.candidateId).toBe('carol');
  });

  it('declares the mission unstaffed when no candidate is eligible', async () => {
    const { missions, launchAt } = await setUp([aCandidate('far-away', { base: VERSAILLES })]);

    const result = await launchAt(T0).execute({ missionId });

    expect(result).toEqual({ outcome: 'unstaffed' });
    expect((await missions.get(missionId)).status).toBe('unstaffed');
    expect(missions.outbox.map((entry) => entry.event.type)).toEqual(['MissionUnstaffed']);
  });

  it('does nothing once the mission is awarded', async () => {
    const { missions, launchAt } = await setUp([aCandidate('alice'), aCandidate('bob'), aCandidate('carol')]);
    await launchAt(T0).execute({ missionId });
    const mission = await missions.get(missionId);
    mission.accept(CandidateId('alice'), T0, MONDAY_MORNING.start);
    await missions.save(mission);

    expect(await launchAt(T0).execute({ missionId })).toEqual({ outcome: 'not-needed' });
  });
});

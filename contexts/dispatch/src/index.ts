import { AcceptOffer } from './application/accept-offer';
import type { Clock } from './application/clock';
import { CloseMission } from './application/close-mission';
import { DeclineOffer } from './application/decline-offer';
import { DispatchEventRelay } from './application/dispatch-event-relay';
import { ExpireWave } from './application/expire-wave';
import { LaunchNextWave } from './application/launch-next-wave';
import { OpenMission } from './application/open-mission';
import type { IntegrationEventPublisher, MissionOutbox, WaveTimer } from './application/ports';
import type { CandidateRepository } from './domain/candidate-repository';
import { CandidateSelectionPolicy } from './domain/candidate-selection-policy';
import type { MissionRepository } from './domain/mission-repository';
import { type AreaLocator, OrderingAcl } from './infrastructure/ordering-acl';

export type DispatchDependencies = {
  readonly missions: MissionRepository & MissionOutbox;
  readonly candidates: CandidateRepository;
  readonly areas: AreaLocator;
  readonly publisher: IntegrationEventPublisher;
  readonly timer: WaveTimer;
  readonly clock: Clock;
  readonly waveSizes: readonly number[];
  readonly waveDurationMs: number;
};

/**
 * Public surface of the Dispatch context. The composition root subscribes the
 * handlers to the bus, exposes the commands to the tailor app and runs the relay.
 */
export function createDispatchModule(deps: DispatchDependencies) {
  const policy = new CandidateSelectionPolicy(deps.waveSizes);
  const launchNextWave = new LaunchNextWave(deps.missions, deps.candidates, policy, deps.clock, deps.waveDurationMs);
  const ordering = new OrderingAcl(new OpenMission(deps.missions, policy), new CloseMission(deps.missions), deps.areas);

  return {
    subscriptions: {
      'OrderPlaced.v1': ordering.onOrderPlaced,
      'OrderCancelled.v1': ordering.onOrderCancelled,
    },
    commands: {
      acceptOffer: new AcceptOffer(deps.missions, deps.clock),
      declineOffer: new DeclineOffer(deps.missions),
      expireWave: new ExpireWave(deps.missions, deps.clock),
    },
    relay: new DispatchEventRelay(deps.missions, deps.publisher, deps.timer, launchNextWave),
  };
}

export type DispatchModule = ReturnType<typeof createDispatchModule>;
export { CandidateId, MissionId } from './domain/ids';
export type { Candidate } from './domain/candidate';
export { InMemoryCandidateRepository } from './infrastructure/in-memory-candidate-repository';
export { InMemoryMissionRepository } from './infrastructure/in-memory-mission-repository';
export { StaticAreaLocator } from './infrastructure/static-area-locator';

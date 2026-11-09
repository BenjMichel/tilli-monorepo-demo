import { FulfillmentEventRelay } from './application/fulfillment-event-relay';
import { MyInterventions } from './application/my-interventions';
import type { Clock, IntegrationEventPublisher, InterventionOutbox } from './application/ports';
import { TailorActions } from './application/tailor-actions';
import { UpstreamReactions } from './application/upstream-reactions';
import type { InterventionDraftRepository } from './domain/intervention-draft';
import type { InterventionRepository } from './domain/intervention-repository';
import { UpstreamAcl } from './infrastructure/upstream-acl';

export type FulfillmentDependencies = {
  readonly interventions: InterventionRepository & InterventionOutbox;
  readonly drafts: InterventionDraftRepository;
  readonly clock: Clock;
  readonly publisher: IntegrationEventPublisher;
};

/** Public surface of the Fulfillment context, wired by the composition root. */
export function createFulfillmentModule(deps: FulfillmentDependencies) {
  const upstream = new UpstreamAcl(new UpstreamReactions(deps.drafts, deps.interventions));
  return {
    subscriptions: {
      'OrderPlaced.v1': upstream.onOrderPlaced,
      'MissionAwarded.v1': upstream.onMissionAwarded,
      'OrderCancelled.v1': upstream.onOrderCancelled,
    },
    commands: new TailorActions(deps.interventions, deps.clock),
    queries: { myInterventions: new MyInterventions(deps.interventions) },
    relay: new FulfillmentEventRelay(deps.interventions, deps.publisher),
  };
}

export type FulfillmentModule = ReturnType<typeof createFulfillmentModule>;
export { InterventionId, TailorId } from './domain/ids';
export {
  InMemoryInterventionDraftRepository,
  InMemoryInterventionRepository,
} from './infrastructure/in-memory-repositories';

import { InterventionCompletedV1, InterventionStartedV1 } from '@tilli/contracts';
import type { FulfillmentReactions } from '../application/fulfillment-reactions';
import { OrderId } from '../domain/order';

/** Anti-corruption layer facing Fulfillment: validates its events, keeps only the order id. */
export class FulfillmentAcl {
  constructor(private readonly reactions: FulfillmentReactions) {}

  readonly onInterventionStarted = async (raw: unknown): Promise<void> => {
    const { payload } = InterventionStartedV1.parse(raw);
    await this.reactions.interventionStarted(OrderId(payload.orderId));
  };

  readonly onInterventionCompleted = async (raw: unknown): Promise<void> => {
    const { payload } = InterventionCompletedV1.parse(raw);
    await this.reactions.interventionCompleted(OrderId(payload.orderId));
  };
}

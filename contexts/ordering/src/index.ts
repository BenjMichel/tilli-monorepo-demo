import { CancelOrder } from './application/cancel-order';
import { FulfillmentReactions } from './application/fulfillment-reactions';
import { GetQuote } from './application/get-quote';
import { OrderingEventRelay } from './application/ordering-event-relay';
import { PlaceOrder } from './application/place-order';
import type { Clock, IntegrationEventPublisher, OrderIdGenerator, OrderOutbox, PriceGrids } from './application/ports';
import type { OrderRepository } from './domain/order-repository';
import type { ServiceArea } from './domain/service-area';
import { FulfillmentAcl } from './infrastructure/fulfillment-acl';

export type OrderingDependencies = {
  readonly orders: OrderRepository & OrderOutbox;
  readonly grids: PriceGrids;
  readonly serviceArea: ServiceArea;
  readonly ids: OrderIdGenerator;
  readonly clock: Clock;
  readonly publisher: IntegrationEventPublisher;
};

/** Public surface of the Ordering context, wired by the composition root. */
export function createOrderingModule(deps: OrderingDependencies) {
  const fulfillment = new FulfillmentAcl(new FulfillmentReactions(deps.orders));
  return {
    subscriptions: {
      'InterventionStarted.v1': fulfillment.onInterventionStarted,
      'InterventionCompleted.v1': fulfillment.onInterventionCompleted,
    },
    queries: {
      getQuote: new GetQuote(deps.grids),
    },
    commands: {
      placeOrder: new PlaceOrder(deps.orders, deps.grids, deps.serviceArea, deps.ids, deps.clock),
      cancelOrder: new CancelOrder(deps.orders),
    },
    relay: new OrderingEventRelay(deps.orders, deps.publisher),
  };
}

export type OrderingModule = ReturnType<typeof createOrderingModule>;
export { OrderId } from './domain/order';
export { DEMO_PRICE_GRID, InMemoryPriceGrids } from './infrastructure/demo-price-grid';
export { PARIS_SERVICE_AREA } from './infrastructure/demo-service-area';
export { InMemoryOrderRepository } from './infrastructure/in-memory-order-repository';

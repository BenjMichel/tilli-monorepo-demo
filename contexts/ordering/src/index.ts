import { CancelOrder } from './application/cancel-order';
import { GetQuote } from './application/get-quote';
import { OrderingEventRelay } from './application/ordering-event-relay';
import { PlaceOrder } from './application/place-order';
import type { Clock, IntegrationEventPublisher, OrderIdGenerator, OrderOutbox, PriceGrids } from './application/ports';
import type { OrderRepository } from './domain/order-repository';
import type { ServiceArea } from './domain/service-area';

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
  return {
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
export { InMemoryOrderRepository } from './infrastructure/in-memory-order-repository';
export { DEMO_PRICE_GRID, InMemoryPriceGrids } from './infrastructure/demo-price-grid';
export { PARIS_SERVICE_AREA } from './infrastructure/demo-service-area';

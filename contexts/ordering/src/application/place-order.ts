import { OrderingError } from '../domain/errors';
import { type Address, type Customer, Order, OrderId, type TimeSlot } from '../domain/order';
import type { OrderRepository } from '../domain/order-repository';
import type { ItemRequest } from '../domain/quote';
import type { ServiceArea } from '../domain/service-area';
import type { Clock, OrderIdGenerator, PriceGrids } from './ports';

export type PlaceOrderCommand = {
  readonly items: readonly ItemRequest[];
  readonly address: Address;
  readonly slots: readonly TimeSlot[];
  readonly customer: Customer;
  /** The grid version of the quote the customer saw at step 1. */
  readonly quotedPriceGridVersion: string;
};

export class UnknownPriceGridVersion extends OrderingError {
  readonly code = 'UNKNOWN_PRICE_GRID_VERSION';

  constructor(version: string) {
    super(`No price grid with version ${version}`);
  }
}

/** Funnel step 2: the customer's details turn the quote into an order. */
export class PlaceOrder {
  constructor(
    private readonly orders: OrderRepository,
    private readonly grids: PriceGrids,
    private readonly serviceArea: ServiceArea,
    private readonly ids: OrderIdGenerator,
    private readonly clock: Clock,
  ) {}

  async execute(command: PlaceOrderCommand): Promise<{ orderId: OrderId; totalCents: number }> {
    // The customer pays what step 1 showed, even if a new grid was published in between.
    const grid = this.grids.byVersion(command.quotedPriceGridVersion);
    if (!grid) throw new UnknownPriceGridVersion(command.quotedPriceGridVersion);
    const order = Order.place({
      id: OrderId(this.ids.next()),
      items: command.items,
      address: command.address,
      slots: command.slots,
      customer: command.customer,
      now: this.clock.now(),
      grid,
      serviceArea: this.serviceArea,
    });
    await this.orders.save(order);
    return { orderId: order.id, totalCents: order.total.cents };
  }
}

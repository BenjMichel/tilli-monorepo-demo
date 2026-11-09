import type { Order, OrderId } from '../domain/order';
import type { OrderRepository } from '../domain/order-repository';
import { retryOnConflict } from './retry-on-conflict';

/** How Ordering follows the work done in Fulfillment. Both reactions are idempotent. */
export class FulfillmentReactions {
  constructor(
    private readonly orders: OrderRepository,
    private readonly maxAttempts = 3,
  ) {}

  /** From now on the customer can no longer cancel. */
  interventionStarted(orderId: OrderId): Promise<void> {
    return this.apply(orderId, (order) => order.recordInterventionStarted());
  }

  interventionCompleted(orderId: OrderId): Promise<void> {
    return this.apply(orderId, (order) => {
      order.recordInterventionStarted();
      order.complete();
    });
  }

  private apply(orderId: OrderId, change: (order: Order) => void): Promise<void> {
    return retryOnConflict(this.maxAttempts, async () => {
      const order = await this.orders.get(orderId);
      change(order);
      await this.orders.save(order);
    });
  }
}

import type { OrderId } from '../domain/order';
import type { OrderRepository } from '../domain/order-repository';
import { retryOnConflict } from './retry-on-conflict';

/**
 * Cancellation races with the tailor starting the intervention: on a version conflict
 * we reload, and the aggregate refuses if the intervention started in the meantime.
 */
export class CancelOrder {
  constructor(
    private readonly orders: OrderRepository,
    private readonly maxAttempts = 3,
  ) {}

  execute(command: { orderId: OrderId; reason: string }): Promise<void> {
    return retryOnConflict(this.maxAttempts, async () => {
      const order = await this.orders.get(command.orderId);
      order.cancel(command.reason);
      await this.orders.save(order);
    });
  }
}

import type { OrderId } from '../domain/order';
import { OrderConcurrencyConflict, type OrderRepository } from '../domain/order-repository';

/**
 * Cancellation races with the tailor starting the intervention: on a version conflict
 * we reload, and the aggregate refuses if the intervention started in the meantime.
 */
export class CancelOrder {
  constructor(
    private readonly orders: OrderRepository,
    private readonly maxAttempts = 3,
  ) {}

  async execute(command: { orderId: OrderId; reason: string }): Promise<void> {
    for (let attempt = 1; ; attempt++) {
      const order = await this.orders.get(command.orderId);
      order.cancel(command.reason);
      try {
        await this.orders.save(order);
        return;
      } catch (error) {
        if (error instanceof OrderConcurrencyConflict && attempt < this.maxAttempts) continue;
        throw error;
      }
    }
  }
}

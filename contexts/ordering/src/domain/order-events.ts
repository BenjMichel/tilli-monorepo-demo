import type { OrderSnapshot } from './order';

export type OrderPlaced = {
  readonly type: 'OrderPlaced';
  readonly order: OrderSnapshot;
};

export type OrderCancelled = {
  readonly type: 'OrderCancelled';
  readonly orderId: string;
  readonly reason: string;
};

export type OrderCompleted = {
  readonly type: 'OrderCompleted';
  readonly orderId: string;
};

export type OrderEvent = OrderPlaced | OrderCancelled | OrderCompleted;

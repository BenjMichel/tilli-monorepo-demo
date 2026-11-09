import type { Money } from './money';
import type { QuotedItem } from './quote';

declare const brand: unique symbol;
export type OrderId = string & { readonly [brand]: 'OrderId' };
export const OrderId = (value: string): OrderId => value as OrderId;

export type OrderStatus = 'placed' | 'completed' | 'cancelled';

export type Address = { readonly street: string; readonly postalCode: string; readonly city: string };
export type Customer = {
  readonly firstName: string;
  readonly lastName: string;
  readonly phone: string;
  readonly email: string;
};
export type TimeSlot = { readonly start: Date; readonly end: Date };

export type OrderSnapshot = {
  readonly id: OrderId;
  readonly items: readonly QuotedItem[];
  readonly total: Money;
  readonly priceGridVersion: string;
  readonly address: Address;
  readonly slots: readonly TimeSlot[];
  readonly customer: Customer;
  readonly placedAt: Date;
  status: OrderStatus;
  interventionStarted: boolean;
  readonly version: number;
};

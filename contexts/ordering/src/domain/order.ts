import { AreaNotServed, InvalidOrder, OrderCannotBeCancelled } from './errors';
import type { Money } from './money';
import type { OrderEvent } from './order-events';
import type { PriceGrid } from './price-grid';
import { type ItemRequest, type QuotedItem, quote } from './quote';
import type { ServiceArea } from './service-area';

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

export type PlaceOrder = {
  readonly id: OrderId;
  readonly items: readonly ItemRequest[];
  readonly address: Address;
  readonly slots: readonly TimeSlot[];
  readonly customer: Customer;
  readonly now: Date;
  readonly grid: PriceGrid;
  readonly serviceArea: ServiceArea;
};

/** A customer's firm request: items, address, slots and a price frozen when it is placed. */
export class Order {
  private pendingEvents: OrderEvent[] = [];

  private constructor(private readonly state: OrderSnapshot) {}

  static place(command: PlaceOrder): Order {
    const { items, total, priceGridVersion } = quote(command.items, command.grid);
    if (!command.serviceArea.covers(command.address.postalCode)) {
      throw new AreaNotServed(command.address.postalCode);
    }
    assertSlots(command.slots, command.now);
    assertCustomer(command.customer);

    const order = new Order({
      id: command.id,
      items,
      total,
      priceGridVersion,
      address: { ...command.address, postalCode: command.address.postalCode.trim() },
      slots: command.slots.map(copySlot),
      customer: { ...command.customer },
      placedAt: command.now,
      status: 'placed',
      interventionStarted: false,
      version: 0,
    });
    order.pendingEvents.push({ type: 'OrderPlaced', order: order.toSnapshot() });
    return order;
  }

  static restore(snapshot: OrderSnapshot): Order {
    return new Order(copyOf(snapshot));
  }

  toSnapshot(): OrderSnapshot {
    return copyOf(this.state);
  }

  get id(): OrderId {
    return this.state.id;
  }

  get status(): OrderStatus {
    return this.state.status;
  }

  get total(): Money {
    return this.state.total;
  }

  get version(): number {
    return this.state.version;
  }

  pullEvents(): OrderEvent[] {
    const events = this.pendingEvents;
    this.pendingEvents = [];
    return events;
  }

  cancel(reason: string): void {
    if (this.state.status === 'cancelled') return;
    if (this.state.status === 'completed') throw new OrderCannotBeCancelled('The order is already completed');
    if (this.state.interventionStarted) {
      throw new OrderCannotBeCancelled('The tailor has already started working on the order');
    }
    this.state.status = 'cancelled';
    this.pendingEvents.push({ type: 'OrderCancelled', orderId: this.state.id, reason });
  }

  /** Fed by Fulfillment: from now on the order can no longer be cancelled. */
  recordInterventionStarted(): void {
    this.state.interventionStarted = true;
  }

  complete(): void {
    if (this.state.status === 'completed') return;
    if (this.state.status === 'cancelled') throw new InvalidOrder('A cancelled order cannot be completed');
    this.state.status = 'completed';
    this.pendingEvents.push({ type: 'OrderCompleted', orderId: this.state.id });
  }
}

function assertSlots(slots: readonly TimeSlot[], now: Date): void {
  if (slots.length === 0) throw new InvalidOrder('The customer must propose at least one time slot');
  for (const slot of slots) {
    if (slot.end <= slot.start) throw new InvalidOrder('A time slot must end after it starts');
    if (slot.start <= now) throw new InvalidOrder('Time slots must be in the future');
  }
}

function assertCustomer(customer: Customer): void {
  const missing = (['firstName', 'lastName', 'phone', 'email'] as const).filter((field) => !customer[field].trim());
  if (missing.length > 0) throw new InvalidOrder(`Missing customer details: ${missing.join(', ')}`);
  if (!customer.email.includes('@')) throw new InvalidOrder('Invalid customer email');
}

const copySlot = (slot: TimeSlot): TimeSlot => ({ start: new Date(slot.start), end: new Date(slot.end) });

function copyOf(snapshot: OrderSnapshot): OrderSnapshot {
  return { ...snapshot, slots: snapshot.slots.map(copySlot), placedAt: new Date(snapshot.placedAt) };
}

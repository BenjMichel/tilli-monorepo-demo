import { InvalidTransition, NotAssignedTailor, TooEarlyToStart } from './errors';
import { type InterventionId, type OrderId, type TailorId, interventionIdForOrder } from './ids';
import type { CustomerContact, InterventionDraft, TimeSlot, WorkItem } from './intervention-draft';
import type { InterventionEvent } from './intervention-events';

export type InterventionStatus = 'scheduled' | 'in-progress' | 'completed' | 'cancelled';

export type InterventionSnapshot = {
  readonly id: InterventionId;
  readonly orderId: OrderId;
  readonly tailorId: TailorId;
  readonly customer: CustomerContact;
  readonly workSheet: readonly WorkItem[];
  /** Picked by the tailor when accepting the mission (Dispatch owns that rule). Final. */
  readonly appointment: TimeSlot;
  status: InterventionStatus;
  startedAt: Date | null;
  completedAt: Date | null;
  lateCancellation: boolean;
  readonly version: number;
};

/** The work a given tailor does for an order, from the appointment to the end of the job. */
export class Intervention {
  private pendingEvents: InterventionEvent[] = [];

  private constructor(private readonly state: InterventionSnapshot) {}

  /** The tailor won the mission. If the order was cancelled meanwhile, they are told at once. */
  static schedule(draft: InterventionDraft, tailorId: TailorId, appointment: TimeSlot): Intervention {
    const intervention = new Intervention({
      id: interventionIdForOrder(draft.orderId),
      orderId: draft.orderId,
      tailorId,
      customer: draft.customer,
      workSheet: draft.workSheet,
      appointment: copySlot(appointment),
      status: 'scheduled',
      startedAt: null,
      completedAt: null,
      lateCancellation: false,
      version: 0,
    });
    intervention.record({ type: 'InterventionScheduled', tailorId, appointment: copySlot(appointment) });
    if (draft.cancelled) intervention.cancel();
    return intervention;
  }

  static restore(snapshot: InterventionSnapshot): Intervention {
    return new Intervention(copyOf(snapshot));
  }

  toSnapshot(): InterventionSnapshot {
    return copyOf(this.state);
  }

  get id(): InterventionId {
    return this.state.id;
  }

  get status(): InterventionStatus {
    return this.state.status;
  }

  get tailorId(): TailorId {
    return this.state.tailorId;
  }

  get version(): number {
    return this.state.version;
  }

  pullEvents(): InterventionEvent[] {
    const events = this.pendingEvents;
    this.pendingEvents = [];
    return events;
  }

  start(tailorId: TailorId, now: Date): void {
    this.assertAssigned(tailorId);
    if (this.state.status !== 'scheduled') throw new InvalidTransition('start', this.state.status);
    if (now < this.state.appointment.start) throw new TooEarlyToStart(this.state.appointment.start);

    this.state.status = 'in-progress';
    this.state.startedAt = now;
    this.record({ type: 'InterventionStarted', startedAt: now });
  }

  complete(tailorId: TailorId, now: Date): void {
    this.assertAssigned(tailorId);
    if (this.state.status !== 'in-progress') throw new InvalidTransition('complete', this.state.status);

    this.state.status = 'completed';
    this.state.completedAt = now;
    this.record({ type: 'InterventionCompleted', completedAt: now });
  }

  /**
   * The order was cancelled. Before the work starts, the intervention is cancelled. After,
   * Fulfillment cannot undo a fact: the work goes on and the ops team is alerted once.
   */
  cancel(): void {
    switch (this.state.status) {
      case 'scheduled':
        this.state.status = 'cancelled';
        this.record({ type: 'InterventionCancelled' });
        return;
      case 'in-progress':
      case 'completed':
        if (this.state.lateCancellation) return;
        this.state.lateCancellation = true;
        this.record({ type: 'LateCancellationReceived' });
        return;
      case 'cancelled':
        return;
    }
  }

  private assertAssigned(tailorId: TailorId): void {
    if (tailorId !== this.state.tailorId) throw new NotAssignedTailor(this.state.id, tailorId);
  }

  private record(event: DistributiveOmit<InterventionEvent, 'interventionId' | 'orderId'>): void {
    this.pendingEvents.push({ ...event, interventionId: this.state.id, orderId: this.state.orderId } as InterventionEvent);
  }
}

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

const copySlot = (slot: TimeSlot): TimeSlot => ({ start: new Date(slot.start), end: new Date(slot.end) });

function copyOf(snapshot: InterventionSnapshot): InterventionSnapshot {
  return {
    ...snapshot,
    appointment: copySlot(snapshot.appointment),
    startedAt: snapshot.startedAt && new Date(snapshot.startedAt),
    completedAt: snapshot.completedAt && new Date(snapshot.completedAt),
  };
}

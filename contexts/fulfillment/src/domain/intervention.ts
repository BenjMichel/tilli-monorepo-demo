import { InvalidTransition, NotAssignedTailor, SlotNotProposed, TooEarlyToStart } from './errors';
import { type InterventionId, type OrderId, type TailorId, interventionIdForOrder } from './ids';
import type { CustomerContact, InterventionDraft, TimeSlot, WorkItem } from './intervention-draft';
import type { InterventionEvent } from './intervention-events';

export type InterventionStatus = 'scheduled' | 'appointment-confirmed' | 'in-progress' | 'completed' | 'cancelled';

export type InterventionSnapshot = {
  readonly id: InterventionId;
  readonly orderId: OrderId;
  readonly tailorId: TailorId;
  readonly customer: CustomerContact;
  readonly workSheet: readonly WorkItem[];
  readonly proposedSlots: readonly TimeSlot[];
  appointment: TimeSlot | null;
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
  static schedule(draft: InterventionDraft, tailorId: TailorId): Intervention {
    const intervention = new Intervention({
      id: interventionIdForOrder(draft.orderId),
      orderId: draft.orderId,
      tailorId,
      customer: draft.customer,
      workSheet: draft.workSheet,
      proposedSlots: draft.proposedSlots.map(copySlot),
      appointment: null,
      status: 'scheduled',
      startedAt: null,
      completedAt: null,
      lateCancellation: false,
      version: 0,
    });
    intervention.record({ type: 'InterventionScheduled', tailorId });
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

  /** Can be changed until the work starts. */
  confirmAppointment(tailorId: TailorId, slot: TimeSlot): void {
    this.assertAssigned(tailorId);
    if (this.state.status !== 'scheduled' && this.state.status !== 'appointment-confirmed') {
      throw new InvalidTransition('confirm an appointment for', this.state.status);
    }
    const proposed = this.state.proposedSlots.some(
      (candidate) => candidate.start.getTime() === slot.start.getTime() && candidate.end.getTime() === slot.end.getTime(),
    );
    if (!proposed) throw new SlotNotProposed();

    this.state.appointment = copySlot(slot);
    this.state.status = 'appointment-confirmed';
    this.record({ type: 'AppointmentConfirmed', start: slot.start, end: slot.end });
  }

  start(tailorId: TailorId, now: Date): void {
    this.assertAssigned(tailorId);
    if (this.state.status !== 'appointment-confirmed' || !this.state.appointment) {
      throw new InvalidTransition('start', this.state.status);
    }
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
      case 'appointment-confirmed':
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
    proposedSlots: snapshot.proposedSlots.map(copySlot),
    appointment: snapshot.appointment && copySlot(snapshot.appointment),
    startedAt: snapshot.startedAt && new Date(snapshot.startedAt),
    completedAt: snapshot.completedAt && new Date(snapshot.completedAt),
  };
}

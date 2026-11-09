import type { IntegrationEvent } from '@tilli/contracts';

export type TrackingStatus =
  | 'searching-tailor'
  | 'unstaffed'
  | 'tailor-assigned'
  | 'in-progress'
  | 'completed'
  | 'cancelled';

export type OrderTrackingRow = {
  readonly orderId: string;
  placedAt: string | null;
  postalCode: string | null;
  totalCents: number | null;
  status: TrackingStatus;
  tailorId: string | null;
  appointment: { start: string; end: string } | null;
};

/** Events can arrive in any order: a status never goes back, and a cancellation is final. */
const RANK: Record<TrackingStatus, number> = {
  'searching-tailor': 0,
  unstaffed: 1,
  'tailor-assigned': 1,
  'in-progress': 2,
  completed: 3,
  cancelled: 4,
};

/**
 * "Suivi des commandes" for the ops team. Not a bounded context: a denormalised read model
 * fed by the integration events of the three contexts, with no business rule of its own.
 * Every update is idempotent, so a redelivered event changes nothing.
 */
export class OrderTrackingProjection {
  private readonly rows = new Map<string, OrderTrackingRow>();

  readonly apply = async (event: IntegrationEvent): Promise<void> => {
    const row = this.rowOf(event.payload.orderId);
    switch (event.type) {
      case 'OrderPlaced':
        row.placedAt = event.occurredAt;
        row.postalCode = event.payload.address.postalCode;
        row.totalCents = event.payload.totalCents;
        return;
      case 'MissionAwarded':
        row.tailorId = event.payload.tailorId;
        row.appointment = event.payload.appointment;
        return this.moveTo(row, 'tailor-assigned');
      case 'MissionUnstaffed':
        return this.moveTo(row, 'unstaffed');
      case 'InterventionStarted':
        return this.moveTo(row, 'in-progress');
      case 'InterventionCompleted':
        return this.moveTo(row, 'completed');
      case 'OrderCancelled':
        return this.moveTo(row, 'cancelled');
    }
  };

  list(): OrderTrackingRow[] {
    return [...this.rows.values()].sort((a, b) => (b.placedAt ?? '').localeCompare(a.placedAt ?? ''));
  }

  private rowOf(orderId: string): OrderTrackingRow {
    let row = this.rows.get(orderId);
    if (!row) {
      row = {
        orderId,
        placedAt: null,
        postalCode: null,
        totalCents: null,
        status: 'searching-tailor',
        tailorId: null,
        appointment: null,
      };
      this.rows.set(orderId, row);
    }
    return row;
  }

  private moveTo(row: OrderTrackingRow, status: TrackingStatus): void {
    if (RANK[status] >= RANK[row.status]) row.status = status;
  }
}

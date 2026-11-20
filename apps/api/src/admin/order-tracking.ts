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

/** Where the projection keeps its rows: in memory for the demo, in PostgreSQL otherwise. */
export interface OrderTrackingStore {
  find(orderId: string): Promise<OrderTrackingRow | null>;
  save(row: OrderTrackingRow): Promise<void>;
  /** Most recent orders first; rows whose OrderPlaced has not arrived yet come last. */
  list(): Promise<OrderTrackingRow[]>;
}

/**
 * "Suivi des commandes" for the ops team. Not a bounded context: a denormalised read model
 * fed by the integration events of the three contexts, with no business rule of its own.
 * Every update is idempotent, so a redelivered event changes nothing.
 */
export class OrderTrackingProjection {
  constructor(private readonly store: OrderTrackingStore = new InMemoryOrderTrackingStore()) {}

  readonly apply = async (event: IntegrationEvent): Promise<void> => {
    const row = (await this.store.find(event.payload.orderId)) ?? emptyRow(event.payload.orderId);
    switch (event.type) {
      case 'OrderPlaced':
        row.placedAt = event.occurredAt;
        row.postalCode = event.payload.address.postalCode;
        row.totalCents = event.payload.totalCents;
        break;
      case 'MissionAwarded':
        row.tailorId = event.payload.tailorId;
        row.appointment = event.payload.appointment;
        moveTo(row, 'tailor-assigned');
        break;
      case 'MissionUnstaffed':
        moveTo(row, 'unstaffed');
        break;
      case 'InterventionStarted':
        moveTo(row, 'in-progress');
        break;
      case 'InterventionCompleted':
        moveTo(row, 'completed');
        break;
      case 'OrderCancelled':
        moveTo(row, 'cancelled');
        break;
    }
    await this.store.save(row);
  };

  list(): Promise<OrderTrackingRow[]> {
    return this.store.list();
  }
}

export class InMemoryOrderTrackingStore implements OrderTrackingStore {
  private readonly rows = new Map<string, OrderTrackingRow>();

  async find(orderId: string): Promise<OrderTrackingRow | null> {
    const row = this.rows.get(orderId);
    return row ? { ...row } : null;
  }

  async save(row: OrderTrackingRow): Promise<void> {
    this.rows.set(row.orderId, { ...row });
  }

  async list(): Promise<OrderTrackingRow[]> {
    return [...this.rows.values()]
      .map((row) => ({ ...row }))
      .sort((a, b) => (b.placedAt ?? '').localeCompare(a.placedAt ?? ''));
  }
}

function emptyRow(orderId: string): OrderTrackingRow {
  return {
    orderId,
    placedAt: null,
    postalCode: null,
    totalCents: null,
    status: 'searching-tailor',
    tailorId: null,
    appointment: null,
  };
}

function moveTo(row: OrderTrackingRow, status: TrackingStatus): void {
  if (RANK[status] >= RANK[row.status]) row.status = status;
}

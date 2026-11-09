import type { Clock, InterventionOutbox, OutboxEntry } from '../application/ports';
import type { InterventionId, OrderId, TailorId } from '../domain/ids';
import { Intervention, type InterventionSnapshot } from '../domain/intervention';
import type { InterventionDraft, InterventionDraftRepository } from '../domain/intervention-draft';
import {
  InterventionConcurrencyConflict,
  InterventionNotFound,
  type InterventionRepository,
} from '../domain/intervention-repository';

const systemClock: Clock = { now: () => new Date() };

/** Saves the intervention and its events together, as a database transaction with an outbox table would. */
export class InMemoryInterventionRepository implements InterventionRepository, InterventionOutbox {
  private readonly snapshots = new Map<InterventionId, InterventionSnapshot>();
  private readonly processed = new Set<string>();
  readonly outbox: OutboxEntry[] = [];

  constructor(private readonly clock: Clock = systemClock) {}

  async get(id: InterventionId): Promise<Intervention> {
    const snapshot = this.snapshots.get(id);
    if (!snapshot) throw new InterventionNotFound(id);
    return Intervention.restore(snapshot);
  }

  async exists(id: InterventionId): Promise<boolean> {
    return this.snapshots.has(id);
  }

  async findByTailor(tailorId: TailorId): Promise<Intervention[]> {
    return [...this.snapshots.values()]
      .filter((snapshot) => snapshot.tailorId === tailorId)
      .map((snapshot) => Intervention.restore(snapshot));
  }

  async save(intervention: Intervention): Promise<void> {
    const storedVersion = this.snapshots.get(intervention.id)?.version ?? 0;
    if (storedVersion !== intervention.version) {
      throw new InterventionConcurrencyConflict(intervention.id, intervention.version, storedVersion);
    }
    const version = intervention.version + 1;
    this.snapshots.set(intervention.id, { ...intervention.toSnapshot(), version });
    const occurredAt = this.clock.now();
    this.outbox.push(
      ...intervention
        .pullEvents()
        .map((event, index) => ({ id: `${intervention.id}:v${version}:${index}`, occurredAt, event })),
    );
  }

  async pending(): Promise<OutboxEntry[]> {
    return this.outbox.filter((entry) => !this.processed.has(entry.id));
  }

  async markProcessed(id: string): Promise<void> {
    this.processed.add(id);
  }
}

export class InMemoryInterventionDraftRepository implements InterventionDraftRepository {
  private readonly drafts = new Map<OrderId, InterventionDraft>();

  async find(orderId: OrderId): Promise<InterventionDraft | null> {
    return this.drafts.get(orderId) ?? null;
  }

  async save(draft: InterventionDraft): Promise<void> {
    this.drafts.set(draft.orderId, draft);
  }
}

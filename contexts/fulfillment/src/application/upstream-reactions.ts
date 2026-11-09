import { type OrderId, type TailorId, interventionIdForOrder } from '../domain/ids';
import { Intervention } from '../domain/intervention';
import type { InterventionDraft, InterventionDraftRepository, TimeSlot } from '../domain/intervention-draft';
import type { InterventionRepository } from '../domain/intervention-repository';
import { retryOnConflict } from './retry-on-conflict';

export class DraftNotFound extends Error {
  constructor(orderId: OrderId) {
    super(`No draft for order ${orderId} yet: OrderPlaced has not been received`);
    this.name = 'DraftNotFound';
  }
}

/** How Fulfillment reacts to what Ordering and Dispatch publish. All reactions are idempotent. */
export class UpstreamReactions {
  constructor(
    private readonly drafts: InterventionDraftRepository,
    private readonly interventions: InterventionRepository,
    private readonly maxAttempts = 3,
  ) {}

  /** OrderPlaced: keep what the future tailor will need, until Dispatch finds one. */
  async orderPlaced(draft: Omit<InterventionDraft, 'cancelled'>): Promise<void> {
    if (await this.drafts.find(draft.orderId)) return;
    await this.drafts.save({ ...draft, cancelled: false });
  }

  /**
   * MissionAwarded. Events from two contexts may arrive in any order: without a draft we fail,
   * so that the relay of the publisher delivers the event again later.
   */
  async missionAwarded(orderId: OrderId, tailorId: TailorId, appointment: TimeSlot): Promise<'scheduled' | 'already-scheduled'> {
    if (await this.interventions.exists(interventionIdForOrder(orderId))) return 'already-scheduled';
    const draft = await this.drafts.find(orderId);
    if (!draft) throw new DraftNotFound(orderId);

    await this.interventions.save(Intervention.schedule(draft, tailorId, appointment));
    return 'scheduled';
  }

  /** OrderCancelled: cancel the intervention, or flag the draft if no tailor was awarded yet. */
  async orderCancelled(orderId: OrderId): Promise<void> {
    const id = interventionIdForOrder(orderId);
    if (await this.interventions.exists(id)) {
      await retryOnConflict(this.maxAttempts, async () => {
        const intervention = await this.interventions.get(id);
        intervention.cancel();
        await this.interventions.save(intervention);
      });
      return;
    }
    const draft = await this.drafts.find(orderId);
    if (draft && !draft.cancelled) await this.drafts.save({ ...draft, cancelled: true });
  }
}

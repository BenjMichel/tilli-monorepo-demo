import type { InterventionId, OrderId, TailorId } from './ids';
import type { TimeSlot } from './intervention-draft';

type Base = { readonly interventionId: InterventionId; readonly orderId: OrderId };

export type InterventionScheduled = Base & {
  readonly type: 'InterventionScheduled';
  readonly tailorId: TailorId;
  readonly appointment: TimeSlot;
};
export type InterventionStarted = Base & { readonly type: 'InterventionStarted'; readonly startedAt: Date };
export type InterventionCompleted = Base & { readonly type: 'InterventionCompleted'; readonly completedAt: Date };
export type InterventionCancelled = Base & { readonly type: 'InterventionCancelled' };
/** The order was cancelled after work started: the tailor keeps going and the ops team must step in. */
export type LateCancellationReceived = Base & { readonly type: 'LateCancellationReceived' };

export type InterventionEvent =
  | InterventionScheduled
  | InterventionStarted
  | InterventionCompleted
  | InterventionCancelled
  | LateCancellationReceived;

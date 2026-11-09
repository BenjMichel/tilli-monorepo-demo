import type { OrderId } from './ids';

export type TimeSlot = { readonly start: Date; readonly end: Date };

/** Only the assigned tailor ever sees it. */
export type CustomerContact = {
  readonly fullName: string;
  readonly phone: string;
  readonly address: { readonly street: string; readonly postalCode: string; readonly city: string };
};

export type WorkItem = {
  readonly garmentType: string;
  readonly fabric: 'basic' | 'dressy';
  readonly alterationCodes: readonly string[];
};

/**
 * What Fulfillment keeps from an order while Dispatch looks for a tailor. Keeping it here
 * is what lets Dispatch work without any personal data.
 */
export type InterventionDraft = {
  readonly orderId: OrderId;
  readonly customer: CustomerContact;
  readonly workSheet: readonly WorkItem[];
  readonly proposedSlots: readonly TimeSlot[];
  /** The order was cancelled before any tailor was awarded the mission. */
  readonly cancelled: boolean;
};

export interface InterventionDraftRepository {
  find(orderId: OrderId): Promise<InterventionDraft | null>;
  save(draft: InterventionDraft): Promise<void>;
}

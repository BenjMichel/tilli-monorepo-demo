import { OrderId, TailorId } from '../src/domain/ids';
import type { InterventionDraft, TimeSlot } from '../src/domain/intervention-draft';

export const MONDAY_MORNING: TimeSlot = { start: new Date('2026-11-16T09:00:00Z'), end: new Date('2026-11-16T11:00:00Z') };
export const MONDAY_EVENING: TimeSlot = { start: new Date('2026-11-16T18:00:00Z'), end: new Date('2026-11-16T20:00:00Z') };

export const MARIE = TailorId('marie');
export const KARIM = TailorId('karim');

export function aDraft(overrides: Partial<InterventionDraft> = {}): InterventionDraft {
  return {
    orderId: OrderId('o-1'),
    customer: {
      fullName: 'Léa Martin',
      phone: '+33600000000',
      address: { street: '12 rue Oberkampf', postalCode: '75011', city: 'Paris' },
    },
    workSheet: [{ garmentType: 'pants', fabric: 'dressy', alterationCodes: ['hem-simple'] }],
    proposedSlots: [MONDAY_MORNING, MONDAY_EVENING],
    cancelled: false,
    ...overrides,
  };
}

import type { Address, Customer, TimeSlot } from '../src/domain/order';
import type { ItemRequest } from '../src/domain/quote';

export const NOW = new Date('2026-11-09T10:00:00Z');

export const MONDAY_MORNING: TimeSlot = {
  start: new Date('2026-11-16T09:00:00Z'),
  end: new Date('2026-11-16T11:00:00Z'),
};

export const PARIS_11_ADDRESS: Address = { street: '12 rue Oberkampf', postalCode: '75011', city: 'Paris' };

export const LEA: Customer = { firstName: 'Léa', lastName: 'Martin', phone: '+33600000000', email: 'lea@example.com' };

export const DRESSY_PANTS_HEM: ItemRequest = { garmentType: 'pants', fabric: 'dressy', alterationCodes: ['hem-simple'] };

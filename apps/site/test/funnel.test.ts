import { describe, expect, it } from 'vitest';
import { ApiError } from '../src/api';
import { describeError, formatEuros, slotOf, toItemRequests, upcomingDays } from '../src/funnel';

describe('funnel helpers', () => {
  it('formats cents as euros, French style', () => {
    expect(formatEuros(1750)).toMatch(/^17,50\s€$/);
  });

  it('proposes the next days, starting tomorrow', () => {
    const days = upcomingDays(new Date(2026, 10, 30, 22, 15), 3);
    expect(days).toEqual([new Date(2026, 11, 1), new Date(2026, 11, 2), new Date(2026, 11, 3)]);
  });

  it('builds a slot in local time', () => {
    expect(slotOf(new Date(2026, 10, 16), [9, 11])).toEqual({
      start: new Date(2026, 10, 16, 9),
      end: new Date(2026, 10, 16, 11),
    });
  });

  it('sends only the alteration codes of the cart', () => {
    const cart = [
      { id: 1, garmentType: 'pants', fabric: 'basic' as const, alterations: [{ code: 'hem-simple', label: 'Ourlet' }] },
    ];
    expect(toItemRequests(cart)).toEqual([{ garmentType: 'pants', fabric: 'basic', alterationCodes: ['hem-simple'] }]);
  });

  it('explains the refusals the customer can act on', () => {
    expect(describeError(new ApiError(422, 'AREA_NOT_SERVED', 'no'))).toContain('Paris intra-muros');
    expect(describeError(new ApiError(500, 'INTERNAL_ERROR', 'boom'))).toContain('Réessayez');
    expect(describeError(new TypeError('Failed to fetch'))).toContain('connexion');
  });
});

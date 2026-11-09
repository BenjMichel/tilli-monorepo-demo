import { describe, expect, it } from 'vitest';
import { ApiError, type OrderTrackingRow, type TrackingStatus } from '../src/api';
import { countByStatus, describeError, mayCancel, visibleRows } from '../src/tracking';

const row = (orderId: string, status: TrackingStatus): OrderTrackingRow => ({
  orderId,
  placedAt: '2026-11-09T10:00:00.000Z',
  postalCode: '75011',
  totalCents: 1700,
  status,
  tailorId: null,
  appointment: null,
});

describe('tracking helpers', () => {
  it('counts orders per status', () => {
    const counts = countByStatus([row('a', 'unstaffed'), row('b', 'unstaffed'), row('c', 'completed')]);
    expect(counts).toMatchObject({ unstaffed: 2, completed: 1, 'searching-tailor': 0 });
  });

  it('puts unstaffed orders first, and keeps the projection order otherwise', () => {
    const rows = [row('a', 'completed'), row('b', 'unstaffed'), row('c', 'searching-tailor')];
    expect(visibleRows(rows, 'all').map((r) => r.orderId)).toEqual(['b', 'a', 'c']);
    expect(visibleRows(rows, 'completed').map((r) => r.orderId)).toEqual(['a']);
  });

  it('offers cancellation only before the intervention starts', () => {
    expect(mayCancel('tailor-assigned')).toBe(true);
    expect(mayCancel('in-progress')).toBe(false);
    expect(mayCancel('cancelled')).toBe(false);
  });

  it('explains a refused cancellation', () => {
    expect(describeError(new ApiError(409, 'ORDER_CANNOT_BE_CANCELLED', 'started'))).toContain('déjà commencé');
    expect(describeError(new TypeError('Failed to fetch'))).toBe('API injoignable.');
  });
});

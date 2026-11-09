import { describe, expect, it } from 'vitest';
import { appointmentStarts, formatExpiry } from '../src/schedule';

const iso = (dates: Date[]) => dates.map((date) => date.toISOString());

describe('appointmentStarts', () => {
  const now = new Date('2026-11-16T07:00:00Z');

  it('offers every half hour whose 30 minutes fit in a slot', () => {
    const slots = [{ start: '2026-11-16T08:00:00Z', end: '2026-11-16T09:30:00Z' }];
    expect(iso(appointmentStarts(slots, now))).toEqual([
      '2026-11-16T08:00:00.000Z',
      '2026-11-16T08:30:00.000Z',
      '2026-11-16T09:00:00.000Z',
    ]);
  });

  it('snaps a slot starting off the grid to the next half hour', () => {
    const slots = [{ start: '2026-11-16T08:10:00Z', end: '2026-11-16T09:10:00Z' }];
    expect(iso(appointmentStarts(slots, now))).toEqual(['2026-11-16T08:30:00.000Z']);
  });

  it('leaves out past starts and merges overlapping slots', () => {
    const slots = [
      { start: '2026-11-16T06:00:00Z', end: '2026-11-16T08:00:00Z' },
      { start: '2026-11-16T07:00:00Z', end: '2026-11-16T08:00:00Z' },
    ];
    expect(iso(appointmentStarts(slots, now))).toEqual(['2026-11-16T07:30:00.000Z']);
  });
});

describe('formatExpiry', () => {
  const now = new Date('2026-11-16T07:00:00Z');

  it('counts the minutes left, rounded up', () => {
    expect(formatExpiry('2026-11-16T07:04:10Z', now)).toBe('Expire dans 5 min');
    expect(formatExpiry('2026-11-16T06:59:00Z', now)).toBe('Expirée');
    expect(formatExpiry(null, now)).toBeNull();
  });
});

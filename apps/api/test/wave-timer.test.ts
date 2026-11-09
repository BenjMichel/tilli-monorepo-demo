import { type Candidate, CandidateId, MissionId } from '@tilli/dispatch';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../src/http/app';
import { SetTimeoutWaveTimer } from '../src/infrastructure/set-timeout-wave-timer';
import { createPlatform } from '../src/platform';

afterEach(() => vi.useRealTimers());

describe('SetTimeoutWaveTimer', () => {
  it('fires each expiry once its time comes', async () => {
    vi.useFakeTimers({ now: new Date('2026-11-09T10:00:00Z'), toFake: ['setTimeout', 'clearTimeout', 'Date'] });
    const fired: number[] = [];
    const timer = new SetTimeoutWaveTimer(
      () => new Date(),
      async ({ wave }) => void fired.push(wave),
    );

    await timer.schedule({ missionId: MissionId('m'), wave: 1, at: new Date('2026-11-09T10:30:00Z') });
    vi.advanceTimersByTime(29 * 60_000);
    expect(fired).toEqual([]);
    vi.advanceTimersByTime(60_000);
    expect(fired).toEqual([1]);
  });
});

describe('Platform with the real timer', () => {
  it('widens the offer to the next tailors when nobody answered in time', async () => {
    vi.useFakeTimers({ now: new Date('2026-11-09T10:00:00Z'), toFake: ['setTimeout', 'clearTimeout', 'Date'] });
    const tailor = (id: string, recentAwards: number): Candidate => ({
      id: CandidateId(id),
      base: { latitude: 48.859, longitude: 2.38 },
      radiusKm: 8,
      garmentTypes: ['pants'],
      fabrics: ['basic', 'dressy'],
      availabilities: [{ start: new Date('2026-11-16T07:00:00Z'), end: new Date('2026-11-16T19:00:00Z') }],
      recentAwards,
    });
    const platform = createPlatform({ candidates: [tailor('marie', 0), tailor('karim', 1)], waveSizes: [1, Infinity] });
    const app = buildApp(platform);
    await app.inject({
      method: 'POST',
      url: '/orders',
      payload: {
        items: [{ garmentType: 'pants', fabric: 'basic', alterationCodes: ['hem-simple'] }],
        address: { street: '12 rue Oberkampf', postalCode: '75011', city: 'Paris' },
        slots: [{ start: '2026-11-16T09:00:00Z', end: '2026-11-16T11:00:00Z' }],
        customer: { firstName: 'Léa', lastName: 'Martin', phone: '+33600000000', email: 'lea@example.com' },
        quotedPriceGridVersion: 'demo-2026-11',
      },
    });
    expect((await app.inject({ url: '/tailors/karim/offers' })).json()).toEqual([]);

    await vi.advanceTimersByTimeAsync(30 * 60_000);

    expect((await app.inject({ url: '/tailors/karim/offers' })).json()).toHaveLength(1);
    platform.stop();
  });
});

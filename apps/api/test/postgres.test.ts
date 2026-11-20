import { PGlite } from '@electric-sql/pglite';
import { type Candidate, CandidateId } from '@tilli/dispatch';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/http/app';
import { migrate } from '../src/infrastructure/postgres/migrate';
import { createPlatform } from '../src/platform';

const tailor = (id: string): Candidate => ({
  id: CandidateId(id),
  base: { latitude: 48.859, longitude: 2.38 },
  radiusKm: 8,
  garmentTypes: ['pants'],
  fabrics: ['basic', 'dressy'],
  availabilities: [{ start: new Date('2026-11-16T07:00:00Z'), end: new Date('2026-11-16T19:00:00Z') }],
  recentAwards: id === 'marie' ? 0 : 1,
});

const order = {
  items: [{ garmentType: 'pants', fabric: 'dressy', alterationCodes: ['hem-simple'] }],
  address: { street: '12 rue Oberkampf', postalCode: '75011', city: 'Paris' },
  slots: [{ start: '2026-11-16T09:00:00Z', end: '2026-11-16T11:00:00Z' }],
  customer: { firstName: 'Léa', lastName: 'Martin', phone: '+33600000000', email: 'lea@example.com' },
  quotedPriceGridVersion: 'demo-2026-11',
};

// PGlite is PostgreSQL compiled to WebAssembly: same SQL, same jsonb, no server to start.
let db: PGlite;
beforeAll(async () => {
  db = await PGlite.create();
});
afterAll(() => db.close());

let now = new Date('2026-11-09T10:00:00Z');
/** A fresh API process on the same database, as after a restart or on another instance. */
function anApiProcess() {
  const platform = createPlatform({
    database: db,
    clock: { now: () => now },
    candidates: [tailor('marie'), tailor('karim')],
    waveSizes: [1, Infinity],
    onRelayError: () => {},
  });
  return { platform, app: buildApp(platform) };
}

describe('API on PostgreSQL', () => {
  it('migrates every schema once, even when run again', async () => {
    expect(await migrate(db)).toEqual([
      'ordering/0001_orders_and_outbox',
      'dispatch/0001_missions_outbox_and_wave_timers',
      'fulfillment/0001_interventions_drafts_and_outbox',
      'admin/0001_order_tracking',
    ]);
    expect(await migrate(db)).toEqual([]);
  });

  it('carries on the journey across restarts: orders, offers, wave timers, interventions and tracking', async () => {
    const first = anApiProcess();
    const placed = await first.app.inject({ method: 'POST', url: '/orders', payload: order });
    expect(placed.statusCode).toBe(201);
    const { orderId } = placed.json();
    expect((await first.app.inject({ url: '/tailors/marie/offers' })).json()).toHaveLength(1);
    expect((await first.app.inject({ url: '/tailors/karim/offers' })).json()).toEqual([]);
    await first.app.close();

    // Restart after the deadline of the first wave: its timer is in the database.
    now = new Date('2026-11-09T10:31:00Z');
    const second = anApiProcess();
    expect(await second.platform.fireDueWaves()).toBe(1);
    const [offer] = (await second.app.inject({ url: '/tailors/karim/offers' })).json();
    expect(offer).toMatchObject({ postalCode: '75011' });
    const accepted = await second.app.inject({
      method: 'POST',
      url: `/missions/${offer.missionId}/accept`,
      payload: { tailorId: 'karim', appointmentStart: '2026-11-16T09:30:00Z' },
    });
    expect(accepted.statusCode).toBe(204);
    await second.app.close();

    now = new Date('2026-11-16T09:30:00Z');
    const third = anApiProcess();
    const [intervention] = (await third.app.inject({ url: '/tailors/karim/interventions' })).json();
    expect(intervention).toMatchObject({ status: 'scheduled', customer: { fullName: 'Léa Martin' } });
    const started = await third.app.inject({
      method: 'POST',
      url: `/interventions/${intervention.id}/start`,
      payload: { tailorId: 'karim' },
    });
    expect(started.statusCode).toBe(204);

    expect((await third.app.inject({ url: '/admin/orders' })).json()).toEqual([
      {
        orderId,
        placedAt: '2026-11-09T10:00:00.000Z',
        postalCode: '75011',
        totalCents: 1700,
        status: 'in-progress',
        tailorId: 'karim',
        appointment: { start: '2026-11-16T09:30:00.000Z', end: '2026-11-16T10:00:00.000Z' },
      },
    ]);
    const cancelled = await third.app.inject({
      method: 'POST',
      url: `/orders/${orderId}/cancel`,
      payload: { reason: 'customer request' },
    });
    expect(cancelled.statusCode).toBe(409);
    await third.app.close();

    const pending = await db.query<{ count: number }>(
      `select (select count(*) from ordering.outbox where processed_at is null)
            + (select count(*) from dispatch.outbox where processed_at is null)
            + (select count(*) from fulfillment.outbox where processed_at is null) as count`,
    );
    expect(Number(pending.rows[0]?.count)).toBe(0);
  });
});

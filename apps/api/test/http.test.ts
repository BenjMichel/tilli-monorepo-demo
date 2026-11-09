import { CandidateId, type Candidate } from '@tilli/dispatch';
import { afterEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/http/app';
import { createPlatform } from '../src/platform';

const MONDAY_ALL_DAY = { start: new Date('2026-11-16T07:00:00Z'), end: new Date('2026-11-16T19:00:00Z') };
const MONDAY_MORNING = { start: '2026-11-16T09:00:00.000Z', end: '2026-11-16T11:00:00.000Z' };

const tailor = (id: string, overrides: Partial<Candidate> = {}): Candidate => ({
  id: CandidateId(id),
  base: { latitude: 48.859, longitude: 2.38 },
  radiusKm: 8,
  garmentTypes: ['pants', 'skirt', 'dress'],
  fabrics: ['basic', 'dressy'],
  availabilities: [MONDAY_ALL_DAY],
  recentAwards: 0,
  ...overrides,
});

const order = {
  items: [{ garmentType: 'pants', fabric: 'dressy', alterationCodes: ['hem-simple'] }],
  address: { street: '12 rue Oberkampf', postalCode: '75011', city: 'Paris' },
  slots: [MONDAY_MORNING],
  customer: { firstName: 'Léa', lastName: 'Martin', phone: '+33600000000', email: 'lea@example.com' },
};

let stop: (() => void) | undefined;
afterEach(() => stop?.());

function anApi() {
  let now = new Date('2026-11-09T10:00:00Z');
  const scheduled: { missionId: string; wave: number; at: Date }[] = [];
  const platform = createPlatform({
    clock: { now: () => now },
    candidates: [tailor('marie'), tailor('karim'), tailor('sofia', { fabrics: ['basic'] })],
    timer: { schedule: async (expiry) => void scheduled.push(expiry) },
    onRelayError: () => {},
  });
  stop = platform.stop;
  const app = buildApp(platform);
  return {
    app,
    scheduled,
    setNow: (date: string) => {
      now = new Date(date);
    },
    placeOrder: async () => {
      const quote = await app.inject({ method: 'POST', url: '/quotes', payload: { items: order.items } });
      const placed = await app.inject({
        method: 'POST',
        url: '/orders',
        payload: { ...order, quotedPriceGridVersion: quote.json().priceGridVersion },
      });
      return placed.json() as { orderId: string; totalCents: number };
    },
  };
}

describe('Tilli demo API', () => {
  it('runs the whole journey over HTTP: funnel, offers, acceptance, work, admin tracking', async () => {
    const api = anApi();
    const { app } = api;

    const alterations = await app.inject({ url: '/catalog/alterations?garmentType=pants&fabric=dressy' });
    expect(alterations.json()).toContainEqual({ code: 'hem-simple', label: 'Ourlet simple (x2)', price: { cents: 1700 } });

    const { orderId, totalCents } = await api.placeOrder();
    expect(totalCents).toBe(1700);

    const offers = await app.inject({ url: '/tailors/marie/offers' });
    const [offer] = offers.json();
    expect(offer).toMatchObject({ postalCode: '75011', garmentTypes: ['pants'], fabrics: ['dressy'] });
    expect(offer).not.toHaveProperty('customer');
    expect((await app.inject({ url: '/tailors/sofia/offers' })).json()).toEqual([]);

    const accepted = await app.inject({
      method: 'POST',
      url: `/missions/${offer.missionId}/accept`,
      payload: { tailorId: 'marie', appointmentStart: '2026-11-16T09:30:00Z' },
    });
    expect(accepted.statusCode).toBe(204);

    const [intervention] = (await app.inject({ url: '/tailors/marie/interventions' })).json();
    expect(intervention).toMatchObject({
      status: 'scheduled',
      customer: { fullName: 'Léa Martin', phone: '+33600000000' },
      appointment: { start: '2026-11-16T09:30:00.000Z', end: '2026-11-16T10:00:00.000Z' },
    });

    api.setNow('2026-11-16T09:30:00Z');
    const started = await app.inject({
      method: 'POST',
      url: `/interventions/${intervention.id}/start`,
      payload: { tailorId: 'marie' },
    });
    expect(started.statusCode).toBe(204);
    api.setNow('2026-11-16T10:00:00Z');
    await app.inject({ method: 'POST', url: `/interventions/${intervention.id}/complete`, payload: { tailorId: 'marie' } });

    const tracking = (await app.inject({ url: '/admin/orders' })).json();
    expect(tracking).toEqual([
      {
        orderId,
        placedAt: '2026-11-09T10:00:00.000Z',
        postalCode: '75011',
        totalCents: 1700,
        status: 'completed',
        tailorId: 'marie',
        appointment: { start: '2026-11-16T09:30:00.000Z', end: '2026-11-16T10:00:00.000Z' },
      },
    ]);
  });

  it('answers 409 to the second tailor, and 422 to an appointment off the half-hour grid', async () => {
    const api = anApi();
    await api.placeOrder();
    const [offer] = (await api.app.inject({ url: '/tailors/marie/offers' })).json();
    const accept = (tailorId: string, appointmentStart: string) =>
      api.app.inject({ method: 'POST', url: `/missions/${offer.missionId}/accept`, payload: { tailorId, appointmentStart } });

    const offGrid = await accept('marie', '2026-11-16T09:10:00Z');
    expect(offGrid.statusCode).toBe(422);
    expect(offGrid.json().error).toBe('INVALID_APPOINTMENT');

    expect((await accept('marie', '2026-11-16T09:00:00Z')).statusCode).toBe(204);
    const tooLate = await accept('karim', '2026-11-16T09:00:00Z');
    expect(tooLate.statusCode).toBe(409);
    expect(tooLate.json().error).toBe('MISSION_ALREADY_AWARDED');
  });

  it('answers 400 to a malformed request, 404 to an unknown mission and 422 to an area not served', async () => {
    const { app } = anApi();

    expect((await app.inject({ method: 'POST', url: '/quotes', payload: { items: [] } })).statusCode).toBe(400);
    expect(
      (await app.inject({ method: 'POST', url: '/missions/nope/accept', payload: { tailorId: 'marie', appointmentStart: '2026-11-16T09:00:00Z' } }))
        .statusCode,
    ).toBe(404);
    const versailles = await app.inject({
      method: 'POST',
      url: '/orders',
      payload: { ...order, address: { ...order.address, postalCode: '78000' }, quotedPriceGridVersion: 'demo-2026-11' },
    });
    expect(versailles.statusCode).toBe(422);
    expect(versailles.json().error).toBe('AREA_NOT_SERVED');
  });

  it('cancels an order before any tailor accepts: offers disappear and admin shows it cancelled', async () => {
    const api = anApi();
    const { orderId } = await api.placeOrder();

    const cancelled = await api.app.inject({ method: 'POST', url: `/orders/${orderId}/cancel`, payload: { reason: 'oops' } });

    expect(cancelled.statusCode).toBe(204);
    expect((await api.app.inject({ url: '/tailors/marie/offers' })).json()).toEqual([]);
    expect((await api.app.inject({ url: '/admin/orders' })).json()[0].status).toBe('cancelled');
  });
});

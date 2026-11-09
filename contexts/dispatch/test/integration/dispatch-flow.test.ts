import { IntegrationEvent, type OrderPlacedV1 } from '@tilli/contracts';
import { InMemoryEventBus } from '@tilli/event-bus';
import { describe, expect, it } from 'vitest';
import type { Clock } from '../../src/application/clock';
import type { WaveTimer } from '../../src/application/ports';
import {
  CandidateId,
  InMemoryCandidateRepository,
  InMemoryMissionRepository,
  MissionId,
  StaticAreaLocator,
  createDispatchModule,
} from '../../src';
import type { MissionId as MissionIdType } from '../../src/domain/ids';
import { PARIS_15, aCandidate } from '../fixtures';

const T0 = new Date('2026-11-16T07:00:00Z');
const WAVE_DURATION_MS = 30 * 60_000;
const missionId = MissionId('mission-o-1');
const MONDAY_9AM = new Date('2026-11-16T09:00:00Z');

function orderPlaced(overrides: Partial<OrderPlacedV1['payload']> = {}): OrderPlacedV1 {
  return {
    eventId: 'ordering:o-1:placed',
    type: 'OrderPlaced',
    version: 1,
    occurredAt: T0.toISOString(),
    payload: {
      orderId: 'o-1',
      items: [{ garmentType: 'pants', fabric: 'dressy', alterations: [{ code: 'hem-simple', priceCents: 1700 }] }],
      address: { street: '12 rue Oberkampf', postalCode: '75011', city: 'Paris' },
      slots: [{ start: '2026-11-16T09:00:00Z', end: '2026-11-16T11:00:00Z' }],
      customer: { firstName: 'Léa', lastName: 'Martin', phone: '+33600000000', email: 'lea@example.com' },
      totalCents: 1700,
      priceGridVersion: 'v14',
      ...overrides,
    },
  };
}

type ScheduledExpiry = { missionId: MissionIdType; wave: number; at: Date };

/** Wires Dispatch on the in-memory bus, as the API composition root will. */
function aRunningDispatch() {
  let now = T0;
  const clock: Clock = { now: () => now };
  const scheduled: ScheduledExpiry[] = [];
  const timer: WaveTimer = { schedule: async (request) => void scheduled.push(request) };

  const bus = new InMemoryEventBus();
  const missions = new InMemoryMissionRepository(clock);
  const dispatch = createDispatchModule({
    missions,
    candidates: new InMemoryCandidateRepository([
      aCandidate('alice'),
      aCandidate('bob'),
      aCandidate('carol', { base: PARIS_15 }),
      aCandidate('basic-only', { fabrics: ['basic'] }),
    ]),
    areas: new StaticAreaLocator(),
    publisher: bus,
    timer,
    clock,
    waveSizes: [2, Infinity],
    waveDurationMs: WAVE_DURATION_MS,
  });
  bus.subscribe('OrderPlaced.v1', dispatch.subscriptions['OrderPlaced.v1']);
  bus.subscribe('OrderCancelled.v1', dispatch.subscriptions['OrderCancelled.v1']);

  return {
    bus,
    dispatch,
    scheduled,
    pendingOffers: async () =>
      (await missions.get(missionId)).offers.filter((offer) => offer.status === 'pending').map((offer) => offer.candidateId),
    status: async () => (await missions.get(missionId)).status,
    /** Moves time to the expiry of a scheduled wave and fires its timer. */
    fireTimer: async (expiry: ScheduledExpiry) => {
      now = expiry.at;
      return dispatch.commands.expireWave.execute({ missionId: expiry.missionId, wave: expiry.wave });
    },
    publishedBy: (type: IntegrationEvent['type']) => bus.published.filter((event) => event.type === type),
  };
}

describe('Dispatch, driven by integration events', () => {
  it('opens a mission on OrderPlaced, offers it, and publishes MissionAwarded when a tailor accepts', async () => {
    const app = aRunningDispatch();

    await app.bus.publish(orderPlaced());
    await app.dispatch.relay.run();

    expect(await app.pendingOffers()).toEqual([CandidateId('alice'), CandidateId('bob')]);
    expect(app.scheduled).toEqual([{ missionId, wave: 1, at: new Date(T0.getTime() + WAVE_DURATION_MS) }]);

    await app.dispatch.commands.acceptOffer.execute({ missionId, candidateId: CandidateId('bob'), appointmentStart: MONDAY_9AM });
    await app.dispatch.relay.run();

    const [awarded] = app.publishedBy('MissionAwarded');
    expect(IntegrationEvent.parse(awarded)).toMatchObject({
      type: 'MissionAwarded',
      version: 1,
      payload: { missionId: 'mission-o-1', orderId: 'o-1', tailorId: 'bob' },
    });
  });

  it('widens to a second wave when nobody answers, then publishes MissionUnstaffed', async () => {
    const app = aRunningDispatch();
    await app.bus.publish(orderPlaced());
    await app.dispatch.relay.run();

    await app.fireTimer(app.scheduled[0]!);
    await app.dispatch.relay.run();
    expect(await app.pendingOffers()).toEqual([CandidateId('carol')]);

    await app.fireTimer(app.scheduled[1]!);
    await app.dispatch.relay.run();
    expect(await app.status()).toBe('unstaffed');
    expect(app.publishedBy('MissionUnstaffed')).toEqual([
      expect.objectContaining({ payload: { missionId: 'mission-o-1', orderId: 'o-1', waves: 2 } }),
    ]);
  });

  it('starts the next wave as soon as the whole wave declined, and ignores the old timer', async () => {
    const app = aRunningDispatch();
    await app.bus.publish(orderPlaced());
    await app.dispatch.relay.run();

    await app.dispatch.commands.declineOffer.execute({ missionId, candidateId: CandidateId('alice') });
    await app.dispatch.commands.declineOffer.execute({ missionId, candidateId: CandidateId('bob') });
    await app.dispatch.relay.run();
    expect(await app.pendingOffers()).toEqual([CandidateId('carol')]);

    expect(await app.fireTimer(app.scheduled[0]!)).toBe('stale');
    expect(await app.pendingOffers()).toEqual([CandidateId('carol')]);
  });

  it('opens a single mission when OrderPlaced is delivered twice', async () => {
    const app = aRunningDispatch();

    await app.bus.publish(orderPlaced());
    await app.bus.publish(orderPlaced());
    await app.dispatch.relay.run();

    expect(app.scheduled).toHaveLength(1);
    expect(await app.pendingOffers()).toHaveLength(2);
  });

  it('closes the mission when the order is cancelled, without publishing anything', async () => {
    const app = aRunningDispatch();
    await app.bus.publish(orderPlaced());
    await app.dispatch.relay.run();

    await app.bus.publish({
      eventId: 'ordering:o-1:cancelled',
      type: 'OrderCancelled',
      version: 1,
      occurredAt: T0.toISOString(),
      payload: { orderId: 'o-1', reason: 'customer request' },
    });
    await app.dispatch.relay.run();

    expect(await app.status()).toBe('closed');
    expect(await app.pendingOffers()).toEqual([]);
    expect(app.bus.published.map((event) => event.type)).toEqual(['OrderPlaced', 'OrderCancelled']);
  });

  it('refuses an order outside the known areas, and a malformed event', async () => {
    const app = aRunningDispatch();
    const unknownArea = orderPlaced({ address: { street: '1 place d’Armes', postalCode: '78000', city: 'Versailles' } });

    await expect(app.bus.publish(unknownArea)).rejects.toThrow('No known location for postal code 78000');
    await expect(app.dispatch.subscriptions['OrderPlaced.v1']({ ...orderPlaced(), payload: {} })).rejects.toThrow();
  });
});

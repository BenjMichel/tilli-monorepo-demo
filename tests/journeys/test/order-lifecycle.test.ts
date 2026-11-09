import type { IntegrationEventKey } from '@tilli/contracts';
import {
  type Candidate,
  CandidateId,
  InMemoryCandidateRepository,
  InMemoryMissionRepository,
  MissionId,
  StaticAreaLocator,
  createDispatchModule,
} from '@tilli/dispatch';
import { InMemoryEventBus } from '@tilli/event-bus';
import {
  InMemoryInterventionDraftRepository,
  InMemoryInterventionRepository,
  InterventionId,
  TailorId,
  createFulfillmentModule,
} from '@tilli/fulfillment';
import {
  DEMO_PRICE_GRID,
  InMemoryOrderRepository,
  InMemoryPriceGrids,
  OrderId,
  PARIS_SERVICE_AREA,
  createOrderingModule,
} from '@tilli/ordering';
import { describe, expect, it } from 'vitest';

const MONDAY_MORNING = { start: new Date('2026-11-16T09:00:00Z'), end: new Date('2026-11-16T11:00:00Z') };
const MONDAY_ALL_DAY = { start: new Date('2026-11-16T08:00:00Z'), end: new Date('2026-11-16T21:00:00Z') };
/** The tailor picks a 30-minute appointment within the customer slot when accepting. */
const APPOINTMENT_START = new Date('2026-11-16T09:30:00Z');

function tailor(id: string, overrides: Partial<Omit<Candidate, 'id'>> = {}): Candidate {
  return {
    id: CandidateId(id),
    base: { latitude: 48.859, longitude: 2.38 },
    radiusKm: 10,
    garmentTypes: ['pants', 'skirt', 'dress'],
    fabrics: ['basic', 'dressy'],
    availabilities: [MONDAY_ALL_DAY],
    recentAwards: 0,
    ...overrides,
  };
}

/** What the API composition root will do: three contexts that only meet on the bus. */
function aRunningPlatform() {
  let now = new Date('2026-11-09T10:00:00Z');
  const clock = { now: () => now };
  const bus = new InMemoryEventBus();
  const orders = new InMemoryOrderRepository(clock);
  const missions = new InMemoryMissionRepository(clock);

  const ordering = createOrderingModule({
    orders,
    grids: new InMemoryPriceGrids(),
    serviceArea: PARIS_SERVICE_AREA,
    ids: { next: () => 'o-1' },
    clock,
    publisher: bus,
  });
  const dispatch = createDispatchModule({
    missions,
    candidates: new InMemoryCandidateRepository([tailor('marie'), tailor('karim'), tailor('basic-only', { fabrics: ['basic'] })]),
    areas: new StaticAreaLocator(),
    publisher: bus,
    timer: { schedule: async () => {} },
    clock,
    waveSizes: [3, Infinity],
    waveDurationMs: 30 * 60_000,
  });
  const fulfillment = createFulfillmentModule({
    interventions: new InMemoryInterventionRepository(clock),
    drafts: new InMemoryInterventionDraftRepository(),
    clock,
    publisher: bus,
  });

  for (const module of [ordering, dispatch, fulfillment]) {
    for (const [key, handler] of Object.entries(module.subscriptions)) {
      bus.subscribe(key as IntegrationEventKey, handler);
    }
  }

  return {
    bus,
    orders,
    missions,
    ordering,
    dispatch,
    fulfillment,
    setNow: (date: Date) => {
      now = date;
    },
    relayAll: async () => {
      await ordering.relay.run();
      await dispatch.relay.run();
      await fulfillment.relay.run();
    },
  };
}

type Platform = ReturnType<typeof aRunningPlatform>;

async function placeDressyPantsHem(platform: Platform) {
  const placed = await platform.ordering.commands.placeOrder.execute({
    items: [{ garmentType: 'pants', fabric: 'dressy', alterationCodes: ['hem-simple'] }],
    address: { street: '12 rue Oberkampf', postalCode: '75011', city: 'Paris' },
    slots: [MONDAY_MORNING],
    customer: { firstName: 'Léa', lastName: 'Martin', phone: '+33600000000', email: 'lea@example.com' },
    quotedPriceGridVersion: DEMO_PRICE_GRID.version,
  });
  await platform.relayAll();
  return placed.orderId;
}

const missionId = MissionId('mission-o-1');
const interventionId = InterventionId('intervention-o-1');
const marie = TailorId('marie');

describe('Order lifecycle across Ordering, Dispatch and Fulfillment', () => {
  it('goes from the website funnel to a completed order', async () => {
    const platform = aRunningPlatform();
    const orderId = await placeDressyPantsHem(platform);

    const mission = await platform.missions.get(missionId);
    expect(mission.offers.map((offer) => [offer.candidateId, offer.status])).toEqual([
      ['karim', 'pending'],
      ['marie', 'pending'],
    ]);

    await platform.dispatch.commands.acceptOffer.execute({
      missionId,
      candidateId: CandidateId('marie'),
      appointmentStart: APPOINTMENT_START,
    });
    await platform.relayAll();

    const [intervention] = await platform.fulfillment.queries.myInterventions.list(marie);
    expect(intervention?.customer).toMatchObject({ fullName: 'Léa Martin', phone: '+33600000000' });
    expect(intervention?.appointment).toEqual({ start: APPOINTMENT_START, end: new Date('2026-11-16T10:00:00Z') });

    platform.setNow(APPOINTMENT_START);
    await platform.fulfillment.commands.start({ interventionId, tailorId: marie });
    await platform.relayAll();

    await expect(platform.ordering.commands.cancelOrder.execute({ orderId, reason: 'too late' })).rejects.toThrow(
      'The tailor has already started working on the order',
    );

    platform.setNow(new Date('2026-11-16T10:30:00Z'));
    await platform.fulfillment.commands.complete({ interventionId, tailorId: marie });
    await platform.relayAll();

    expect((await platform.orders.get(OrderId(orderId))).status).toBe('completed');
    expect(platform.bus.published.map((event) => event.type)).toEqual([
      'OrderPlaced',
      'MissionAwarded',
      'InterventionStarted',
      'InterventionCompleted',
    ]);
  });

  it('withdraws the offers when the customer cancels before any tailor accepts', async () => {
    const platform = aRunningPlatform();
    const orderId = await placeDressyPantsHem(platform);

    await platform.ordering.commands.cancelOrder.execute({ orderId, reason: 'customer request' });
    await platform.relayAll();

    const mission = await platform.missions.get(missionId);
    expect(mission.status).toBe('closed');
    expect(mission.offers.every((offer) => offer.status === 'withdrawn')).toBe(true);
    expect(await platform.fulfillment.queries.myInterventions.list(marie)).toEqual([]);
  });

  it('cancels the intervention when the customer cancels after the award but before the work', async () => {
    const platform = aRunningPlatform();
    const orderId = await placeDressyPantsHem(platform);
    await platform.dispatch.commands.acceptOffer.execute({
      missionId,
      candidateId: CandidateId('marie'),
      appointmentStart: APPOINTMENT_START,
    });
    await platform.relayAll();

    await platform.ordering.commands.cancelOrder.execute({ orderId, reason: 'customer request' });
    await platform.relayAll();

    const [intervention] = await platform.fulfillment.queries.myInterventions.list(marie);
    expect(intervention?.status).toBe('cancelled');
  });
});

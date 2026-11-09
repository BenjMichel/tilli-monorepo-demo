import { MissionAwardedV1 } from '@tilli/contracts';
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
  DEMO_PRICE_GRID,
  FixedPriceGrids,
  InMemoryOrderRepository,
  PARIS_SERVICE_AREA,
  createOrderingModule,
} from '@tilli/ordering';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-11-09T10:00:00Z');
const clock = { now: () => NOW };
const MONDAY_ALL_DAY = { start: new Date('2026-11-16T08:00:00Z'), end: new Date('2026-11-16T21:00:00Z') };

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

/** What the API composition root will do: two contexts that only meet on the bus. */
function aRunningPlatform() {
  const bus = new InMemoryEventBus();
  const missions = new InMemoryMissionRepository(clock);
  const ordering = createOrderingModule({
    orders: new InMemoryOrderRepository(clock),
    grids: new FixedPriceGrids(),
    serviceArea: PARIS_SERVICE_AREA,
    ids: { next: () => 'o-1' },
    clock,
    publisher: bus,
  });
  const dispatch = createDispatchModule({
    missions,
    candidates: new InMemoryCandidateRepository([
      tailor('marie'),
      tailor('karim'),
      tailor('basic-only', { fabrics: ['basic'] }),
    ]),
    areas: new StaticAreaLocator(),
    publisher: bus,
    timer: { schedule: async () => {} },
    clock,
    waveSizes: [3, Infinity],
    waveDurationMs: 30 * 60_000,
  });
  bus.subscribe('OrderPlaced.v1', dispatch.subscriptions['OrderPlaced.v1']);
  bus.subscribe('OrderCancelled.v1', dispatch.subscriptions['OrderCancelled.v1']);

  const relayAll = async () => {
    await ordering.relay.run();
    await dispatch.relay.run();
  };
  return { bus, missions, ordering, dispatch, relayAll };
}

const placeDressyPantsHem = (ordering: ReturnType<typeof aRunningPlatform>['ordering']) =>
  ordering.commands.placeOrder.execute({
    items: [{ garmentType: 'pants', fabric: 'dressy', alterationCodes: ['hem-simple'] }],
    address: { street: '12 rue Oberkampf', postalCode: '75011', city: 'Paris' },
    slots: [{ start: new Date('2026-11-16T09:00:00Z'), end: new Date('2026-11-16T11:00:00Z') }],
    customer: { firstName: 'Léa', lastName: 'Martin', phone: '+33600000000', email: 'lea@example.com' },
    quotedPriceGridVersion: DEMO_PRICE_GRID.version,
  });

describe('From the website funnel to a tailor', () => {
  it('offers a placed order to the qualified tailors, and awards it to the first who accepts', async () => {
    const platform = aRunningPlatform();

    await placeDressyPantsHem(platform.ordering);
    await platform.relayAll();

    const mission = await platform.missions.get(MissionId('mission-o-1'));
    expect(mission.offers.map((offer) => [offer.candidateId, offer.status])).toEqual([
      ['karim', 'pending'],
      ['marie', 'pending'],
    ]);

    await platform.dispatch.commands.acceptOffer.execute({ missionId: mission.id, candidateId: CandidateId('marie') });
    await platform.relayAll();

    const awarded = platform.bus.published.find((event) => event.type === 'MissionAwarded');
    expect(MissionAwardedV1.parse(awarded).payload).toEqual({ missionId: 'mission-o-1', orderId: 'o-1', tailorId: 'marie' });
  });

  it('withdraws the offers when the customer cancels the order', async () => {
    const platform = aRunningPlatform();
    const { orderId } = await placeDressyPantsHem(platform.ordering);
    await platform.relayAll();

    await platform.ordering.commands.cancelOrder.execute({ orderId, reason: 'customer request' });
    await platform.relayAll();

    const mission = await platform.missions.get(MissionId('mission-o-1'));
    expect(mission.status).toBe('closed');
    expect(mission.offers.every((offer) => offer.status === 'withdrawn')).toBe(true);
  });
});

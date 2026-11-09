import { InterventionCompletedV1, InterventionStartedV1, type MissionAwardedV1, type OrderPlacedV1 } from '@tilli/contracts';
import { InMemoryEventBus } from '@tilli/event-bus';
import { describe, expect, it } from 'vitest';
import {
  InMemoryInterventionDraftRepository,
  InMemoryInterventionRepository,
  InterventionId,
  createFulfillmentModule,
} from '../../src';
import { DraftNotFound } from '../../src/application/upstream-reactions';
import { APPOINTMENT, KARIM, MARIE, MONDAY_MORNING } from '../fixtures';

const interventionId = InterventionId('intervention-o-1');

const orderPlaced: OrderPlacedV1 = {
  eventId: 'ordering:o-1:placed',
  type: 'OrderPlaced',
  version: 1,
  occurredAt: '2026-11-09T10:00:00Z',
  payload: {
    orderId: 'o-1',
    items: [{ garmentType: 'pants', fabric: 'dressy', alterations: [{ code: 'hem-simple', priceCents: 1700 }] }],
    address: { street: '12 rue Oberkampf', postalCode: '75011', city: 'Paris' },
    slots: [{ start: MONDAY_MORNING.start.toISOString(), end: MONDAY_MORNING.end.toISOString() }],
    customer: { firstName: 'Léa', lastName: 'Martin', phone: '+33600000000', email: 'lea@example.com' },
    totalCents: 1700,
    priceGridVersion: 'demo-2026-11',
  },
};

const missionAwarded = (tailorId: string): MissionAwardedV1 => ({
  eventId: 'dispatch:mission-o-1:awarded',
  type: 'MissionAwarded',
  version: 1,
  occurredAt: '2026-11-09T10:05:00Z',
  payload: {
    missionId: 'mission-o-1',
    orderId: 'o-1',
    tailorId,
    appointment: { start: APPOINTMENT.start.toISOString(), end: APPOINTMENT.end.toISOString() },
  },
});

const orderCancelled = {
  eventId: 'ordering:o-1:cancelled',
  type: 'OrderCancelled' as const,
  version: 1 as const,
  occurredAt: '2026-11-09T10:10:00Z',
  payload: { orderId: 'o-1', reason: 'customer request' },
};

function aRunningFulfillment() {
  let now = APPOINTMENT.start;
  const bus = new InMemoryEventBus();
  const interventions = new InMemoryInterventionRepository({ now: () => now });
  const fulfillment = createFulfillmentModule({
    interventions,
    drafts: new InMemoryInterventionDraftRepository(),
    clock: { now: () => now },
    publisher: bus,
  });
  for (const [key, handler] of Object.entries(fulfillment.subscriptions)) {
    bus.subscribe(key as keyof typeof fulfillment.subscriptions, handler);
  }
  return {
    bus,
    interventions,
    fulfillment,
    setNow: (date: Date) => {
      now = date;
    },
  };
}

describe('Fulfillment, driven by integration events', () => {
  it('shows the customer details to the awarded tailor only, then publishes the start and the end of the work', async () => {
    const app = aRunningFulfillment();

    await app.bus.publish(orderPlaced);
    await app.bus.publish(missionAwarded('marie'));

    const [mine] = await app.fulfillment.queries.myInterventions.list(MARIE);
    expect(mine).toMatchObject({ id: interventionId, status: 'scheduled', customer: { fullName: 'Léa Martin', phone: '+33600000000' } });
    expect(await app.fulfillment.queries.myInterventions.list(KARIM)).toEqual([]);

    await app.fulfillment.commands.start({ interventionId, tailorId: MARIE });
    app.setNow(new Date('2026-11-16T10:30:00Z'));
    await app.fulfillment.commands.complete({ interventionId, tailorId: MARIE });
    await app.fulfillment.relay.run();

    const published = app.bus.published.slice(2);
    expect(InterventionStartedV1.parse(published[0]).payload).toEqual({
      interventionId: 'intervention-o-1',
      orderId: 'o-1',
      startedAt: '2026-11-16T09:30:00.000Z',
    });
    expect(InterventionCompletedV1.parse(published[1]).payload.completedAt).toBe('2026-11-16T10:30:00.000Z');
  });

  it('schedules a single intervention when MissionAwarded is delivered twice', async () => {
    const app = aRunningFulfillment();
    await app.bus.publish(orderPlaced);

    await app.bus.publish(missionAwarded('marie'));
    await app.bus.publish(missionAwarded('marie'));

    expect(app.interventions.outbox.map((entry) => entry.event.type)).toEqual(['InterventionScheduled']);
  });

  it('fails on a MissionAwarded that overtook its OrderPlaced, so that it is delivered again later', async () => {
    const app = aRunningFulfillment();

    await expect(app.bus.publish(missionAwarded('marie'))).rejects.toThrow(DraftNotFound);

    await app.bus.publish(orderPlaced);
    await app.bus.publish(missionAwarded('marie'));
    expect((await app.interventions.get(interventionId)).status).toBe('scheduled');
  });

  it('tells the winning tailor at once when the order was cancelled while the mission was being awarded', async () => {
    const app = aRunningFulfillment();
    await app.bus.publish(orderPlaced);

    await app.bus.publish(orderCancelled);
    await app.bus.publish(missionAwarded('marie'));

    expect((await app.interventions.get(interventionId)).status).toBe('cancelled');
  });

  it('keeps an intervention in progress when a late cancellation arrives, and flags it for ops', async () => {
    const app = aRunningFulfillment();
    await app.bus.publish(orderPlaced);
    await app.bus.publish(missionAwarded('marie'));
    await app.fulfillment.commands.start({ interventionId, tailorId: MARIE });

    await app.bus.publish(orderCancelled);

    expect((await app.interventions.get(interventionId)).status).toBe('in-progress');
    expect(app.interventions.outbox.at(-1)?.event.type).toBe('LateCancellationReceived');
  });
});

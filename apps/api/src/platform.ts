import { randomUUID } from 'node:crypto';
import type { IntegrationEventKey } from '@tilli/contracts';
import {
  type Candidate,
  createDispatchModule,
  InMemoryCandidateRepository,
  InMemoryMissionRepository,
  StaticAreaLocator,
  type WaveTimer,
} from '@tilli/dispatch';
import { InMemoryEventBus } from '@tilli/event-bus';
import {
  createFulfillmentModule,
  InMemoryInterventionDraftRepository,
  InMemoryInterventionRepository,
} from '@tilli/fulfillment';
import { createOrderingModule, InMemoryOrderRepository, InMemoryPriceGrids, PARIS_SERVICE_AREA } from '@tilli/ordering';
import { OrderTrackingProjection } from './admin/order-tracking';
import { SetTimeoutWaveTimer } from './infrastructure/set-timeout-wave-timer';

type Clock = { now(): Date };

export type PlatformOptions = {
  readonly clock?: Clock;
  readonly candidates?: readonly Candidate[];
  /** Defaults to a setTimeout timer that expires the wave and pumps the outboxes. */
  readonly timer?: WaveTimer;
  readonly waveSizes?: readonly number[];
  readonly waveDurationMs?: number;
  readonly onRelayError?: (relay: string, error: unknown) => void;
};

const ALL_EVENTS: IntegrationEventKey[] = [
  'OrderPlaced.v1',
  'OrderCancelled.v1',
  'MissionAwarded.v1',
  'MissionUnstaffed.v1',
  'InterventionStarted.v1',
  'InterventionCompleted.v1',
];

/**
 * Composition root: the only place that knows all three contexts. It picks the adapters,
 * subscribes each context to the bus and drains the outboxes.
 */
export function createPlatform(options: PlatformOptions = {}) {
  const clock = options.clock ?? { now: () => new Date() };
  const bus = new InMemoryEventBus();
  const tracking = new OrderTrackingProjection();

  const defaultTimer = new SetTimeoutWaveTimer(
    () => clock.now(),
    async ({ missionId, wave }) => {
      await dispatch.commands.expireWave.execute({ missionId, wave });
      await pump();
    },
  );

  const ordering = createOrderingModule({
    orders: new InMemoryOrderRepository(clock),
    grids: new InMemoryPriceGrids(),
    serviceArea: PARIS_SERVICE_AREA,
    ids: { next: () => randomUUID() },
    clock,
    publisher: bus,
  });
  const dispatch = createDispatchModule({
    missions: new InMemoryMissionRepository(clock),
    candidates: new InMemoryCandidateRepository(options.candidates ?? []),
    areas: new StaticAreaLocator(),
    publisher: bus,
    timer: options.timer ?? defaultTimer,
    clock,
    waveSizes: options.waveSizes ?? [3, 5, Infinity],
    waveDurationMs: options.waveDurationMs ?? 30 * 60_000,
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
  for (const key of ALL_EVENTS) bus.subscribe(key, tracking.apply);

  const relays = { ordering: ordering.relay, dispatch: dispatch.relay, fulfillment: fulfillment.relay };
  const onRelayError = options.onRelayError ?? ((relay, error) => console.warn(`[relay:${relay}]`, error));

  /**
   * Drains every outbox until nothing moves. A failing relay keeps its entry pending and is
   * retried on the next pump. Pumps are serialised so an entry is never relayed twice at once.
   */
  let queue: Promise<void> = Promise.resolve();
  async function drain(): Promise<void> {
    for (let round = 0; round < 50; round++) {
      let moved = 0;
      for (const [name, relay] of Object.entries(relays)) {
        try {
          moved += await relay.run();
        } catch (error) {
          onRelayError(name, error);
        }
      }
      if (moved === 0) return;
    }
  }
  function pump(): Promise<void> {
    queue = queue.then(drain);
    return queue;
  }

  return {
    clock,
    bus,
    ordering,
    dispatch,
    fulfillment,
    tracking,
    pump,
    stop: () => defaultTimer.stop(),
  };
}

export type Platform = ReturnType<typeof createPlatform>;

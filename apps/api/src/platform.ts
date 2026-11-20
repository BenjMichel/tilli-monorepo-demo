import { randomUUID } from 'node:crypto';
import type { IntegrationEventKey } from '@tilli/contracts';
import {
  type Candidate,
  createDispatchModule,
  InMemoryCandidateRepository,
  InMemoryMissionRepository,
  type MissionId,
  PostgresMissionRepository,
  PostgresWaveTimer,
  StaticAreaLocator,
  type WaveTimer,
} from '@tilli/dispatch';
import { InMemoryEventBus } from '@tilli/event-bus';
import {
  createFulfillmentModule,
  InMemoryInterventionDraftRepository,
  InMemoryInterventionRepository,
  PostgresInterventionDraftRepository,
  PostgresInterventionRepository,
} from '@tilli/fulfillment';
import {
  createOrderingModule,
  InMemoryOrderRepository,
  InMemoryPriceGrids,
  PARIS_SERVICE_AREA,
  PostgresOrderRepository,
} from '@tilli/ordering';
import { InMemoryOrderTrackingStore, OrderTrackingProjection } from './admin/order-tracking';
import { PostgresOrderTrackingStore } from './admin/postgres-order-tracking-store';
import type { SqlDatabase } from './infrastructure/postgres/database';
import { SetTimeoutWaveTimer } from './infrastructure/set-timeout-wave-timer';

type Clock = { now(): Date };

export type PlatformOptions = {
  readonly clock?: Clock;
  readonly candidates?: readonly Candidate[];
  /**
   * Migrated PostgreSQL database (see `migrate`). Without it, everything lives in memory and
   * is lost on restart. Tailor candidates stay in memory either way: they come from the seed (ADR 0005).
   */
  readonly database?: SqlDatabase;
  /**
   * Defaults to a setTimeout timer in memory, and to the `dispatch.wave_timers` table with a
   * database: `fireDueWaves` must then be polled. Either way, the wave expires and the outboxes are pumped.
   */
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
  const db = options.database;
  const tracking = new OrderTrackingProjection(
    db ? new PostgresOrderTrackingStore(db) : new InMemoryOrderTrackingStore(),
  );

  const expireWave = async ({ missionId, wave }: { missionId: MissionId; wave: number }) => {
    await dispatch.commands.expireWave.execute({ missionId, wave });
    await pump();
  };
  const memoryTimer = new SetTimeoutWaveTimer(() => clock.now(), expireWave);
  const databaseTimer = db ? new PostgresWaveTimer(db) : null;

  const ordering = createOrderingModule({
    orders: db ? new PostgresOrderRepository(db, clock) : new InMemoryOrderRepository(clock),
    grids: new InMemoryPriceGrids(),
    serviceArea: PARIS_SERVICE_AREA,
    ids: { next: () => randomUUID() },
    clock,
    publisher: bus,
  });
  const dispatch = createDispatchModule({
    missions: db ? new PostgresMissionRepository(db, clock) : new InMemoryMissionRepository(clock),
    candidates: new InMemoryCandidateRepository(options.candidates ?? []),
    areas: new StaticAreaLocator(),
    publisher: bus,
    timer: options.timer ?? databaseTimer ?? memoryTimer,
    clock,
    waveSizes: options.waveSizes ?? [3, 5, Infinity],
    waveDurationMs: options.waveDurationMs ?? 30 * 60_000,
  });
  const fulfillment = createFulfillmentModule({
    interventions: db ? new PostgresInterventionRepository(db, clock) : new InMemoryInterventionRepository(clock),
    drafts: db ? new PostgresInterventionDraftRepository(db) : new InMemoryInterventionDraftRepository(),
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

  /** Expires the waves whose deadline passed, when the timers live in the database. */
  async function fireDueWaves(): Promise<number> {
    if (!databaseTimer || options.timer) return 0;
    return databaseTimer.fireDue(clock.now(), expireWave, (expiry, error) =>
      console.warn(`[wave-timer] ${expiry.missionId} wave ${expiry.wave}`, error),
    );
  }

  return {
    clock,
    bus,
    ordering,
    dispatch,
    fulfillment,
    tracking,
    pump,
    fireDueWaves,
    stop: () => memoryTimer.stop(),
  };
}

export type Platform = ReturnType<typeof createPlatform>;

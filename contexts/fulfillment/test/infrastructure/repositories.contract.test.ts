import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { InterventionOutbox } from '../../src/application/ports';
import { InterventionId, OrderId } from '../../src/domain/ids';
import { Intervention } from '../../src/domain/intervention';
import type { InterventionDraftRepository } from '../../src/domain/intervention-draft';
import {
  InterventionConcurrencyConflict,
  InterventionNotFound,
  type InterventionRepository,
} from '../../src/domain/intervention-repository';
import {
  InMemoryInterventionDraftRepository,
  InMemoryInterventionRepository,
} from '../../src/infrastructure/in-memory-repositories';
import { FULFILLMENT_MIGRATIONS } from '../../src/infrastructure/postgres/migrations';
import {
  PostgresInterventionDraftRepository,
  PostgresInterventionRepository,
} from '../../src/infrastructure/postgres/postgres-repositories';
import { APPOINTMENT, aDraft, KARIM, MARIE } from '../fixtures';

type Repositories = { interventions: InterventionRepository & InterventionOutbox; drafts: InterventionDraftRepository };

const clock = { now: () => APPOINTMENT.start };

let db: PGlite;
beforeAll(async () => {
  db = await PGlite.create();
  for (const migration of FULFILLMENT_MIGRATIONS) await db.exec(migration.sql);
});
afterAll(() => db.close());

const implementations: [string, () => Promise<Repositories>][] = [
  [
    'in memory',
    async () => ({
      interventions: new InMemoryInterventionRepository(clock),
      drafts: new InMemoryInterventionDraftRepository(),
    }),
  ],
  [
    'PostgreSQL',
    async () => {
      await db.exec('truncate fulfillment.interventions, fulfillment.intervention_drafts, fulfillment.outbox');
      return {
        interventions: new PostgresInterventionRepository(db, clock),
        drafts: new PostgresInterventionDraftRepository(db),
      };
    },
  ],
];

const scheduledFor = (orderId: string, tailor = MARIE) =>
  Intervention.schedule(aDraft({ orderId: OrderId(orderId) }), tailor, APPOINTMENT);

describe.each(implementations)('Fulfillment repositories (%s)', (_name, theRepositories) => {
  let repositories: Repositories;
  beforeEach(async () => {
    repositories = await theRepositories();
  });

  it('gives back the intervention it saved, dates included, one version up', async () => {
    const { interventions } = repositories;
    const intervention = scheduledFor('o-1');
    await interventions.save(intervention);
    const started = await interventions.get(intervention.id);
    started.start(MARIE, APPOINTMENT.start);
    await interventions.save(started);

    const loaded = await interventions.get(intervention.id);

    expect(loaded.toSnapshot()).toEqual({ ...started.toSnapshot(), version: 2 });
    expect(loaded.toSnapshot().startedAt).toEqual(APPOINTMENT.start);
    expect(await interventions.exists(intervention.id)).toBe(true);
    await expect(interventions.get(InterventionId('nope'))).rejects.toThrow(InterventionNotFound);
  });

  it("lists a tailor's interventions only", async () => {
    const { interventions } = repositories;
    await interventions.save(scheduledFor('o-1', MARIE));
    await interventions.save(scheduledFor('o-2', KARIM));
    await interventions.save(scheduledFor('o-3', MARIE));

    const ofMarie = await interventions.findByTailor(MARIE);

    expect(ofMarie.map((intervention) => intervention.id).sort()).toEqual(['intervention-o-1', 'intervention-o-3']);
  });

  it('refuses a save from a stale copy', async () => {
    const { interventions } = repositories;
    await interventions.save(scheduledFor('o-1'));
    const first = await interventions.get(InterventionId('intervention-o-1'));
    const second = await interventions.get(InterventionId('intervention-o-1'));
    first.start(MARIE, APPOINTMENT.start);
    second.start(MARIE, APPOINTMENT.start);

    await interventions.save(first);
    await expect(interventions.save(second)).rejects.toThrow(InterventionConcurrencyConflict);
    expect((await interventions.pending()).map((entry) => entry.event.type)).toEqual([
      'InterventionScheduled',
      'InterventionStarted',
    ]);
  });

  it('keeps events in the outbox until they are processed', async () => {
    const { interventions } = repositories;
    await interventions.save(scheduledFor('o-1'));

    const [scheduled] = await interventions.pending();
    expect(scheduled?.id).toBe('intervention-o-1:v1:0');
    expect(scheduled?.occurredAt).toEqual(APPOINTMENT.start);
    expect(scheduled?.event.type === 'InterventionScheduled' && scheduled.event.appointment).toEqual(APPOINTMENT);

    await interventions.markProcessed('intervention-o-1:v1:0');
    expect(await interventions.pending()).toEqual([]);
  });

  it('keeps one draft per order, the last one saved', async () => {
    const { drafts } = repositories;
    expect(await drafts.find(OrderId('o-1'))).toBeNull();

    await drafts.save(aDraft());
    await drafts.save(aDraft({ cancelled: true }));

    expect(await drafts.find(OrderId('o-1'))).toEqual(aDraft({ cancelled: true }));
  });
});

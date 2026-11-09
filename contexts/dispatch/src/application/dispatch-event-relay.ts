import type { IntegrationEvent } from '@tilli/contracts';
import type { MissionEvent } from '../domain/mission-events';
import type { LaunchNextWave } from './launch-next-wave';
import type { IntegrationEventPublisher, MissionOutbox, OutboxEntry, WaveTimer } from './ports';

/**
 * Drains the outbox. Each domain event either drives an internal policy (next wave,
 * wave timer) or becomes a public integration event; most become neither.
 * An entry is marked processed only after its handling succeeded, so a failure is retried.
 */
export class DispatchEventRelay {
  constructor(
    private readonly outbox: MissionOutbox,
    private readonly publisher: IntegrationEventPublisher,
    private readonly timer: WaveTimer,
    private readonly launchNextWave: LaunchNextWave,
    private readonly maxRounds = 100,
  ) {}

  /** Runs until the outbox is empty, since handling an event can append new ones. */
  async run(): Promise<number> {
    let relayed = 0;
    for (let round = 0; round < this.maxRounds; round++) {
      const entries = await this.outbox.pending();
      if (entries.length === 0) return relayed;
      for (const entry of entries) {
        await this.handle(entry);
        await this.outbox.markProcessed(entry.id);
        relayed++;
      }
    }
    throw new Error(`Outbox still not empty after ${this.maxRounds} rounds`);
  }

  private async handle({ id, occurredAt, event }: OutboxEntry): Promise<void> {
    switch (event.type) {
      case 'MissionOpened':
      case 'OfferDeclined':
      case 'OfferWaveExpired':
        await this.launchNextWave.execute({ missionId: event.missionId });
        return;
      case 'OfferWaveLaunched':
        await this.timer.schedule({ missionId: event.missionId, wave: event.wave, at: event.expiresAt });
        return;
      case 'MissionAwarded':
      case 'MissionUnstaffed':
        await this.publisher.publish(toIntegrationEvent(id, occurredAt, event));
        return;
      case 'MissionClosed':
        return;
      default:
        return assertNever(event);
    }
  }
}

function toIntegrationEvent(
  eventId: string,
  occurredAt: Date,
  event: Extract<MissionEvent, { type: 'MissionAwarded' | 'MissionUnstaffed' }>,
): IntegrationEvent {
  const envelope = { eventId, version: 1 as const, occurredAt: occurredAt.toISOString() };
  if (event.type === 'MissionAwarded') {
    return {
      ...envelope,
      type: 'MissionAwarded',
      payload: { missionId: event.missionId, orderId: event.orderId, tailorId: event.candidateId },
    };
  }
  return {
    ...envelope,
    type: 'MissionUnstaffed',
    payload: { missionId: event.missionId, orderId: event.orderId, waves: event.waves },
  };
}

function assertNever(value: never): never {
  throw new Error(`Unhandled mission event: ${JSON.stringify(value)}`);
}

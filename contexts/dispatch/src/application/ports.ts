import type { IntegrationEvent } from '@tilli/contracts';
import type { MissionId } from '../domain/ids';
import type { MissionEvent } from '../domain/mission-events';

/** A domain event saved in the same transaction as the mission, waiting to be relayed. */
export type OutboxEntry = {
  readonly id: string;
  readonly occurredAt: Date;
  readonly event: MissionEvent;
};

export interface MissionOutbox {
  pending(): Promise<OutboxEntry[]>;
  markProcessed(id: string): Promise<void>;
}

export interface IntegrationEventPublisher {
  publish(event: IntegrationEvent): Promise<void>;
}

/** Calls ExpireWave for this mission and wave once `at` is reached. */
export interface WaveTimer {
  schedule(request: { missionId: MissionId; wave: number; at: Date }): Promise<void>;
}

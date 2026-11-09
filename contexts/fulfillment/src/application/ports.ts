import type { IntegrationEvent } from '@tilli/contracts';
import type { InterventionEvent } from '../domain/intervention-events';

export interface Clock {
  now(): Date;
}

export type OutboxEntry = {
  readonly id: string;
  readonly occurredAt: Date;
  readonly event: InterventionEvent;
};

export interface InterventionOutbox {
  pending(): Promise<OutboxEntry[]>;
  markProcessed(id: string): Promise<void>;
}

export interface IntegrationEventPublisher {
  publish(event: IntegrationEvent): Promise<void>;
}

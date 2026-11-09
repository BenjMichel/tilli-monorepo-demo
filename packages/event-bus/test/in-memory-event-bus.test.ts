import type { MissionAwardedV1 } from '@tilli/contracts';
import { describe, expect, it } from 'vitest';
import { InMemoryEventBus } from '../src';

const awarded: MissionAwardedV1 = {
  eventId: 'evt-1',
  type: 'MissionAwarded',
  version: 1,
  occurredAt: '2026-11-09T10:00:00Z',
  payload: { missionId: 'm-1', orderId: 'o-1', tailorId: 'alice' },
};

describe('InMemoryEventBus', () => {
  it('delivers an event to the subscribers of its type and version only', async () => {
    const bus = new InMemoryEventBus();
    const received: string[] = [];
    bus.subscribe('MissionAwarded.v1', async (event) => {
      received.push(`awarded:${event.payload.tailorId}`);
    });
    bus.subscribe('MissionUnstaffed.v1', async () => {
      received.push('unstaffed');
    });

    await bus.publish(awarded);

    expect(received).toEqual(['awarded:alice']);
    expect(bus.published).toEqual([awarded]);
  });

  it('fails the publish when a handler fails', async () => {
    const bus = new InMemoryEventBus();
    bus.subscribe('MissionAwarded.v1', async () => {
      throw new Error('boom');
    });

    await expect(bus.publish(awarded)).rejects.toThrow('boom');
  });
});

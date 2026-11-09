import { describe, expect, it } from 'vitest';
import { InvalidTransition, NotAssignedTailor, TooEarlyToStart } from '../../src/domain/errors';
import { Intervention } from '../../src/domain/intervention';
import { APPOINTMENT, KARIM, MARIE, aDraft } from '../fixtures';

const LATER = new Date('2026-11-16T10:30:00Z');

function scheduled(): Intervention {
  const intervention = Intervention.schedule(aDraft(), MARIE, APPOINTMENT);
  intervention.pullEvents();
  return intervention;
}

function started(): Intervention {
  const intervention = scheduled();
  intervention.start(MARIE, APPOINTMENT.start);
  intervention.pullEvents();
  return intervention;
}

const typesOf = (intervention: Intervention) => intervention.pullEvents().map((event) => event.type);

describe('Intervention', () => {
  it('is scheduled at the appointment the tailor picked, with an id derived from the order', () => {
    const intervention = Intervention.schedule(aDraft(), MARIE, APPOINTMENT);

    expect(intervention.id).toBe('intervention-o-1');
    expect(intervention.status).toBe('scheduled');
    expect(intervention.toSnapshot().appointment).toEqual(APPOINTMENT);
    expect(intervention.pullEvents()).toEqual([
      {
        type: 'InterventionScheduled',
        interventionId: 'intervention-o-1',
        orderId: 'o-1',
        tailorId: MARIE,
        appointment: APPOINTMENT,
      },
    ]);
  });

  it('is cancelled right away when the order was cancelled while the mission was being awarded', () => {
    const intervention = Intervention.schedule(aDraft({ cancelled: true }), MARIE, APPOINTMENT);

    expect(intervention.status).toBe('cancelled');
    expect(typesOf(intervention)).toEqual(['InterventionScheduled', 'InterventionCancelled']);
  });

  describe('work', () => {
    it('starts at the appointment and completes afterwards', () => {
      const intervention = scheduled();

      intervention.start(MARIE, APPOINTMENT.start);
      intervention.complete(MARIE, LATER);

      expect(intervention.status).toBe('completed');
      expect(intervention.pullEvents()).toEqual([
        { type: 'InterventionStarted', interventionId: 'intervention-o-1', orderId: 'o-1', startedAt: APPOINTMENT.start },
        { type: 'InterventionCompleted', interventionId: 'intervention-o-1', orderId: 'o-1', completedAt: LATER },
      ]);
    });

    it('cannot start before the appointment, nor twice', () => {
      expect(() => scheduled().start(MARIE, new Date('2026-11-16T09:29:00Z'))).toThrow(TooEarlyToStart);
      expect(() => started().start(MARIE, LATER)).toThrow(InvalidTransition);
    });

    it('cannot complete an intervention that has not started', () => {
      expect(() => scheduled().complete(MARIE, LATER)).toThrow(InvalidTransition);
    });

    it('only lets the assigned tailor act', () => {
      expect(() => scheduled().start(KARIM, APPOINTMENT.start)).toThrow(NotAssignedTailor);
      expect(() => started().complete(KARIM, LATER)).toThrow(NotAssignedTailor);
    });
  });

  describe('order cancellation', () => {
    it('cancels the intervention before the work starts', () => {
      const intervention = scheduled();

      intervention.cancel();
      intervention.cancel();

      expect(intervention.status).toBe('cancelled');
      expect(typesOf(intervention)).toEqual(['InterventionCancelled']);
      expect(() => intervention.start(MARIE, APPOINTMENT.start)).toThrow(InvalidTransition);
    });

    it('cannot undo work already started: the work goes on and ops are alerted once', () => {
      const intervention = started();

      intervention.cancel();
      intervention.cancel();

      expect(intervention.status).toBe('in-progress');
      expect(typesOf(intervention)).toEqual(['LateCancellationReceived']);
    });
  });
});

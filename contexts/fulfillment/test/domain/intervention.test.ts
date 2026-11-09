import { describe, expect, it } from 'vitest';
import { InvalidTransition, NotAssignedTailor, SlotNotProposed, TooEarlyToStart } from '../../src/domain/errors';
import { Intervention } from '../../src/domain/intervention';
import { KARIM, MARIE, MONDAY_EVENING, MONDAY_MORNING, aDraft } from '../fixtures';

const AT_APPOINTMENT = MONDAY_MORNING.start;
const LATER = new Date('2026-11-16T10:30:00Z');

function scheduled(): Intervention {
  const intervention = Intervention.schedule(aDraft(), MARIE);
  intervention.pullEvents();
  return intervention;
}

function confirmed(): Intervention {
  const intervention = scheduled();
  intervention.confirmAppointment(MARIE, MONDAY_MORNING);
  intervention.pullEvents();
  return intervention;
}

function started(): Intervention {
  const intervention = confirmed();
  intervention.start(MARIE, AT_APPOINTMENT);
  intervention.pullEvents();
  return intervention;
}

const typesOf = (intervention: Intervention) => intervention.pullEvents().map((event) => event.type);

describe('Intervention', () => {
  it('is scheduled for the tailor who won the mission, with an id derived from the order', () => {
    const intervention = Intervention.schedule(aDraft(), MARIE);

    expect(intervention.id).toBe('intervention-o-1');
    expect(intervention.status).toBe('scheduled');
    expect(intervention.pullEvents()).toEqual([
      { type: 'InterventionScheduled', interventionId: 'intervention-o-1', orderId: 'o-1', tailorId: MARIE },
    ]);
  });

  it('is cancelled right away when the order was cancelled while the mission was being awarded', () => {
    const intervention = Intervention.schedule(aDraft({ cancelled: true }), MARIE);

    expect(intervention.status).toBe('cancelled');
    expect(typesOf(intervention)).toEqual(['InterventionScheduled', 'InterventionCancelled']);
  });

  describe('appointment', () => {
    it('is one of the slots the customer proposed, and can change until the work starts', () => {
      const intervention = scheduled();

      intervention.confirmAppointment(MARIE, MONDAY_MORNING);
      intervention.confirmAppointment(MARIE, MONDAY_EVENING);

      expect(intervention.status).toBe('appointment-confirmed');
      expect(intervention.toSnapshot().appointment).toEqual(MONDAY_EVENING);
    });

    it('refuses a slot the customer did not propose', () => {
      const tuesday = { start: new Date('2026-11-17T09:00:00Z'), end: new Date('2026-11-17T11:00:00Z') };

      expect(() => scheduled().confirmAppointment(MARIE, tuesday)).toThrow(SlotNotProposed);
    });

    it('cannot change once the work started', () => {
      expect(() => started().confirmAppointment(MARIE, MONDAY_EVENING)).toThrow(InvalidTransition);
    });
  });

  describe('work', () => {
    it('starts at the appointment and completes afterwards', () => {
      const intervention = confirmed();

      intervention.start(MARIE, AT_APPOINTMENT);
      intervention.complete(MARIE, LATER);

      expect(intervention.status).toBe('completed');
      expect(intervention.pullEvents()).toEqual([
        { type: 'InterventionStarted', interventionId: 'intervention-o-1', orderId: 'o-1', startedAt: AT_APPOINTMENT },
        { type: 'InterventionCompleted', interventionId: 'intervention-o-1', orderId: 'o-1', completedAt: LATER },
      ]);
    });

    it('cannot start without a confirmed appointment, nor before it', () => {
      expect(() => scheduled().start(MARIE, AT_APPOINTMENT)).toThrow(InvalidTransition);
      expect(() => confirmed().start(MARIE, new Date('2026-11-16T08:59:00Z'))).toThrow(TooEarlyToStart);
    });

    it('cannot complete an intervention that has not started', () => {
      expect(() => confirmed().complete(MARIE, LATER)).toThrow(InvalidTransition);
    });

    it('only lets the assigned tailor act', () => {
      expect(() => scheduled().confirmAppointment(KARIM, MONDAY_MORNING)).toThrow(NotAssignedTailor);
      expect(() => confirmed().start(KARIM, AT_APPOINTMENT)).toThrow(NotAssignedTailor);
      expect(() => started().complete(KARIM, LATER)).toThrow(NotAssignedTailor);
    });
  });

  describe('order cancellation', () => {
    it('cancels the intervention before the work starts', () => {
      const intervention = confirmed();

      intervention.cancel();
      intervention.cancel();

      expect(intervention.status).toBe('cancelled');
      expect(typesOf(intervention)).toEqual(['InterventionCancelled']);
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

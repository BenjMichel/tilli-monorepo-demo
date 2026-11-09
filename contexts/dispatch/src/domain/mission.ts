import {
  InvalidAppointment,
  InvalidWave,
  MissionAlreadyAwarded,
  MissionNotOffering,
  OfferExpired,
  OfferNotFound,
  OfferNotPending,
  WaveNotYetExpired,
  WaveStillActive,
} from './errors';
import type { CandidateId, MissionId, OrderId } from './ids';
import type { MissionEvent } from './mission-events';
import { copyRequirements, type MissionRequirements } from './mission-requirements';
import { TimeSlot, copyTimeSlot, isWithin } from './time-slot';

export const APPOINTMENT_DURATION_MS = 30 * 60_000;

export type MissionStatus = 'open' | 'offering' | 'awarded' | 'unstaffed' | 'closed';
export type OfferStatus = 'pending' | 'accepted' | 'declined' | 'withdrawn' | 'expired';

export type Offer = {
  readonly candidateId: CandidateId;
  readonly wave: number;
  status: OfferStatus;
};

export type OfferWave = {
  readonly number: number;
  readonly expiresAt: Date;
};

export type MissionSnapshot = {
  readonly id: MissionId;
  readonly orderId: OrderId;
  readonly requirements: MissionRequirements;
  readonly maxWaves: number;
  status: MissionStatus;
  waves: OfferWave[];
  offers: Offer[];
  awardedTo: CandidateId | null;
  appointment: TimeSlot | null;
  readonly version: number;
};

/**
 * Aggregate root of the Dispatch context: finds exactly one tailor for an order.
 * Offers are sent in parallel, wave after wave; the first acceptance wins.
 */
export class Mission {
  private pendingEvents: MissionEvent[] = [];

  private constructor(private readonly state: MissionSnapshot) {}

  static open(params: {
    id: MissionId;
    orderId: OrderId;
    requirements: MissionRequirements;
    maxWaves: number;
  }): Mission {
    if (!Number.isInteger(params.maxWaves) || params.maxWaves < 1) {
      throw new RangeError(`maxWaves must be a positive integer, got ${params.maxWaves}`);
    }
    const mission = new Mission({
      id: params.id,
      orderId: params.orderId,
      requirements: copyRequirements(params.requirements),
      maxWaves: params.maxWaves,
      status: 'open',
      waves: [],
      offers: [],
      awardedTo: null,
      appointment: null,
      version: 0,
    });
    mission.record({ type: 'MissionOpened', missionId: params.id, orderId: params.orderId });
    return mission;
  }

  static restore(snapshot: MissionSnapshot): Mission {
    return new Mission(copyOf(snapshot));
  }

  toSnapshot(): MissionSnapshot {
    return copyOf(this.state);
  }

  get id(): MissionId {
    return this.state.id;
  }

  get status(): MissionStatus {
    return this.state.status;
  }

  get awardedTo(): CandidateId | null {
    return this.state.awardedTo;
  }

  get appointment(): TimeSlot | null {
    return this.state.appointment;
  }

  get version(): number {
    return this.state.version;
  }

  get offers(): readonly Readonly<Offer>[] {
    return this.state.offers;
  }

  get requirements(): MissionRequirements {
    return this.state.requirements;
  }

  get waveCount(): number {
    return this.state.waves.length;
  }

  get solicitedCandidateIds(): ReadonlySet<CandidateId> {
    return new Set(this.state.offers.map((offer) => offer.candidateId));
  }

  /** True when the current wave has no pending offer left and another wave is allowed. */
  get needsNextWave(): boolean {
    return (
      (this.state.status === 'open' || this.state.status === 'offering') &&
      this.pendingOffers().length === 0 &&
      this.state.waves.length < this.state.maxWaves
    );
  }

  pullEvents(): MissionEvent[] {
    const events = this.pendingEvents;
    this.pendingEvents = [];
    return events;
  }

  launchWave(candidateIds: readonly CandidateId[], expiresAt: Date, now: Date): void {
    this.assertActive();
    // No max-waves check needed: the last wave ending moves the mission to 'unstaffed'.
    if (this.pendingOffers().length > 0) throw new WaveStillActive(this.state.id);
    if (candidateIds.length === 0) throw new InvalidWave('A wave needs at least one candidate');
    if (expiresAt <= now) throw new InvalidWave('A wave deadline must be in the future');
    if (new Set(candidateIds).size !== candidateIds.length) {
      throw new InvalidWave('A wave cannot target the same candidate twice');
    }
    const alreadySolicited = candidateIds.filter((id) => this.findOffer(id));
    if (alreadySolicited.length > 0) {
      throw new InvalidWave(`Already solicited for this mission: ${alreadySolicited.join(', ')}`);
    }

    const wave = this.state.waves.length + 1;
    this.state.waves.push({ number: wave, expiresAt });
    this.state.offers.push(...candidateIds.map((candidateId) => ({ candidateId, wave, status: 'pending' as const })));
    this.state.status = 'offering';
    this.record({ type: 'OfferWaveLaunched', missionId: this.state.id, wave, candidateIds: [...candidateIds], expiresAt });
  }

  /**
   * The tailor accepts and, in the same gesture, picks a 30-minute appointment inside one of
   * the customer's slots. The appointment is final.
   */
  accept(candidateId: CandidateId, now: Date, appointmentStart: Date): void {
    if (this.state.status === 'awarded') {
      // A retry from the winner is harmless; any other acceptance comes too late.
      if (this.state.awardedTo === candidateId) return;
      throw new MissionAlreadyAwarded(this.state.id);
    }
    const offer = this.pendingOfferOf(candidateId);
    if (now >= this.currentWave().expiresAt) throw new OfferExpired(candidateId);
    const appointment = this.appointmentAt(appointmentStart, now);

    offer.status = 'accepted';
    const withdrawn = this.withdrawPendingOffers();
    this.state.status = 'awarded';
    this.state.awardedTo = candidateId;
    this.state.appointment = appointment;
    this.record({
      type: 'MissionAwarded',
      missionId: this.state.id,
      orderId: this.state.orderId,
      candidateId,
      appointment,
      withdrawnCandidateIds: withdrawn,
    });
  }

  decline(candidateId: CandidateId): void {
    if (this.state.status === 'awarded') throw new MissionAlreadyAwarded(this.state.id);
    const offer = this.pendingOfferOf(candidateId);

    offer.status = 'declined';
    this.record({ type: 'OfferDeclined', missionId: this.state.id, candidateId });
    this.markUnstaffedIfExhausted();
  }

  /** Called by the wave timer. Late calls after the mission is settled are ignored. */
  expireWave(now: Date): void {
    if (this.state.status !== 'offering') return;
    const wave = this.currentWave();
    if (now < wave.expiresAt) throw new WaveNotYetExpired(this.state.id);

    const expired = this.pendingOffers().map((offer) => {
      offer.status = 'expired';
      return offer.candidateId;
    });
    if (expired.length > 0) {
      this.record({ type: 'OfferWaveExpired', missionId: this.state.id, wave: wave.number, expiredCandidateIds: expired });
    }
    this.markUnstaffedIfExhausted();
  }

  /** Nobody eligible is left to solicit: there is no point waiting for the remaining waves. */
  declareUnstaffed(): void {
    this.assertActive();
    if (this.pendingOffers().length > 0) throw new WaveStillActive(this.state.id);
    this.markUnstaffed();
  }

  /** The order was cancelled. Once the mission is settled, Dispatch has nothing left to close. */
  close(): void {
    if (this.state.status !== 'open' && this.state.status !== 'offering') return;
    const withdrawn = this.withdrawPendingOffers();
    this.state.status = 'closed';
    this.record({ type: 'MissionClosed', missionId: this.state.id, withdrawnCandidateIds: withdrawn });
  }

  private appointmentAt(start: Date, now: Date): TimeSlot {
    const appointment = TimeSlot(start, new Date(start.getTime() + APPOINTMENT_DURATION_MS));
    if (appointment.start <= now) throw new InvalidAppointment('The appointment must be in the future');
    if (!this.state.requirements.slots.some((slot) => isWithin(appointment, slot))) {
      throw new InvalidAppointment('The 30-minute appointment must fit in one of the customer slots');
    }
    return appointment;
  }

  private assertActive(): void {
    if (this.state.status === 'awarded') throw new MissionAlreadyAwarded(this.state.id);
    if (this.state.status !== 'open' && this.state.status !== 'offering') {
      throw new MissionNotOffering(this.state.id, this.state.status);
    }
  }

  private pendingOfferOf(candidateId: CandidateId): Offer {
    if (this.state.status !== 'offering') throw new MissionNotOffering(this.state.id, this.state.status);
    const offer = this.findOffer(candidateId);
    if (!offer) throw new OfferNotFound(this.state.id, candidateId);
    if (offer.status !== 'pending') throw new OfferNotPending(candidateId, offer.status);
    return offer;
  }

  private markUnstaffedIfExhausted(): void {
    if (this.pendingOffers().length > 0 || this.state.waves.length < this.state.maxWaves) return;
    this.markUnstaffed();
  }

  private markUnstaffed(): void {
    this.state.status = 'unstaffed';
    this.record({
      type: 'MissionUnstaffed',
      missionId: this.state.id,
      orderId: this.state.orderId,
      waves: this.state.waves.length,
    });
  }

  private withdrawPendingOffers(): CandidateId[] {
    return this.pendingOffers().map((offer) => {
      offer.status = 'withdrawn';
      return offer.candidateId;
    });
  }

  private currentWave(): OfferWave {
    const wave = this.state.waves.at(-1);
    if (!wave) throw new MissionNotOffering(this.state.id, this.state.status);
    return wave;
  }

  private findOffer(candidateId: CandidateId): Offer | undefined {
    return this.state.offers.find((offer) => offer.candidateId === candidateId);
  }

  private pendingOffers(): Offer[] {
    return this.state.offers.filter((offer) => offer.status === 'pending');
  }

  private record(event: MissionEvent): void {
    this.pendingEvents.push(event);
  }
}

function copyOf(snapshot: MissionSnapshot): MissionSnapshot {
  return {
    ...snapshot,
    requirements: copyRequirements(snapshot.requirements),
    appointment: snapshot.appointment && copyTimeSlot(snapshot.appointment),
    waves: snapshot.waves.map((wave) => ({ ...wave, expiresAt: new Date(wave.expiresAt) })),
    offers: snapshot.offers.map((offer) => ({ ...offer })),
  };
}

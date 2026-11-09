import { OrderCancelledV1, OrderPlacedV1 } from '@tilli/contracts';
import type { CloseMission } from '../application/close-mission';
import type { OpenMission } from '../application/open-mission';
import type { GeoPoint } from '../domain/geo-point';
import { OrderId } from '../domain/ids';
import { MissionRequirements } from '../domain/mission-requirements';
import { TimeSlot } from '../domain/time-slot';

/** Turns a postal code into the centroid Dispatch matches tailors against. */
export interface AreaLocator {
  locate(postalCode: string): GeoPoint | null;
}

export class UnknownArea extends Error {
  constructor(postalCode: string) {
    super(`No known location for postal code ${postalCode}`);
    this.name = 'UnknownArea';
  }
}

/**
 * Anti-corruption layer facing Ordering. It validates the published events, keeps only
 * what Dispatch needs to decide, and drops the rest: street, customer identity, prices.
 */
export class OrderingAcl {
  constructor(
    private readonly openMission: OpenMission,
    private readonly closeMission: CloseMission,
    private readonly areas: AreaLocator,
  ) {}

  readonly onOrderPlaced = async (raw: unknown): Promise<void> => {
    const { payload } = OrderPlacedV1.parse(raw);
    const location = this.areas.locate(payload.address.postalCode);
    if (!location) throw new UnknownArea(payload.address.postalCode);

    await this.openMission.execute({
      orderId: OrderId(payload.orderId),
      requirements: MissionRequirements({
        area: { postalCode: payload.address.postalCode, location },
        slots: payload.slots.map((slot) => TimeSlot(new Date(slot.start), new Date(slot.end))),
        garmentTypes: payload.items.map((item) => item.garmentType),
        fabrics: payload.items.map((item) => item.fabric),
      }),
    });
  };

  readonly onOrderCancelled = async (raw: unknown): Promise<void> => {
    const { payload } = OrderCancelledV1.parse(raw);
    await this.closeMission.execute({ orderId: OrderId(payload.orderId) });
  };
}

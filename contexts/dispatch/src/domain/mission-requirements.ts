import type { GeoPoint } from './geo-point';
import { copyTimeSlot, type TimeSlot } from './time-slot';

export type GarmentType = string;
export type Fabric = 'basic' | 'dressy';

/**
 * What a tailor needs to take the mission. The area is the postal code and its
 * centroid: Dispatch never stores the customer's address.
 */
export type MissionRequirements = {
  readonly area: { readonly postalCode: string; readonly location: GeoPoint };
  readonly slots: readonly TimeSlot[];
  readonly garmentTypes: readonly GarmentType[];
  readonly fabrics: readonly Fabric[];
};

export function MissionRequirements(requirements: MissionRequirements): MissionRequirements {
  if (requirements.slots.length === 0) throw new RangeError('A mission needs at least one time slot');
  if (requirements.garmentTypes.length === 0) throw new RangeError('A mission needs at least one garment type');
  return copyRequirements(requirements);
}

export function copyRequirements(requirements: MissionRequirements): MissionRequirements {
  return {
    area: { postalCode: requirements.area.postalCode, location: { ...requirements.area.location } },
    slots: requirements.slots.map(copyTimeSlot),
    garmentTypes: [...new Set(requirements.garmentTypes)],
    fabrics: [...new Set(requirements.fabrics)],
  };
}

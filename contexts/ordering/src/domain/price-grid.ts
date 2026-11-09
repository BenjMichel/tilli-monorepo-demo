import { AlterationNotOffered } from './errors';
import { Money } from './money';

export type GarmentType = string;
export type Fabric = 'basic' | 'dressy';

export type PriceGridEntry = {
  readonly garmentType: GarmentType;
  readonly alteration: { readonly code: string; readonly label: string };
  readonly prices: Readonly<Record<Fabric, Money>>;
};

export type OfferedAlteration = {
  readonly code: string;
  readonly label: string;
  readonly price: Money;
};

/**
 * Fixed, versioned reference data: the price of every (garment type, alteration, fabric).
 * No use case changes it; a new grid is a new version.
 */
export class PriceGrid {
  private readonly entries = new Map<string, PriceGridEntry>();

  constructor(
    readonly version: string,
    entries: readonly PriceGridEntry[],
  ) {
    for (const entry of entries) {
      const key = keyOf(entry.garmentType, entry.alteration.code);
      if (this.entries.has(key)) throw new RangeError(`Duplicate price grid entry: ${key}`);
      this.entries.set(key, entry);
    }
  }

  priceOf(garmentType: GarmentType, alterationCode: string, fabric: Fabric): Money {
    const entry = this.entries.get(keyOf(garmentType, alterationCode));
    if (!entry) throw new AlterationNotOffered(garmentType, alterationCode, fabric);
    return entry.prices[fabric];
  }

  labelOf(garmentType: GarmentType, alterationCode: string): string {
    return this.entries.get(keyOf(garmentType, alterationCode))?.alteration.label ?? alterationCode;
  }

  /** What the funnel shows once the customer picked a garment and its fabric. */
  alterationsFor(garmentType: GarmentType, fabric: Fabric): OfferedAlteration[] {
    return [...this.entries.values()]
      .filter((entry) => entry.garmentType === garmentType)
      .map((entry) => ({ ...entry.alteration, price: entry.prices[fabric] }));
  }
}

const keyOf = (garmentType: GarmentType, alterationCode: string) => `${garmentType}/${alterationCode}`;

import { InvalidOrder } from './errors';
import { type Money, ZERO, add } from './money';
import type { Fabric, GarmentType, PriceGrid } from './price-grid';

export type ItemRequest = {
  readonly garmentType: GarmentType;
  readonly fabric: Fabric;
  readonly alterationCodes: readonly string[];
};

export type PricedAlteration = {
  readonly code: string;
  readonly label: string;
  readonly price: Money;
};

export type QuotedItem = {
  readonly garmentType: GarmentType;
  readonly fabric: Fabric;
  readonly alterations: readonly PricedAlteration[];
  readonly subtotal: Money;
};

export type Quote = {
  readonly items: readonly QuotedItem[];
  readonly total: Money;
  readonly priceGridVersion: string;
};

/**
 * Funnel step 1: a deterministic calculation from the grid, not an aggregate.
 * Placing the order runs the same calculation, so the customer pays what was shown.
 */
export function quote(items: readonly ItemRequest[], grid: PriceGrid): Quote {
  if (items.length === 0) throw new InvalidOrder('An order needs at least one item');

  const quoted = items.map((item): QuotedItem => {
    if (item.alterationCodes.length === 0) {
      throw new InvalidOrder(`The ${item.garmentType} needs at least one alteration`);
    }
    if (new Set(item.alterationCodes).size !== item.alterationCodes.length) {
      throw new InvalidOrder(`The same alteration is listed twice on the ${item.garmentType}`);
    }
    const alterations = item.alterationCodes.map((code) => ({
      code,
      label: grid.labelOf(item.garmentType, code),
      price: grid.priceOf(item.garmentType, code, item.fabric),
    }));
    const subtotal = alterations.reduce((sum, alteration) => add(sum, alteration.price), ZERO);
    return { garmentType: item.garmentType, fabric: item.fabric, alterations, subtotal };
  });

  return {
    items: quoted,
    total: quoted.reduce((sum, item) => add(sum, item.subtotal), ZERO),
    priceGridVersion: grid.version,
  };
}

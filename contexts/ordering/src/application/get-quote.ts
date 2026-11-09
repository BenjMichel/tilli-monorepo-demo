import type { Fabric, GarmentType, OfferedAlteration } from '../domain/price-grid';
import { type ItemRequest, type Quote, quote } from '../domain/quote';
import type { PriceGrids } from './ports';

/** Funnel step 1: the alterations offered for a garment, then the price of the selection. */
export class GetQuote {
  constructor(private readonly grids: PriceGrids) {}

  alterationsFor(garmentType: GarmentType, fabric: Fabric): OfferedAlteration[] {
    return this.grids.current().alterationsFor(garmentType, fabric);
  }

  execute(items: readonly ItemRequest[]): Quote {
    return quote(items, this.grids.current());
  }
}

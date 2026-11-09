import type { PriceGrids } from '../application/ports';
import { Money } from '../domain/money';
import { type Fabric, PriceGrid, type PriceGridEntry } from '../domain/price-grid';

const entry = (garmentType: string, code: string, label: string, basic: number, dressy: number): PriceGridEntry => ({
  garmentType,
  alteration: { code, label },
  prices: { basic: Money(basic * 100), dressy: Money(dressy * 100) } satisfies Record<Fabric, Money>,
});

/**
 * Excerpt of the real Tilli grid (euros, "basique" / "habillé" columns), limited to hems
 * and short zips on pants, skirts and dresses.
 */
export const DEMO_PRICE_GRID = new PriceGrid('demo-2026-11', [
  entry('pants', 'hem-simple', 'Ourlet simple (x2)', 12, 17),
  entry('pants', 'hem-turn-up', 'Ourlet revers (x2)', 15, 20),
  entry('pants', 'hem-jeans-simple', 'Ourlet de jean simple', 12, 12),
  entry('pants', 'hem-jeans-complex', 'Ourlet de jean complexe', 16, 16),
  entry('pants', 'hem-invisible', 'Ourlet invisible', 17, 17),
  entry('pants', 'zip-short', 'Zip court (< 25 cm) fourni par le Tilliste', 22, 24),
  entry('skirt', 'hem-simple', 'Ourlet simple', 12, 20),
  entry('skirt', 'hem-wide', 'Ourlet ample', 18, 23),
  entry('skirt', 'hem-invisible', 'Ourlet invisible', 20, 20),
  entry('skirt', 'zip-short', 'Zip court (< 25 cm) fourni par le Tilliste', 22, 24),
  entry('dress', 'hem-simple', 'Ourlet simple', 12, 20),
  entry('dress', 'hem-wide', 'Ourlet ample', 18, 23),
  entry('dress', 'hem-ruffles', 'Ourlet à volants', 22, 28),
  entry('dress', 'zip-short', 'Zip court (< 25 cm) fourni par le Tilliste', 22, 24),
]);

/** Every grid ever published, the last one being current. */
export class InMemoryPriceGrids implements PriceGrids {
  private readonly byVersions: ReadonlyMap<string, PriceGrid>;
  private readonly latest: PriceGrid;

  constructor(grids: readonly PriceGrid[] = [DEMO_PRICE_GRID]) {
    const latest = grids.at(-1);
    if (!latest) throw new RangeError('At least one price grid is required');
    this.latest = latest;
    this.byVersions = new Map(grids.map((grid) => [grid.version, grid]));
  }

  current(): PriceGrid {
    return this.latest;
  }

  byVersion(version: string): PriceGrid | null {
    return this.byVersions.get(version) ?? null;
  }
}

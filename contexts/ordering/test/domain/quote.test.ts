import { describe, expect, it } from 'vitest';
import { AlterationNotOffered, InvalidOrder } from '../../src/domain/errors';
import { Money } from '../../src/domain/money';
import { PriceGrid } from '../../src/domain/price-grid';
import { quote } from '../../src/domain/quote';
import { DEMO_PRICE_GRID } from '../../src/infrastructure/demo-price-grid';

describe('quote', () => {
  it('prices an alteration by garment type and fabric', () => {
    const basic = quote([{ garmentType: 'pants', fabric: 'basic', alterationCodes: ['hem-simple'] }], DEMO_PRICE_GRID);
    const dressy = quote(
      [{ garmentType: 'pants', fabric: 'dressy', alterationCodes: ['hem-simple'] }],
      DEMO_PRICE_GRID,
    );

    expect(basic.total).toEqual(Money(1200));
    expect(dressy.total).toEqual(Money(1700));
  });

  it('adds up every alteration of every item', () => {
    const result = quote(
      [
        { garmentType: 'pants', fabric: 'dressy', alterationCodes: ['hem-simple', 'zip-short'] },
        { garmentType: 'dress', fabric: 'basic', alterationCodes: ['hem-ruffles'] },
      ],
      DEMO_PRICE_GRID,
    );

    expect(result.items.map((item) => item.subtotal.cents)).toEqual([1700 + 2400, 2200]);
    expect(result.total).toEqual(Money(1700 + 2400 + 2200));
    expect(result.items[0]?.alterations[0]).toEqual({
      code: 'hem-simple',
      label: 'Ourlet simple (x2)',
      price: Money(1700),
    });
  });

  it('records the grid version it was computed with', () => {
    expect(
      quote([{ garmentType: 'skirt', fabric: 'basic', alterationCodes: ['hem-wide'] }], DEMO_PRICE_GRID)
        .priceGridVersion,
    ).toBe(DEMO_PRICE_GRID.version);
  });

  it('refuses an alteration the grid does not offer for this garment', () => {
    expect(() =>
      quote([{ garmentType: 'pants', fabric: 'basic', alterationCodes: ['hem-ruffles'] }], DEMO_PRICE_GRID),
    ).toThrow(AlterationNotOffered);
  });

  it('refuses an empty selection, an item without alteration and a duplicated alteration', () => {
    expect(() => quote([], DEMO_PRICE_GRID)).toThrow(InvalidOrder);
    expect(() => quote([{ garmentType: 'pants', fabric: 'basic', alterationCodes: [] }], DEMO_PRICE_GRID)).toThrow(
      InvalidOrder,
    );
    expect(() =>
      quote(
        [{ garmentType: 'pants', fabric: 'basic', alterationCodes: ['hem-simple', 'hem-simple'] }],
        DEMO_PRICE_GRID,
      ),
    ).toThrow(InvalidOrder);
  });
});

describe('PriceGrid', () => {
  it('lists the alterations offered for a garment, priced for its fabric', () => {
    const offered = DEMO_PRICE_GRID.alterationsFor('skirt', 'dressy');

    expect(offered.map((alteration) => [alteration.code, alteration.price.cents])).toEqual([
      ['hem-simple', 2000],
      ['hem-wide', 2300],
      ['hem-invisible', 2000],
      ['zip-short', 2400],
    ]);
  });

  it('rejects a grid that prices the same alteration twice', () => {
    const line = {
      garmentType: 'pants',
      alteration: { code: 'hem', label: 'Ourlet' },
      prices: { basic: Money(1), dressy: Money(2) },
    };

    expect(() => new PriceGrid('broken', [line, line])).toThrow(RangeError);
  });
});

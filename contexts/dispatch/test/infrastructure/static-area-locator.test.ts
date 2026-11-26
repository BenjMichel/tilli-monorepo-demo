import { describe, expect, it } from 'vitest';
import { StaticAreaLocator } from '../../src';

describe('StaticAreaLocator', () => {
  it('locates the 20 Paris districts that Ordering serves', () => {
    const locator = new StaticAreaLocator();
    const districts = Array.from({ length: 20 }, (_, index) => `750${String(index + 1).padStart(2, '0')}`);

    expect(districts.filter((postalCode) => locator.locate(postalCode) === null)).toEqual([]);
  });

  it('knows nothing outside Paris', () => {
    expect(new StaticAreaLocator().locate('78000')).toBeNull();
  });
});

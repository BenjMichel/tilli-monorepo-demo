import type { GeoPoint } from '../domain/geo-point';
import type { AreaLocator } from './ordering-acl';

/**
 * Approximate centroids of the 20 Paris districts Ordering serves; a geocoding API would replace
 * this table. A postal code missing here is not an error: the mission finds no tailor in range.
 */
const PARIS_CENTROIDS: Readonly<Record<string, GeoPoint>> = {
  '75001': { latitude: 48.8625, longitude: 2.3364 },
  '75002': { latitude: 48.8683, longitude: 2.3428 },
  '75003': { latitude: 48.863, longitude: 2.3601 },
  '75004': { latitude: 48.8543, longitude: 2.3576 },
  '75005': { latitude: 48.8445, longitude: 2.3497 },
  '75006': { latitude: 48.8491, longitude: 2.3328 },
  '75007': { latitude: 48.8562, longitude: 2.3122 },
  '75008': { latitude: 48.8727, longitude: 2.3125 },
  '75009': { latitude: 48.877, longitude: 2.3375 },
  '75010': { latitude: 48.8762, longitude: 2.3607 },
  '75011': { latitude: 48.859, longitude: 2.38 },
  '75012': { latitude: 48.8412, longitude: 2.3876 },
  '75013': { latitude: 48.8283, longitude: 2.3622 },
  '75014': { latitude: 48.8292, longitude: 2.3266 },
  '75015': { latitude: 48.8417, longitude: 2.2999 },
  '75016': { latitude: 48.8603, longitude: 2.2747 },
  '75017': { latitude: 48.8873, longitude: 2.3067 },
  '75018': { latitude: 48.8925, longitude: 2.3484 },
  '75019': { latitude: 48.8871, longitude: 2.3848 },
  '75020': { latitude: 48.8634, longitude: 2.4011 },
};

export class StaticAreaLocator implements AreaLocator {
  constructor(private readonly centroids: Readonly<Record<string, GeoPoint>> = PARIS_CENTROIDS) {}

  locate(postalCode: string): GeoPoint | null {
    return this.centroids[postalCode] ?? null;
  }
}

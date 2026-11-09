import type { GeoPoint } from '../domain/geo-point';
import type { AreaLocator } from './ordering-acl';

/** Approximate centroids of a few Paris districts; a geocoding API would replace this table. */
const PARIS_CENTROIDS: Readonly<Record<string, GeoPoint>> = {
  '75003': { latitude: 48.863, longitude: 2.3601 },
  '75011': { latitude: 48.859, longitude: 2.38 },
  '75015': { latitude: 48.8417, longitude: 2.2999 },
  '75018': { latitude: 48.8925, longitude: 2.3484 },
  '75020': { latitude: 48.8634, longitude: 2.4011 },
};

export class StaticAreaLocator implements AreaLocator {
  constructor(private readonly centroids: Readonly<Record<string, GeoPoint>> = PARIS_CENTROIDS) {}

  locate(postalCode: string): GeoPoint | null {
    return this.centroids[postalCode] ?? null;
  }
}

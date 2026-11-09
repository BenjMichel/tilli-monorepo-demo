import { ServiceArea } from '../domain/service-area';

/** Paris intra-muros, 75001 to 75020. */
export const PARIS_SERVICE_AREA = new ServiceArea(
  Array.from({ length: 20 }, (_, index) => `750${String(index + 1).padStart(2, '0')}`),
);

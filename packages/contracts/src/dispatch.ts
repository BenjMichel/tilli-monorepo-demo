import { z } from 'zod';
import { eventSchema, isoDateTime } from './envelope';

export const MissionAwardedV1 = eventSchema(
  'MissionAwarded',
  1,
  z.object({
    missionId: z.string().min(1),
    orderId: z.string().min(1),
    tailorId: z.string().min(1),
    /** Chosen by the tailor when accepting, within the customer's slots. Final. */
    appointment: z.object({ start: isoDateTime, end: isoDateTime }),
  }),
);
export type MissionAwardedV1 = z.infer<typeof MissionAwardedV1>;

export const MissionUnstaffedV1 = eventSchema(
  'MissionUnstaffed',
  1,
  z.object({
    missionId: z.string().min(1),
    orderId: z.string().min(1),
    waves: z.int().positive(),
  }),
);
export type MissionUnstaffedV1 = z.infer<typeof MissionUnstaffedV1>;

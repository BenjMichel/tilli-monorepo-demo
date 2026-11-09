import { z } from 'zod';
import { eventSchema, isoDateTime } from './envelope';

export const InterventionStartedV1 = eventSchema(
  'InterventionStarted',
  1,
  z.object({
    interventionId: z.string().min(1),
    orderId: z.string().min(1),
    startedAt: isoDateTime,
  }),
);
export type InterventionStartedV1 = z.infer<typeof InterventionStartedV1>;

export const InterventionCompletedV1 = eventSchema(
  'InterventionCompleted',
  1,
  z.object({
    interventionId: z.string().min(1),
    orderId: z.string().min(1),
    completedAt: isoDateTime,
  }),
);
export type InterventionCompletedV1 = z.infer<typeof InterventionCompletedV1>;

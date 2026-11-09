import { z } from 'zod';

/**
 * Every integration event travels in the same envelope. `eventId` lets consumers
 * deduplicate; `version` changes only on a breaking change of the payload.
 */
export function eventSchema<T extends string, V extends number, P extends z.ZodType>(type: T, version: V, payload: P) {
  return z.object({
    eventId: z.string().min(1),
    type: z.literal(type),
    version: z.literal(version),
    occurredAt: z.iso.datetime(),
    payload,
  });
}

export const isoDateTime = z.iso.datetime();

import { z } from 'zod';
import { eventSchema, isoDateTime } from './envelope';

export const Fabric = z.enum(['basic', 'dressy']);

export const OrderPlacedV1 = eventSchema(
  'OrderPlaced',
  1,
  z.object({
    orderId: z.string().min(1),
    items: z
      .array(
        z.object({
          garmentType: z.string().min(1),
          fabric: Fabric,
          alterations: z.array(z.object({ code: z.string().min(1), priceCents: z.int().nonnegative() })).min(1),
        }),
      )
      .min(1),
    address: z.object({ street: z.string(), postalCode: z.string().min(1), city: z.string() }),
    slots: z.array(z.object({ start: isoDateTime, end: isoDateTime })).min(1),
    customer: z.object({ firstName: z.string(), lastName: z.string(), phone: z.string(), email: z.string() }),
    totalCents: z.int().nonnegative(),
    priceGridVersion: z.string().min(1),
  }),
);
export type OrderPlacedV1 = z.infer<typeof OrderPlacedV1>;

export const OrderCancelledV1 = eventSchema(
  'OrderCancelled',
  1,
  z.object({
    orderId: z.string().min(1),
    reason: z.string(),
  }),
);
export type OrderCancelledV1 = z.infer<typeof OrderCancelledV1>;

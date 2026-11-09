import { CandidateId, MissionId } from '@tilli/dispatch';
import { InterventionId, TailorId } from '@tilli/fulfillment';
import { OrderId } from '@tilli/ordering';
import Fastify, { type FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { Platform } from '../platform';
import { errorHandler } from './errors';

const Fabric = z.enum(['basic', 'dressy']);
const Items = z
  .array(z.object({ garmentType: z.string().min(1), fabric: Fabric, alterationCodes: z.array(z.string().min(1)) }))
  .min(1);
const Slot = z.object({ start: z.coerce.date(), end: z.coerce.date() });
const TailorBody = z.object({ tailorId: z.string().min(1) });

const PlaceOrderBody = z.object({
  items: Items,
  address: z.object({ street: z.string().min(1), postalCode: z.string().min(1), city: z.string().min(1) }),
  slots: z.array(Slot).min(1),
  customer: z.object({ firstName: z.string(), lastName: z.string(), phone: z.string(), email: z.string() }),
  quotedPriceGridVersion: z.string().min(1),
});

/**
 * HTTP adapter. Handlers only parse, call one use case and, after a command, pump the outboxes
 * so the other contexts react before the response is sent.
 */
export function buildApp(platform: Platform): FastifyInstance {
  const app = Fastify();
  app.setErrorHandler(errorHandler);
  const { ordering, dispatch, fulfillment } = platform;

  app.get('/health', async () => ({ status: 'ok' }));

  // Website funnel, step 1: alterations of a garment, then the quote of a selection.
  app.get('/catalog/alterations', async (request) => {
    const { garmentType, fabric } = z.object({ garmentType: z.string().min(1), fabric: Fabric }).parse(request.query);
    return ordering.queries.getQuote.alterationsFor(garmentType, fabric);
  });

  app.post('/quotes', async (request) => {
    const { items } = z.object({ items: Items }).parse(request.body);
    return ordering.queries.getQuote.execute(items);
  });

  // Website funnel, step 2: the customer's details turn the quote into an order.
  app.post('/orders', async (request, reply) => {
    const placed = await ordering.commands.placeOrder.execute(PlaceOrderBody.parse(request.body));
    await platform.pump();
    return reply.status(201).send(placed);
  });

  app.post('/orders/:orderId/cancel', async (request, reply) => {
    const { orderId } = z.object({ orderId: z.string() }).parse(request.params);
    const { reason } = z.object({ reason: z.string().default('') }).parse(request.body ?? {});
    await ordering.commands.cancelOrder.execute({ orderId: OrderId(orderId), reason });
    await platform.pump();
    return reply.status(204).send();
  });

  // Tailor app. No authentication in this demo: the tailor id travels in the request.
  app.get('/tailors/:tailorId/offers', async (request) => {
    const { tailorId } = z.object({ tailorId: z.string() }).parse(request.params);
    return dispatch.queries.pendingOffers.list(CandidateId(tailorId));
  });

  app.post('/missions/:missionId/accept', async (request, reply) => {
    const { missionId } = z.object({ missionId: z.string() }).parse(request.params);
    const { tailorId, appointmentStart } = TailorBody.extend({ appointmentStart: z.coerce.date() }).parse(request.body);
    await dispatch.commands.acceptOffer.execute({
      missionId: MissionId(missionId),
      candidateId: CandidateId(tailorId),
      appointmentStart,
    });
    await platform.pump();
    return reply.status(204).send();
  });

  app.post('/missions/:missionId/decline', async (request, reply) => {
    const { missionId } = z.object({ missionId: z.string() }).parse(request.params);
    const { tailorId } = TailorBody.parse(request.body);
    await dispatch.commands.declineOffer.execute({ missionId: MissionId(missionId), candidateId: CandidateId(tailorId) });
    await platform.pump();
    return reply.status(204).send();
  });

  app.get('/tailors/:tailorId/interventions', async (request) => {
    const { tailorId } = z.object({ tailorId: z.string() }).parse(request.params);
    return fulfillment.queries.myInterventions.list(TailorId(tailorId));
  });

  for (const action of ['start', 'complete'] as const) {
    app.post(`/interventions/:interventionId/${action}`, async (request, reply) => {
      const { interventionId } = z.object({ interventionId: z.string() }).parse(request.params);
      const { tailorId } = TailorBody.parse(request.body);
      await fulfillment.commands[action]({ interventionId: InterventionId(interventionId), tailorId: TailorId(tailorId) });
      await platform.pump();
      return reply.status(204).send();
    });
  }

  // Admin: order tracking, a read model over every context's events.
  app.get('/admin/orders', async () => platform.tracking.list());

  return app;
}

import type { FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';

/** Business rules refused because of the current state of the aggregate: try again differently. */
const CONFLICTS = new Set([
  'MISSION_ALREADY_AWARDED',
  'OFFER_NOT_PENDING',
  'OFFER_EXPIRED',
  'WAVE_STILL_ACTIVE',
  'ORDER_CANNOT_BE_CANCELLED',
  'INVALID_TRANSITION',
]);

type ErrorLike = { name?: unknown; code?: unknown; message?: unknown; statusCode?: unknown };

/**
 * Translates errors into HTTP. Domain errors carry a stable `code`, so the API never
 * depends on the classes of a context, only on its published codes.
 */
export function errorHandler(error: unknown, _request: FastifyRequest, reply: FastifyReply): FastifyReply {
  if (error instanceof ZodError) {
    return reply.status(400).send({ error: 'INVALID_REQUEST', issues: error.issues });
  }
  const { name, code, message, statusCode } = (error ?? {}) as ErrorLike;
  if (typeof statusCode === 'number' && typeof code === 'string' && code.startsWith('FST_')) {
    return reply.status(statusCode).send({ error: code, message });
  }
  if (typeof name === 'string' && name.endsWith('NotFound')) {
    return reply.status(404).send({ error: 'NOT_FOUND', message });
  }
  if (typeof name === 'string' && name.endsWith('ConcurrencyConflict')) {
    return reply.status(409).send({ error: 'CONCURRENT_UPDATE', message });
  }
  if (typeof code === 'string') {
    return reply.status(CONFLICTS.has(code) ? 409 : 422).send({ error: code, message });
  }
  reply.log.error(error);
  return reply.status(500).send({ error: 'INTERNAL_ERROR' });
}

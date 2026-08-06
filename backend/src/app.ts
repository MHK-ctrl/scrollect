import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import type { AppDeps } from './deps';
import { ApiError } from './lib/errors';
import { loggerOptions } from './lib/logger';
import registerAuthRoutes from './modules/auth/routes';
import registerFeedRoutes from './modules/feed/routes';
import registerInteractionRoutes from './modules/interactions/routes';
import registerModerationRoutes from './modules/moderation/routes';
import registerWebhookRoutes from './modules/webhooks/routes';

/**
 * Builds the Fastify app. Every route returns a consistent JSON error envelope:
 *   { error: { code, message, details?, requestId } }   (spec: every public API
 * endpoint returns consistent JSON error envelopes).
 */
export async function createApp(deps: AppDeps): Promise<FastifyInstance> {
  const app = Fastify({ logger: loggerOptions(deps.config.logLevel, deps.config.nodeEnv), trustProxy: true });

  await app.register(cors, { origin: true });

  app.setNotFoundHandler((req, reply) => {
    reply.status(404).send({ error: { code: 'NOT_FOUND', message: `route ${req.method} ${req.url} not found`, requestId: req.id } });
  });

  app.setErrorHandler((err, req, reply) => {
    if (err instanceof ApiError) {
      return reply.status(err.statusCode).send({
        error: { code: err.code, message: err.message, ...(err.details ? { details: err.details } : {}), requestId: req.id },
      });
    }
    const validation = (err as { validation?: unknown }).validation;
    if (validation) {
      return reply.status(400).send({
        error: { code: 'VALIDATION_ERROR', message: 'invalid request body or query', details: validation, requestId: req.id },
      });
    }
    const status = (err as { statusCode?: number }).statusCode;
    const httpStatus = status && status < 500 ? status : 500;
    if (httpStatus >= 500) {
      req.log.error({ err: (err as Error).message, stack: (err as Error).stack }, 'unhandled error');
    }
    return reply.status(httpStatus).send({
      error: {
        code: httpStatus < 500 ? 'BAD_REQUEST' : 'INTERNAL',
        message: httpStatus < 500 ? (err as Error).message : 'internal server error',
        requestId: req.id,
      },
    });
  });

  registerAuthRoutes(app, deps);
  registerFeedRoutes(app, deps);
  registerInteractionRoutes(app, deps);
  registerModerationRoutes(app, deps);
  registerWebhookRoutes(app, deps);

  // /healthz doubles as a readiness probe: when a backing store is configured
  // and unreachable the endpoint returns 503 + status "degraded" so orchestrators
  // stop routing traffic to this instance. Shape: { status, mockMode, checks }.
  app.get('/healthz', async (_req, reply) => {
    const checks: Record<string, string> = {};
    let ok = true;

    try {
      await deps.db.ping();
      checks.db = 'up';
    } catch {
      checks.db = 'down';
      ok = false;
    }

    if (deps.redis) {
      try {
        checks.redis = (await deps.redis.ping()) === 'PONG' ? 'up' : 'down';
        if (checks.redis !== 'up') ok = false;
      } catch {
        checks.redis = 'down';
        ok = false;
      }
    } else {
      checks.redis = 'skipped'; // REDIS_URL unset — not part of the readiness contract
    }

    return reply
      .status(ok ? 200 : 503)
      .send({ status: ok ? 'ok' : 'degraded', mockMode: deps.config.mockMode, checks });
  });

  return app;
}

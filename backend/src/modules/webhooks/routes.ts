import { createHmac, timingSafeEqual } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import type { AppDeps } from '../../deps';

/**
 * Instagram webhook receiver (spec §2.4): HMAC-verified, then triggers an
 * immediate incremental sync for the affected creator. `since`-sync remains the
 * source of truth — webhooks are best-effort push refresh.
 *
 * HMAC must be computed over the exact raw body, so we install a JSON parser
 * that also stashes the raw string on the request.
 */
function registerWebhookRoutes(app: FastifyInstance, deps: AppDeps): void {
  const { config, db, sync, logger } = deps;

  // Encapsulated scope: the raw-body JSON parser must NOT replace the default
  // parser for the rest of the API — only /webhooks/* needs it.
  app.register(async (webhook) => {
    webhook.addContentTypeParser('application/json', { parseAs: 'string' }, (req, body, done) => {
      (req as { rawBody?: unknown }).rawBody = body;
      try {
        done(null, JSON.parse(body as string));
      } catch {
        done(null, body as string);
      }
    });

    // Subscription verification handshake (GET).
    webhook.get<{ Querystring: { 'hub.mode'?: string; 'hub.verify_token'?: string; 'hub.challenge'?: string } }>(
      '/webhooks/instagram',
      async (req, reply) => {
        if (req.query['hub.mode'] === 'subscribe' && req.query['hub.verify_token'] === config.instagram.webhookVerifyToken) {
          return reply.type('text/plain').send(req.query['hub.challenge'] ?? '');
        }
        return reply.status(403).send({ error: { code: 'WEBHOOK_VERIFY_FAILED', message: 'verify token mismatch' } });
      },
    );

    webhook.post('/webhooks/instagram', async (req, reply) => {
      const signature = req.headers['x-hub-signature-256'];
      const raw = (req as { rawBody?: unknown }).rawBody;
      if (typeof raw !== 'string' || typeof signature !== 'string') {
        return reply.status(400).send({ error: { code: 'WEBHOOK_INVALID', message: 'missing signature or body' } });
      }
      const expected = 'sha256=' + createHmac('sha256', config.instagram.appSecret || 'dev-no-app-secret').update(raw).digest('hex');
      const a = Buffer.from(signature);
      const b = Buffer.from(expected);
      if (a.length !== b.length || !timingSafeEqual(a, b)) {
        logger.warn('webhook signature mismatch — dropped');
        return reply.status(400).send({ error: { code: 'WEBHOOK_BAD_SIGNATURE', message: 'signature mismatch' } });
      }

      let body: { entry?: { id?: string }[] };
      try {
        body = JSON.parse(raw);
      } catch {
        return reply.status(400).send({ error: { code: 'WEBHOOK_INVALID', message: 'invalid json' } });
      }

      // entry[].id is the Instagram user id (IG Login). Kick an immediate sync.
      for (const entry of body.entry ?? []) {
        if (!entry.id) continue;
        const creator = await db.getCreatorByIgId(entry.id);
        if (!creator) continue;
        sync.syncCreator(creator.id).catch((err) => logger.warn({ creatorId: creator.id, err: (err as Error).message }, 'webhook sync deferred'));
      }
      return reply.status(200).send({ received: true });
    });
  });
}

export default registerWebhookRoutes;

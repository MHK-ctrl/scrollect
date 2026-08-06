import type { FastifyInstance } from 'fastify';
import type { AppDeps } from '../../deps';
import { ApiError } from '../../lib/errors';
import { readUser } from '../auth/routes';

function registerInteractionRoutes(app: FastifyInstance, deps: AppDeps): void {
  const { config, db } = deps;

  const requireUser = async (req: Parameters<typeof readUser>[0]) => {
    const payload = readUser(req, config.jwtSecret);
    if (!payload || payload.kind !== 'user') throw new ApiError(401, 'UNAUTHORIZED', 'viewer session required');
    return payload.sub;
  };

  const ensureMedia = async (mediaId: string) => {
    const media = await db.getMediaById(mediaId);
    if (!media) throw new ApiError(404, 'NOT_FOUND', 'media not found');
  };

  // PUT semantics => idempotent by design (spec §5.1): liking twice is a no-op.
  app.put<{ Params: { id: string }; Body: { liked: boolean } }>(
    '/api/v1/media/:id/like',
    { schema: { body: { type: 'object', required: ['liked'], properties: { liked: { type: 'boolean' } } } } },
    async (req) => {
      const userId = await requireUser(req);
      await ensureMedia(req.params.id);
      await db.setLike(userId, req.params.id, req.body.liked);
      return { liked: req.body.liked };
    },
  );

  app.put<{ Params: { id: string }; Body: { saved: boolean } }>(
    '/api/v1/media/:id/save',
    { schema: { body: { type: 'object', required: ['saved'], properties: { saved: { type: 'boolean' } } } } },
    async (req) => {
      const userId = await requireUser(req);
      await ensureMedia(req.params.id);
      await db.setSave(userId, req.params.id, req.body.saved);
      return { saved: req.body.saved };
    },
  );
}

export default registerInteractionRoutes;

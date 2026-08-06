import type { FastifyInstance } from 'fastify';
import type { AppDeps } from '../../deps';
import { ApiError } from '../../lib/errors';
import { readUser } from '../auth/routes';

/**
 * Moderation queue (spec §3.2): low-confidence/flagged items never appear in
 * feeds until a human approves them. MVP scope: authenticated creators can
 * moderate (staff ACL becomes V2 admin). Report flow lands here too.
 */
function registerModerationRoutes(app: FastifyInstance, deps: AppDeps): void {
  const { config, db } = deps;

  const requireCreator = (req: Parameters<typeof readUser>[0]) => {
    const payload = readUser(req, config.jwtSecret);
    if (!payload || payload.kind !== 'creator') throw new ApiError(403, 'FORBIDDEN', 'creator session required');
    return payload.sub;
  };

  app.get('/api/v1/moderation/queue', async (req) => {
    requireCreator(req);
    const queue = await db.listModerationQueue();
    return {
      items: queue.map((m) => ({
        id: m.id,
        caption: m.caption,
        thumbnailUrl: m.thumbnailUrl,
        categories: m.categories,
        confidence: m.confidence,
        moderation: m.moderation,
        creator: m.creator,
      })),
    };
  });

  app.post<{ Params: { id: string }; Body: { action: 'approve' | 'reject' } }>(
    '/api/v1/moderation/:id',
    { schema: { body: { type: 'object', required: ['action'], properties: { action: { enum: ['approve', 'reject'] } } } } },
    async (req) => {
      requireCreator(req);
      const media = await db.getMediaById(req.params.id);
      if (!media) throw new ApiError(404, 'NOT_FOUND', 'media not found');
      if (req.body.action === 'approve') {
        await db.setMediaModeration(media.id, 'approved', 'published');
        return { id: media.id, status: 'approved' };
      }
      await db.setMediaModeration(media.id, 'rejected', 'ingested');
      return { id: media.id, status: 'rejected' };
    },
  );
}

export default registerModerationRoutes;

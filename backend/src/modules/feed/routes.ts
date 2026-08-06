import type { FastifyInstance } from 'fastify';
import type { AppDeps } from '../../deps';
import { ApiError } from '../../lib/errors';
import { CATEGORIES } from '../classifier/lexicons';
import { readUser } from '../auth/routes';

const MAX_LIMIT = 50;

function mediaToDto(m: {
  id: string; caption: string | null; mediaType: string; mediaUrl: string | null; thumbnailUrl: string | null;
  videoUrl: string | null; permalink: string | null; likeCount: number; commentCount: number; timestamp: Date;
  categories: string[]; isCardMode: boolean; liked: boolean; saved: boolean;
  creator: { id: string; username: string };
}) {
  return {
    id: m.id,
    caption: m.caption,
    mediaType: m.mediaType,
    mediaUrl: m.mediaUrl,
    thumbnailUrl: m.thumbnailUrl,
    videoUrl: m.videoUrl,
    permalink: m.permalink,
    likeCount: m.likeCount,
    commentCount: m.commentCount,
    timestamp: m.timestamp.toISOString(),
    categories: m.categories,
    isCardMode: m.isCardMode,
    liked: m.liked,
    saved: m.saved,
    creator: m.creator,
  };
}

function registerFeedRoutes(app: FastifyInstance, deps: AppDeps): void {
  const { config, db } = deps;

  app.get('/api/v1/categories', async () => {
    const counts = await db.countLiveByCategory();
    return {
      categories: CATEGORIES.map((c) => ({
        slug: c.slug,
        label: c.label,
        emoji: c.emoji,
        adjacent: c.adjacent,
        liveCount: counts[c.slug] ?? 0,
      })),
    };
  });

  app.get<{ Querystring: { categories?: string; cursor?: string; limit?: string } }>('/api/v1/feed', async (req) => {
    const limit = Math.min(MAX_LIMIT, Math.max(1, Number(req.query.limit ?? 20) || 20));
    const categories = (req.query.categories ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 10);
    const payload = readUser(req, config.jwtSecret);
    const page = await db.listPublishedMedia({
      categories,
      cursor: req.query.cursor ?? null,
      limit,
      userId: payload?.kind === 'user' ? payload.sub : null,
    });
    return { items: page.items.map(mediaToDto), nextCursor: page.nextCursor };
  });

  app.get<{ Params: { id: string } }>('/api/v1/creators/:id', async (req) => {
    const creator = await db.getCreatorById(req.params.id);
    if (!creator) throw new ApiError(404, 'NOT_FOUND', 'creator not found');
    const media = await db.listMediaByCreator(creator.id);
    const live = media.filter((m) => m.status === 'published' && m.moderation === 'approved');
    return {
      creator: {
        id: creator.id,
        username: creator.username,
        accountType: creator.accountType,
        status: creator.status,
        mediaCount: live.length,
      },
      media: live.map((m) => mediaToDto({ ...m, liked: false, saved: false })),
    };
  });

  app.post<{ Params: { id: string } }>('/api/v1/creators/:id/revoke', async (req) => {
    const payload = readUser(req, config.jwtSecret);
    if (!payload || payload.kind !== 'creator' || payload.sub !== req.params.id) {
      throw new ApiError(403, 'FORBIDDEN', 'only the creator can revoke their own account');
    }
    await db.updateCreatorStatus(req.params.id, 'revoked');
    const purged = await db.revokeCreatorMedia(req.params.id);
    return { revoked: true, mediaRemovedImmediately: purged };
  });

  app.get('/api/v1/settings/interests', async (req) => {
    const payload = readUser(req, config.jwtSecret);
    if (!payload || payload.kind !== 'user') throw new ApiError(401, 'UNAUTHORIZED', 'viewer session required');
    const user = await db.getUserById(payload.sub);
    return { interests: user?.interests ?? [] };
  });

  app.put<{ Body: { interests: string[] } }>(
    '/api/v1/settings/interests',
    { schema: { body: { type: 'object', required: ['interests'], properties: { interests: { type: 'array', items: { type: 'string' }, maxItems: 12 } } } } },
    async (req) => {
      const payload = readUser(req, config.jwtSecret);
      if (!payload || payload.kind !== 'user') throw new ApiError(401, 'UNAUTHORIZED', 'viewer session required');
      const valid = req.body.interests.filter((s) => CATEGORIES.some((c) => c.slug === s));
      await db.setUserInterests(payload.sub, valid);
      return { interests: valid };
    },
  );
}

export default registerFeedRoutes;

import { PrismaClient } from '@prisma/client';
import type { Db, CreatorRow, MediaRow, UserRow, FeedPage, UpsertMediaInput, ModerationState, MediaStatus, CreatorStatus } from './types';

function toCreator(row: {
  id: string; igUserId: string; username: string; accountType: string; status: string;
  tokenRef: string | null; tokenExpiresAt: Date | null; lastSyncAt: Date | null;
  lastMediaTimestamp: Date | null; createdAt: Date;
}): CreatorRow {
  return {
    id: row.id,
    igUserId: row.igUserId,
    username: row.username,
    accountType: row.accountType,
    status: row.status as CreatorStatus,
    tokenRef: row.tokenRef,
    tokenExpiresAt: row.tokenExpiresAt,
    lastSyncAt: row.lastSyncAt,
    lastMediaTimestamp: row.lastMediaTimestamp,
    createdAt: row.createdAt,
  };
}

function toMedia(row: {
  id: string; creatorId: string; igMediaId: string; caption: string | null; mediaType: string;
  mediaUrl: string | null; thumbnailUrl: string | null; videoUrl: string | null; permalink: string | null;
  likeCount: number; commentCount: number; timestamp: Date; categories: string[]; confidence: number | null;
  moderation: string; status: string; isCardMode: boolean; createdAt: Date; revokedAt: Date | null;
  creator: { id: string; username: string; igUserId: string };
}): MediaRow {
  return {
    id: row.id,
    creatorId: row.creatorId,
    creator: { id: row.creator.id, username: row.creator.username, igUserId: row.creator.igUserId },
    igMediaId: row.igMediaId,
    caption: row.caption,
    mediaType: row.mediaType,
    mediaUrl: row.mediaUrl,
    thumbnailUrl: row.thumbnailUrl,
    videoUrl: row.videoUrl,
    permalink: row.permalink,
    likeCount: row.likeCount,
    commentCount: row.commentCount,
    timestamp: row.timestamp,
    categories: row.categories,
    confidence: row.confidence,
    moderation: row.moderation as ModerationState,
    status: row.status as MediaStatus,
    isCardMode: row.isCardMode,
    createdAt: row.createdAt,
    revokedAt: row.revokedAt,
  };
}

/** Production Db backed by Postgres via Prisma (SCROLLECT-SPEC.md §1.2). */
export class PrismaDb implements Db {
  constructor(public prisma: PrismaClient) {}

  async upsertCreator(input: {
    igUserId: string; username: string; accountType: string; tokenRef: string; tokenExpiresAt: Date;
  }): Promise<CreatorRow> {
    const row = await this.prisma.creator.upsert({
      where: { igUserId: input.igUserId },
      update: {
        username: input.username,
        accountType: input.accountType,
        tokenRef: input.tokenRef,
        tokenExpiresAt: input.tokenExpiresAt,
        status: 'active',
      },
      create: input,
    });
    return toCreator(row);
  }

  async getCreatorByIgId(igUserId: string): Promise<CreatorRow | null> {
    const row = await this.prisma.creator.findUnique({ where: { igUserId } });
    return row ? toCreator(row) : null;
  }

  async getCreatorById(id: string): Promise<CreatorRow | null> {
    const row = await this.prisma.creator.findUnique({ where: { id } });
    return row ? toCreator(row) : null;
  }

  async updateCreatorStatus(id: string, status: CreatorStatus): Promise<void> {
    await this.prisma.creator.update({ where: { id }, data: { status } });
  }

  async setCreatorToken(id: string, tokenRef: string, expiresAt: Date): Promise<void> {
    await this.prisma.creator.update({ where: { id }, data: { tokenRef, tokenExpiresAt: expiresAt, status: 'active' } });
  }

  async setCreatorSyncState(id: string, lastMediaTimestamp: Date | null, lastSyncAt: Date): Promise<void> {
    await this.prisma.creator.update({ where: { id }, data: { lastMediaTimestamp, lastSyncAt } });
  }

  async listCreatorsForSync(): Promise<CreatorRow[]> {
    const cutoff = new Date(Date.now() - 30 * 60_000);
    const rows = await this.prisma.creator.findMany({
      where: {
        status: { in: ['active', 'expiring'] },
        OR: [{ lastSyncAt: null }, { lastSyncAt: { lt: cutoff } }],
      },
    });
    return rows.map(toCreator);
  }

  async upsertMedia(input: UpsertMediaInput): Promise<MediaRow> {
    const row = await this.prisma.media.upsert({
      where: { creatorId_igMediaId: { creatorId: input.creatorId, igMediaId: input.igMediaId } },
      update: {
        caption: input.caption,
        mediaType: input.mediaType,
        mediaUrl: input.mediaUrl,
        thumbnailUrl: input.thumbnailUrl,
        videoUrl: input.videoUrl,
        permalink: input.permalink,
        likeCount: input.likeCount,
        commentCount: input.commentCount,
        timestamp: input.timestamp,
        categories: input.categories,
        confidence: input.confidence,
        moderation: input.moderation,
        status: input.status,
        isCardMode: input.isCardMode,
      },
      create: input,
      include: { creator: { select: { id: true, username: true, igUserId: true } } },
    });
    return toMedia(row);
  }

  async getMediaById(id: string): Promise<MediaRow | null> {
    const row = await this.prisma.media.findUnique({
      where: { id },
      include: { creator: { select: { id: true, username: true, igUserId: true } } },
    });
    return row ? toMedia(row) : null;
  }

  async listMediaByCreator(creatorId: string): Promise<MediaRow[]> {
    const rows = await this.prisma.media.findMany({
      where: { creatorId },
      orderBy: { timestamp: 'desc' },
      include: { creator: { select: { id: true, username: true, igUserId: true } } },
    });
    return rows.map(toMedia);
  }

  async setMediaModeration(id: string, moderation: ModerationState, status?: MediaStatus): Promise<void> {
    await this.prisma.media.update({ where: { id }, data: { moderation, ...(status ? { status } : {}) } });
  }

  async listModerationQueue(): Promise<MediaRow[]> {
    const rows = await this.prisma.media.findMany({
      where: { moderation: { in: ['pending', 'flagged'] } },
      orderBy: { createdAt: 'asc' },
      include: { creator: { select: { id: true, username: true, igUserId: true } } },
    });
    return rows.map(toMedia);
  }

  async listPublishedMedia(opts: {
    categories: string[]; cursor?: string | null; limit: number; userId?: string | null;
  }): Promise<FeedPage> {
    const rows = await this.prisma.media.findMany({
      where: {
        status: 'published',
        moderation: 'approved',
        ...(opts.categories.length > 0 ? { categories: { hasSome: opts.categories } } : {}),
      },
      orderBy: [{ timestamp: 'desc' }, { id: 'desc' }],
      take: opts.limit + 1,
      ...(opts.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
      include: { creator: { select: { id: true, username: true, igUserId: true } } },
    });

    const hasMore = rows.length > opts.limit;
    const page = hasMore ? rows.slice(0, opts.limit) : rows;
    const nextCursor = hasMore ? page[page.length - 1].id : null;

    let liked = new Set<string>();
    let saved = new Set<string>();
    if (opts.userId && page.length > 0) {
      const ids = page.map((m) => m.id);
      const [ls, ss] = await Promise.all([
        this.prisma.like.findMany({ where: { userId: opts.userId, mediaId: { in: ids } } }),
        this.prisma.save.findMany({ where: { userId: opts.userId, mediaId: { in: ids } } }),
      ]);
      liked = new Set(ls.map((l) => l.mediaId));
      saved = new Set(ss.map((s) => s.mediaId));
    }

    return {
      items: page.map((m) => ({ ...toMedia(m), liked: liked.has(m.id), saved: saved.has(m.id) })),
      nextCursor,
    };
  }

  async countLiveByCategory(): Promise<Record<string, number>> {
    const rows = await this.prisma.media.findMany({
      where: { status: 'published', moderation: 'approved' },
      select: { categories: true },
    });
    const counts: Record<string, number> = {};
    for (const r of rows) for (const c of r.categories) counts[c] = (counts[c] ?? 0) + 1;
    return counts;
  }

  async revokeCreatorMedia(creatorId: string): Promise<number> {
    const res = await this.prisma.media.updateMany({
      where: { creatorId, status: { not: 'revoked' } },
      // stamp the exact revocation time so the 24h purge window is anchored to it (spec §2.5)
      data: { status: 'revoked', revokedAt: new Date() },
    });
    return res.count;
  }

  async purgeRevoked(olderThan: Date): Promise<number> {
    // Purge exactly 24h after REVOCATION (revokedAt). Legacy rows (revoked before
    // the revokedAt migration) fall back to createdAt, preserving prior behavior.
    const res = await this.prisma.media.deleteMany({
      where: {
        status: 'revoked',
        OR: [{ revokedAt: { lt: olderThan } }, { revokedAt: null, createdAt: { lt: olderThan } }],
      },
    });
    return res.count;
  }

  async ping(): Promise<void> {
    await this.prisma.$queryRaw`SELECT 1`;
  }

  async getOrCreateUserByDevice(deviceId: string): Promise<UserRow> {
    const row = await this.prisma.user.upsert({
      where: { deviceId },
      update: {},
      create: { deviceId },
    });
    return { id: row.id, deviceId: row.deviceId, interests: row.interests, createdAt: row.createdAt };
  }

  async getUserById(id: string): Promise<UserRow | null> {
    const row = await this.prisma.user.findUnique({ where: { id } });
    return row ? { id: row.id, deviceId: row.deviceId, interests: row.interests, createdAt: row.createdAt } : null;
  }

  async setUserInterests(userId: string, interests: string[]): Promise<void> {
    await this.prisma.user.update({ where: { id: userId }, data: { interests } });
  }

  async setLike(userId: string, mediaId: string, liked: boolean): Promise<void> {
    if (liked) {
      await this.prisma.like.upsert({ where: { userId_mediaId: { userId, mediaId } }, update: {}, create: { userId, mediaId } });
    } else {
      await this.prisma.like.deleteMany({ where: { userId, mediaId } });
    }
  }

  async setSave(userId: string, mediaId: string, saved: boolean): Promise<void> {
    if (saved) {
      await this.prisma.save.upsert({ where: { userId_mediaId: { userId, mediaId } }, update: {}, create: { userId, mediaId } });
    } else {
      await this.prisma.save.deleteMany({ where: { userId, mediaId } });
    }
  }
}

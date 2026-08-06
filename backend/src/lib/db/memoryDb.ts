import { randomUUID } from 'node:crypto';
import type { Db, CreatorRow, MediaRow, UserRow, FeedPage, UpsertMediaInput } from './types';

/**
 * In-memory Db. Used by unit/smoke tests and by MOCK_MODE when no DATABASE_URL
 * is configured (dev without Docker). Same interface as PrismaDb — swapping is
 * config, not code (spec: mock/live share the same interfaces).
 */
export class MemoryDb implements Db {
  creators = new Map<string, CreatorRow>();
  media = new Map<string, MediaRow>();
  users = new Map<string, UserRow>();
  likes = new Set<string>(); // `${userId}:${mediaId}`
  saves = new Set<string>();

  private byIgId = new Map<string, string>();
  private byDevice = new Map<string, string>();

  // --- creators ---
  async upsertCreator(input: {
    igUserId: string;
    username: string;
    accountType: string;
    tokenRef: string;
    tokenExpiresAt: Date;
  }): Promise<CreatorRow> {
    const existingId = this.byIgId.get(input.igUserId);
    if (existingId) {
      const row = this.creators.get(existingId)!;
      row.username = input.username;
      row.accountType = input.accountType;
      row.tokenRef = input.tokenRef;
      row.tokenExpiresAt = input.tokenExpiresAt;
      row.status = 'active';
      return row;
    }
    const row: CreatorRow = {
      id: randomUUID(),
      igUserId: input.igUserId,
      username: input.username,
      accountType: input.accountType,
      status: 'active',
      tokenRef: input.tokenRef,
      tokenExpiresAt: input.tokenExpiresAt,
      lastSyncAt: null,
      lastMediaTimestamp: null,
      createdAt: new Date(),
    };
    this.creators.set(row.id, row);
    this.byIgId.set(row.igUserId, row.id);
    return row;
  }

  async getCreatorByIgId(igUserId: string): Promise<CreatorRow | null> {
    const id = this.byIgId.get(igUserId);
    return id ? this.creators.get(id) ?? null : null;
  }

  async getCreatorById(id: string): Promise<CreatorRow | null> {
    return this.creators.get(id) ?? null;
  }

  async updateCreatorStatus(id: string, status: CreatorRow['status']): Promise<void> {
    const row = this.creators.get(id);
    if (row) row.status = status;
  }

  async setCreatorToken(id: string, tokenRef: string, expiresAt: Date): Promise<void> {
    const row = this.creators.get(id);
    if (row) {
      row.tokenRef = tokenRef;
      row.tokenExpiresAt = expiresAt;
    }
  }

  async setCreatorSyncState(id: string, lastMediaTimestamp: Date | null, lastSyncAt: Date): Promise<void> {
    const row = this.creators.get(id);
    if (row) {
      row.lastMediaTimestamp = lastMediaTimestamp;
      row.lastSyncAt = lastSyncAt;
    }
  }

  async listCreatorsForSync(): Promise<CreatorRow[]> {
    const cutoff = new Date(Date.now() - 30 * 60_000);
    return [...this.creators.values()].filter(
      (c) => c.status === 'active' || c.status === 'expiring',
    ).filter((c) => !c.lastSyncAt || c.lastSyncAt < cutoff);
  }

  // --- media ---
  async upsertMedia(input: UpsertMediaInput): Promise<MediaRow> {
    const existing = [...this.media.values()].find((m) => m.creatorId === input.creatorId && m.igMediaId === input.igMediaId);
    if (existing) {
      const { createdAt: _createdAt, revokedAt: _revokedAt, ...rest } = input;
      const row = {
        ...existing,
        ...rest,
        id: existing.id,
        creator: this.creatorInfo(input.creatorId),
        revokedAt: _revokedAt !== undefined ? _revokedAt : existing.revokedAt,
      };
      this.media.set(existing.id, row);
      return row;
    }
    const row: MediaRow = {
      id: randomUUID(),
      creatorId: input.creatorId,
      creator: this.creatorInfo(input.creatorId),
      igMediaId: input.igMediaId,
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
      createdAt: input.createdAt ?? new Date(),
      revokedAt: input.revokedAt ?? null,
    };
    this.media.set(row.id, row);
    return row;
  }

  async getMediaById(id: string): Promise<MediaRow | null> {
    return this.media.get(id) ?? null;
  }

  async listMediaByCreator(creatorId: string): Promise<MediaRow[]> {
    return [...this.media.values()]
      .filter((m) => m.creatorId === creatorId)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  async setMediaModeration(id: string, moderation: MediaRow['moderation'], status?: MediaRow['status']): Promise<void> {
    const row = this.media.get(id);
    if (row) {
      row.moderation = moderation;
      if (status) row.status = status;
    }
  }

  async listModerationQueue(): Promise<MediaRow[]> {
    return [...this.media.values()].filter((m) => m.moderation === 'flagged' || m.moderation === 'pending');
  }

  async listPublishedMedia(opts: {
    categories: string[];
    cursor?: string | null;
    limit: number;
    userId?: string | null;
  }): Promise<FeedPage> {
    let items = [...this.media.values()].filter((m) => m.status === 'published' && m.moderation === 'approved');
    if (opts.categories.length > 0) {
      items = items.filter((m) => m.categories.some((c) => opts.categories.includes(c)));
    }
    items.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime() || (a.id < b.id ? 1 : -1));

    if (opts.cursor) {
      const idx = items.findIndex((m) => m.id === opts.cursor);
      items = idx >= 0 ? items.slice(idx + 1) : [];
    }

    const page = items.slice(0, opts.limit + 1);
    const hasMore = page.length > opts.limit;
    const pageItems = hasMore ? page.slice(0, opts.limit) : page;
    const nextCursor = hasMore ? pageItems[pageItems.length - 1].id : null;

    return {
      items: pageItems.map((m) => ({
        ...m,
        liked: opts.userId ? this.likes.has(`${opts.userId}:${m.id}`) : false,
        saved: opts.userId ? this.saves.has(`${opts.userId}:${m.id}`) : false,
      })),
      nextCursor,
    };
  }

  async countLiveByCategory(): Promise<Record<string, number>> {
    const counts: Record<string, number> = {};
    for (const m of this.media.values()) {
      if (m.status !== 'published' || m.moderation !== 'approved') continue;
      for (const c of m.categories) counts[c] = (counts[c] ?? 0) + 1;
    }
    return counts;
  }

  async revokeCreatorMedia(creatorId: string): Promise<number> {
    let count = 0;
    for (const m of this.media.values()) {
      if (m.creatorId === creatorId && m.status !== 'revoked') {
        m.status = 'revoked';
        m.revokedAt = new Date();
        count++;
      }
    }
    return count;
  }

  async purgeRevoked(olderThan: Date): Promise<number> {
    let count = 0;
    for (const [id, m] of this.media) {
      if (m.status !== 'revoked') continue;
      // exact 24h-after-revocation window; legacy rows fall back to createdAt
      const anchor = m.revokedAt ?? m.createdAt;
      if (anchor < olderThan) {
        this.media.delete(id);
        count++;
      }
    }
    return count;
  }

  async ping(): Promise<void> {
    // in-memory store is always reachable
    return;
  }

  // --- users & interactions ---
  async getOrCreateUserByDevice(deviceId: string): Promise<UserRow> {
    const existing = this.byDevice.get(deviceId);
    if (existing) return this.users.get(existing)!;
    const row: UserRow = { id: randomUUID(), deviceId, interests: [], createdAt: new Date() };
    this.users.set(row.id, row);
    this.byDevice.set(deviceId, row.id);
    return row;
  }

  async getUserById(id: string): Promise<UserRow | null> {
    return this.users.get(id) ?? null;
  }

  async setUserInterests(userId: string, interests: string[]): Promise<void> {
    const row = this.users.get(userId);
    if (row) row.interests = interests;
  }

  async setLike(userId: string, mediaId: string, liked: boolean): Promise<void> {
    const key = `${userId}:${mediaId}`;
    if (liked) this.likes.add(key);
    else this.likes.delete(key);
  }

  async setSave(userId: string, mediaId: string, saved: boolean): Promise<void> {
    const key = `${userId}:${mediaId}`;
    if (saved) this.saves.add(key);
    else this.saves.delete(key);
  }

  private creatorInfo(creatorId: string) {
    const c = this.creators.get(creatorId);
    return { id: creatorId, username: c?.username ?? 'unknown', igUserId: c?.igUserId ?? '' };
  }
}

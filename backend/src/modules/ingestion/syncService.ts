import type { Db } from '../../lib/db/types';
import { TokenVault } from '../../lib/tokenVault';
import { TokenBucketRateLimiter } from '../../lib/rateLimiter';
import type { Logger } from '../../lib/logger';
import type { IgClient } from './instagramClient';
import { classify } from '../classifier/classifier';
import { moderationForDecision } from '../classifier/moderation';

export class RateLimitedError extends Error {
  constructor(public retryAfterMs: number) {
    super('rate limited');
  }
}

export interface SyncResult {
  creatorId: string;
  calls: number;
  mediaUpserted: number;
  published: number;
  reviewed: number;
  rejected: number;
  skipped: boolean;
}

export interface SyncAllResult {
  results: SyncResult[];
  errors: { creatorId: string; message: string }[];
}

const MAX_PAGES_PER_PASS = 3;
const PAGE_SIZE = 50;

/**
 * Incremental ingestion worker body (SCROLLECT-SPEC.md §2.4): `since`-based
 * incremental sync, 200 calls/user/hour budget via token bucket, detail fetch
 * only for new/changed media, classifier applied per item.
 */
export class SyncService {
  constructor(
    private deps: {
      db: Db;
      ig: IgClient;
      vault: TokenVault;
      rateLimiter: TokenBucketRateLimiter;
      logger: Logger;
    },
  ) {}

  async syncCreator(creatorId: string): Promise<SyncResult> {
    const creator = await this.deps.db.getCreatorById(creatorId);
    if (!creator) throw new Error(`creator not found: ${creatorId}`);

    const result: SyncResult = { creatorId, calls: 0, mediaUpserted: 0, published: 0, reviewed: 0, rejected: 0, skipped: false };
    if (creator.status === 'revoked' || creator.status === 'expired' || creator.status === 'refresh_failed') {
      result.skipped = true;
      return result;
    }

    const budget = await this.deps.rateLimiter.consume(`ig:${creator.id}`);
    if (!budget.allowed) throw new RateLimitedError(budget.retryAfterMs);
    result.calls += 1;

    const token = creator.tokenRef ? this.deps.vault.decrypt(creator.tokenRef) : null;
    if (!token) {
      result.skipped = true;
      return result;
    }

    let since = creator.lastMediaTimestamp ? creator.lastMediaTimestamp.toISOString() : undefined;
    let after: string | undefined;
    let maxTs = creator.lastMediaTimestamp;

    for (let page = 0; page < MAX_PAGES_PER_PASS; page++) {
      const list = await this.deps.ig.listMedia(token, creator.igUserId, since, PAGE_SIZE);
      result.calls += 1;
      after = list.after;

      for (const item of list.items) {
        const detail = await this.deps.ig.getMediaDetail(token, item.igMediaId);
        result.calls += 1;
        result.mediaUpserted += 1;

        const cls = classify({ caption: detail.caption ?? '', bio: '', username: creator.username });
        const moderation = moderationForDecision(cls.decision);
        const status = cls.decision === 'publish' ? 'published' : 'ingested';
        if (status === 'published') result.published += 1;
        else if (moderation === 'flagged') result.reviewed += 1;
        else if (moderation === 'rejected') result.rejected += 1;

        await this.deps.db.upsertMedia({
          creatorId: creator.id,
          igMediaId: detail.igMediaId,
          caption: detail.caption,
          mediaType: detail.mediaType,
          mediaUrl: detail.mediaUrl,
          thumbnailUrl: detail.thumbnailUrl,
          videoUrl: detail.videoUrl,
          permalink: detail.permalink,
          likeCount: detail.likeCount,
          commentCount: detail.commentCount,
          timestamp: new Date(detail.timestamp),
          categories: cls.publishedTags,
          confidence: cls.top?.confidence ?? null,
          moderation,
          status,
          isCardMode: detail.mediaType === 'VIDEO' && !detail.videoUrl,
        });

        const ts = new Date(detail.timestamp);
        if (!maxTs || ts > maxTs) maxTs = ts;
      }

      if (!after) break;
      const nextBudget = await this.deps.rateLimiter.consume(`ig:${creator.id}`);
      if (!nextBudget.allowed) break; // continue next pass
      result.calls += 1;
    }

    await this.deps.db.setCreatorSyncState(creator.id, maxTs, new Date());
    return result;
  }

  async syncAll(): Promise<SyncAllResult> {
    const creators = await this.deps.db.listCreatorsForSync();
    const results: SyncResult[] = [];
    const errors: { creatorId: string; message: string }[] = [];

    for (const creator of creators) {
      try {
        results.push(await this.syncCreator(creator.id));
      } catch (err) {
        if (err instanceof RateLimitedError) {
          this.deps.logger.info({ creatorId: creator.id, retryAfterMs: err.retryAfterMs }, 'sync deferred: rate limited');
          continue;
        }
        errors.push({ creatorId: creator.id, message: (err as Error).message });
        this.deps.logger.warn({ creatorId: creator.id, err: (err as Error).message }, 'sync failed');
      }
    }
    return { results, errors };
  }
}

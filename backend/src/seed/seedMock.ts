import type { Db } from '../lib/db/types';
import { TokenVault } from '../lib/tokenVault';
import type { Logger } from '../lib/logger';
import { MOCK_CREATORS, MOCK_MEDIA, mockThumbnailFor, mockVideoFor } from '../modules/ingestion/mockData';
import { classify } from '../modules/classifier/classifier';
import { moderationForDecision } from '../modules/classifier/moderation';

/**
 * Seeds the deterministic MOCK dataset (creators + Reels, classified through the
 * real lexical pipeline) so MOCK_MODE serves a populated feed with zero Meta
 * setup. Idempotent (upserts). Only ever called in MOCK_MODE.
 */
export async function seedMockData(deps: { db: Db; vault: TokenVault; logger: Logger }): Promise<void> {
  const { db, vault, logger } = deps;

  for (const c of MOCK_CREATORS) {
    await db.upsertCreator({
      igUserId: c.igUserId,
      username: c.username,
      accountType: c.accountType,
      tokenRef: vault.encrypt(`mock-token-${c.username}`),
      tokenExpiresAt: new Date(Date.now() + 60 * 24 * 3600_000),
    });
  }

  let index = 0;
  for (const seed of MOCK_MEDIA) {
    const creatorSeed = MOCK_CREATORS.find((c) => c.username === seed.username);
    if (!creatorSeed) continue;
    const creator = await db.getCreatorByIgId(creatorSeed.igUserId);
    if (!creator) continue;

    const igMediaId = `mock-${seed.username}-${index}`;
    const bio = creatorSeed.bio;
    const cls = classify({ caption: seed.caption, bio, username: seed.username });
    const moderation = moderationForDecision(cls.decision);
    const status = cls.decision === 'publish' ? 'published' : 'ingested';

    await db.upsertMedia({
      creatorId: creator.id,
      igMediaId,
      caption: seed.caption,
      mediaType: 'VIDEO',
      mediaUrl: null,
      thumbnailUrl: mockThumbnailFor(igMediaId),
      videoUrl: seed.playable ? mockVideoFor(index) : null,
      permalink: `https://instagram.com/${seed.username}/reel/${igMediaId}`,
      likeCount: seed.likeCount,
      commentCount: seed.commentCount,
      timestamp: new Date(Date.now() - seed.daysAgo * 86_400_000),
      categories: cls.publishedTags,
      confidence: cls.top?.confidence ?? null,
      moderation,
      status,
      isCardMode: !seed.playable,
    });
    index += 1;
  }

  logger.info({ creators: MOCK_CREATORS.length, media: MOCK_MEDIA.length }, 'mock dataset seeded');
}

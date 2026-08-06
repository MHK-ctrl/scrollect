import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryDb } from '../src/lib/db/memoryDb';
import type { UpsertMediaInput } from '../src/lib/db/types';

function mediaInput(overrides: Partial<UpsertMediaInput> = {}): UpsertMediaInput {
  return {
    creatorId: 'c1',
    igMediaId: 'ig-1',
    caption: 'a #tech reel',
    mediaType: 'VIDEO',
    mediaUrl: null,
    thumbnailUrl: 'https://x/thumb.jpg',
    videoUrl: 'https://x/v.mp4',
    permalink: 'https://instagram.com/x',
    likeCount: 10,
    commentCount: 2,
    timestamp: new Date(),
    categories: ['tech'],
    confidence: 0.9,
    moderation: 'approved',
    status: 'published',
    isCardMode: false,
    ...overrides,
  };
}

/**
 * Spec §2.5: content is purged within 24h of REVOCATION — not 24h after it was
 * first created (the known `createdAt` limitation fixed by the revokedAt column).
 */
describe('revokedAt-anchored 24h purge (spec §2.5)', () => {
  let db: MemoryDb;

  beforeEach(async () => {
    db = new MemoryDb();
    await db.upsertCreator({
      igUserId: 'ig-1',
      username: 'bytebuddy',
      accountType: 'CREATOR',
      tokenRef: 'enc',
      tokenExpiresAt: new Date(Date.now() + 1e12),
    });
    // Two long-live Reels: created 30d ago and 1d ago. Under the old
    // createdAt-based purge, revoking either would purge it immediately.
    await db.upsertMedia(mediaInput({ igMediaId: 'ig-a', createdAt: new Date(Date.now() - 30 * 86_400_000) }));
    await db.upsertMedia(mediaInput({ igMediaId: 'ig-b', createdAt: new Date(Date.now() - 1 * 86_400_000) }));
  });

  it('stamps revokedAt at revocation time, not createdAt', async () => {
    await db.revokeCreatorMedia('c1');
    const all = await db.listMediaByCreator('c1');
    expect(all.length).toBe(2);
    for (const m of all) {
      expect(m.status).toBe('revoked');
      expect(m.revokedAt).not.toBeNull();
      // a 30-day-old reel revoked just now must anchor to NOW, not to createdAt
      expect(m.revokedAt!.getTime()).toBeGreaterThan(Date.now() - 5_000);
    }
  });

  it('does NOT purge media revoked within the last 24h, even if createdAt is old', async () => {
    await db.revokeCreatorMedia('c1'); // both reels revoked NOW, createdAt 30d/1d ago
    const purged = await db.purgeRevoked(new Date(Date.now() - 86_400_000));
    expect(purged).toBe(0); // old bug would have purged the 30-day-old reel immediately
  });

  it('purges media exactly once 24h after revocation elapsed', async () => {
    await db.revokeCreatorMedia('c1');
    for (const m of await db.listMediaByCreator('c1')) {
      m.revokedAt = new Date(Date.now() - 25 * 3_600_000); // revoked 25h ago
    }
    const purged = await db.purgeRevoked(new Date(Date.now() - 86_400_000));
    expect(purged).toBe(2);
    expect((await db.listMediaByCreator('c1')).length).toBe(0);
  });

  it('keeps a 24h+ revoked row when the window has NOT fully elapsed', async () => {
    await db.revokeCreatorMedia('c1');
    for (const m of await db.listMediaByCreator('c1')) {
      m.revokedAt = new Date(Date.now() - 23 * 3_600_000); // revoked 23h ago
    }
    const purged = await db.purgeRevoked(new Date(Date.now() - 86_400_000));
    expect(purged).toBe(0); // 23h < 24h window
  });

  it('legacy rows without revokedAt fall back to createdAt', async () => {
    // rows revoked before the revokedAt migration shipped have revokedAt = null
    await db.upsertMedia(mediaInput({ igMediaId: 'ig-legacy-old', status: 'revoked', createdAt: new Date(Date.now() - 2 * 86_400_000) }));
    await db.upsertMedia(mediaInput({ igMediaId: 'ig-legacy-fresh', status: 'revoked', createdAt: new Date(Date.now() - 3 * 3_600_000) }));
    const purged = await db.purgeRevoked(new Date(Date.now() - 86_400_000));
    expect(purged).toBe(1); // only the old legacy row
    const remaining = await db.listMediaByCreator('c1');
    expect(remaining.some((m) => m.igMediaId === 'ig-legacy-fresh')).toBe(true);
  });
});

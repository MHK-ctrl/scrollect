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

describe('MemoryDb likes/saves (idempotency)', () => {
  let db: MemoryDb;
  beforeEach(async () => {
    db = new MemoryDb();
    const user = await db.getOrCreateUserByDevice('device-1');
    await db.upsertCreator({ igUserId: 'ig-1', username: 'bytebuddy', accountType: 'CREATOR', tokenRef: 'enc', tokenExpiresAt: new Date(Date.now() + 1e12) });
    await db.upsertMedia(mediaInput());
    await db.setLike(user.id, (await db.listPublishedMedia({ categories: [], limit: 10 })).items[0].id, true);
  });

  it('double-like is a no-op (idempotent)', async () => {
    const media = (await db.listPublishedMedia({ categories: [], limit: 10 })).items[0];
    const user = await db.getOrCreateUserByDevice('device-1');
    await db.setLike(user.id, media.id, true); // again — must not throw or duplicate
    await db.setLike(user.id, media.id, true);
    const page = await db.listPublishedMedia({ categories: [], limit: 10, userId: user.id });
    expect(page.items[0].liked).toBe(true);
  });

  it('unlike flips the flag', async () => {
    const media = (await db.listPublishedMedia({ categories: [], limit: 10 })).items[0];
    const user = await db.getOrCreateUserByDevice('device-1');
    await db.setLike(user.id, media.id, false);
    const page = await db.listPublishedMedia({ categories: [], limit: 10, userId: user.id });
    expect(page.items[0].liked).toBe(false);
  });

  it('save/un-save is idempotent and isolated from likes', async () => {
    const media = (await db.listPublishedMedia({ categories: [], limit: 10 })).items[0];
    const user = await db.getOrCreateUserByDevice('device-1');
    await db.setSave(user.id, media.id, true);
    await db.setSave(user.id, media.id, true);
    const page = await db.listPublishedMedia({ categories: [], limit: 10, userId: user.id });
    expect(page.items[0].saved).toBe(true);
    await db.setSave(user.id, media.id, false);
    const after = await db.listPublishedMedia({ categories: [], limit: 10, userId: user.id });
    expect(after.items[0].saved).toBe(false);
    expect(after.items[0].liked).toBe(true); // untouched by save toggle
  });

  it('a second user does not see the first user’s likes', async () => {
    const media = (await db.listPublishedMedia({ categories: [], limit: 10 })).items[0];
    const other = await db.getOrCreateUserByDevice('device-2');
    const page = await db.listPublishedMedia({ categories: [], limit: 10, userId: other.id });
    expect(page.items[0].liked).toBe(false);
  });
});

describe('MemoryDb feed behavior', () => {
  let db: MemoryDb;
  beforeEach(async () => {
    db = new MemoryDb();
    await db.upsertCreator({ igUserId: 'ig-1', username: 'bytebuddy', accountType: 'CREATOR', tokenRef: 'enc', tokenExpiresAt: new Date(Date.now() + 1e12) });
    const base = Date.now();
    for (let i = 0; i < 5; i++) {
      await db.upsertMedia(
        mediaInput({
          igMediaId: `ig-${i}`,
          categories: i % 2 === 0 ? ['tech'] : ['cars'],
          timestamp: new Date(base - i * 60_000),
          status: 'published',
          moderation: 'approved',
        }),
      );
    }
    // one unpublished item must never leak into feeds
    await db.upsertMedia(mediaInput({ igMediaId: 'ig-hidden', status: 'ingested', moderation: 'flagged', categories: ['tech'] }));
  });

  it('filters by category and hides non-published items', async () => {
    const page = await db.listPublishedMedia({ categories: ['tech'], limit: 20 });
    expect(page.items.length).toBe(3); // 0,2,4 (even) are tech; hidden item excluded
    for (const it of page.items) expect(it.categories).toContain('tech');
  });

  it('paginates with cursor and keeps order (newest first)', async () => {
    const page1 = await db.listPublishedMedia({ categories: [], limit: 2 });
    expect(page1.items.length).toBe(2);
    expect(page1.nextCursor).toBe(page1.items[1].id);
    const page2 = await db.listPublishedMedia({ categories: [], limit: 2, cursor: page1.nextCursor });
    expect(page2.items.length).toBe(2);
    expect(page2.items[0].timestamp.getTime()).toBeLessThanOrEqual(page1.items[1].timestamp.getTime());
    expect(page1.items[0].timestamp.getTime()).toBeGreaterThanOrEqual(page1.items[1].timestamp.getTime());
  });

  it('counts live items per category, ignoring hidden ones', async () => {
    const counts = await db.countLiveByCategory();
    expect(counts['tech']).toBe(3);
    expect(counts['cars']).toBe(2);
    expect(counts['finance']).toBeUndefined();
  });

  it('revokes a creator’s media and purges old revoked rows', async () => {
    const removed = await db.revokeCreatorMedia('c1');
    expect(removed).toBe(6);
    const empty = await db.listPublishedMedia({ categories: [], limit: 20 });
    expect(empty.items.length).toBe(0);
    await db.upsertMedia(mediaInput({ igMediaId: 'ig-old', status: 'revoked', createdAt: new Date(Date.now() - 2 * 86_400_000) }));
    const purged = await db.purgeRevoked(new Date(Date.now() - 86_400_000));
    expect(purged).toBeGreaterThanOrEqual(1);
  });
});

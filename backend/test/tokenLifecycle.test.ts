import { describe, it, expect, vi } from 'vitest';
import { MemoryDb } from '../src/lib/db/memoryDb';
import { TokenVault } from '../src/lib/tokenVault';
import { TokenLifecycleService, shouldRefresh, REFRESH_BEFORE_MS, MAX_REFRESH_ATTEMPTS } from '../src/lib/tokenLifecycle';
import { IgAuthError } from '../src/modules/ingestion/instagramClient';
import type { CreatorRow } from '../src/lib/db/types';

const KEY = 'ab'.repeat(32);
const DAY = 24 * 3600_000;

function makeCreator(overrides: Partial<CreatorRow> = {}): CreatorRow {
  return {
    id: 'c1',
    igUserId: 'ig-1',
    username: 'grid.queen',
    accountType: 'CREATOR',
    status: 'active',
    tokenRef: new TokenVault(KEY).encrypt('long-token'),
    tokenExpiresAt: new Date(Date.now() + 30 * DAY),
    lastSyncAt: new Date(),
    lastMediaTimestamp: new Date(),
    createdAt: new Date(),
    ...overrides,
  };
}

describe('shouldRefresh', () => {
  it('refreshes inside the 10-day window', () => {
    expect(shouldRefresh(new Date(Date.now() + 5 * DAY), new Date())).toBe(true);
  });
  it('does not refresh far from expiry', () => {
    expect(shouldRefresh(new Date(Date.now() + 20 * DAY), new Date())).toBe(false);
  });
  it('refreshes when expiry unknown', () => {
    expect(shouldRefresh(null, new Date())).toBe(true);
  });
});

describe('TokenLifecycleService.maybeRefresh', () => {
  it('refreshes an expiring token and stores the new encrypted value', async () => {
    const db = new MemoryDb();
    const vault = new TokenVault(KEY);
    const creator = await db.upsertCreator({ igUserId: 'ig-1', username: 'grid.queen', accountType: 'CREATOR', tokenRef: vault.encrypt('old-token'), tokenExpiresAt: new Date(Date.now() + 5 * DAY) });

    const ig = { refreshToken: vi.fn().mockResolvedValue({ accessToken: 'new-token', expiresIn: 60 * 24 * 3600 }) };
    const svc = new TokenLifecycleService({ db, ig: ig as never, vault });

    const out = await svc.maybeRefresh(creator);
    expect(out.refreshed).toBe(true);
    expect(out.state).toBe('active');
    const updated = await db.getCreatorById(creator.id);
    expect(vault.decrypt(updated!.tokenRef!)).toBe('new-token');
    expect(ig.refreshToken).toHaveBeenCalledWith('old-token');
  });

  it('skips refresh when the token is far from expiry', async () => {
    const db = new MemoryDb();
    const vault = new TokenVault(KEY);
    const creator = await db.upsertCreator({ igUserId: 'ig-1', username: 'u', accountType: 'CREATOR', tokenRef: vault.encrypt('t'), tokenExpiresAt: new Date(Date.now() + 20 * DAY) });
    const ig = { refreshToken: vi.fn() };
    const svc = new TokenLifecycleService({ db, ig: ig as never, vault });
    const out = await svc.maybeRefresh(creator);
    expect(out.refreshed).toBe(false);
    expect(ig.refreshToken).not.toHaveBeenCalled();
  });

  it('marks the creator expired on an IG auth error (error 190)', async () => {
    const db = new MemoryDb();
    const vault = new TokenVault(KEY);
    const creator = await db.upsertCreator({ igUserId: 'ig-1', username: 'u', accountType: 'CREATOR', tokenRef: vault.encrypt('t'), tokenExpiresAt: new Date(Date.now() + 5 * DAY) });
    const ig = { refreshToken: vi.fn().mockRejectedValue(new IgAuthError('expired')) };
    const svc = new TokenLifecycleService({ db, ig: ig as never, vault });
    const out = await svc.maybeRefresh(creator);
    expect(out.state).toBe('expired');
    expect((await db.getCreatorById(creator.id))?.status).toBe('expired');
  });

  it('rethrows transient failures until MAX_REFRESH_ATTEMPTS, then refresh_failed', async () => {
    const db = new MemoryDb();
    const vault = new TokenVault(KEY);
    const creator = await db.upsertCreator({ igUserId: 'ig-1', username: 'u', accountType: 'CREATOR', tokenRef: vault.encrypt('t'), tokenExpiresAt: new Date(Date.now() + 5 * DAY) });
    const ig = { refreshToken: vi.fn().mockRejectedValue(new Error('network')) };
    const svc = new TokenLifecycleService({ db, ig: ig as never, vault });

    await expect(svc.maybeRefresh(creator, 0)).rejects.toThrow('network');
    await expect(svc.maybeRefresh(creator, 1)).rejects.toThrow('network');
    const out = await svc.maybeRefresh(creator, 2);
    expect(out.state).toBe('refresh_failed');
    expect((await db.getCreatorById(creator.id))?.status).toBe('refresh_failed');
    expect(MAX_REFRESH_ATTEMPTS).toBe(3);
  });

  it('never refreshes a revoked creator', async () => {
    const db = new MemoryDb();
    const vault = new TokenVault(KEY);
    const creator = await db.upsertCreator({ igUserId: 'ig-1', username: 'u', accountType: 'CREATOR', tokenRef: vault.encrypt('t'), tokenExpiresAt: new Date(Date.now() + 5 * DAY) });
    await db.updateCreatorStatus(creator.id, 'revoked');
    const ig = { refreshToken: vi.fn() };
    const svc = new TokenLifecycleService({ db, ig: ig as never, vault });
    const out = await svc.maybeRefresh(creator);
    expect(out.state).toBe('revoked');
    expect(ig.refreshToken).not.toHaveBeenCalled();
  });

  it('expires creators with no stored token', async () => {
    const db = new MemoryDb();
    const vault = new TokenVault(KEY);
    const creator = makeCreator({ tokenRef: null });
    await db.creators.set(creator.id, creator);
    const svc = new TokenLifecycleService({ db, ig: { refreshToken: vi.fn() } as never, vault });
    const out = await svc.maybeRefresh(creator);
    expect(out.state).toBe('expired');
  });

  it('REFRESH_BEFORE_MS is 10 days', () => {
    expect(REFRESH_BEFORE_MS).toBe(10 * DAY);
  });
});

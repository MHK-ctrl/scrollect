import { describe, it, expect } from 'vitest';
import {
  TokenBucketRateLimiter,
  MemoryRateBucketStore,
  backoffMsForAttempt,
  isSyncDue,
  STEADY_STATE_SYNC_INTERVAL_MS,
} from '../src/lib/rateLimiter';

describe('TokenBucketRateLimiter', () => {
  it('allows up to callsPerHour then denies with a retry window', async () => {
    let now = 1_000_000;
    const limiter = new TokenBucketRateLimiter({ callsPerHour: 3, store: new MemoryRateBucketStore(), now: () => now });

    for (let i = 0; i < 3; i++) {
      const r = await limiter.consume('creator:1');
      expect(r.allowed).toBe(true);
    }
    const denied = await limiter.consume('creator:1');
    expect(denied.allowed).toBe(false);
    expect(denied.retryAfterMs).toBeGreaterThan(0);
  });

  it('refills tokens over the hour window', async () => {
    let now = 1_000_000;
    const limiter = new TokenBucketRateLimiter({ callsPerHour: 2, store: new MemoryRateBucketStore(), now: () => now });

    await limiter.consume('k'); // 1
    await limiter.consume('k'); // 2
    expect((await limiter.consume('k')).allowed).toBe(false);

    now += 30 * 60_000; // +30 min refills 1 token
    const r = await limiter.consume('k');
    expect(r.allowed).toBe(true);
  });

  it('tracks remaining tokens', async () => {
    const limiter = new TokenBucketRateLimiter({ callsPerHour: 10, store: new MemoryRateBucketStore() });
    const r = await limiter.consume('k');
    expect(r.allowed).toBe(true);
    expect(r.remaining).toBe(9);
  });

  it('isolates buckets per key', async () => {
    let now = 1_000_000;
    const limiter = new TokenBucketRateLimiter({ callsPerHour: 1, store: new MemoryRateBucketStore(), now: () => now });
    expect((await limiter.consume('a')).allowed).toBe(true);
    expect((await limiter.consume('b')).allowed).toBe(true);
    expect((await limiter.consume('a')).allowed).toBe(false);
  });
});

describe('backoffMsForAttempt', () => {
  it('follows the 60/120/300/600s ladder and caps', () => {
    expect(backoffMsForAttempt(0)).toBe(60_000);
    expect(backoffMsForAttempt(1)).toBe(120_000);
    expect(backoffMsForAttempt(2)).toBe(300_000);
    expect(backoffMsForAttempt(3)).toBe(600_000);
    expect(backoffMsForAttempt(10)).toBe(600_000); // cap
  });
});

describe('isSyncDue', () => {
  it('treats never-synced creators as due', () => {
    expect(isSyncDue(null)).toBe(true);
  });
  it('defers recently synced creators', () => {
    expect(isSyncDue(new Date(Date.now() - 5 * 60_000))).toBe(false);
  });
  it('flags creators past the steady-state interval', () => {
    expect(isSyncDue(new Date(Date.now() - (STEADY_STATE_SYNC_INTERVAL_MS + 1000)))).toBe(true);
  });
});

/**
 * Instagram rate-limit budget (SCROLLECT-SPEC.md §2.4).
 *
 * Meta's official Instagram Platform limit is impression-based
 * (`Calls within 24h = 4800 × Number of Impressions`). Independently of that,
 * SCROLLECT enforces a conservative **200 calls per user per hour** floor with
 * **exponential backoff** so ingestion can never trip throttling.
 */
export interface RateBucket {
  tokens: number; // available calls in the window
  lastRefillAtMs: number;
}

export interface RateBucketStore {
  get(key: string): Promise<RateBucket | null>;
  set(key: string, bucket: RateBucket): Promise<void>;
}

/** In-memory store (default; Redis-backed store in prod — see src/lib/redis.ts). */
export class MemoryRateBucketStore implements RateBucketStore {
  private map = new Map<string, RateBucket>();
  async get(key: string): Promise<RateBucket | null> {
    return this.map.get(key) ?? null;
  }
  async set(key: string, bucket: RateBucket): Promise<void> {
    this.map.set(key, bucket);
  }
}

export class TokenBucketRateLimiter {
  constructor(
    private readonly opts: {
      callsPerHour: number;
      store: RateBucketStore;
      now?: () => number;
    },
  ) {}

  /** Consume one call; returns whether allowed and, if not, when to retry. */
  async consume(key: string): Promise<{ allowed: boolean; retryAfterMs: number; remaining: number }> {
    const now = this.opts.now ? this.opts.now() : Date.now();
    const hourMs = 3_600_000;
    const refillPerMs = this.opts.callsPerHour / hourMs;

    const bucket = (await this.opts.store.get(key)) ?? { tokens: this.opts.callsPerHour, lastRefillAtMs: now };
    const elapsed = Math.max(0, now - bucket.lastRefillAtMs);
    bucket.tokens = Math.min(this.opts.callsPerHour, bucket.tokens + elapsed * refillPerMs);
    bucket.lastRefillAtMs = now;

    const EPSILON = 1e-9; // float safety around exact refill boundaries
    if (bucket.tokens >= 1 - EPSILON) {
      bucket.tokens = Math.max(0, bucket.tokens - 1);
      await this.opts.store.set(key, bucket);
      return { allowed: true, retryAfterMs: 0, remaining: Math.floor(bucket.tokens) };
    }

    await this.opts.store.set(key, bucket);
    const retryAfterMs = Math.ceil((1 - bucket.tokens) / refillPerMs);
    return { allowed: false, retryAfterMs, remaining: 0 };
  }
}

/** Exponential backoff delays (spec §2.4 backoff table): 60s → 120s → 300s → 600s cap. */
const BACKOFF_STEPS_MS = [60_000, 120_000, 300_000, 600_000];

export function backoffMsForAttempt(attempt: number): number {
  const idx = Math.max(0, Math.min(attempt, BACKOFF_STEPS_MS.length - 1));
  return BACKOFF_STEPS_MS[idx];
}

/** Steady-state sync cadence: one sync pass per creator per 30 minutes (spec §2.4). */
export const STEADY_STATE_SYNC_INTERVAL_MS = 30 * 60_000;

export function isSyncDue(lastSyncAt: Date | null, now = new Date()): boolean {
  if (!lastSyncAt) return true;
  return now.getTime() - lastSyncAt.getTime() >= STEADY_STATE_SYNC_INTERVAL_MS;
}

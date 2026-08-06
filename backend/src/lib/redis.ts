import IORedis from 'ioredis';
import type { RateBucket, RateBucketStore } from './rateLimiter';
import type { CacheStore } from './cache';

/**
 * Redis wiring (queues, rate buckets, cache). Returns null when REDIS_URL is
 * unset (mock/no-Docker dev falls back to in-memory stores).
 */
export function createRedis(url?: string): IORedis | null {
  if (!url) return null;
  return new IORedis(url, { maxRetriesPerRequest: null });
}

export class RedisRateBucketStore implements RateBucketStore {
  constructor(private readonly redis: IORedis, private readonly prefix = 'scrollect:rate:') {}
  async get(key: string): Promise<RateBucket | null> {
    const raw = await this.redis.get(this.prefix + key);
    return raw ? (JSON.parse(raw) as RateBucket) : null;
  }
  async set(key: string, bucket: RateBucket): Promise<void> {
    await this.redis.set(this.prefix + key, JSON.stringify(bucket));
  }
}

export class RedisCache implements CacheStore {
  constructor(private readonly redis: IORedis) {}
  async get(key: string): Promise<string | null> {
    return this.redis.get(key);
  }
  async set(key: string, value: string, ttlMs: number): Promise<void> {
    await this.redis.set(key, value, 'PX', ttlMs);
  }
  async del(key: string): Promise<void> {
    await this.redis.del(key);
  }
}

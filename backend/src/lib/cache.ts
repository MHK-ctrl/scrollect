/**
 * 24h content-cache policy (SCROLLECT-SPEC.md §2.5): metadata cached with a
 * 24h TTL and purged on revocation. In-memory fallback when no Redis is
 * configured (mock/dev). Never caches tokens or PII.
 */
export const CACHE_TTL_MS = 24 * 60 * 60_000;

export interface CacheStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlMs: number): Promise<void>;
  del(key: string): Promise<void>;
}

export class MemoryCache implements CacheStore {
  private map = new Map<string, { value: string; expiresAtMs: number }>();
  async get(key: string): Promise<string | null> {
    const hit = this.map.get(key);
    if (!hit) return null;
    if (hit.expiresAtMs <= Date.now()) {
      this.map.delete(key);
      return null;
    }
    return hit.value;
  }
  async set(key: string, value: string, ttlMs: number): Promise<void> {
    this.map.set(key, { value, expiresAtMs: Date.now() + ttlMs });
  }
  async del(key: string): Promise<void> {
    this.map.delete(key);
  }
}

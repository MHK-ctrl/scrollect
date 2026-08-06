import type { Redis } from 'ioredis';
import type { Config } from './config';
import type { Logger } from './lib/logger';
import type { Db } from './lib/db/types';
import { TokenVault } from './lib/tokenVault';
import { TokenBucketRateLimiter } from './lib/rateLimiter';
import type { CacheStore } from './lib/cache';
import type { IgClient } from './modules/ingestion/instagramClient';
import type { SyncService } from './modules/ingestion/syncService';
import type { TokenLifecycleService } from './lib/tokenLifecycle';

/** Everything routes/services need — injectable for tests. */
export interface AppDeps {
  config: Config;
  logger: Logger;
  db: Db;
  vault: TokenVault;
  igClient: IgClient;
  rateLimiter: TokenBucketRateLimiter;
  sync: SyncService;
  tokenLifecycle: TokenLifecycleService;
  cache: CacheStore;
  /** null when REDIS_URL is unset (mock/no-Docker dev) — /healthz reports redis: "skipped". */
  redis: Redis | null;
}

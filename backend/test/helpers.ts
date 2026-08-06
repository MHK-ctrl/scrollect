import { pino } from 'pino';
import { loadConfig, type Config } from '../src/config';
import { TokenVault } from '../src/lib/tokenVault';
import { MemoryDb } from '../src/lib/db/memoryDb';
import { MemoryRateBucketStore, TokenBucketRateLimiter } from '../src/lib/rateLimiter';
import { MemoryCache } from '../src/lib/cache';
import { MockIgClient } from '../src/modules/ingestion/mockClient';
import { SyncService } from '../src/modules/ingestion/syncService';
import { TokenLifecycleService } from '../src/lib/tokenLifecycle';
import { seedMockData } from '../src/seed/seedMock';
import { createApp } from '../src/app';
import type { AppDeps } from '../src/deps';

export function testConfig(overrides: Partial<Config> = {}): Config {
  return loadConfig({
    mockMode: true,
    logLevel: 'silent',
    jwtSecret: 'test-secret-0123456789abcdef',
    encryptionKey: 'ab'.repeat(32),
    instagram: {
      appId: 'test-app-id',
      appSecret: 'test-app-secret',
      redirectUri: 'http://localhost:8080/api/v1/auth/ig/callback',
      webhookVerifyToken: 'verify-token',
    },
    ...overrides,
  });
}

export interface TestContext {
  app: ReturnType<typeof createApp> extends Promise<infer T> ? T : never;
  db: MemoryDb;
  vault: TokenVault;
  sync: SyncService;
  config: Config;
}

export async function buildTestApp(opts: { seed?: boolean; db?: MemoryDb } = { seed: true }): Promise<TestContext> {
  const config = testConfig();
  const logger = pino({ level: 'silent' });
  const vault = new TokenVault(config.encryptionKey);
  const db = opts.db ?? new MemoryDb();
  const rateLimiter = new TokenBucketRateLimiter({ callsPerHour: 200, store: new MemoryRateBucketStore() });
  const igClient = new MockIgClient();
  const sync = new SyncService({ db, ig: igClient, vault, rateLimiter, logger });
  const tokenLifecycle = new TokenLifecycleService({ db, ig: igClient, vault });
  const cache = new MemoryCache();
  if (opts.seed) await seedMockData({ db, vault, logger });

  const deps: AppDeps = { config, logger, db, vault, igClient, rateLimiter, sync, tokenLifecycle, cache, redis: null };
  const app = await createApp(deps);
  return { app, db, vault, sync, config };
}

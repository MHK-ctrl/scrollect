import { PrismaClient } from '@prisma/client';
import { loadConfig } from './config';
import { createLogger } from './lib/logger';
import { TokenVault } from './lib/tokenVault';
import { PrismaDb } from './lib/db/prismaDb';
import { MemoryDb } from './lib/db/memoryDb';
import { createRedis, RedisRateBucketStore, RedisCache } from './lib/redis';
import { MemoryRateBucketStore, TokenBucketRateLimiter } from './lib/rateLimiter';
import { MemoryCache, type CacheStore } from './lib/cache';
import { LiveIgClient } from './modules/ingestion/instagramClient';
import { MockIgClient } from './modules/ingestion/mockClient';
import { SyncService } from './modules/ingestion/syncService';
import { TokenLifecycleService } from './lib/tokenLifecycle';
import { IngestionScheduler } from './modules/ingestion/worker';
import { seedMockData } from './seed/seedMock';
import { createApp } from './app';

async function main(): Promise<void> {
  const config = loadConfig();
  const logger = createLogger(config.logLevel, config.nodeEnv);
  const vault = new TokenVault(config.encryptionKey || undefined, (msg) => logger.warn(msg));

  // Db: Prisma when DATABASE_URL is set; in-memory otherwise (mock/dev without Docker).
  let prisma: PrismaClient | null = null;
  const db = config.databaseUrl ? new PrismaDb((prisma = new PrismaClient())) : new MemoryDb();

  const redis = createRedis(config.redisUrl);
  const rateLimiter = new TokenBucketRateLimiter({
    callsPerHour: 200, // conservative floor (spec §2.4)
    store: redis ? new RedisRateBucketStore(redis) : new MemoryRateBucketStore(),
  });
  const cache: CacheStore = redis ? new RedisCache(redis) : new MemoryCache();

  // Mock vs live is a config change (MOCK_MODE), not a code change.
  const igClient = config.mockMode
    ? new MockIgClient()
    : new LiveIgClient({
        appId: config.instagram.appId,
        appSecret: config.instagram.appSecret,
        redirectUri: config.instagram.redirectUri,
      });

  const sync = new SyncService({ db, ig: igClient, vault, rateLimiter, logger });
  const tokenLifecycle = new TokenLifecycleService({ db, ig: igClient, vault });

  if (config.mockMode) await seedMockData({ db, vault, logger });

  const app = await createApp({ config, logger, db, vault, igClient, rateLimiter, sync, tokenLifecycle, cache, redis });
  await app.listen({ port: config.port, host: '0.0.0.0' });
  logger.info({ mockMode: config.mockMode, port: config.port }, 'SCROLLECT backend listening');

  const scheduler = new IngestionScheduler({ sync, db, logger });
  if (config.mockMode || config.redisUrl) scheduler.start();

  const shutdown = async (): Promise<void> => {
    scheduler.stop();
    await app.close();
    await prisma?.$disconnect();
    redis?.disconnect();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown());
  process.on('SIGTERM', () => void shutdown());
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});

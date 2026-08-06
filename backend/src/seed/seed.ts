import { PrismaClient } from '@prisma/client';
import { loadConfig } from '../config';
import { createLogger } from '../lib/logger';
import { TokenVault } from '../lib/tokenVault';
import { PrismaDb } from '../lib/db/prismaDb';
import { seedMockData } from './seedMock';

/** CLI: `npm run seed` — seeds the deterministic mock dataset into Postgres (MOCK_MODE workflows). */
async function main(): Promise<void> {
  const config = loadConfig();
  const logger = createLogger(config.logLevel);
  if (!config.mockMode) {
    logger.warn('refusing to seed mock data when MOCK_MODE=false; set MOCK_MODE=true');
    process.exit(1);
  }
  const prisma = new PrismaClient();
  try {
    await seedMockData({ db: new PrismaDb(prisma), vault: new TokenVault(config.encryptionKey), logger });
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

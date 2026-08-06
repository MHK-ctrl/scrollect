import type { Db } from '../../lib/db/types';
import type { Logger } from '../../lib/logger';
import type { SyncService } from './syncService';

/** Revoked content is purged exactly 24h after revocation (spec §2.5). */
export const REVOCATION_PURGE_WINDOW_MS = 24 * 60 * 60_000;

export class IngestionScheduler {
  private timer?: ReturnType<typeof setInterval>;

  constructor(
    private deps: {
      sync: SyncService;
      db: Db;
      logger: Logger;
      intervalMs?: number;
      purgeIntervalMs?: number;
    },
  ) {}

  /** One sweep: sync every due creator, then purge media revoked more than 24h ago. */
  async runOnce(): Promise<void> {
    const { results, errors } = await this.deps.sync.syncAll();
    const purged = await this.deps.db.purgeRevoked(new Date(Date.now() - REVOCATION_PURGE_WINDOW_MS));
    this.deps.logger.info(
      { synced: results.filter((r) => !r.skipped).length, errors: errors.length, purged },
      'ingestion sweep',
    );
  }

  start(): void {
    if (this.timer) return;
    const intervalMs = this.deps.intervalMs ?? 60_000;
    this.timer = setInterval(() => {
      this.runOnce().catch((err) => this.deps.logger.error({ err: (err as Error).message }, 'ingestion sweep error'));
    }, intervalMs);
    if (typeof this.timer.unref === 'function') this.timer.unref();
    this.deps.logger.info({ intervalMs }, 'ingestion scheduler started');
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
  }
}

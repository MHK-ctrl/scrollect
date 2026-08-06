import type { CreatorRow, CreatorStatus, Db } from '../lib/db/types';
import type { IgClient } from '../modules/ingestion/instagramClient';
import { TokenVault } from './tokenVault';

/**
 * Instagram long-lived token lifecycle (SCROLLECT-SPEC.md §2.3):
 *   active → expiring (T-10d) → refresh → active
 *   3 failed refresh attempts → refresh_failed (email creator)
 *   error 190 → expired (sync suspended)
 *   creator revoked → revoked (media purged ≤ 24h)
 */
export const REFRESH_BEFORE_MS = 10 * 24 * 60 * 60_000;
export const MAX_REFRESH_ATTEMPTS = 3;

export type TokenState = CreatorStatus;

export function shouldRefresh(expiresAt: Date | null, now: Date): boolean {
  if (!expiresAt) return true;
  return expiresAt.getTime() - now.getTime() <= REFRESH_BEFORE_MS;
}

export class TokenLifecycleService {
  constructor(
    private deps: {
      db: Db;
      ig: IgClient;
      vault: TokenVault;
      now?: () => Date;
    },
  ) {}

  /**
   * Refresh the creator's token when it is within the 10-day window.
   * Returns the resulting state. Throws for transient errors (caller retries
   * with backoff, spec §2.4); terminal errors are recorded here.
   */
  async maybeRefresh(creator: CreatorRow, attempt = 0): Promise<{ state: TokenState; refreshed: boolean }> {
    if (creator.status === 'revoked') return { state: 'revoked', refreshed: false };

    // No stored token => cannot sync; terminal state.
    if (!creator.tokenRef) {
      await this.deps.db.updateCreatorStatus(creator.id, 'expired');
      return { state: 'expired', refreshed: false };
    }

    const now = this.deps.now ? this.deps.now() : new Date();
    if (!shouldRefresh(creator.tokenExpiresAt, now) && creator.status === 'active') {
      return { state: 'active', refreshed: false };
    }

    try {
      const token = this.deps.vault.decrypt(creator.tokenRef);
      const { accessToken, expiresIn } = await this.deps.ig.refreshToken(token);
      const expiresAt = new Date(now.getTime() + expiresIn * 1000);
      await this.deps.db.setCreatorToken(creator.id, this.deps.vault.encrypt(accessToken), expiresAt);
      return { state: 'active', refreshed: true };
    } catch (err) {
      const authErr = (err as { code?: string }).code;
      if (authErr === 'IG_AUTH' /* error 190 */) {
        await this.deps.db.updateCreatorStatus(creator.id, 'expired');
        return { state: 'expired', refreshed: false };
      }
      if (attempt >= MAX_REFRESH_ATTEMPTS - 1) {
        await this.deps.db.updateCreatorStatus(creator.id, 'refresh_failed');
        return { state: 'refresh_failed', refreshed: false };
      }
      throw err; // transient (network/rate-limit): caller retries with backoff
    }
  }
}

-- Add revokedAt: purge runs exactly 24h AFTER revocation (spec §2.5).
-- Previously purgeRevoked keyed off createdAt, which purged long-live Reels
-- immediately on revocation instead of 24h later.
ALTER TABLE "Media" ADD COLUMN "revokedAt" TIMESTAMP(3);

-- No data backfill needed: rows already in `revoked` status have revokedAt = NULL,
-- and purgeRevoked falls back to createdAt for those legacy rows (preserving the
-- previous behavior for rows revoked before this migration shipped).

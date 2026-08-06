/** Data-layer contract. Implemented by PrismaDb (production) and MemoryDb (tests / mock without Docker). */

export type CreatorStatus = 'active' | 'expiring' | 'refresh_failed' | 'expired' | 'revoked';
export type ModerationState = 'pending' | 'approved' | 'flagged' | 'rejected';
export type MediaStatus = 'ingested' | 'published' | 'revoked' | 'deleted';

export interface CreatorRow {
  id: string;
  igUserId: string;
  username: string;
  accountType: string;
  status: CreatorStatus;
  tokenRef: string | null;
  tokenExpiresAt: Date | null;
  lastSyncAt: Date | null;
  lastMediaTimestamp: Date | null;
  createdAt: Date;
}

export interface CreatorInfo {
  id: string;
  username: string;
  igUserId: string;
}

export interface MediaRow {
  id: string;
  creatorId: string;
  creator: CreatorInfo;
  igMediaId: string;
  caption: string | null;
  mediaType: string;
  mediaUrl: string | null;
  thumbnailUrl: string | null;
  videoUrl: string | null;
  permalink: string | null;
  likeCount: number;
  commentCount: number;
  timestamp: Date;
  categories: string[];
  confidence: number | null;
  moderation: ModerationState;
  status: MediaStatus;
  isCardMode: boolean;
  createdAt: Date;
  /** Set when status flips to `revoked`; null for rows that were never revoked. */
  revokedAt: Date | null;
}

export interface UserRow {
  id: string;
  deviceId: string;
  interests: string[];
  createdAt: Date;
}

export interface FeedItem extends MediaRow {
  liked: boolean;
  saved: boolean;
}

export interface FeedPage {
  items: FeedItem[];
  nextCursor: string | null;
}

export interface UpsertMediaInput {
  creatorId: string;
  igMediaId: string;
  caption: string | null;
  mediaType: string;
  mediaUrl: string | null;
  thumbnailUrl: string | null;
  videoUrl: string | null;
  permalink: string | null;
  likeCount: number;
  commentCount: number;
  timestamp: Date;
  categories: string[];
  confidence: number | null;
  moderation: ModerationState;
  status: MediaStatus;
  isCardMode: boolean;
  /** Overrides the inserted-at timestamp (used by purge tests); defaults to now. */
  createdAt?: Date;
  /** Revocation time; null by default. purgeRevoked uses it when present. */
  revokedAt?: Date | null;
}

export interface Db {
  // creators
  upsertCreator(input: {
    igUserId: string;
    username: string;
    accountType: string;
    tokenRef: string;
    tokenExpiresAt: Date;
  }): Promise<CreatorRow>;
  getCreatorByIgId(igUserId: string): Promise<CreatorRow | null>;
  getCreatorById(id: string): Promise<CreatorRow | null>;
  updateCreatorStatus(id: string, status: CreatorStatus): Promise<void>;
  setCreatorToken(id: string, tokenRef: string, expiresAt: Date): Promise<void>;
  setCreatorSyncState(id: string, lastMediaTimestamp: Date | null, lastSyncAt: Date): Promise<void>;
  listCreatorsForSync(): Promise<CreatorRow[]>;

  // media
  upsertMedia(input: UpsertMediaInput): Promise<MediaRow>;
  getMediaById(id: string): Promise<MediaRow | null>;
  listMediaByCreator(creatorId: string): Promise<MediaRow[]>;
  setMediaModeration(id: string, moderation: ModerationState, status?: MediaStatus): Promise<void>;
  listModerationQueue(): Promise<MediaRow[]>;
  listPublishedMedia(opts: {
    categories: string[];
    cursor?: string | null;
    limit: number;
    userId?: string | null;
  }): Promise<FeedPage>;
  countLiveByCategory(): Promise<Record<string, number>>;
  revokeCreatorMedia(creatorId: string): Promise<number>;
  /**
   * Hard-delete revoked media whose revocation window (revokedAt when set, else
   * createdAt for legacy rows) is older than the given date; returns deleted count.
   * Spec §2.5: content is purged exactly 24h after revocation.
   */
  purgeRevoked(olderThan: Date): Promise<number>;
  /** Liveness probe used by /healthz; throws when the backing store is unreachable. */
  ping(): Promise<void>;

  // users & interactions (idempotent by design — spec §5.1 likes/saves)
  getOrCreateUserByDevice(deviceId: string): Promise<UserRow>;
  getUserById(id: string): Promise<UserRow | null>;
  setUserInterests(userId: string, interests: string[]): Promise<void>;
  setLike(userId: string, mediaId: string, liked: boolean): Promise<void>;
  setSave(userId: string, mediaId: string, saved: boolean): Promise<void>;
}

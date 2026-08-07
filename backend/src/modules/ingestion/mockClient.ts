import { IgApiError, IgClient, IgProfile, IgMediaDetail, IgListResult, IgTokenResult } from './instagramClient';
import { MOCK_CREATORS, mediaSeedsFor, mockThumbnailFor, mockVideoFor } from './mockData';

/**
 * Mock Instagram client (MOCK_MODE). Shares the exact IgClient interface with
 * LiveIgClient — swapping is a config change (MOCK_MODE env), not a code change
 * (spec: mock and live paths share the same repository/interfaces).
 */
export class MockIgClient implements IgClient {
  private seedForUsername(username: string) {
    const seed = MOCK_CREATORS.find((c) => c.username === username);
    if (!seed) throw new IgApiError(`unknown mock creator: ${username}`);
    return seed;
  }

  private mediaFor(username: string): IgMediaDetail[] {
    const now = Date.now();
    return mediaSeedsFor(username).map((m, i) => {
      const igMediaId = `mock-${username}-${i}`;
      return {
        igMediaId,
        caption: m.caption,
        mediaType: 'VIDEO',
        mediaUrl: null,
        thumbnailUrl: mockThumbnailFor(igMediaId),
        videoUrl: m.playable ? mockVideoFor(i) : null,
        permalink: `https://instagram.com/${username}/reel/${igMediaId}`,
        likeCount: m.likeCount,
        commentCount: m.commentCount,
        timestamp: new Date(now - m.daysAgo * 86_400_000).toISOString(),
      };
    });
  }

  async exchangeCode(code: string): Promise<{ accessToken: string; igUserId: string }> {
    const m = /^mock:([a-z0-9._]+)$/i.exec(code);
    if (!m) throw new IgApiError('mock login requires code=mock:<username>');
    const seed = this.seedForUsername(m[1]);
    return { accessToken: `mock-token-${seed.username}`, igUserId: seed.igUserId };
  }

  async exchangeLongLived(shortToken: string): Promise<IgTokenResult> {
    return { accessToken: shortToken, expiresIn: 60 * 24 * 3600 };
  }

  async refreshToken(longLivedToken: string): Promise<IgTokenResult> {
    return { accessToken: longLivedToken, expiresIn: 60 * 24 * 3600 };
  }

  async getProfile(token: string): Promise<IgProfile> {
    const username = token.replace('mock-token-', '');
    const seed = this.seedForUsername(username);
    return {
      igUserId: seed.igUserId,
      username: seed.username,
      accountType: seed.accountType,
      mediaCount: mediaSeedsFor(username).length,
    };
  }

  async listMedia(token: string, _igUserId: string, since?: string, limit = 50): Promise<IgListResult> {
    const username = token.replace('mock-token-', '');
    const items = this.mediaFor(username)
      .filter((m) => (since ? new Date(m.timestamp).getTime() > new Date(since).getTime() : true))
      .slice(0, limit)
      .map((m) => ({ igMediaId: m.igMediaId, timestamp: m.timestamp }));
    return { items };
  }

  async getMediaDetail(token: string, igMediaId: string): Promise<IgMediaDetail> {
    const username = token.replace('mock-token-', '');
    const item = this.mediaFor(username).find((m) => m.igMediaId === igMediaId);
    if (!item) throw new IgApiError(`mock media not found: ${igMediaId}`);
    return item;
  }
}

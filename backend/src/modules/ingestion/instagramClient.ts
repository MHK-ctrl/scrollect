/**
 * Official Instagram Graph API client (Instagram Login). The ONLY content
 * source in SCROLLECT (compliance: spec §1.4, §2.6 — no scraping, official
 * endpoints only). Error mapping per spec §1.4 failure table.
 */

export interface IgProfile {
  igUserId: string;
  username: string;
  accountType: string; // BUSINESS | CREATOR | PERSONAL
  mediaCount: number;
}

export interface IgMediaSummary {
  igMediaId: string;
  timestamp: string; // ISO-8601
}

export interface IgMediaDetail {
  igMediaId: string;
  caption: string | null;
  mediaType: string; // IMAGE | VIDEO | CAROUSEL_ALBUM
  mediaUrl: string | null;
  thumbnailUrl: string | null;
  videoUrl: string | null; // absent for licensed-audio Reels -> card mode (spec §3.4)
  permalink: string | null;
  likeCount: number;
  commentCount: number;
  timestamp: string;
}

export interface IgTokenResult {
  accessToken: string;
  expiresIn: number;
}

export interface IgListResult {
  items: IgMediaSummary[];
  after?: string;
}

export class IgAuthError extends Error {
  code = 'IG_AUTH'; // token expired/revoked (error 190) or permission (10/17)
}

export class IgRateLimitError extends Error {
  code = 'IG_RATE_LIMIT'; // error 4 (app) / 613 (per-user) / HTTP 429
  constructor(public retryAfterMs = 60_000) {
    super('instagram rate limit');
  }
}

export class IgApiError extends Error {
  code = 'IG_API'; // error 100/200 and other 4xx/5xx
  constructor(message: string, public igCode?: number) {
    super(message);
  }
}

export interface IgClient {
  exchangeCode(code: string): Promise<{ accessToken: string; igUserId: string }>;
  exchangeLongLived(shortToken: string): Promise<IgTokenResult>;
  refreshToken(longLivedToken: string): Promise<IgTokenResult>;
  getProfile(token: string): Promise<IgProfile>;
  listMedia(token: string, igUserId: string, since?: string, limit?: number): Promise<IgListResult>;
  getMediaDetail(token: string, igMediaId: string): Promise<IgMediaDetail>;
}

const GRAPH = 'https://graph.instagram.com';
const OAUTH = 'https://api.instagram.com';

export class LiveIgClient implements IgClient {
  constructor(
    private cfg: { appId: string; appSecret: string; redirectUri: string },
    private fetchFn: typeof fetch = fetch,
  ) {}

  private mapError(body: unknown, status: number): never {
    const err = (body as { error?: { code?: number; message?: string } })?.error;
    const code = err?.code;
    if (code === 190 || code === 10 || code === 17) throw new IgAuthError(err?.message ?? 'ig auth error');
    if (code === 4 || code === 613 || status === 429) throw new IgRateLimitError();
    throw new IgApiError(err?.message ?? `ig api error (http ${status})`, code);
  }

  private async graphGet(path: string, params: Record<string, string>): Promise<any> {
    const qs = new URLSearchParams(params).toString();
    const res = await this.fetchFn(`${GRAPH}${path}?${qs}`);
    const body = await res.json().catch(() => ({}));
    if (!res.ok) this.mapError(body, res.status);
    return body;
  }

  private async graphPostForm(url: string, form: Record<string, string>): Promise<any> {
    const res = await this.fetchFn(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(form).toString(),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) this.mapError(body, res.status);
    return body;
  }

  async exchangeCode(code: string): Promise<{ accessToken: string; igUserId: string }> {
    const body = await this.graphPostForm(`${OAUTH}/oauth/access_token`, {
      client_id: this.cfg.appId,
      client_secret: this.cfg.appSecret,
      grant_type: 'authorization_code',
      redirect_uri: this.cfg.redirectUri,
      code,
    });
    return { accessToken: body.access_token as string, igUserId: String(body.user_id) };
  }

  async exchangeLongLived(shortToken: string): Promise<IgTokenResult> {
    const body = await this.graphGet('/access_token', { grant_type: 'ig_exchange_token', access_token: shortToken });
    return { accessToken: body.access_token as string, expiresIn: body.expires_in as number };
  }

  /** Per Meta docs: calling ig_exchange_token with a long-lived token refreshes it. */
  async refreshToken(longLivedToken: string): Promise<IgTokenResult> {
    return this.exchangeLongLived(longLivedToken);
  }

  async getProfile(token: string): Promise<IgProfile> {
    const body = await this.graphGet('/me', {
      fields: 'user_id,username,account_type,media_count',
      access_token: token,
    });
    return {
      igUserId: String(body.user_id),
      username: body.username as string,
      accountType: body.account_type as string,
      mediaCount: body.media_count as number,
    };
  }

  async listMedia(token: string, igUserId: string, since?: string, limit = 50): Promise<IgListResult> {
    const params: Record<string, string> = { fields: 'id,timestamp', access_token: token, limit: String(limit) };
    if (since) params.since = since;
    const body = await this.graphGet(`/${igUserId}/media`, params);
    const items: IgMediaSummary[] = (body.data ?? []).map((m: { id: string; timestamp: string }) => ({
      igMediaId: m.id,
      timestamp: m.timestamp,
    }));
    return { items, after: body.paging?.cursors?.after };
  }

  async getMediaDetail(token: string, igMediaId: string): Promise<IgMediaDetail> {
    const body = await this.graphGet(`/${igMediaId}`, {
      fields: 'id,caption,media_type,media_url,thumbnail_url,video_url,permalink,timestamp,like_count,comments_count',
      access_token: token,
    });
    return {
      igMediaId: body.id,
      caption: body.caption ?? null,
      mediaType: body.media_type,
      mediaUrl: body.media_url ?? null,
      thumbnailUrl: body.thumbnail_url ?? null,
      videoUrl: body.video_url ?? null,
      permalink: body.permalink ?? null,
      likeCount: body.like_count ?? 0,
      commentCount: body.comments_count ?? 0,
      timestamp: body.timestamp,
    };
  }
}

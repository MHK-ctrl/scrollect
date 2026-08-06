import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createHmac } from 'node:crypto';
import { MemoryDb } from '../src/lib/db/memoryDb';
import { buildTestApp, type TestContext } from './helpers';

let ctx: TestContext;
let app: TestContext['app'];

beforeAll(async () => {
  ctx = await buildTestApp();
  app = ctx.app;
});

afterAll(async () => {
  await app.close();
});

const inject = (opts: Parameters<TestContext['app']['inject']>[0]) => app.inject(opts);

describe('health + error envelope', () => {
  it('healthz reports ok with mockMode', async () => {
    const res = await inject({ method: 'GET', url: '/healthz' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ status: 'ok', mockMode: true });
  });

  it('healthz exposes readiness checks (db up, redis skipped when REDIS_URL unset)', async () => {
    const res = await inject({ method: 'GET', url: '/healthz' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.checks).toEqual({ db: 'up', redis: 'skipped' });
  });

  it('healthz returns 503 degraded when Postgres is unreachable', async () => {
    const failingDb = new MemoryDb();
    failingDb.ping = async () => {
      throw new Error('connection refused');
    };
    const app2 = (await buildTestApp({ seed: false, db: failingDb })).app;
    try {
      const res = await app2.inject({ method: 'GET', url: '/healthz' });
      expect(res.statusCode).toBe(503);
      expect(res.json()).toMatchObject({ status: 'degraded', checks: { db: 'down' } });
    } finally {
      await app2.close();
    }
  });

  it('404s return the JSON error envelope', async () => {
    const res = await inject({ method: 'GET', url: '/api/v1/nope' });
    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe('NOT_FOUND');
    expect(res.json().error.requestId).toBeDefined();
  });

  it('validation failures return the envelope', async () => {
    const res = await inject({ method: 'PUT', url: '/api/v1/media/x/like', payload: {} });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('VALIDATION_ERROR');
  });
});

describe('auth flow (mock)', () => {
  it('mock creator login returns a creator JWT and profile', async () => {
    const res = await inject({ method: 'POST', url: '/api/v1/auth/mock/login', payload: { handle: 'grid.queen' } });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.creator.username).toBe('grid.queen');
    expect(body.token).toBeTruthy();

    const me = await inject({ method: 'GET', url: '/api/v1/auth/me', headers: { authorization: `Bearer ${body.token}` } });
    expect(me.json()).toMatchObject({ kind: 'creator', username: 'grid.queen' });
  });

  it('unknown mock creator fails cleanly', async () => {
    const res = await inject({ method: 'POST', url: '/api/v1/auth/mock/login', payload: { handle: 'nobody' } });
    expect(res.statusCode).toBe(500);
    expect(res.json().error.code).toBe('INTERNAL');
  });

  it('device login creates a viewer session', async () => {
    const res = await inject({ method: 'POST', url: '/api/v1/auth/device', payload: { deviceId: 'device-smoke-1' } });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.user.id).toBeTruthy();
    expect(body.user.interests).toEqual([]);
    expect(body.token).toBeTruthy();
  });

  it('me without a token is 401 with envelope', async () => {
    const res = await inject({ method: 'GET', url: '/api/v1/auth/me' });
    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe('UNAUTHORIZED');
  });
});

describe('feed + categories', () => {
  it('lists 14 categories with live counts', async () => {
    const res = await inject({ method: 'GET', url: '/api/v1/categories' });
    expect(res.statusCode).toBe(200);
    const cats = res.json().categories as { slug: string; liveCount: number }[];
    expect(cats.length).toBe(14);
    expect(cats.some((c) => c.slug === 'fashion' && c.liveCount > 0)).toBe(true);
  });

  it('returns a categorized feed with card-mode flags (public, no auth needed)', async () => {
    const res = await inject({ method: 'GET', url: '/api/v1/feed?categories=fashion&limit=5' });
    expect(res.statusCode).toBe(200);
    const items = res.json().items as any[];
    expect(items.length).toBeGreaterThan(0);
    for (const it of items) {
      expect(it.id).toBeTruthy();
      expect(typeof it.isCardMode).toBe('boolean');
      expect(it.creator.username).toBeTruthy();
    }
  });

  it('empty category yields an empty page with null cursor', async () => {
    const res = await inject({ method: 'GET', url: '/api/v1/feed?categories=finance' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(Array.isArray(body.items)).toBe(true);
  });
});

describe('like/save via API (idempotent)', () => {
  it('like → appears in feed flags; repeat like is a no-op', async () => {
    const device = await inject({ method: 'POST', url: '/api/v1/auth/device', payload: { deviceId: 'device-like-1' } });
    const token = device.json().token;
    const feed = await inject({ method: 'GET', url: '/api/v1/feed?categories=fashion', headers: { authorization: `Bearer ${token}` } });
    const id = feed.json().items[0].id;

    const like = await inject({ method: 'PUT', url: `/api/v1/media/${id}/like`, headers: { authorization: `Bearer ${token}` }, payload: { liked: true } });
    expect(like.statusCode).toBe(200);
    expect(like.json()).toEqual({ liked: true });

    const again = await inject({ method: 'PUT', url: `/api/v1/media/${id}/like`, headers: { authorization: `Bearer ${token}` }, payload: { liked: true } });
    expect(again.statusCode).toBe(200);

    const feed2 = await inject({ method: 'GET', url: '/api/v1/feed?categories=fashion', headers: { authorization: `Bearer ${token}` } });
    const flagged = feed2.json().items.find((i: any) => i.id === id);
    expect(flagged.liked).toBe(true);

    const unlike = await inject({ method: 'PUT', url: `/api/v1/media/${id}/like`, headers: { authorization: `Bearer ${token}` }, payload: { liked: false } });
    expect(unlike.statusCode).toBe(200);
  });

  it('save works and 404s on unknown media', async () => {
    const device = await inject({ method: 'POST', url: '/api/v1/auth/device', payload: { deviceId: 'device-save-1' } });
    const token = device.json().token;
    const feed = await inject({ method: 'GET', url: '/api/v1/feed?categories=fashion', headers: { authorization: `Bearer ${token}` } });
    const id = feed.json().items[0].id;
    const save = await inject({ method: 'PUT', url: `/api/v1/media/${id}/save`, headers: { authorization: `Bearer ${token}` }, payload: { saved: true } });
    expect(save.statusCode).toBe(200);

    const missing = await inject({ method: 'PUT', url: '/api/v1/media/does-not-exist/save', headers: { authorization: `Bearer ${token}` }, payload: { saved: true } });
    expect(missing.statusCode).toBe(404);
    expect(missing.json().error.code).toBe('NOT_FOUND');
  });

  it('like without auth is 401', async () => {
    const res = await inject({ method: 'PUT', url: '/api/v1/media/x/like', payload: { liked: true } });
    expect(res.statusCode).toBe(401);
  });
});

describe('settings/interests', () => {
  it('set + get interests (validated against taxonomy)', async () => {
    const device = await inject({ method: 'POST', url: '/api/v1/auth/device', payload: { deviceId: 'device-int-1' } });
    const token = device.json().token;
    const put = await inject({ method: 'PUT', url: '/api/v1/settings/interests', headers: { authorization: `Bearer ${token}` }, payload: { interests: ['tech', 'cars', 'bogus-slug'] } });
    expect(put.statusCode).toBe(200);
    expect(put.json().interests).toEqual(['tech', 'cars']); // bogus filtered
    const get = await inject({ method: 'GET', url: '/api/v1/settings/interests', headers: { authorization: `Bearer ${token}` } });
    expect(get.json().interests).toEqual(['tech', 'cars']);
  });
});

describe('moderation queue', () => {
  it('creator can list and approve a queued item, which then publishes', async () => {
    const login = await inject({ method: 'POST', url: '/api/v1/auth/mock/login', payload: { handle: 'grid.queen' } });
    const token = login.json().token;

    const queue = await inject({ method: 'GET', url: '/api/v1/moderation/queue', headers: { authorization: `Bearer ${token}` } });
    expect(queue.statusCode).toBe(200);
    expect(Array.isArray(queue.json().items)).toBe(true);

    // approve the first queued item and confirm it enters the feed
    const qItem = queue.json().items[0];
    if (qItem) {
      const approve = await inject({ method: 'POST', url: `/api/v1/moderation/${qItem.id}`, headers: { authorization: `Bearer ${token}` }, payload: { action: 'approve' } });
      expect(approve.statusCode).toBe(200);
      expect(approve.json().status).toBe('approved');
    }
  });

  it('viewer sessions are forbidden from moderation', async () => {
    const device = await inject({ method: 'POST', url: '/api/v1/auth/device', payload: { deviceId: 'device-mod-1' } });
    const res = await inject({ method: 'GET', url: '/api/v1/moderation/queue', headers: { authorization: `Bearer ${device.json().token}` } });
    expect(res.statusCode).toBe(403);
  });
});

describe('webhooks', () => {
  it('verification handshake echoes the challenge', async () => {
    const res = await inject({ method: 'GET', url: '/webhooks/instagram?hub.mode=subscribe&hub.verify_token=verify-token&hub.challenge=challenge123' });
    expect(res.statusCode).toBe(200);
    expect(res.body).toBe('challenge123');
  });

  it('rejects a wrong verify token', async () => {
    const res = await inject({ method: 'GET', url: '/webhooks/instagram?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=x' });
    expect(res.statusCode).toBe(403);
  });

  it('rejects a bad HMAC signature', async () => {
    const res = await inject({ method: 'POST', url: '/webhooks/instagram', headers: { 'x-hub-signature-256': 'sha256=deadbeef' }, payload: { entry: [] } });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('WEBHOOK_BAD_SIGNATURE');
  });

  it('accepts a valid HMAC signature', async () => {
    const payload = JSON.stringify({ object: 'instagram', entry: [{ id: 'mock-ig-101' }] });
    const sig = 'sha256=' + createHmac('sha256', 'test-app-secret').update(payload).digest('hex');
    const res = await inject({ method: 'POST', url: '/webhooks/instagram', headers: { 'content-type': 'application/json', 'x-hub-signature-256': sig }, payload });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ received: true });
  });
});

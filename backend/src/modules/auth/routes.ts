import type { FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';
import type { AppDeps } from '../../deps';
import { ApiError } from '../../lib/errors';
import { signJwt, verifyJwt, JwtPayload } from '../../lib/jwt';

const STATE_TTL_MS = 10 * 60_000;
const CREATOR_TOKEN_TTL_S = 7 * 24 * 3600;
const USER_TOKEN_TTL_S = 365 * 24 * 3600;

export interface AuthedRequest {
  user?: JwtPayload;
}

/** Extract the app-session from a Bearer token; returns null when absent/invalid. */
export function readUser(req: { headers: Record<string, string | string[] | undefined> }, secret: string): JwtPayload | null {
  const header = req.headers.authorization;
  if (typeof header !== 'string' || !header.startsWith('Bearer ')) return null;
  try {
    return verifyJwt(header.slice(7), secret);
  } catch {
    return null;
  }
}

function registerAuthRoutes(app: FastifyInstance, deps: AppDeps): void {
  const { config, db, igClient: ig, vault, sync, cache, logger } = deps;

  const completeIgLogin = async (code: string) => {
    // Official flow (spec §2.2): code -> short-lived -> profile -> long-lived -> store encrypted -> sync.
    const { accessToken: shortToken } = await ig.exchangeCode(code);
    const profile = await ig.getProfile(shortToken);

    // Creator-account gate (spec §2.2): Graph API media endpoints require professional accounts.
    if (profile.accountType === 'PERSONAL') {
      throw new ApiError(
        409,
        'PERSONAL_ACCOUNT',
        'Instagram accounts must be Business or Creator (professional) to join SCROLLECT. Switch in Instagram Settings → Account type → Switch to professional, then reconnect.',
      );
    }

    const { accessToken, expiresIn } = await ig.exchangeLongLived(shortToken);
    const tokenRef = vault.encrypt(accessToken);
    const creator = await db.upsertCreator({
      igUserId: profile.igUserId,
      username: profile.username,
      accountType: profile.accountType,
      tokenRef,
      tokenExpiresAt: new Date(Date.now() + expiresIn * 1000),
    });

    // Initial backfill is best-effort; the scheduler retries on a 5-min loop.
    sync.syncCreator(creator.id).catch((err) => logger.warn({ creatorId: creator.id, err: (err as Error).message }, 'initial sync deferred'));

    const token = signJwt({ sub: creator.id, kind: 'creator' }, config.jwtSecret, CREATOR_TOKEN_TTL_S);
    return { token, creator: { id: creator.id, username: creator.username, accountType: creator.accountType } };
  };

  app.post('/api/v1/auth/ig/start', async () => {
    const state = randomUUID();
    await cache.set(`ig:state:${state}`, '1', STATE_TTL_MS);
    const url = `https://api.instagram.com/oauth/authorize?client_id=${config.instagram.appId}&redirect_uri=${encodeURIComponent(config.instagram.redirectUri)}&scope=instagram_business_basic&response_type=code&state=${state}`;
    return { authorizeUrl: url };
  });

  app.post<{ Body: { code: string; state: string } }>(
    '/api/v1/auth/ig/callback',
    {
      schema: { body: { type: 'object', required: ['code', 'state'], properties: { code: { type: 'string' }, state: { type: 'string' } } } },
    },
    async (req) => {
      const valid = await cache.get(`ig:state:${req.body.state}`);
      if (!valid) throw new ApiError(400, 'INVALID_STATE', 'OAuth state mismatch or expired; start again.');
      await cache.del(`ig:state:${req.body.state}`);
      return completeIgLogin(req.body.code);
    },
  );

  // MOCK_MODE creator login — same path as real OAuth but via MockIgClient.
  app.post<{ Body: { handle: string } }>(
    '/api/v1/auth/mock/login',
    { schema: { body: { type: 'object', required: ['handle'], properties: { handle: { type: 'string' } } } } },
    async (req) => {
      if (!config.mockMode) throw new ApiError(404, 'NOT_FOUND', 'mock login is only available in MOCK_MODE=true');
      return completeIgLogin(`mock:${req.body.handle}`);
    },
  );

  app.post<{ Body: { deviceId: string } }>(
    '/api/v1/auth/device',
    { schema: { body: { type: 'object', required: ['deviceId'], properties: { deviceId: { type: 'string', minLength: 8 } } } } },
    async (req) => {
      const user = await db.getOrCreateUserByDevice(req.body.deviceId);
      const token = signJwt({ sub: user.id, kind: 'user' }, config.jwtSecret, USER_TOKEN_TTL_S);
      return { token, user: { id: user.id, interests: user.interests } };
    },
  );

  app.get('/api/v1/auth/me', async (req) => {
    const payload = readUser(req, config.jwtSecret);
    if (!payload) throw new ApiError(401, 'UNAUTHORIZED', 'missing or invalid bearer token');
    if (payload.kind === 'user') {
      const user = await db.getUserById(payload.sub);
      if (!user) throw new ApiError(401, 'UNAUTHORIZED', 'unknown user');
      return { kind: 'user', id: user.id, interests: user.interests };
    }
    const creator = await db.getCreatorById(payload.sub);
    if (!creator) throw new ApiError(401, 'UNAUTHORIZED', 'unknown creator');
    return { kind: 'creator', id: creator.id, username: creator.username, accountType: creator.accountType, status: creator.status };
  });
}

export default registerAuthRoutes;

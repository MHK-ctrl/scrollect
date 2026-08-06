import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Minimal HMAC-SHA256 JWT (HS256). Dependency-free; testable.
 * Used only for app-level sessions (viewer/creator), never for Instagram tokens.
 */
const HEADER = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');

export interface JwtPayload {
  sub: string;
  kind: 'user' | 'creator';
  iat: number;
  exp: number;
}

export function signJwt(payload: Omit<JwtPayload, 'iat' | 'exp'>, secret: string, ttlSeconds: number): string {
  const now = Math.floor(Date.now() / 1000);
  const body: JwtPayload = { ...payload, iat: now, exp: now + ttlSeconds };
  const data = `${HEADER}.${Buffer.from(JSON.stringify(body)).toString('base64url')}`;
  const sig = createHmac('sha256', secret).update(data).digest('base64url');
  return `${data}.${sig}`;
}

export function verifyJwt(token: string, secret: string): JwtPayload {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('malformed token');
  const [h, p, sig] = parts;
  if (h !== HEADER) throw new Error('unexpected header');
  const expected = createHmac('sha256', secret).update(`${h}.${p}`).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) throw new Error('bad signature');
  const payload = JSON.parse(Buffer.from(p, 'base64url').toString('utf8')) as JwtPayload;
  if (payload.exp * 1000 <= Date.now()) throw new Error('token expired');
  return payload;
}

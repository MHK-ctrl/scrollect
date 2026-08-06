/**
 * Environment config. All secrets come from env vars (see .env.example).
 * MOCK_MODE=true requires no Meta credentials; MOCK_MODE=false fails fast when
 * required Instagram env vars are missing (no silent misconfiguration).
 */
export interface Config {
  nodeEnv: string;
  port: number;
  logLevel: string;
  mockMode: boolean;
  jwtSecret: string;
  encryptionKey: string;
  instagram: {
    appId: string;
    appSecret: string;
    redirectUri: string;
    webhookVerifyToken: string;
  };
  databaseUrl?: string;
  redisUrl?: string;
}

function env(name: string, fallback?: string): string | undefined {
  const v = process.env[name];
  if (v !== undefined && v !== '') return v;
  return fallback;
}

function required(name: string): string {
  const v = env(name);
  if (!v) throw new Error(`Missing required env var: ${name} (see .env.example)`);
  return v;
}

export function loadConfig(overrides: Partial<Config> = {}): Config {
  const nodeEnv = env('NODE_ENV', 'development') ?? 'development';
  const mockModeDefault = nodeEnv === 'production' ? false : true;
  const mockMode = overrides.mockMode ?? (env('MOCK_MODE') === 'true' ? true : env('MOCK_MODE') === 'false' ? false : mockModeDefault);

  const base: Config = {
    nodeEnv,
    port: overrides.port ?? Number(env('PORT', '8080')),
    logLevel: env('LOG_LEVEL', 'info') ?? 'info',
    mockMode,
    jwtSecret: overrides.jwtSecret ?? env('JWT_SECRET') ?? 'dev-only-insecure-jwt-secret',
    encryptionKey: overrides.encryptionKey ?? env('ENCRYPTION_KEY') ?? '',
    instagram: {
      appId: env('INSTAGRAM_APP_ID', '') ?? '',
      appSecret: env('INSTAGRAM_APP_SECRET', '') ?? '',
      redirectUri: env('INSTAGRAM_REDIRECT_URI', 'http://localhost:8080/api/v1/auth/ig/callback') ?? 'http://localhost:8080/api/v1/auth/ig/callback',
      webhookVerifyToken: env('INSTAGRAM_WEBHOOK_VERIFY_TOKEN', 'scrollect-webhook-verify') ?? 'scrollect-webhook-verify',
    },
    databaseUrl: env('DATABASE_URL'),
    redisUrl: env('REDIS_URL'),
  };

  if (!mockMode) {
    if (!base.encryptionKey) throw new Error('Missing required env var: ENCRYPTION_KEY (openssl rand -hex 32)');
    if (!base.jwtSecret || base.jwtSecret === 'dev-only-insecure-jwt-secret') {
      throw new Error('Live mode requires JWT_SECRET (openssl rand -hex 32)');
    }
    if (!base.instagram.appId || !base.instagram.appSecret) {
      throw new Error('Live mode requires INSTAGRAM_APP_ID + INSTAGRAM_APP_SECRET (Business Verification + Advanced Access needed; see README)');
    }
    if (!base.databaseUrl) throw new Error('Live mode requires DATABASE_URL');
  }

  return { ...base, ...overrides };
}

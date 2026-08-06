import { pino } from 'pino';

/**
 * Logger with redaction so tokens/PII never reach logs (compliance: spec §2.2,
 * "Tokens ... masked in logs"; privacy policy §5).
 */
/**
 * Pino options shared by the service logger and Fastify's own logger (spec §2.2:
 * tokens/PII are redacted everywhere, including request logs). Fastify v5's
 * `logger:` option only accepts a plain options object — not a logger instance.
 *
 * Structured logging: pino emits one JSON object per line in every environment,
 * so production logs are machine-parseable out of the box. `base` stamps every
 * line with the service name + environment for cheap cross-service correlation;
 * timestamps are ISO-8601 for human-readable pino-pretty output in dev.
 */
export function loggerOptions(level: string, nodeEnv = 'development') {
  return {
    level,
    base: { service: 'scrollect-backend', env: nodeEnv },
    timestamp: pino.stdTimeFunctions.isoTime,
    redact: {
      paths: [
        'req.headers.authorization',
        'authorization',
        '*.token',
        '*.tokenRef',
        '*.accessToken',
        '*.access_token',
        'code',
        '*.code',
        'password',
        'secret',
        '*.secret',
      ],
      censor: '[REDACTED]',
    },
  };
}

export function createLogger(level: string, nodeEnv = 'development') {
  return pino(loggerOptions(level, nodeEnv));
}

export type Logger = ReturnType<typeof createLogger>;

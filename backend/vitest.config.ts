import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'node',
    coverage: {
      provider: 'v8',
      include: [
        'src/modules/classifier/classifier.ts',
        'src/modules/classifier/moderation.ts',
        'src/lib/rateLimiter.ts',
      ],
      reporter: ['text', 'text-summary'],
      thresholds: {
        lines: 80,
        statements: 80,
        functions: 80,
        branches: 70,
      },
    },
  },
});

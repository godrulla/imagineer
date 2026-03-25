import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'integration',
    root: './tests/integration',
    testTimeout: 30000,
    hookTimeout: 30000,
    teardownTimeout: 30000,
    maxConcurrency: 4,
    environment: 'node',
    globalSetup: './tests/setup/global-setup.ts',
    setupFiles: ['./tests/setup/integration-setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: './coverage/integration',
      include: ['services/**/*.ts', '!services/**/*.test.ts', '!services/**/*.d.ts'],
      exclude: [
        'node_modules/**',
        'dist/**',
        'coverage/**',
        '**/*.config.*',
        '**/*.d.ts'
      ],
      thresholds: {
        global: {
          branches: 70,
          functions: 70,
          lines: 70,
          statements: 70
        }
      }
    },
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true
      }
    },
    retry: 1,
    bail: 1
  },
  resolve: {
    alias: {
      '@services': new URL('./services', import.meta.url).pathname,
      '@tests': new URL('./tests', import.meta.url).pathname
    }
  }
});
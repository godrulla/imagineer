import { beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { setupServer } from 'msw/node';
import { mockHandlers } from './fixtures/mock-handlers';
import dotenv from 'dotenv';

// Load test environment variables
dotenv.config({ path: '.env.test' });

// MSW server for mocking external APIs
export const mockServer = setupServer(...mockHandlers);

beforeAll(() => {
  // Start MSW server
  mockServer.listen({ onUnhandledRequest: 'error' });
  
  // Set test environment variables
  process.env.NODE_ENV = 'test';
  process.env.OPENAI_API_KEY = 'test_openai_key';
  process.env.ANTHROPIC_API_KEY = 'test_anthropic_key';
  process.env.GOOGLE_API_KEY = 'test_google_key';
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgresql://test_user:test_password@localhost:5433/imagineer_test';
  process.env.REDIS_URL = process.env.TEST_REDIS_URL || 'redis://localhost:6380';
  process.env.LOG_LEVEL = 'error'; // Reduce log noise in tests
});

afterAll(() => {
  // Stop MSW server
  mockServer.close();
});

beforeEach(() => {
  // Reset MSW handlers
  mockServer.resetHandlers();
});

afterEach(() => {
  // Clean up after each test
  mockServer.resetHandlers();
});
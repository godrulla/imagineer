import { GenericContainer, Network, Wait } from 'testcontainers';
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { RedisContainer } from '@testcontainers/redis';
import { execSync } from 'child_process';
import { createPool, Pool } from 'pg';
import Redis from 'ioredis';

export interface TestContainers {
  postgres: PostgreSqlContainer;
  redis: RedisContainer;
  network: Network;
}

let containers: TestContainers | null = null;
let pgPool: Pool | null = null;
let redisClient: Redis | null = null;

export async function setup() {
  console.log('🚀 Setting up test infrastructure...');

  try {
    // Create a network for all containers
    const network = await new Network().start();

    // Start PostgreSQL container
    console.log('📦 Starting PostgreSQL test container...');
    const postgres = await new PostgreSqlContainer('postgres:15-alpine')
      .withDatabase('imagineer_test')
      .withUsername('test_user')
      .withPassword('test_password')
      .withExposedPorts(5432)
      .withWaitStrategy(Wait.forLogMessage('database system is ready to accept connections'))
      .withNetwork(network)
      .withNetworkAliases('test-postgres')
      .start();

    // Start Redis container
    console.log('📦 Starting Redis test container...');
    const redis = await new RedisContainer('redis:7-alpine')
      .withExposedPorts(6379)
      .withWaitStrategy(Wait.forLogMessage('Ready to accept connections'))
      .withNetwork(network)
      .withNetworkAliases('test-redis')
      .start();

    containers = { postgres, redis, network };

    // Set up database connection
    const pgHost = postgres.getHost();
    const pgPort = postgres.getMappedPort(5432);
    const pgConnectionString = `postgresql://test_user:test_password@${pgHost}:${pgPort}/imagineer_test`;

    pgPool = createPool({
      connectionString: pgConnectionString,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });

    // Set up Redis connection
    const redisHost = redis.getHost();
    const redisPort = redis.getMappedPort(6379);
    redisClient = new Redis({
      host: redisHost,
      port: redisPort,
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
    });

    // Run database migrations
    console.log('🗄️ Running database migrations...');
    await runDatabaseMigrations(pgConnectionString);

    // Set environment variables for tests
    process.env.TEST_DATABASE_URL = pgConnectionString;
    process.env.TEST_REDIS_URL = `redis://${redisHost}:${redisPort}`;
    process.env.NODE_ENV = 'test';
    process.env.FIGMA_ACCESS_TOKEN = 'test_figma_token';
    process.env.OPENAI_API_KEY = 'test_openai_key';
    process.env.ANTHROPIC_API_KEY = 'test_anthropic_key';

    console.log('✅ Test infrastructure setup complete');
    
    return {
      pgConnectionString,
      redisUrl: `redis://${redisHost}:${redisPort}`,
      containers
    };

  } catch (error) {
    console.error('❌ Failed to set up test infrastructure:', error);
    await teardown();
    throw error;
  }
}

export async function teardown() {
  console.log('🧹 Tearing down test infrastructure...');

  try {
    // Close database connections
    if (pgPool) {
      await pgPool.end();
      pgPool = null;
    }

    // Close Redis connections
    if (redisClient) {
      redisClient.disconnect();
      redisClient = null;
    }

    // Stop containers
    if (containers) {
      await containers.postgres.stop();
      await containers.redis.stop();
      await containers.network.stop();
      containers = null;
    }

    console.log('✅ Test infrastructure teardown complete');
  } catch (error) {
    console.error('❌ Error during teardown:', error);
  }
}

async function runDatabaseMigrations(connectionString: string): Promise<void> {
  try {
    // Run the database migration script
    execSync(`psql "${connectionString}" -f database/schema.sql`, {
      stdio: 'pipe',
      timeout: 30000
    });
    console.log('✅ Database migrations completed');
  } catch (error) {
    console.error('❌ Database migration failed:', error);
    throw new Error(`Database migration failed: ${error.message}`);
  }
}

// Utility functions for tests
export function getTestDatabase(): Pool {
  if (!pgPool) {
    throw new Error('Test database not initialized. Call setup() first.');
  }
  return pgPool;
}

export function getTestRedis(): Redis {
  if (!redisClient) {
    throw new Error('Test Redis not initialized. Call setup() first.');
  }
  return redisClient;
}

export function getTestContainers(): TestContainers {
  if (!containers) {
    throw new Error('Test containers not initialized. Call setup() first.');
  }
  return containers;
}
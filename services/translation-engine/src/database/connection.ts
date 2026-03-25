import { Pool } from 'pg';
import { logger } from '../utils/logger';
import { DatabaseOperations, DatabaseConfig } from './operations';

let pool: Pool;
let dbOps: DatabaseOperations;

export async function connectDatabase(): Promise<void> {
  try {
    const config: DatabaseConfig = {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'imagineer',
      username: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'password',
      ssl: process.env.DB_SSL === 'true',
      maxConnections: parseInt(process.env.DB_POOL_MAX || '20'),
      idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000'),
      connectionTimeoutMillis: parseInt(process.env.DB_CONNECT_TIMEOUT || '2000'),
    };

    // Initialize database operations
    dbOps = new DatabaseOperations(config);
    await dbOps.connect();

    // For backward compatibility, keep the old pool
    pool = new Pool({
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.username,
      password: config.password,
      ssl: config.ssl ? { rejectUnauthorized: false } : false,
      max: config.maxConnections,
      idleTimeoutMillis: config.idleTimeoutMillis,
      connectionTimeoutMillis: config.connectionTimeoutMillis,
    });

    logger.info('Database connected successfully', {
      host: config.host,
      database: config.database,
      poolSize: config.maxConnections
    });

  } catch (error) {
    logger.error('Database connection failed', { error: error.message });
    throw error;
  }
}

export function getDatabase(): Pool {
  if (!pool) {
    throw new Error('Database not initialized. Call connectDatabase() first.');
  }
  return pool;
}

export function getDatabaseOperations(): DatabaseOperations {
  if (!dbOps) {
    throw new Error('Database operations not initialized. Call connectDatabase() first.');
  }
  return dbOps;
}

export async function disconnectDatabase(): Promise<void> {
  try {
    if (dbOps) {
      await dbOps.disconnect();
    }
    if (pool) {
      await pool.end();
    }
    logger.info('Database disconnected');
  } catch (error) {
    logger.error('Error disconnecting database', { error: error.message });
  }
}
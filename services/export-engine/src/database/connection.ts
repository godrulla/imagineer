import { Pool, PoolClient } from 'pg';
import { logger } from '../utils/logger';

export class DatabaseConnection {
  private pool: Pool;
  private static instance: DatabaseConnection;

  private constructor() {
    this.pool = new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'imagineer',
      user: process.env.DB_USER || 'imagineer',
      password: process.env.DB_PASSWORD || 'password',
      min: 2,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    this.pool.on('error', (err) => {
      logger.error('Database pool error', { error: err.message });
    });
  }

  public static getInstance(): DatabaseConnection {
    if (!DatabaseConnection.instance) {
      DatabaseConnection.instance = new DatabaseConnection();
    }
    return DatabaseConnection.instance;
  }

  public async getClient(): Promise<PoolClient> {
    return this.pool.connect();
  }

  public async query(text: string, params?: any[]): Promise<any> {
    const start = Date.now();
    try {
      const result = await this.pool.query(text, params);
      const duration = Date.now() - start;
      logger.debug('Database query executed', {
        duration,
        rows: result.rowCount,
        query: text.substring(0, 100)
      });
      return result;
    } catch (error) {
      logger.error('Database query error', {
        error: error.message,
        query: text.substring(0, 100),
        params
      });
      throw error;
    }
  }

  public async transaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.getClient();
    try {
      await client.query('BEGIN');
      const result = await fn(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  public async healthCheck(): Promise<boolean> {
    try {
      await this.pool.query('SELECT 1');
      return true;
    } catch (error) {
      logger.error('Database health check failed', { error: error.message });
      return false;
    }
  }

  public async close(): Promise<void> {
    await this.pool.end();
    logger.info('Database connection pool closed');
  }
}

export const db = DatabaseConnection.getInstance();

export async function connectDatabase(): Promise<void> {
  try {
    const isHealthy = await db.healthCheck();
    if (isHealthy) {
      logger.info('Database connection established successfully');
    } else {
      throw new Error('Database health check failed');
    }
  } catch (error) {
    logger.error('Failed to connect to database', { error: error.message });
    throw error;
  }
}
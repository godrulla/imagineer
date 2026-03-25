import { createClient, RedisClientType } from 'redis';
import { logger } from '../utils/logger';

let redisClient: RedisClientType;

export async function connectRedis(): Promise<void> {
  try {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    redisClient = createClient({ url: redisUrl });
    
    await redisClient.connect();
    await redisClient.ping();
    
    logger.info('Redis connected successfully');
  } catch (error) {
    logger.error('Redis connection failed', { error: error.message });
    throw error;
  }
}

export class ExportCache {
  static async cacheExport(key: string, result: any): Promise<void> {
    await redisClient.setEx(`export:${key}`, 3600, JSON.stringify(result));
  }

  static async getExport(key: string): Promise<any> {
    const cached = await redisClient.get(`export:${key}`);
    return cached ? JSON.parse(cached) : null;
  }

  static generateExportKey(request: any): string {
    const hash = Buffer.from(JSON.stringify(request)).toString('base64').slice(0, 20);
    return hash;
  }
}
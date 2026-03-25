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
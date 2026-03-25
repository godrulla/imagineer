import { createClient, RedisClientType } from 'redis';
import { logger } from '../utils/logger';

let redisClient: RedisClientType;

export async function connectRedis(): Promise<void> {
  try {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    
    redisClient = createClient({
      url: redisUrl,
      retry_strategy: (options) => {
        if (options.error && options.error.code === 'ECONNREFUSED') {
          logger.error('Redis server is not reachable');
          return new Error('Redis server is not reachable');
        }
        if (options.total_retry_time > 1000 * 60 * 60) {
          logger.error('Redis retry time exhausted');
          return new Error('Retry time exhausted');
        }
        if (options.attempt > 10) {
          logger.error('Redis max retry attempts reached');
          return undefined;
        }
        return Math.min(options.attempt * 100, 3000);
      }
    });

    redisClient.on('error', (err) => {
      logger.error('Redis client error', { error: err.message });
    });

    await redisClient.connect();
    await redisClient.ping();
    
    logger.info('Redis connected successfully', { url: redisUrl });

  } catch (error) {
    logger.error('Redis connection failed', { error: error.message });
    throw error;
  }
}

export function getRedisClient(): RedisClientType {
  if (!redisClient) {
    throw new Error('Redis not initialized. Call connectRedis() first.');
  }
  return redisClient;
}

// Cache utilities for translation service
export class TranslationCache {
  private static TTL = {
    TRANSLATION: 3600,     // 1 hour
    TEMPLATE: 86400,       // 24 hours
    OPTIMIZATION: 1800,    // 30 minutes
    LLM_RESPONSE: 7200     // 2 hours
  };

  static async cacheTranslation(key: string, translation: any): Promise<void> {
    const client = getRedisClient();
    await client.setEx(`translation:${key}`, this.TTL.TRANSLATION, JSON.stringify(translation));
  }

  static async getTranslation(key: string): Promise<any> {
    const client = getRedisClient();
    const cached = await client.get(`translation:${key}`);
    return cached ? JSON.parse(cached) : null;
  }

  static async cacheTemplate(templateId: string, template: any): Promise<void> {
    const client = getRedisClient();
    await client.setEx(`template:${templateId}`, this.TTL.TEMPLATE, JSON.stringify(template));
  }

  static async getTemplate(templateId: string): Promise<any> {
    const client = getRedisClient();
    const cached = await client.get(`template:${templateId}`);
    return cached ? JSON.parse(cached) : null;
  }

  static async cacheLLMResponse(key: string, response: any): Promise<void> {
    const client = getRedisClient();
    await client.setEx(`llm:${key}`, this.TTL.LLM_RESPONSE, JSON.stringify(response));
  }

  static async getLLMResponse(key: string): Promise<any> {
    const client = getRedisClient();
    const cached = await client.get(`llm:${key}`);
    return cached ? JSON.parse(cached) : null;
  }

  static generateTranslationKey(designData: any, options: any): string {
    const dataHash = Buffer.from(JSON.stringify(designData)).toString('base64').slice(0, 20);
    const optionsHash = Buffer.from(JSON.stringify(options)).toString('base64').slice(0, 10);
    return `${dataHash}_${optionsHash}`;
  }
}
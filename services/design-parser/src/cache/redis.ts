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
        // Exponential backoff
        return Math.min(options.attempt * 100, 3000);
      }
    });

    redisClient.on('error', (err) => {
      logger.error('Redis client error', { error: err.message });
    });

    redisClient.on('connect', () => {
      logger.info('Redis client connected');
    });

    redisClient.on('ready', () => {
      logger.info('Redis client ready for commands');
    });

    await redisClient.connect();
    
    // Test connection
    await redisClient.ping();
    
    logger.info('Redis connected successfully', {
      url: redisUrl
    });

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

export async function disconnectRedis(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    logger.info('Redis disconnected');
  }
}

// Enhanced Cache utilities with advanced features
export class CacheManager {
  private static TTL = {
    IMMEDIATE: 30,     // 30 seconds
    SHORT: 300,        // 5 minutes
    MEDIUM: 1800,      // 30 minutes  
    LONG: 3600,        // 1 hour
    VERY_LONG: 86400,  // 24 hours
    WEEK: 604800       // 7 days
  };

  private static CACHE_STATS = {
    hits: 0,
    misses: 0,
    errors: 0
  };

  // Basic cache operations with enhanced error handling and logging
  static async set(
    key: string, 
    value: any, 
    ttl: number = CacheManager.TTL.MEDIUM,
    options: { 
      compress?: boolean; 
      tags?: string[]; 
      namespace?: string 
    } = {}
  ): Promise<void> {
    const client = getRedisClient();
    const finalKey = options.namespace ? `${options.namespace}:${key}` : key;
    
    try {
      let serializedValue = JSON.stringify(value);
      
      // Compress large values if requested
      if (options.compress && serializedValue.length > 1024) {
        const zlib = await import('zlib');
        serializedValue = zlib.gzipSync(serializedValue).toString('base64');
        await client.hSet(`${finalKey}:meta`, 'compressed', 'true');
      }
      
      await client.setEx(finalKey, ttl, serializedValue);
      
      // Store tags for cache invalidation
      if (options.tags && options.tags.length > 0) {
        for (const tag of options.tags) {
          await client.sAdd(`tag:${tag}`, finalKey);
          await client.expire(`tag:${tag}`, ttl);
        }
      }
      
      // Store metadata
      await client.hSet(`${finalKey}:meta`, {
        created: Date.now().toString(),
        ttl: ttl.toString(),
        size: serializedValue.length.toString()
      });
      await client.expire(`${finalKey}:meta`, ttl);
      
      logger.debug('Cache set successful', {
        key: finalKey,
        size: serializedValue.length,
        ttl,
        compressed: options.compress && serializedValue.length > 1024,
        tags: options.tags
      });

    } catch (error) {
      CacheManager.CACHE_STATS.errors++;
      logger.error('Cache set failed', {
        key: finalKey,
        error: error.message
      });
      throw error;
    }
  }

  static async get(
    key: string, 
    options: { 
      namespace?: string;
      fallback?: () => Promise<any>;
      refreshTTL?: number;
    } = {}
  ): Promise<any> {
    const client = getRedisClient();
    const finalKey = options.namespace ? `${options.namespace}:${key}` : key;
    
    try {
      const value = await client.get(finalKey);
      
      if (value === null) {
        CacheManager.CACHE_STATS.misses++;
        
        // Try fallback if provided
        if (options.fallback) {
          const fallbackValue = await options.fallback();
          if (fallbackValue !== undefined) {
            await CacheManager.set(key, fallbackValue, options.refreshTTL || CacheManager.TTL.MEDIUM, options);
          }
          return fallbackValue;
        }
        
        logger.debug('Cache miss', { key: finalKey });
        return null;
      }
      
      CacheManager.CACHE_STATS.hits++;
      
      // Check if value is compressed
      const meta = await client.hGetAll(`${finalKey}:meta`);
      let parsedValue = value;
      
      if (meta.compressed === 'true') {
        const zlib = await import('zlib');
        const decompressed = zlib.gunzipSync(Buffer.from(value, 'base64'));
        parsedValue = decompressed.toString();
      }
      
      logger.debug('Cache hit', {
        key: finalKey,
        size: value.length,
        compressed: meta.compressed === 'true',
        age: meta.created ? Date.now() - parseInt(meta.created) : undefined
      });
      
      return JSON.parse(parsedValue);

    } catch (error) {
      CacheManager.CACHE_STATS.errors++;
      logger.error('Cache get failed', {
        key: finalKey,
        error: error.message
      });
      
      // Return fallback on error
      if (options.fallback) {
        try {
          return await options.fallback();
        } catch (fallbackError) {
          logger.error('Cache fallback failed', {
            key: finalKey,
            error: fallbackError.message
          });
        }
      }
      
      return null;
    }
  }

  static async mget(keys: string[], namespace?: string): Promise<{ [key: string]: any }> {
    const client = getRedisClient();
    const finalKeys = keys.map(key => namespace ? `${namespace}:${key}` : key);
    
    try {
      const values = await client.mGet(finalKeys);
      const result: { [key: string]: any } = {};
      
      for (let i = 0; i < keys.length; i++) {
        const originalKey = keys[i];
        const value = values[i];
        
        if (value !== null) {
          CacheManager.CACHE_STATS.hits++;
          result[originalKey] = JSON.parse(value);
        } else {
          CacheManager.CACHE_STATS.misses++;
          result[originalKey] = null;
        }
      }
      
      return result;

    } catch (error) {
      CacheManager.CACHE_STATS.errors++;
      logger.error('Cache mget failed', {
        keys: finalKeys,
        error: error.message
      });
      throw error;
    }
  }

  static async mset(entries: { key: string; value: any; ttl?: number }[], namespace?: string): Promise<void> {
    const client = getRedisClient();
    
    try {
      const pipeline = client.multi();
      
      for (const entry of entries) {
        const finalKey = namespace ? `${namespace}:${entry.key}` : entry.key;
        const ttl = entry.ttl || CacheManager.TTL.MEDIUM;
        
        pipeline.setEx(finalKey, ttl, JSON.stringify(entry.value));
      }
      
      await pipeline.exec();
      
      logger.debug('Cache mset successful', {
        count: entries.length,
        namespace
      });

    } catch (error) {
      CacheManager.CACHE_STATS.errors++;
      logger.error('Cache mset failed', {
        count: entries.length,
        error: error.message
      });
      throw error;
    }
  }

  static async del(key: string | string[], namespace?: string): Promise<number> {
    const client = getRedisClient();
    
    try {
      const keys = Array.isArray(key) ? key : [key];
      const finalKeys = keys.map(k => namespace ? `${namespace}:${k}` : k);
      
      // Also delete metadata
      const metaKeys = finalKeys.map(k => `${k}:meta`);
      
      const deleted = await client.del([...finalKeys, ...metaKeys]);
      
      logger.debug('Cache delete successful', {
        keys: finalKeys,
        deleted
      });
      
      return deleted;

    } catch (error) {
      CacheManager.CACHE_STATS.errors++;
      logger.error('Cache delete failed', {
        key,
        error: error.message
      });
      throw error;
    }
  }

  static async exists(key: string, namespace?: string): Promise<boolean> {
    const client = getRedisClient();
    const finalKey = namespace ? `${namespace}:${key}` : key;
    
    try {
      return (await client.exists(finalKey)) === 1;
    } catch (error) {
      logger.error('Cache exists check failed', {
        key: finalKey,
        error: error.message
      });
      return false;
    }
  }

  static async expire(key: string, ttl: number, namespace?: string): Promise<boolean> {
    const client = getRedisClient();
    const finalKey = namespace ? `${namespace}:${key}` : key;
    
    try {
      const result = await client.expire(finalKey, ttl);
      await client.expire(`${finalKey}:meta`, ttl);
      return result;
    } catch (error) {
      logger.error('Cache expire failed', {
        key: finalKey,
        ttl,
        error: error.message
      });
      return false;
    }
  }

  static async ttl(key: string, namespace?: string): Promise<number> {
    const client = getRedisClient();
    const finalKey = namespace ? `${namespace}:${key}` : key;
    
    try {
      return await client.ttl(finalKey);
    } catch (error) {
      logger.error('Cache TTL check failed', {
        key: finalKey,
        error: error.message
      });
      return -1;
    }
  }

  // Tag-based cache invalidation
  static async invalidateByTag(tag: string): Promise<number> {
    const client = getRedisClient();
    
    try {
      const keys = await client.sMembers(`tag:${tag}`);
      if (keys.length === 0) return 0;
      
      const deleted = await CacheManager.del(keys);
      await client.del(`tag:${tag}`);
      
      logger.info('Cache invalidated by tag', {
        tag,
        keysDeleted: deleted
      });
      
      return deleted;

    } catch (error) {
      logger.error('Cache tag invalidation failed', {
        tag,
        error: error.message
      });
      return 0;
    }
  }

  // Pattern-based operations
  static async keys(pattern: string, namespace?: string): Promise<string[]> {
    const client = getRedisClient();
    const finalPattern = namespace ? `${namespace}:${pattern}` : pattern;
    
    try {
      const keys = await client.keys(finalPattern);
      return namespace ? keys.map(key => key.replace(`${namespace}:`, '')) : keys;
    } catch (error) {
      logger.error('Cache keys scan failed', {
        pattern: finalPattern,
        error: error.message
      });
      return [];
    }
  }

  static async flush(namespace?: string): Promise<void> {
    const client = getRedisClient();
    
    try {
      if (namespace) {
        const keys = await CacheManager.keys('*', namespace);
        if (keys.length > 0) {
          await CacheManager.del(keys, namespace);
        }
      } else {
        await client.flushAll();
      }
      
      logger.info('Cache flushed', { namespace });

    } catch (error) {
      logger.error('Cache flush failed', {
        namespace,
        error: error.message
      });
      throw error;
    }
  }

  // Stats and monitoring
  static getStats(): { hits: number; misses: number; errors: number; hitRate: number } {
    const total = CacheManager.CACHE_STATS.hits + CacheManager.CACHE_STATS.misses;
    const hitRate = total > 0 ? (CacheManager.CACHE_STATS.hits / total) * 100 : 0;
    
    return {
      hits: CacheManager.CACHE_STATS.hits,
      misses: CacheManager.CACHE_STATS.misses,
      errors: CacheManager.CACHE_STATS.errors,
      hitRate: Math.round(hitRate * 100) / 100
    };
  }

  static resetStats(): void {
    CacheManager.CACHE_STATS.hits = 0;
    CacheManager.CACHE_STATS.misses = 0;
    CacheManager.CACHE_STATS.errors = 0;
  }

  static async getInfo(): Promise<any> {
    const client = getRedisClient();
    
    try {
      const info = await client.info();
      const dbSize = await client.dbSize();
      const memory = await client.info('memory');
      
      return {
        connected: client.isReady,
        dbSize,
        memory: CacheManager.parseRedisInfo(memory),
        stats: CacheManager.getStats()
      };

    } catch (error) {
      logger.error('Failed to get cache info', { error: error.message });
      return {
        connected: false,
        error: error.message,
        stats: CacheManager.getStats()
      };
    }
  }

  private static parseRedisInfo(info: string): any {
    const lines = info.split('\\r\\n');
    const result: any = {};
    
    for (const line of lines) {
      if (line.includes(':')) {
        const [key, value] = line.split(':');
        result[key] = isNaN(Number(value)) ? value : Number(value);
      }
    }
    
    return result;
  }

  // Specialized cache methods for design parser

  // Cache design parsing results with compression and tags
  static async cacheParseResult(
    designId: string, 
    result: any, 
    options: { 
      fileId?: string; 
      projectId?: string; 
      version?: string 
    } = {}
  ): Promise<void> {
    const key = `parse:${designId}`;
    const tags = ['parse_results'];
    
    if (options.fileId) tags.push(`file:${options.fileId}`);
    if (options.projectId) tags.push(`project:${options.projectId}`);
    if (options.version) tags.push(`version:${options.version}`);
    
    await CacheManager.set(key, result, CacheManager.TTL.LONG, {
      compress: true,
      tags,
      namespace: 'design_parser'
    });
  }

  static async getParseResult(designId: string): Promise<any> {
    const key = `parse:${designId}`;
    return await CacheManager.get(key, { namespace: 'design_parser' });
  }

  // Cache Figma API responses
  static async cacheFigmaResponse(
    fileId: string, 
    nodeId: string | undefined, 
    response: any
  ): Promise<void> {
    const key = nodeId ? `figma:${fileId}:${nodeId}` : `figma:${fileId}`;
    const tags = ['figma_responses', `figma_file:${fileId}`];
    
    if (nodeId) tags.push(`figma_node:${nodeId}`);
    
    await CacheManager.set(key, response, CacheManager.TTL.MEDIUM, {
      compress: true,
      tags,
      namespace: 'design_parser'
    });
  }

  static async getFigmaResponse(fileId: string, nodeId?: string): Promise<any> {
    const key = nodeId ? `figma:${fileId}:${nodeId}` : `figma:${fileId}`;
    return await CacheManager.get(key, { namespace: 'design_parser' });
  }

  // Cache design tokens
  static async cacheDesignTokens(
    designId: string, 
    tokens: any, 
    projectId?: string
  ): Promise<void> {
    const key = `tokens:${designId}`;
    const tags = ['design_tokens'];
    
    if (projectId) tags.push(`project:${projectId}`);
    
    await CacheManager.set(key, tokens, CacheManager.TTL.VERY_LONG, {
      tags,
      namespace: 'design_parser'
    });
  }

  static async getDesignTokens(designId: string): Promise<any> {
    const key = `tokens:${designId}`;
    return await CacheManager.get(key, { namespace: 'design_parser' });
  }

  // Cache job results
  static async cacheJobResult(jobId: string, result: any): Promise<void> {
    const key = `job:${jobId}`;
    await CacheManager.set(key, result, CacheManager.TTL.LONG, {
      tags: ['job_results'],
      namespace: 'design_parser'
    });
  }

  static async getJobResult(jobId: string): Promise<any> {
    const key = `job:${jobId}`;
    return await CacheManager.get(key, { namespace: 'design_parser' });
  }

  // Batch operations for performance
  static async cacheBatch(operations: Array<{
    key: string;
    value: any;
    ttl?: number;
    tags?: string[];
  }>): Promise<void> {
    const client = getRedisClient();
    const pipeline = client.multi();
    
    for (const op of operations) {
      const key = `design_parser:${op.key}`;
      const ttl = op.ttl || CacheManager.TTL.MEDIUM;
      
      pipeline.setEx(key, ttl, JSON.stringify(op.value));
      
      // Handle tags
      if (op.tags && op.tags.length > 0) {
        for (const tag of op.tags) {
          pipeline.sAdd(`tag:${tag}`, key);
          pipeline.expire(`tag:${tag}`, ttl);
        }
      }
    }
    
    await pipeline.exec();
    
    logger.debug('Cache batch operation completed', {
      operations: operations.length
    });
  }

  // Warming and preloading
  static async warmCache(patterns: string[]): Promise<void> {
    logger.info('Starting cache warming', { patterns });
    
    // Implementation would depend on specific warming strategies
    // For example, preloading frequently accessed design tokens
    
    logger.info('Cache warming completed');
  }

  // Cleanup and maintenance
  static async cleanup(): Promise<void> {
    try {
      // Clean up expired metadata
      const client = getRedisClient();
      const metaKeys = await client.keys('design_parser:*:meta');
      
      for (const metaKey of metaKeys) {
        const ttl = await client.ttl(metaKey);
        if (ttl === -1) { // No expiration set
          await client.expire(metaKey, CacheManager.TTL.MEDIUM);
        }
      }
      
      logger.info('Cache cleanup completed', {
        metaKeysProcessed: metaKeys.length
      });

    } catch (error) {
      logger.error('Cache cleanup failed', { error: error.message });
    }
  }
}
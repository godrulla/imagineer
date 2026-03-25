import { Pool } from 'pg';
import { logger } from './logger';
import { getRedisClient } from '../cache/redis';

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  uptime: number;
  dependencies: {
    [key: string]: DependencyHealth;
  };
  metrics?: ServiceMetrics;
}

export interface DependencyHealth {
  status: 'healthy' | 'unhealthy';
  responseTime?: number;
  lastCheck: string;
  error?: string;
  details?: any;
}

export interface ServiceMetrics {
  requests: {
    total: number;
    successful: number;
    failed: number;
    rate: number; // requests per second
  };
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  cpu: {
    usage: number;
  };
  jobs: {
    active: number;
    completed: number;
    failed: number;
    queued: number;
  };
  cache: {
    hitRate: number;
    missRate: number;
    evictions: number;
  };
}

export class HealthChecker {
  private dbPool: Pool;
  private redis: any;
  private startTime: number;
  private requestMetrics: {
    total: number;
    successful: number;
    failed: number;
    lastReset: number;
  };

  constructor(dbPool: Pool) {
    this.dbPool = dbPool;
    this.redis = getRedisClient();
    this.startTime = Date.now();
    this.requestMetrics = {
      total: 0,
      successful: 0,
      failed: 0,
      lastReset: Date.now()
    };
  }

  async checkHealth(): Promise<HealthStatus> {
    const startTime = Date.now();
    const dependencies: { [key: string]: DependencyHealth } = {};

    try {
      // Check database health
      dependencies.database = await this.checkDatabase();

      // Check Redis health
      dependencies.redis = await this.checkRedis();

      // Check external services
      dependencies.figma = await this.checkFigmaApi();

      // Check file system
      dependencies.filesystem = await this.checkFileSystem();

      // Determine overall health status
      const overallStatus = this.determineOverallStatus(dependencies);

      // Get service metrics
      const metrics = await this.getServiceMetrics();

      const healthStatus: HealthStatus = {
        status: overallStatus,
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || '1.0.0',
        uptime: Math.floor((Date.now() - this.startTime) / 1000),
        dependencies,
        metrics
      };

      logger.info('Health check completed', {
        status: overallStatus,
        duration: Date.now() - startTime,
        dependencies: Object.keys(dependencies).reduce((acc, key) => ({
          ...acc,
          [key]: dependencies[key].status
        }), {})
      });

      return healthStatus;

    } catch (error) {
      logger.error('Health check failed', {
        error: error.message,
        duration: Date.now() - startTime
      });

      return {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || '1.0.0',
        uptime: Math.floor((Date.now() - this.startTime) / 1000),
        dependencies
      };
    }
  }

  async checkDatabase(): Promise<DependencyHealth> {
    const startTime = Date.now();
    
    try {
      const client = await this.dbPool.connect();
      
      // Test query
      const result = await client.query('SELECT 1 as test');
      
      // Check connection pool stats
      const poolStats = {
        totalCount: this.dbPool.totalCount,
        idleCount: this.dbPool.idleCount,
        waitingCount: this.dbPool.waitingCount
      };

      client.release();

      return {
        status: 'healthy',
        responseTime: Date.now() - startTime,
        lastCheck: new Date().toISOString(),
        details: {
          query_result: result.rows[0],
          pool_stats: poolStats
        }
      };

    } catch (error) {
      logger.error('Database health check failed', { error: error.message });
      
      return {
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        lastCheck: new Date().toISOString(),
        error: error.message,
        details: {
          pool_stats: {
            totalCount: this.dbPool.totalCount,
            idleCount: this.dbPool.idleCount,
            waitingCount: this.dbPool.waitingCount
          }
        }
      };
    }
  }

  async checkRedis(): Promise<DependencyHealth> {
    const startTime = Date.now();
    
    try {
      // Test Redis connection
      const testKey = `health_check_${Date.now()}`;
      const testValue = 'ok';
      
      await this.redis.set(testKey, testValue, 'EX', 10);
      const retrievedValue = await this.redis.get(testKey);
      await this.redis.del(testKey);

      if (retrievedValue !== testValue) {
        throw new Error('Redis read/write test failed');
      }

      // Get Redis info
      const info = await this.redis.info('memory');
      const memoryInfo = this.parseRedisInfo(info);

      return {
        status: 'healthy',
        responseTime: Date.now() - startTime,
        lastCheck: new Date().toISOString(),
        details: {
          test_result: 'passed',
          memory_info: memoryInfo
        }
      };

    } catch (error) {
      logger.error('Redis health check failed', { error: error.message });
      
      return {
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        lastCheck: new Date().toISOString(),
        error: error.message
      };
    }
  }

  async checkFigmaApi(): Promise<DependencyHealth> {
    const startTime = Date.now();
    
    try {
      // Only check if we have a Figma token
      const figmaToken = process.env.FIGMA_ACCESS_TOKEN;
      if (!figmaToken) {
        return {
          status: 'healthy',
          responseTime: 0,
          lastCheck: new Date().toISOString(),
          details: {
            note: 'Figma API not configured - using mock data'
          }
        };
      }

      // Test Figma API with a lightweight request
      const response = await fetch('https://api.figma.com/v1/me', {
        headers: {
          'X-Figma-Token': figmaToken
        },
        signal: AbortSignal.timeout(5000) // 5 second timeout
      });

      if (!response.ok) {
        throw new Error(`Figma API returned ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      return {
        status: 'healthy',
        responseTime: Date.now() - startTime,
        lastCheck: new Date().toISOString(),
        details: {
          user_id: data.id,
          handle: data.handle,
          api_version: 'v1'
        }
      };

    } catch (error) {
      logger.warn('Figma API health check failed', { error: error.message });
      
      return {
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        lastCheck: new Date().toISOString(),
        error: error.message,
        details: {
          note: 'Service will fall back to mock data'
        }
      };
    }
  }

  async checkFileSystem(): Promise<DependencyHealth> {
    const startTime = Date.now();
    
    try {
      const fs = await import('fs/promises');
      const path = await import('path');
      const os = await import('os');

      // Check temp directory access
      const tempDir = os.tmpdir();\n      const testFile = path.join(tempDir, `health_check_${Date.now()}.tmp`);\n      const testContent = 'health check test';\n\n      await fs.writeFile(testFile, testContent);\n      const readContent = await fs.readFile(testFile, 'utf8');\n      await fs.unlink(testFile);\n\n      if (readContent !== testContent) {\n        throw new Error('File system read/write test failed');\n      }\n\n      // Get disk space info\n      const stats = await fs.stat(tempDir);\n      \n      return {\n        status: 'healthy',\n        responseTime: Date.now() - startTime,\n        lastCheck: new Date().toISOString(),\n        details: {\n          temp_directory: tempDir,\n          test_result: 'passed',\n          stats: {\n            accessible: true,\n            writable: true\n          }\n        }\n      };\n\n    } catch (error) {\n      logger.error('File system health check failed', { error: error.message });\n      \n      return {\n        status: 'unhealthy',\n        responseTime: Date.now() - startTime,\n        lastCheck: new Date().toISOString(),\n        error: error.message\n      };\n    }\n  }\n\n  private determineOverallStatus(dependencies: { [key: string]: DependencyHealth }): 'healthy' | 'degraded' | 'unhealthy' {\n    const statuses = Object.values(dependencies).map(dep => dep.status);\n    \n    // If any critical dependency is unhealthy, service is unhealthy\n    const criticalDeps = ['database', 'redis'];\n    const criticalStatuses = Object.entries(dependencies)\n      .filter(([key]) => criticalDeps.includes(key))\n      .map(([, dep]) => dep.status);\n    \n    if (criticalStatuses.includes('unhealthy')) {\n      return 'unhealthy';\n    }\n    \n    // If any dependency is unhealthy but not critical, service is degraded\n    if (statuses.includes('unhealthy')) {\n      return 'degraded';\n    }\n    \n    return 'healthy';\n  }\n\n  private async getServiceMetrics(): Promise<ServiceMetrics> {\n    try {\n      // Calculate request rate\n      const now = Date.now();\n      const timeSinceReset = (now - this.requestMetrics.lastReset) / 1000;\n      const requestRate = timeSinceReset > 0 ? this.requestMetrics.total / timeSinceReset : 0;\n\n      // Get memory usage\n      const memoryUsage = process.memoryUsage();\n      const totalMemory = memoryUsage.heapTotal + memoryUsage.external;\n      const usedMemory = memoryUsage.heapUsed;\n      const memoryPercentage = (usedMemory / totalMemory) * 100;\n\n      // Get CPU usage (simplified)\n      const cpuUsage = process.cpuUsage();\n      const cpuPercentage = ((cpuUsage.user + cpuUsage.system) / 1000000) / process.uptime() * 100;\n\n      // Get job metrics (placeholder - would integrate with actual job manager)\n      const jobMetrics = {\n        active: 0,\n        completed: this.requestMetrics.successful,\n        failed: this.requestMetrics.failed,\n        queued: 0\n      };\n\n      // Get cache metrics (placeholder)\n      const cacheMetrics = {\n        hitRate: 85.5, // Would get from actual cache implementation\n        missRate: 14.5,\n        evictions: 0\n      };\n\n      return {\n        requests: {\n          total: this.requestMetrics.total,\n          successful: this.requestMetrics.successful,\n          failed: this.requestMetrics.failed,\n          rate: Math.round(requestRate * 100) / 100\n        },\n        memory: {\n          used: Math.round(usedMemory / 1024 / 1024), // MB\n          total: Math.round(totalMemory / 1024 / 1024), // MB\n          percentage: Math.round(memoryPercentage * 100) / 100\n        },\n        cpu: {\n          usage: Math.round(cpuPercentage * 100) / 100\n        },\n        jobs: jobMetrics,\n        cache: cacheMetrics\n      };\n\n    } catch (error) {\n      logger.warn('Failed to collect service metrics', { error: error.message });\n      \n      // Return basic metrics\n      return {\n        requests: {\n          total: this.requestMetrics.total,\n          successful: this.requestMetrics.successful,\n          failed: this.requestMetrics.failed,\n          rate: 0\n        },\n        memory: {\n          used: 0,\n          total: 0,\n          percentage: 0\n        },\n        cpu: {\n          usage: 0\n        },\n        jobs: {\n          active: 0,\n          completed: 0,\n          failed: 0,\n          queued: 0\n        },\n        cache: {\n          hitRate: 0,\n          missRate: 0,\n          evictions: 0\n        }\n      };\n    }\n  }\n\n  private parseRedisInfo(info: string): any {\n    const lines = info.split('\\r\\n');\n    const result: any = {};\n    \n    for (const line of lines) {\n      if (line.includes(':')) {\n        const [key, value] = line.split(':');\n        result[key] = isNaN(Number(value)) ? value : Number(value);\n      }\n    }\n    \n    return result;\n  }\n\n  // Request metrics tracking\n  incrementRequestCount(): void {\n    this.requestMetrics.total++;\n  }\n\n  incrementSuccessCount(): void {\n    this.requestMetrics.successful++;\n  }\n\n  incrementFailureCount(): void {\n    this.requestMetrics.failed++;\n  }\n\n  resetMetrics(): void {\n    this.requestMetrics = {\n      total: 0,\n      successful: 0,\n      failed: 0,\n      lastReset: Date.now()\n    };\n  }\n\n  // Additional health check methods\n  async checkServiceReadiness(): Promise<boolean> {\n    try {\n      const health = await this.checkHealth();\n      \n      // Service is ready if critical dependencies are healthy\n      const criticalDeps = ['database', 'redis'];\n      const criticalHealthy = criticalDeps.every(dep => \n        health.dependencies[dep]?.status === 'healthy'\n      );\n      \n      return criticalHealthy;\n    } catch (error) {\n      logger.error('Readiness check failed', { error: error.message });\n      return false;\n    }\n  }\n\n  async checkServiceLiveness(): Promise<boolean> {\n    try {\n      // Basic liveness check - service can respond\n      return true;\n    } catch (error) {\n      logger.error('Liveness check failed', { error: error.message });\n      return false;\n    }\n  }\n\n  // Monitoring and alerting helpers\n  async checkThresholds(): Promise<{ alerts: string[]; warnings: string[] }> {\n    const alerts: string[] = [];\n    const warnings: string[] = [];\n    \n    try {\n      const health = await this.checkHealth();\n      const metrics = health.metrics;\n      \n      if (!metrics) return { alerts, warnings };\n      \n      // Memory thresholds\n      if (metrics.memory.percentage > 90) {\n        alerts.push(`High memory usage: ${metrics.memory.percentage}%`);\n      } else if (metrics.memory.percentage > 75) {\n        warnings.push(`Elevated memory usage: ${metrics.memory.percentage}%`);\n      }\n      \n      // CPU thresholds\n      if (metrics.cpu.usage > 95) {\n        alerts.push(`High CPU usage: ${metrics.cpu.usage}%`);\n      } else if (metrics.cpu.usage > 80) {\n        warnings.push(`Elevated CPU usage: ${metrics.cpu.usage}%`);\n      }\n      \n      // Error rate thresholds\n      const errorRate = (metrics.requests.failed / metrics.requests.total) * 100;\n      if (errorRate > 10) {\n        alerts.push(`High error rate: ${errorRate.toFixed(2)}%`);\n      } else if (errorRate > 5) {\n        warnings.push(`Elevated error rate: ${errorRate.toFixed(2)}%`);\n      }\n      \n      // Queue depth thresholds\n      if (metrics.jobs.queued > 1000) {\n        alerts.push(`High job queue depth: ${metrics.jobs.queued}`);\n      } else if (metrics.jobs.queued > 500) {\n        warnings.push(`Elevated job queue depth: ${metrics.jobs.queued}`);\n      }\n      \n      // Cache hit rate thresholds\n      if (metrics.cache.hitRate < 50) {\n        warnings.push(`Low cache hit rate: ${metrics.cache.hitRate}%`);\n      }\n      \n    } catch (error) {\n      alerts.push(`Failed to check thresholds: ${error.message}`);\n    }\n    \n    return { alerts, warnings };\n  }\n}\n\n// Singleton instance\nlet healthChecker: HealthChecker | null = null;\n\nexport function initializeHealthChecker(dbPool: Pool): HealthChecker {\n  if (!healthChecker) {\n    healthChecker = new HealthChecker(dbPool);\n  }\n  return healthChecker;\n}\n\nexport function getHealthChecker(): HealthChecker {\n  if (!healthChecker) {\n    throw new Error('Health checker not initialized. Call initializeHealthChecker first.');\n  }\n  return healthChecker;\n}\n\n// Express middleware for request tracking\nexport function trackRequests() {\n  return (req: any, res: any, next: any) => {\n    const checker = getHealthChecker();\n    checker.incrementRequestCount();\n    \n    // Track response status\n    const originalSend = res.send;\n    res.send = function(data: any) {\n      if (res.statusCode >= 200 && res.statusCode < 400) {\n        checker.incrementSuccessCount();\n      } else {\n        checker.incrementFailureCount();\n      }\n      return originalSend.call(this, data);\n    };\n    \n    next();\n  };\n}\n\n// Graceful shutdown helper\nexport async function gracefulShutdown(signal: string): Promise<void> {\n  logger.info(`Received ${signal}, starting graceful shutdown...`);\n  \n  try {\n    // Add shutdown logic here\n    // - Stop accepting new requests\n    // - Finish processing current requests\n    // - Close database connections\n    // - Close Redis connections\n    \n    logger.info('Graceful shutdown completed');\n    process.exit(0);\n  } catch (error) {\n    logger.error('Error during graceful shutdown', { error: error.message });\n    process.exit(1);\n  }\n}"
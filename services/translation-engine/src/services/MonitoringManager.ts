import { Registry, Histogram, Counter, Gauge, collectDefaultMetrics } from 'prom-client';
import { logger } from '../utils/logger';
import { LLMManager } from './LLMManager';
import { QueueManager } from './QueueManager';
import { getDatabaseOperations } from '../database/connection';
import { getRedisClient } from '../cache/redis';

export interface MonitoringConfig {
  enableDefaultMetrics: boolean;
  enableCustomMetrics: boolean;
  metricsPort?: number;
  healthCheckInterval: number;
  alertThresholds: {
    errorRate: number;
    responseTime: number;
    queueDepth: number;
    cpuUsage: number;
    memoryUsage: number;
  };
}

export interface SystemHealth {
  overall: 'healthy' | 'degraded' | 'unhealthy';
  components: {
    database: ComponentHealth;
    redis: ComponentHealth;
    llmProviders: Record<string, ComponentHealth>;
    queues: ComponentHealth;
    memory: ComponentHealth;
    cpu: ComponentHealth;
  };
  timestamp: Date;
  uptime: number;
}

export interface ComponentHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  lastCheck: Date;
  responseTime?: number;
  errorRate?: number;
  details?: any;
}

export interface PerformanceMetrics {
  requests: {
    total: number;
    successful: number;
    failed: number;
    rate: number; // requests per second
  };
  latency: {
    p50: number;
    p95: number;
    p99: number;
    average: number;
  };
  throughput: {
    current: number;
    peak: number;
    average: number;
  };
  costs: {
    total: number;
    byProvider: Record<string, number>;
    rate: number; // cost per hour
  };
  quality: {
    averageScore: number;
    successRate: number;
    userSatisfaction: number;
  };
}

export interface Alert {
  id: string;
  type: 'error' | 'warning' | 'info';
  component: string;
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  threshold?: number;
  currentValue?: number;
  timestamp: Date;
  resolved: boolean;
  resolvedAt?: Date;
}

export class MonitoringManager {
  private config: MonitoringConfig;
  private registry: Registry;
  private llmManager: LLMManager;
  private queueManager?: QueueManager;
  
  // Prometheus metrics
  private metrics = {
    httpRequestDuration: new Histogram({
      name: 'http_request_duration_seconds',
      help: 'Duration of HTTP requests in seconds',
      labelNames: ['method', 'route', 'status_code'],
      buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10]
    }),
    
    httpRequestTotal: new Counter({
      name: 'http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'route', 'status_code']
    }),
    
    translationRequestDuration: new Histogram({
      name: 'translation_request_duration_seconds',
      help: 'Duration of translation requests in seconds',
      labelNames: ['provider', 'model', 'format', 'status'],
      buckets: [1, 2, 5, 10, 15, 30, 60, 120]
    }),
    
    translationRequestTotal: new Counter({
      name: 'translation_requests_total',
      help: 'Total number of translation requests',
      labelNames: ['provider', 'model', 'format', 'status']
    }),
    
    translationCost: new Counter({
      name: 'translation_cost_usd_total',
      help: 'Total cost of translations in USD',
      labelNames: ['provider', 'model']
    }),
    
    translationTokens: new Counter({
      name: 'translation_tokens_total',
      help: 'Total number of tokens used',
      labelNames: ['provider', 'model', 'type']
    }),
    
    translationQuality: new Histogram({
      name: 'translation_quality_score',
      help: 'Quality score of translations',
      labelNames: ['provider', 'template_id'],
      buckets: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0]
    }),
    
    queueSize: new Gauge({
      name: 'queue_size',
      help: 'Number of jobs in queue',
      labelNames: ['priority', 'status']
    }),
    
    queueProcessingTime: new Histogram({
      name: 'queue_processing_time_seconds',
      help: 'Time spent processing queue jobs',
      labelNames: ['priority', 'status'],
      buckets: [1, 5, 10, 30, 60, 300, 600]
    }),
    
    llmProviderHealth: new Gauge({
      name: 'llm_provider_health',
      help: 'Health status of LLM providers (1=healthy, 0=unhealthy)',
      labelNames: ['provider']
    }),
    
    databaseConnections: new Gauge({
      name: 'database_connections',
      help: 'Number of database connections',
      labelNames: ['type']
    }),
    
    redisConnections: new Gauge({
      name: 'redis_connections',
      help: 'Redis connection status (1=connected, 0=disconnected)'
    }),
    
    systemMemoryUsage: new Gauge({
      name: 'system_memory_usage_bytes',
      help: 'System memory usage in bytes',
      labelNames: ['type']
    }),
    
    systemCpuUsage: new Gauge({
      name: 'system_cpu_usage_percent',
      help: 'System CPU usage percentage'
    })
  };

  private alerts: Map<string, Alert> = new Map();
  private healthStatus: SystemHealth;
  private performanceMetrics: PerformanceMetrics;
  private monitoringInterval?: NodeJS.Timeout;

  constructor(config: MonitoringConfig, llmManager: LLMManager, queueManager?: QueueManager) {
    this.config = config;
    this.llmManager = llmManager;
    this.queueManager = queueManager;
    
    // Initialize Prometheus registry
    this.registry = new Registry();
    
    // Register metrics
    Object.values(this.metrics).forEach(metric => {
      this.registry.registerMetric(metric);
    });
    
    // Collect default metrics if enabled
    if (config.enableDefaultMetrics) {
      collectDefaultMetrics({ register: this.registry });
    }

    // Initialize health status
    this.healthStatus = {
      overall: 'healthy',
      components: {
        database: { status: 'healthy', lastCheck: new Date() },
        redis: { status: 'healthy', lastCheck: new Date() },
        llmProviders: {},
        queues: { status: 'healthy', lastCheck: new Date() },
        memory: { status: 'healthy', lastCheck: new Date() },
        cpu: { status: 'healthy', lastCheck: new Date() }
      },
      timestamp: new Date(),
      uptime: 0
    };

    // Initialize performance metrics
    this.performanceMetrics = {
      requests: { total: 0, successful: 0, failed: 0, rate: 0 },
      latency: { p50: 0, p95: 0, p99: 0, average: 0 },
      throughput: { current: 0, peak: 0, average: 0 },
      costs: { total: 0, byProvider: {}, rate: 0 },
      quality: { averageScore: 0, successRate: 0, userSatisfaction: 0 }
    };
  }

  async initialize(): Promise<void> {
    try {
      // Start monitoring intervals
      this.startHealthMonitoring();
      this.startPerformanceMonitoring();
      
      logger.info('Monitoring Manager initialized successfully', {
        enableDefaultMetrics: this.config.enableDefaultMetrics,
        enableCustomMetrics: this.config.enableCustomMetrics,
        healthCheckInterval: this.config.healthCheckInterval
      });

    } catch (error) {
      logger.error('Failed to initialize Monitoring Manager', { error: error.message });
      throw error;
    }
  }

  // ============================================================================
  // METRICS RECORDING
  // ============================================================================

  recordHttpRequest(method: string, route: string, statusCode: number, duration: number): void {
    this.metrics.httpRequestTotal.inc({ method, route, status_code: statusCode });
    this.metrics.httpRequestDuration.observe({ method, route, status_code: statusCode }, duration / 1000);
  }

  recordTranslationRequest(
    provider: string,
    model: string,
    format: string,
    status: 'success' | 'failed',
    duration: number,
    cost?: number,
    tokens?: { input: number; output: number },
    quality?: number,
    templateId?: string
  ): void {
    // Request metrics
    this.metrics.translationRequestTotal.inc({ provider, model, format, status });
    this.metrics.translationRequestDuration.observe({ provider, model, format, status }, duration / 1000);
    
    // Cost metrics
    if (cost) {
      this.metrics.translationCost.inc({ provider, model }, cost);
    }
    
    // Token metrics
    if (tokens) {
      this.metrics.translationTokens.inc({ provider, model, type: 'input' }, tokens.input);
      this.metrics.translationTokens.inc({ provider, model, type: 'output' }, tokens.output);
    }
    
    // Quality metrics
    if (quality) {
      this.metrics.translationQuality.observe({ provider, template_id: templateId || 'none' }, quality);
    }
  }

  recordQueueMetrics(priority: string, status: string, size: number, processingTime?: number): void {
    this.metrics.queueSize.set({ priority, status }, size);
    
    if (processingTime) {
      this.metrics.queueProcessingTime.observe({ priority, status }, processingTime / 1000);
    }
  }

  recordProviderHealth(provider: string, isHealthy: boolean): void {
    this.metrics.llmProviderHealth.set({ provider }, isHealthy ? 1 : 0);
  }

  recordDatabaseMetrics(totalConnections: number, activeConnections: number, idleConnections: number): void {
    this.metrics.databaseConnections.set({ type: 'total' }, totalConnections);
    this.metrics.databaseConnections.set({ type: 'active' }, activeConnections);
    this.metrics.databaseConnections.set({ type: 'idle' }, idleConnections);
  }

  recordRedisHealth(isConnected: boolean): void {
    this.metrics.redisConnections.set(isConnected ? 1 : 0);
  }

  recordSystemMetrics(memoryUsage: NodeJS.MemoryUsage, cpuUsage: number): void {
    this.metrics.systemMemoryUsage.set({ type: 'heap_used' }, memoryUsage.heapUsed);
    this.metrics.systemMemoryUsage.set({ type: 'heap_total' }, memoryUsage.heapTotal);
    this.metrics.systemMemoryUsage.set({ type: 'external' }, memoryUsage.external);
    this.metrics.systemMemoryUsage.set({ type: 'rss' }, memoryUsage.rss);
    
    this.metrics.systemCpuUsage.set(cpuUsage);
  }

  // ============================================================================
  // HEALTH MONITORING
  // ============================================================================

  async checkSystemHealth(): Promise<SystemHealth> {
    const startTime = Date.now();
    
    try {
      // Check database health
      const databaseHealth = await this.checkDatabaseHealth();
      
      // Check Redis health
      const redisHealth = await this.checkRedisHealth();
      
      // Check LLM providers health
      const llmProvidersHealth = await this.checkLLMProvidersHealth();
      
      // Check queue health
      const queueHealth = await this.checkQueueHealth();
      
      // Check system resources
      const memoryHealth = this.checkMemoryHealth();
      const cpuHealth = this.checkCpuHealth();

      // Update health status
      this.healthStatus = {
        overall: this.determineOverallHealth([
          databaseHealth,
          redisHealth,
          ...Object.values(llmProvidersHealth),
          queueHealth,
          memoryHealth,
          cpuHealth
        ]),
        components: {
          database: databaseHealth,
          redis: redisHealth,
          llmProviders: llmProvidersHealth,
          queues: queueHealth,
          memory: memoryHealth,
          cpu: cpuHealth
        },
        timestamp: new Date(),
        uptime: process.uptime()
      };

      // Check for alert conditions
      await this.checkAlertConditions();

      return this.healthStatus;

    } catch (error) {
      logger.error('Failed to check system health', { error: error.message });
      throw error;
    }
  }

  getHealthStatus(): SystemHealth {
    return this.healthStatus;
  }

  getPerformanceMetrics(): PerformanceMetrics {
    return this.performanceMetrics;
  }

  getActiveAlerts(): Alert[] {
    return Array.from(this.alerts.values()).filter(alert => !alert.resolved);
  }

  async getMetricsData(): Promise<string> {
    return this.registry.metrics();
  }

  // ============================================================================
  // ALERTING
  // ============================================================================

  createAlert(
    component: string,
    message: string,
    severity: Alert['severity'],
    type: Alert['type'] = 'warning',
    threshold?: number,
    currentValue?: number
  ): Alert {
    const alert: Alert = {
      id: `${component}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      component,
      message,
      severity,
      threshold,
      currentValue,
      timestamp: new Date(),
      resolved: false
    };

    this.alerts.set(alert.id, alert);
    
    logger.warn('Alert created', {
      id: alert.id,
      component,
      message,
      severity,
      threshold,
      currentValue
    });

    return alert;
  }

  resolveAlert(alertId: string): boolean {
    const alert = this.alerts.get(alertId);
    if (!alert) {
      return false;
    }

    alert.resolved = true;
    alert.resolvedAt = new Date();

    logger.info('Alert resolved', { alertId, component: alert.component });
    return true;
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  private startHealthMonitoring(): void {
    const interval = this.config.healthCheckInterval;
    
    this.monitoringInterval = setInterval(async () => {
      try {
        await this.checkSystemHealth();
      } catch (error) {
        logger.error('Health check failed', { error: error.message });
      }
    }, interval);
  }

  private startPerformanceMonitoring(): void {
    // Update performance metrics every 30 seconds
    setInterval(() => {
      try {
        this.updatePerformanceMetrics();
      } catch (error) {
        logger.error('Performance metrics update failed', { error: error.message });
      }
    }, 30000);
  }

  private async checkDatabaseHealth(): Promise<ComponentHealth> {
    const startTime = Date.now();
    
    try {
      const dbOps = getDatabaseOperations();
      const isHealthy = await dbOps.healthCheck();
      const responseTime = Date.now() - startTime;
      
      // Record metrics
      const connectionInfo = await dbOps.getConnectionInfo();
      this.recordDatabaseMetrics(
        connectionInfo.totalConnections,
        connectionInfo.totalConnections - connectionInfo.idleConnections,
        connectionInfo.idleConnections
      );

      return {
        status: isHealthy ? 'healthy' : 'unhealthy',
        lastCheck: new Date(),
        responseTime,
        details: connectionInfo
      };

    } catch (error) {
      logger.error('Database health check failed', { error: error.message });
      return {
        status: 'unhealthy',
        lastCheck: new Date(),
        details: { error: error.message }
      };
    }
  }

  private async checkRedisHealth(): Promise<ComponentHealth> {
    const startTime = Date.now();
    
    try {
      const redisClient = getRedisClient();
      await redisClient.ping();
      const responseTime = Date.now() - startTime;
      
      this.recordRedisHealth(true);

      return {
        status: 'healthy',
        lastCheck: new Date(),
        responseTime
      };

    } catch (error) {
      this.recordRedisHealth(false);
      
      return {
        status: 'unhealthy',
        lastCheck: new Date(),
        details: { error: error.message }
      };
    }
  }

  private async checkLLMProvidersHealth(): Promise<Record<string, ComponentHealth>> {
    const providersHealth: Record<string, ComponentHealth> = {};
    const providers = this.llmManager.getSupportedProviders();

    for (const provider of providers) {
      try {
        const startTime = Date.now();
        const health = await this.llmManager.getProviderHealth(provider);
        const responseTime = Date.now() - startTime;

        providersHealth[provider] = {
          status: health.healthy ? 'healthy' : 'unhealthy',
          lastCheck: health.lastCheck,
          responseTime,
          details: health
        };

        this.recordProviderHealth(provider, health.healthy);

      } catch (error) {
        providersHealth[provider] = {
          status: 'unhealthy',
          lastCheck: new Date(),
          details: { error: error.message }
        };

        this.recordProviderHealth(provider, false);
      }
    }

    return providersHealth;
  }

  private async checkQueueHealth(): Promise<ComponentHealth> {
    if (!this.queueManager) {
      return {
        status: 'healthy',
        lastCheck: new Date(),
        details: { message: 'Queue manager not configured' }
      };
    }

    try {
      const metrics = await this.queueManager.getMetrics();
      
      // Record queue metrics
      Object.entries(metrics.queues).forEach(([priority, stats]) => {
        this.recordQueueMetrics(priority, 'active', stats.active);
        this.recordQueueMetrics(priority, 'waiting', stats.waiting);
        this.recordQueueMetrics(priority, 'failed', stats.failed);
      });

      // Determine health based on queue state
      const totalWaiting = Object.values(metrics.queues).reduce((sum, q) => sum + q.waiting, 0);
      const errorRate = metrics.performance.errorRate;
      
      let status: ComponentHealth['status'] = 'healthy';
      if (totalWaiting > this.config.alertThresholds.queueDepth) {
        status = 'degraded';
      }
      if (errorRate > this.config.alertThresholds.errorRate) {
        status = 'unhealthy';
      }

      return {
        status,
        lastCheck: new Date(),
        errorRate,
        details: metrics
      };

    } catch (error) {
      return {
        status: 'unhealthy',
        lastCheck: new Date(),
        details: { error: error.message }
      };
    }
  }

  private checkMemoryHealth(): ComponentHealth {
    const memoryUsage = process.memoryUsage();
    this.recordSystemMetrics(memoryUsage, 0);

    const heapUsedMB = memoryUsage.heapUsed / 1024 / 1024;
    const heapTotalMB = memoryUsage.heapTotal / 1024 / 1024;
    const usagePercent = (heapUsedMB / heapTotalMB) * 100;

    let status: ComponentHealth['status'] = 'healthy';
    if (usagePercent > this.config.alertThresholds.memoryUsage) {
      status = usagePercent > 90 ? 'unhealthy' : 'degraded';
    }

    return {
      status,
      lastCheck: new Date(),
      details: {
        heapUsedMB: Math.round(heapUsedMB),
        heapTotalMB: Math.round(heapTotalMB),
        usagePercent: Math.round(usagePercent)
      }
    };
  }

  private checkCpuHealth(): ComponentHealth {
    // Simple CPU usage estimation (would use more sophisticated monitoring in production)
    const cpuUsage = process.cpuUsage();
    const usagePercent = (cpuUsage.user + cpuUsage.system) / 1000000; // Convert to seconds

    this.recordSystemMetrics(process.memoryUsage(), usagePercent);

    let status: ComponentHealth['status'] = 'healthy';
    if (usagePercent > this.config.alertThresholds.cpuUsage) {
      status = usagePercent > 90 ? 'unhealthy' : 'degraded';
    }

    return {
      status,
      lastCheck: new Date(),
      details: {
        usagePercent: Math.round(usagePercent)
      }
    };
  }

  private determineOverallHealth(componentHealths: ComponentHealth[]): SystemHealth['overall'] {
    const unhealthyCount = componentHealths.filter(h => h.status === 'unhealthy').length;
    const degradedCount = componentHealths.filter(h => h.status === 'degraded').length;

    if (unhealthyCount > 0) {
      return 'unhealthy';
    } else if (degradedCount > 0) {
      return 'degraded';
    } else {
      return 'healthy';
    }
  }

  private async checkAlertConditions(): Promise<void> {
    // Check error rate
    if (this.performanceMetrics.requests.total > 0) {
      const errorRate = (this.performanceMetrics.requests.failed / this.performanceMetrics.requests.total) * 100;
      if (errorRate > this.config.alertThresholds.errorRate * 100) {
        this.createAlert(
          'error_rate',
          `High error rate detected: ${errorRate.toFixed(2)}%`,
          'high',
          'error',
          this.config.alertThresholds.errorRate * 100,
          errorRate
        );
      }
    }

    // Check response time
    if (this.performanceMetrics.latency.p95 > this.config.alertThresholds.responseTime) {
      this.createAlert(
        'response_time',
        `High response time detected: ${this.performanceMetrics.latency.p95}ms`,
        'medium',
        'warning',
        this.config.alertThresholds.responseTime,
        this.performanceMetrics.latency.p95
      );
    }

    // Check queue depth
    if (this.queueManager) {
      const metrics = await this.queueManager.getMetrics();
      const totalWaiting = Object.values(metrics.queues).reduce((sum, q) => sum + q.waiting, 0);
      
      if (totalWaiting > this.config.alertThresholds.queueDepth) {
        this.createAlert(
          'queue_depth',
          `High queue depth detected: ${totalWaiting} jobs waiting`,
          'medium',
          'warning',
          this.config.alertThresholds.queueDepth,
          totalWaiting
        );
      }
    }
  }

  private updatePerformanceMetrics(): void {
    // Update from LLM Manager
    const costStats = this.llmManager.getCostStatistics();
    
    this.performanceMetrics.costs.total = costStats.total.cost;
    this.performanceMetrics.costs.byProvider = costStats.byProvider;
    this.performanceMetrics.requests.total = costStats.total.requests;

    // Calculate success rate (simplified)
    this.performanceMetrics.requests.successful = Math.round(costStats.total.requests * 0.95);
    this.performanceMetrics.requests.failed = costStats.total.requests - this.performanceMetrics.requests.successful;
  }

  // Cleanup method
  async shutdown(): Promise<void> {
    logger.info('Shutting down Monitoring Manager...');
    
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }
    
    this.alerts.clear();
    
    logger.info('Monitoring Manager shutdown complete');
  }
}
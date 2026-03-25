import Bull, { Queue, Job, JobOptions } from 'bull';
import { logger } from '../utils/logger';
import { LLMManager, TranslationRequest, LLMResponse } from './LLMManager';
import { TemplateManager } from './TemplateManager';
import { getDatabaseOperations } from '../database/connection';
import { v4 as uuidv4 } from 'uuid';

export interface QueueConfig {
  redis: {
    host: string;
    port: number;
    password?: string;
    db?: number;
  };
  concurrency: {
    high: number;
    normal: number;
    low: number;
  };
  retry: {
    attempts: number;
    backoff: {
      type: 'fixed' | 'exponential';
      delay: number;
    };
  };
  cleanup: {
    maxAge: number; // milliseconds
    maxCount: number;
  };
}

export interface TranslationJobData {
  id: string;
  organizationId: string;
  projectId: string;
  userId: string;
  templateId?: string;
  request: TranslationRequest;
  priority: 'high' | 'normal' | 'low';
  callbackUrl?: string;
  metadata: {
    source: string;
    tags: string[];
    estimatedCost: number;
    estimatedTime: number;
  };
}

export interface QueueMetrics {
  queues: {
    high: QueueStats;
    normal: QueueStats;
    low: QueueStats;
  };
  workers: {
    active: number;
    total: number;
    utilization: number;
  };
  jobs: {
    total: number;
    completed: number;
    failed: number;
    active: number;
    waiting: number;
    delayed: number;
  };
  performance: {
    averageProcessingTime: number;
    throughputPerMinute: number;
    errorRate: number;
  };
}

export interface QueueStats {
  active: number;
  waiting: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: boolean;
}

export interface JobResult {
  success: boolean;
  response?: LLMResponse;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  metrics: {
    queueTime: number;
    processingTime: number;
    totalTime: number;
    cost: number;
    tokensUsed: number;
  };
  metadata: {
    provider: string;
    model: string;
    retryCount: number;
    finalAttempt: boolean;
  };
}

export class QueueManager {
  private config: QueueConfig;
  private queues: Map<string, Queue> = new Map();
  private llmManager: LLMManager;
  private templateManager: TemplateManager;
  private metrics: Map<string, any> = new Map();
  private isInitialized = false;

  constructor(config: QueueConfig, llmManager: LLMManager, templateManager: TemplateManager) {
    this.config = config;
    this.llmManager = llmManager;
    this.templateManager = templateManager;
  }

  async initialize(): Promise<void> {
    try {
      // Create priority queues
      await this.createQueues();
      
      // Setup job processors
      await this.setupProcessors();
      
      // Setup monitoring and cleanup
      await this.setupMonitoring();
      await this.setupCleanup();
      
      this.isInitialized = true;
      
      logger.info('Queue Manager initialized successfully', {
        queues: Array.from(this.queues.keys()),
        concurrency: this.config.concurrency
      });

    } catch (error) {
      logger.error('Failed to initialize Queue Manager', { error: error.message });
      throw error;
    }
  }

  async submitJob(jobData: TranslationJobData, options?: JobOptions): Promise<string> {
    if (!this.isInitialized) {
      throw new Error('Queue Manager not initialized');
    }

    try {
      const queue = this.queues.get(jobData.priority);
      if (!queue) {
        throw new Error(`Queue for priority ${jobData.priority} not found`);
      }

      // Prepare job options
      const jobOptions: JobOptions = {
        delay: options?.delay || 0,
        attempts: options?.attempts || this.config.retry.attempts,
        backoff: options?.backoff || this.config.retry.backoff,
        removeOnComplete: this.config.cleanup.maxCount,
        removeOnFail: this.config.cleanup.maxCount,
        jobId: jobData.id,
        ...options
      };

      // Add job to queue
      const job = await queue.add('translation', jobData, jobOptions);

      // Update database status
      const dbOps = getDatabaseOperations();
      await dbOps.updateTranslationJob(jobData.id, {
        status: 'queued',
        queuedAt: new Date()
      });

      logger.info('Translation job queued', {
        jobId: jobData.id,
        priority: jobData.priority,
        queuePosition: await queue.count()
      });

      return job.id?.toString() || jobData.id;

    } catch (error) {
      logger.error('Failed to submit job to queue', {
        jobId: jobData.id,
        error: error.message
      });
      throw error;
    }
  }

  async getJobStatus(jobId: string): Promise<{
    status: string;
    progress: number;
    result?: JobResult;
    logs: string[];
  } | null> {
    try {
      // Check all queues for the job
      for (const [priority, queue] of this.queues.entries()) {
        const job = await queue.getJob(jobId);
        if (job) {
          const logs = job.opts.removeOnComplete ? [] : await job.getState();
          
          return {
            status: await job.getState(),
            progress: job.progress(),
            result: job.returnvalue as JobResult,
            logs: Array.isArray(logs) ? logs : [logs?.toString() || '']
          };
        }
      }

      return null;

    } catch (error) {
      logger.error('Failed to get job status', { jobId, error: error.message });
      return null;
    }
  }

  async cancelJob(jobId: string): Promise<boolean> {
    try {
      // Find and cancel job in all queues
      for (const [priority, queue] of this.queues.entries()) {
        const job = await queue.getJob(jobId);
        if (job) {
          await job.remove();
          
          // Update database
          const dbOps = getDatabaseOperations();
          await dbOps.updateTranslationJob(jobId, {
            status: 'cancelled',
            completedAt: new Date()
          });

          logger.info('Job cancelled successfully', { jobId, priority });
          return true;
        }
      }

      return false;

    } catch (error) {
      logger.error('Failed to cancel job', { jobId, error: error.message });
      return false;
    }
  }

  async pauseQueue(priority: string): Promise<void> {
    const queue = this.queues.get(priority);
    if (!queue) {
      throw new Error(`Queue ${priority} not found`);
    }

    await queue.pause();
    logger.info('Queue paused', { priority });
  }

  async resumeQueue(priority: string): Promise<void> {
    const queue = this.queues.get(priority);
    if (!queue) {
      throw new Error(`Queue ${priority} not found`);
    }

    await queue.resume();
    logger.info('Queue resumed', { priority });
  }

  async getMetrics(): Promise<QueueMetrics> {
    try {
      const metrics: QueueMetrics = {
        queues: {
          high: await this.getQueueStats('high'),
          normal: await this.getQueueStats('normal'),
          low: await this.getQueueStats('low')
        },
        workers: {
          active: 0,
          total: 0,
          utilization: 0
        },
        jobs: {
          total: 0,
          completed: 0,
          failed: 0,
          active: 0,
          waiting: 0,
          delayed: 0
        },
        performance: {
          averageProcessingTime: this.metrics.get('avgProcessingTime') || 0,
          throughputPerMinute: this.metrics.get('throughputPerMinute') || 0,
          errorRate: this.metrics.get('errorRate') || 0
        }
      };

      // Aggregate queue stats
      for (const queueStats of Object.values(metrics.queues)) {
        metrics.jobs.active += queueStats.active;
        metrics.jobs.waiting += queueStats.waiting;
        metrics.jobs.completed += queueStats.completed;
        metrics.jobs.failed += queueStats.failed;
        metrics.jobs.delayed += queueStats.delayed;
      }

      metrics.jobs.total = metrics.jobs.completed + metrics.jobs.failed + 
                          metrics.jobs.active + metrics.jobs.waiting;

      // Calculate worker metrics
      const totalConcurrency = Object.values(this.config.concurrency)
        .reduce((sum, c) => sum + c, 0);
      
      metrics.workers.total = totalConcurrency;
      metrics.workers.active = metrics.jobs.active;
      metrics.workers.utilization = metrics.workers.active / metrics.workers.total;

      return metrics;

    } catch (error) {
      logger.error('Failed to get queue metrics', { error: error.message });
      throw error;
    }
  }

  async retryFailedJobs(priority?: string, limit = 10): Promise<number> {
    try {
      let retriedCount = 0;
      const queuesToProcess = priority ? [priority] : ['high', 'normal', 'low'];

      for (const queueName of queuesToProcess) {
        const queue = this.queues.get(queueName);
        if (!queue) continue;

        const failedJobs = await queue.getFailed(0, limit);
        
        for (const job of failedJobs) {
          try {
            await job.retry();
            retriedCount++;
            
            logger.info('Job retried', { 
              jobId: job.id, 
              queue: queueName,
              attempt: job.attemptsMade + 1 
            });
            
          } catch (retryError) {
            logger.error('Failed to retry job', { 
              jobId: job.id, 
              error: retryError.message 
            });
          }
        }
      }

      return retriedCount;

    } catch (error) {
      logger.error('Failed to retry failed jobs', { error: error.message });
      return 0;
    }
  }

  async cleanupCompletedJobs(olderThanMs = this.config.cleanup.maxAge): Promise<number> {
    try {
      let cleanedCount = 0;
      const cutoffTime = Date.now() - olderThanMs;

      for (const [priority, queue] of this.queues.entries()) {
        const completed = await queue.getCompleted();
        
        for (const job of completed) {
          if (job.finishedOn && job.finishedOn < cutoffTime) {
            await job.remove();
            cleanedCount++;
          }
        }
      }

      logger.info('Cleanup completed', { jobsRemoved: cleanedCount });
      return cleanedCount;

    } catch (error) {
      logger.error('Failed to cleanup completed jobs', { error: error.message });
      return 0;
    }
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  private async createQueues(): Promise<void> {
    const priorities = ['high', 'normal', 'low'] as const;
    
    for (const priority of priorities) {
      const queue = new Bull(`translation-${priority}`, {
        redis: this.config.redis,
        defaultJobOptions: {
          removeOnComplete: this.config.cleanup.maxCount,
          removeOnFail: this.config.cleanup.maxCount
        }
      });

      // Setup error handling
      queue.on('error', (error) => {
        logger.error(`Queue ${priority} error`, { error: error.message });
      });

      queue.on('waiting', (jobId) => {
        logger.debug(`Job waiting in ${priority} queue`, { jobId });
      });

      queue.on('active', (job) => {
        logger.info(`Job started processing`, { 
          jobId: job.id, 
          priority,
          attempt: job.attemptsMade + 1
        });
      });

      queue.on('completed', (job, result) => {
        logger.info(`Job completed successfully`, { 
          jobId: job.id, 
          priority,
          duration: job.finishedOn ? job.finishedOn - job.processedOn! : 0
        });
        
        this.updateMetrics('completed', job, result);
      });

      queue.on('failed', (job, error) => {
        logger.error(`Job failed`, { 
          jobId: job.id, 
          priority,
          attempt: job.attemptsMade,
          error: error.message
        });
        
        this.updateMetrics('failed', job, error);
      });

      this.queues.set(priority, queue);
    }
  }

  private async setupProcessors(): Promise<void> {
    // High priority queue - more workers, faster processing
    const highQueue = this.queues.get('high')!;
    highQueue.process('translation', this.config.concurrency.high, this.processTranslationJob.bind(this));

    // Normal priority queue
    const normalQueue = this.queues.get('normal')!;
    normalQueue.process('translation', this.config.concurrency.normal, this.processTranslationJob.bind(this));

    // Low priority queue
    const lowQueue = this.queues.get('low')!;
    lowQueue.process('translation', this.config.concurrency.low, this.processTranslationJob.bind(this));
  }

  private async processTranslationJob(job: Job<TranslationJobData>): Promise<JobResult> {
    const startTime = Date.now();
    const jobData = job.data;
    
    try {
      // Update progress
      await job.progress(10);

      // Update database status
      const dbOps = getDatabaseOperations();
      await dbOps.updateTranslationJob(jobData.id, {
        status: 'processing',
        startedAt: new Date()
      });

      await job.progress(20);

      // Prepare translation request
      let translationRequest = jobData.request;

      // Apply template if specified
      if (jobData.templateId) {
        const template = await this.templateManager.getTemplate(jobData.templateId);
        if (template) {
          translationRequest = {
            ...translationRequest,
            templateId: jobData.templateId,
            systemPrompt: template.systemPrompt,
            userPrompt: template.userPromptTemplate
          };
        }
      }

      await job.progress(30);

      // Execute translation
      const queueTime = startTime - (job.opts.delay || 0);
      const response = await this.llmManager.generateTranslation(translationRequest);

      await job.progress(80);

      // Calculate metrics
      const processingTime = Date.now() - startTime;
      const totalTime = queueTime + processingTime;

      // Update database with results
      await dbOps.updateTranslationJob(jobData.id, {
        status: 'completed',
        completedAt: new Date(),
        outputText: response.content,
        outputTokensUsed: response.usage.completionTokens,
        inputTokensUsed: response.usage.promptTokens,
        actualCostUsd: response.cost,
        processingTimeMs: processingTime
      });

      await job.progress(90);

      // Send webhook if configured
      if (jobData.callbackUrl) {
        await this.sendWebhook(jobData.callbackUrl, {
          jobId: jobData.id,
          status: 'completed',
          result: response
        });
      }

      await job.progress(100);

      const result: JobResult = {
        success: true,
        response,
        metrics: {
          queueTime,
          processingTime,
          totalTime,
          cost: response.cost,
          tokensUsed: response.usage.totalTokens
        },
        metadata: {
          provider: response.provider,
          model: response.model,
          retryCount: job.attemptsMade,
          finalAttempt: job.attemptsMade >= (job.opts.attempts || 1) - 1
        }
      };

      return result;

    } catch (error) {
      // Update database with error
      const dbOps = getDatabaseOperations();
      await dbOps.updateTranslationJob(jobData.id, {
        status: 'failed',
        completedAt: new Date(),
        errorMessage: error.message,
        errorCode: error.code || 'PROCESSING_ERROR',
        retryCount: job.attemptsMade
      });

      // Send webhook for failure
      if (jobData.callbackUrl) {
        await this.sendWebhook(jobData.callbackUrl, {
          jobId: jobData.id,
          status: 'failed',
          error: {
            message: error.message,
            code: error.code || 'PROCESSING_ERROR'
          }
        });
      }

      const result: JobResult = {
        success: false,
        error: {
          code: error.code || 'PROCESSING_ERROR',
          message: error.message,
          details: error.details
        },
        metrics: {
          queueTime: startTime - (job.opts.delay || 0),
          processingTime: Date.now() - startTime,
          totalTime: Date.now() - (job.opts.delay || 0),
          cost: 0,
          tokensUsed: 0
        },
        metadata: {
          provider: jobData.request.targetLLM,
          model: 'unknown',
          retryCount: job.attemptsMade,
          finalAttempt: job.attemptsMade >= (job.opts.attempts || 1) - 1
        }
      };

      // Only throw if this is the final attempt
      if (result.metadata.finalAttempt) {
        throw error;
      }

      return result;
    }
  }

  private async getQueueStats(priority: string): Promise<QueueStats> {
    const queue = this.queues.get(priority);
    if (!queue) {
      return { active: 0, waiting: 0, completed: 0, failed: 0, delayed: 0, paused: false };
    }

    const [active, waiting, completed, failed, delayed] = await Promise.all([
      queue.getActive(),
      queue.getWaiting(),
      queue.getCompleted(),
      queue.getFailed(),
      queue.getDelayed()
    ]);

    return {
      active: active.length,
      waiting: waiting.length,
      completed: completed.length,
      failed: failed.length,
      delayed: delayed.length,
      paused: await queue.isPaused()
    };
  }

  private updateMetrics(event: 'completed' | 'failed', job: Job, data: any): void {
    // Update processing time metrics
    if (job.finishedOn && job.processedOn) {
      const processingTime = job.finishedOn - job.processedOn;
      const currentAvg = this.metrics.get('avgProcessingTime') || 0;
      const currentCount = this.metrics.get('processedCount') || 0;
      
      const newAvg = (currentAvg * currentCount + processingTime) / (currentCount + 1);
      this.metrics.set('avgProcessingTime', newAvg);
      this.metrics.set('processedCount', currentCount + 1);
    }

    // Update throughput (jobs per minute)
    const now = Date.now();
    const windowStart = now - 60000; // 1 minute window
    
    let recentJobs = this.metrics.get('recentJobs') || [];
    recentJobs = recentJobs.filter((timestamp: number) => timestamp > windowStart);
    recentJobs.push(now);
    
    this.metrics.set('recentJobs', recentJobs);
    this.metrics.set('throughputPerMinute', recentJobs.length);

    // Update error rate
    const errorCount = this.metrics.get('errorCount') || 0;
    const totalCount = this.metrics.get('totalCount') || 0;
    
    if (event === 'failed') {
      this.metrics.set('errorCount', errorCount + 1);
    }
    this.metrics.set('totalCount', totalCount + 1);
    
    const errorRate = (this.metrics.get('errorCount') || 0) / (this.metrics.get('totalCount') || 1);
    this.metrics.set('errorRate', errorRate);
  }

  private async setupMonitoring(): Promise<void> {
    // Setup periodic metrics collection
    setInterval(async () => {
      try {
        const metrics = await this.getMetrics();
        logger.debug('Queue metrics', metrics);
        
        // Could send to monitoring system here
      } catch (error) {
        logger.error('Failed to collect queue metrics', { error: error.message });
      }
    }, 30000); // Every 30 seconds
  }

  private async setupCleanup(): Promise<void> {
    // Setup periodic cleanup
    setInterval(async () => {
      try {
        await this.cleanupCompletedJobs();
      } catch (error) {
        logger.error('Failed to perform periodic cleanup', { error: error.message });
      }
    }, 3600000); // Every hour
  }

  private async sendWebhook(url: string, payload: any): Promise<void> {
    try {
      const axios = require('axios');
      await axios.post(url, payload, {
        timeout: 5000,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Imagineer-Translation-Engine/1.0'
        }
      });
      
      logger.debug('Webhook sent successfully', { url });
    } catch (error) {
      logger.error('Failed to send webhook', { url, error: error.message });
    }
  }

  // Cleanup method
  async shutdown(): Promise<void> {
    logger.info('Shutting down Queue Manager...');
    
    try {
      // Close all queues gracefully
      for (const [priority, queue] of this.queues.entries()) {
        await queue.close();
        logger.info(`Queue ${priority} closed`);
      }
      
      this.queues.clear();
      this.metrics.clear();
      
      logger.info('Queue Manager shutdown complete');
    } catch (error) {
      logger.error('Error during Queue Manager shutdown', { error: error.message });
    }
  }
}
import { createClient, RedisClientType } from 'redis';
import { EventEmitter } from 'events';
import { logger } from '../utils/logger';
import { ExportJob } from '../database/operations';

export interface QueueConfig {
  redis: {
    url?: string;
    host?: string;
    port?: number;
    password?: string;
    db?: number;
    maxRetries?: number;
    retryDelay?: number;
  };
  queue: {
    concurrency?: number;
    maxJobs?: number;
    defaultPriority?: number;
    jobTimeout?: number;
    cleanupInterval?: number;
    retentionTime?: number;
  };
}

export interface QueueJob {
  id: string;
  type: string;
  data: any;
  priority: number;
  attempts: number;
  maxAttempts: number;
  delay?: number;
  timeout?: number;
  createdAt: Date;
  processedAt?: Date;
  completedAt?: Date;
  failedAt?: Date;
  error?: string;
  result?: any;
  progress?: number;
}

export interface QueueStats {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  totalProcessed: number;
  avgProcessingTime: number;
}

export interface JobProcessor {
  process(job: QueueJob): Promise<any>;
}

export class QueueManager extends EventEmitter {
  private redisClient: RedisClientType;
  private config: QueueConfig;
  private processors: Map<string, JobProcessor> = new Map();
  private activeJobs: Map<string, QueueJob> = new Map();
  private processingInterval?: NodeJS.Timeout;
  private cleanupInterval?: NodeJS.Timeout;
  private isShuttingDown = false;
  private initialized = false;

  constructor(config: QueueConfig) {
    super();
    this.config = {
      redis: {
        host: 'localhost',
        port: 6379,
        maxRetries: 3,
        retryDelay: 1000,
        ...config.redis
      },
      queue: {
        concurrency: 5,
        maxJobs: 1000,
        defaultPriority: 0,
        jobTimeout: 300000, // 5 minutes
        cleanupInterval: 60000, // 1 minute
        retentionTime: 86400000, // 24 hours
        ...config.queue
      }
    };

    this.setupRedisClient();
  }

  private setupRedisClient(): void {
    const redisConfig = this.config.redis;
    
    if (redisConfig.url) {
      this.redisClient = createClient({ url: redisConfig.url });
    } else {
      this.redisClient = createClient({
        socket: {
          host: redisConfig.host,
          port: redisConfig.port
        },
        password: redisConfig.password,
        database: redisConfig.db
      });
    }

    this.redisClient.on('error', (error) => {
      logger.error('Redis connection error', { error: error.message });
      this.emit('error', error);
    });

    this.redisClient.on('connect', () => {
      logger.info('Redis connected');
      this.emit('connect');
    });

    this.redisClient.on('ready', () => {
      logger.info('Redis ready');
      this.emit('ready');
    });

    this.redisClient.on('end', () => {
      logger.info('Redis connection ended');
      this.emit('disconnect');
    });
  }

  async initialize(): Promise<void> {
    try {
      await this.redisClient.connect();
      await this.setupQueues();
      this.startProcessing();
      this.startCleanup();
      this.initialized = true;
      
      logger.info('Queue Manager initialized', {
        concurrency: this.config.queue.concurrency,
        maxJobs: this.config.queue.maxJobs
      });
    } catch (error) {
      logger.error('Queue Manager initialization failed', { error: error.message });
      throw error;
    }
  }

  private async setupQueues(): Promise<void> {
    // Ensure required Redis keys exist
    const queueKey = this.getQueueKey('waiting');
    const exists = await this.redisClient.exists(queueKey);
    
    if (!exists) {
      await this.redisClient.zAdd(queueKey, []);
      logger.debug('Queue initialized', { queue: queueKey });
    }
  }

  async add(
    type: string,
    data: any,
    options: {
      priority?: number;
      delay?: number;
      timeout?: number;
      maxAttempts?: number;
      jobId?: string;
    } = {}
  ): Promise<string> {
    if (!this.initialized) {
      throw new Error('QueueManager not initialized');
    }

    const job: QueueJob = {
      id: options.jobId || this.generateJobId(),
      type,
      data,
      priority: options.priority ?? this.config.queue.defaultPriority!,
      attempts: 0,
      maxAttempts: options.maxAttempts || 3,
      delay: options.delay,
      timeout: options.timeout || this.config.queue.jobTimeout,
      createdAt: new Date()
    };

    try {
      // Store job data
      await this.redisClient.hSet(
        this.getJobKey(job.id),
        this.serializeJob(job)
      );

      // Add to appropriate queue
      if (job.delay && job.delay > 0) {
        const runAt = Date.now() + job.delay;
        await this.redisClient.zAdd(this.getQueueKey('delayed'), [{
          score: runAt,
          value: job.id
        }]);
        
        logger.debug('Job added to delayed queue', {
          jobId: job.id,
          type: job.type,
          delay: job.delay,
          runAt: new Date(runAt)
        });
      } else {
        await this.redisClient.zAdd(this.getQueueKey('waiting'), [{
          score: -job.priority, // Negative for high priority first
          value: job.id
        }]);
        
        logger.debug('Job added to waiting queue', {
          jobId: job.id,
          type: job.type,
          priority: job.priority
        });
      }

      this.emit('jobAdded', job);
      return job.id;
    } catch (error) {
      logger.error('Failed to add job to queue', {
        jobId: job.id,
        type: job.type,
        error: error.message
      });
      throw error;
    }
  }

  async remove(jobId: string): Promise<boolean> {
    if (!this.initialized) {
      throw new Error('QueueManager not initialized');
    }

    try {
      // Remove from all possible queues
      const queues = ['waiting', 'active', 'delayed', 'completed', 'failed'];
      const promises = queues.map(queue => 
        this.redisClient.zRem(this.getQueueKey(queue), jobId)
      );

      await Promise.all(promises);

      // Remove job data
      await this.redisClient.del(this.getJobKey(jobId));

      // Remove from active jobs if present
      this.activeJobs.delete(jobId);

      logger.debug('Job removed from queue', { jobId });
      this.emit('jobRemoved', jobId);
      
      return true;
    } catch (error) {
      logger.error('Failed to remove job from queue', {
        jobId,
        error: error.message
      });
      return false;
    }
  }

  async getJob(jobId: string): Promise<QueueJob | null> {
    if (!this.initialized) {
      throw new Error('QueueManager not initialized');
    }

    try {
      const jobData = await this.redisClient.hGetAll(this.getJobKey(jobId));
      
      if (Object.keys(jobData).length === 0) {
        return null;
      }

      return this.deserializeJob(jobData);
    } catch (error) {
      logger.error('Failed to get job', { jobId, error: error.message });
      throw error;
    }
  }

  async getStats(): Promise<QueueStats> {
    if (!this.initialized) {
      throw new Error('QueueManager not initialized');
    }

    try {
      const [waiting, active, completed, failed, delayed] = await Promise.all([
        this.redisClient.zCard(this.getQueueKey('waiting')),
        this.redisClient.zCard(this.getQueueKey('active')),
        this.redisClient.zCard(this.getQueueKey('completed')),
        this.redisClient.zCard(this.getQueueKey('failed')),
        this.redisClient.zCard(this.getQueueKey('delayed'))
      ]);

      const totalProcessed = completed + failed;
      
      // Calculate average processing time from completed jobs
      let avgProcessingTime = 0;
      if (completed > 0) {
        const recentCompleted = await this.redisClient.zRangeWithScores(
          this.getQueueKey('completed'),
          -10, // Last 10 jobs
          -1
        );
        
        if (recentCompleted.length > 0) {
          const times: number[] = [];
          for (const item of recentCompleted) {
            const job = await this.getJob(item.value);
            if (job && job.processedAt && job.completedAt) {
              times.push(job.completedAt.getTime() - job.processedAt.getTime());
            }
          }
          
          if (times.length > 0) {
            avgProcessingTime = times.reduce((sum, time) => sum + time, 0) / times.length;
          }
        }
      }

      return {
        waiting,
        active,
        completed,
        failed,
        delayed,
        totalProcessed,
        avgProcessingTime
      };
    } catch (error) {
      logger.error('Failed to get queue stats', { error: error.message });
      throw error;
    }
  }

  registerProcessor(type: string, processor: JobProcessor): void {
    this.processors.set(type, processor);
    logger.info('Job processor registered', { type });
  }

  unregisterProcessor(type: string): void {
    this.processors.delete(type);
    logger.info('Job processor unregistered', { type });
  }

  private startProcessing(): void {
    this.processingInterval = setInterval(async () => {
      if (this.isShuttingDown) return;
      
      try {
        await this.processDelayedJobs();
        await this.processWaitingJobs();
      } catch (error) {
        logger.error('Error in processing loop', { error: error.message });
      }
    }, 1000); // Check every second
  }

  private async processDelayedJobs(): Promise<void> {
    const now = Date.now();
    
    // Get delayed jobs that are ready to run
    const readyJobs = await this.redisClient.zRangeByScore(
      this.getQueueKey('delayed'),
      0,
      now
    );

    for (const jobId of readyJobs) {
      try {
        // Move from delayed to waiting
        await this.redisClient.zRem(this.getQueueKey('delayed'), jobId);
        
        const job = await this.getJob(jobId);
        if (job) {
          await this.redisClient.zAdd(this.getQueueKey('waiting'), [{
            score: -job.priority,
            value: jobId
          }]);
          
          logger.debug('Delayed job moved to waiting queue', { jobId });
        }
      } catch (error) {
        logger.error('Failed to process delayed job', {
          jobId,
          error: error.message
        });
      }
    }
  }

  private async processWaitingJobs(): Promise<void> {
    // Check if we have capacity for more jobs
    if (this.activeJobs.size >= this.config.queue.concurrency!) {
      return;
    }

    const availableSlots = this.config.queue.concurrency! - this.activeJobs.size;
    
    // Get next jobs to process (highest priority first)
    const nextJobs = await this.redisClient.zRange(
      this.getQueueKey('waiting'),
      0,
      availableSlots - 1
    );

    for (const jobId of nextJobs) {
      try {
        // Move job from waiting to active
        await this.redisClient.zRem(this.getQueueKey('waiting'), jobId);
        await this.redisClient.zAdd(this.getQueueKey('active'), [{
          score: Date.now(),
          value: jobId
        }]);

        const job = await this.getJob(jobId);
        if (job) {
          this.processJob(job);
        }
      } catch (error) {
        logger.error('Failed to start job processing', {
          jobId,
          error: error.message
        });
      }
    }
  }

  private async processJob(job: QueueJob): Promise<void> {
    this.activeJobs.set(job.id, job);
    
    // Update job status
    job.processedAt = new Date();
    job.attempts++;
    await this.updateJob(job);

    logger.info('Processing job', {
      jobId: job.id,
      type: job.type,
      attempt: job.attempts
    });

    this.emit('jobStarted', job);

    try {
      // Get processor for this job type
      const processor = this.processors.get(job.type);
      if (!processor) {
        throw new Error(`No processor registered for job type: ${job.type}`);
      }

      // Set up timeout
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Job timeout after ${job.timeout}ms`));
        }, job.timeout);
      });

      // Process the job with timeout
      const result = await Promise.race([
        processor.process(job),
        timeoutPromise
      ]);

      // Job completed successfully
      await this.completeJob(job, result);
    } catch (error) {
      // Job failed
      await this.failJob(job, error);
    } finally {
      this.activeJobs.delete(job.id);
    }
  }

  private async completeJob(job: QueueJob, result: any): Promise<void> {
    job.completedAt = new Date();
    job.result = result;
    job.progress = 100;

    try {
      // Remove from active queue
      await this.redisClient.zRem(this.getQueueKey('active'), job.id);
      
      // Add to completed queue
      await this.redisClient.zAdd(this.getQueueKey('completed'), [{
        score: Date.now(),
        value: job.id
      }]);

      // Update job data
      await this.updateJob(job);

      logger.info('Job completed', {
        jobId: job.id,
        type: job.type,
        processingTime: job.completedAt.getTime() - job.processedAt!.getTime()
      });

      this.emit('jobCompleted', job, result);
    } catch (error) {
      logger.error('Failed to complete job', {
        jobId: job.id,
        error: error.message
      });
    }
  }

  private async failJob(job: QueueJob, error: Error): Promise<void> {
    job.failedAt = new Date();
    job.error = error.message;

    try {
      // Remove from active queue
      await this.redisClient.zRem(this.getQueueKey('active'), job.id);

      // Check if we should retry
      if (job.attempts < job.maxAttempts) {
        // Add back to waiting queue with exponential backoff
        const delay = Math.min(1000 * Math.pow(2, job.attempts), 30000); // Max 30 seconds
        const runAt = Date.now() + delay;
        
        await this.redisClient.zAdd(this.getQueueKey('delayed'), [{
          score: runAt,
          value: job.id
        }]);

        logger.warn('Job failed, retrying', {
          jobId: job.id,
          type: job.type,
          attempt: job.attempts,
          maxAttempts: job.maxAttempts,
          retryIn: delay
        });

        this.emit('jobRetry', job, error);
      } else {
        // Max attempts reached, move to failed queue
        await this.redisClient.zAdd(this.getQueueKey('failed'), [{
          score: Date.now(),
          value: job.id
        }]);

        logger.error('Job failed permanently', {
          jobId: job.id,
          type: job.type,
          attempts: job.attempts,
          error: error.message
        });

        this.emit('jobFailed', job, error);
      }

      // Update job data
      await this.updateJob(job);
    } catch (updateError) {
      logger.error('Failed to handle job failure', {
        jobId: job.id,
        originalError: error.message,
        updateError: updateError.message
      });
    }
  }

  private async updateJob(job: QueueJob): Promise<void> {
    await this.redisClient.hSet(
      this.getJobKey(job.id),
      this.serializeJob(job)
    );
  }

  private startCleanup(): void {
    this.cleanupInterval = setInterval(async () => {
      if (this.isShuttingDown) return;
      
      try {
        await this.cleanupOldJobs();
      } catch (error) {
        logger.error('Error in cleanup', { error: error.message });
      }
    }, this.config.queue.cleanupInterval);
  }

  private async cleanupOldJobs(): Promise<void> {
    const cutoff = Date.now() - this.config.queue.retentionTime!;
    
    // Clean up completed jobs older than retention time
    const oldCompleted = await this.redisClient.zRangeByScore(
      this.getQueueKey('completed'),
      0,
      cutoff
    );

    // Clean up failed jobs older than retention time
    const oldFailed = await this.redisClient.zRangeByScore(
      this.getQueueKey('failed'),
      0,
      cutoff
    );

    const oldJobs = [...oldCompleted, ...oldFailed];
    
    if (oldJobs.length > 0) {
      // Remove from queues
      await Promise.all([
        this.redisClient.zRem(this.getQueueKey('completed'), oldCompleted),
        this.redisClient.zRem(this.getQueueKey('failed'), oldFailed)
      ]);

      // Remove job data
      const jobKeys = oldJobs.map(jobId => this.getJobKey(jobId));
      if (jobKeys.length > 0) {
        await this.redisClient.del(jobKeys);
      }

      logger.debug('Cleaned up old jobs', { count: oldJobs.length });
    }
  }

  async shutdown(): Promise<void> {
    this.isShuttingDown = true;

    logger.info('Shutting down Queue Manager...');

    // Stop processing new jobs
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
    }

    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    // Wait for active jobs to complete (with timeout)
    const shutdownTimeout = 30000; // 30 seconds
    const startTime = Date.now();

    while (this.activeJobs.size > 0 && (Date.now() - startTime) < shutdownTimeout) {
      logger.info(`Waiting for ${this.activeJobs.size} active jobs to complete...`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    if (this.activeJobs.size > 0) {
      logger.warn(`Forcing shutdown with ${this.activeJobs.size} active jobs remaining`);
    }

    // Close Redis connection
    await this.redisClient.quit();
    
    logger.info('Queue Manager shutdown complete');
  }

  // Utility methods
  private generateJobId(): string {
    return `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private getQueueKey(queue: string): string {
    return `imagineer:export:queue:${queue}`;
  }

  private getJobKey(jobId: string): string {
    return `imagineer:export:job:${jobId}`;
  }

  private serializeJob(job: QueueJob): Record<string, string> {
    return {
      id: job.id,
      type: job.type,
      data: JSON.stringify(job.data),
      priority: job.priority.toString(),
      attempts: job.attempts.toString(),
      maxAttempts: job.maxAttempts.toString(),
      delay: job.delay?.toString() || '',
      timeout: job.timeout?.toString() || '',
      createdAt: job.createdAt.toISOString(),
      processedAt: job.processedAt?.toISOString() || '',
      completedAt: job.completedAt?.toISOString() || '',
      failedAt: job.failedAt?.toISOString() || '',
      error: job.error || '',
      result: job.result ? JSON.stringify(job.result) : '',
      progress: job.progress?.toString() || '0'
    };
  }

  private deserializeJob(data: Record<string, string>): QueueJob {
    return {
      id: data.id,
      type: data.type,
      data: JSON.parse(data.data),
      priority: parseInt(data.priority),
      attempts: parseInt(data.attempts),
      maxAttempts: parseInt(data.maxAttempts),
      delay: data.delay ? parseInt(data.delay) : undefined,
      timeout: data.timeout ? parseInt(data.timeout) : undefined,
      createdAt: new Date(data.createdAt),
      processedAt: data.processedAt ? new Date(data.processedAt) : undefined,
      completedAt: data.completedAt ? new Date(data.completedAt) : undefined,
      failedAt: data.failedAt ? new Date(data.failedAt) : undefined,
      error: data.error || undefined,
      result: data.result ? JSON.parse(data.result) : undefined,
      progress: data.progress ? parseInt(data.progress) : 0
    };
  }

  // Health check
  async healthCheck(): Promise<boolean> {
    try {
      await this.redisClient.ping();
      return true;
    } catch (error) {
      logger.error('Queue health check failed', { error: error.message });
      return false;
    }
  }

  // Progress tracking
  async updateJobProgress(jobId: string, progress: number): Promise<void> {
    const job = this.activeJobs.get(jobId);
    if (job) {
      job.progress = Math.max(0, Math.min(100, progress));
      await this.updateJob(job);
      this.emit('jobProgress', job, progress);
    }
  }

  // Bulk operations
  async addBatch(jobs: Array<{
    type: string;
    data: any;
    options?: {
      priority?: number;
      delay?: number;
      timeout?: number;
      maxAttempts?: number;
    };
  }>): Promise<string[]> {
    const jobIds: string[] = [];
    
    for (const jobData of jobs) {
      const jobId = await this.add(jobData.type, jobData.data, jobData.options);
      jobIds.push(jobId);
    }
    
    return jobIds;
  }

  async pause(): Promise<void> {
    this.isShuttingDown = true;
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
    }
    logger.info('Queue processing paused');
  }

  async resume(): Promise<void> {
    this.isShuttingDown = false;
    this.startProcessing();
    logger.info('Queue processing resumed');
  }
}

export default QueueManager;
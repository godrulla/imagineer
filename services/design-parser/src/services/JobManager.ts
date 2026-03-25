import { v4 as uuidv4 } from 'uuid';
import { getRedisClient } from '../cache/redis';
import { logger } from '../utils/logger';
import { ProcessingError } from '../middleware/errorHandler';

export interface Job {
  id: string;
  type: JobType;
  payload: any;
  status: JobStatus;
  priority: JobPriority;
  createdAt: Date;
  updatedAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  result?: any;
  error?: string;
  progress?: number;
  estimatedCompletion?: Date;
  attempts?: number;
  maxAttempts?: number;
  retryDelay?: number;
  timeout?: number;
  metadata?: any;
}

export type JobType = 
  | 'analyze_design' 
  | 'extract_elements' 
  | 'sync_figma_file' 
  | 'process_upload'
  | 'generate_thumbnails'
  | 'extract_assets'
  | 'validate_design'
  | 'batch_analysis';

export type JobStatus = 
  | 'queued'
  | 'processing' 
  | 'completed' 
  | 'failed'
  | 'cancelled'
  | 'timeout'
  | 'retrying';

export type JobPriority = 'low' | 'normal' | 'high' | 'critical';

export interface JobMetrics {
  totalJobs: number;
  queuedJobs: number;
  processingJobs: number;
  completedJobs: number;
  failedJobs: number;
  averageProcessingTime: number;
  successRate: number;
}

export class JobManager {
  private redis = getRedisClient();
  private jobPrefix = 'job:';
  private queueKey = 'job_queue';
  private metricsKey = 'job_metrics';

  async createJob(jobData: {
    type: string;
    payload: any;
    priority?: 'low' | 'normal' | 'high';
  }): Promise<Job> {
    const job: Job = {
      id: uuidv4(),
      type: jobData.type,
      payload: jobData.payload,
      status: 'queued',
      priority: jobData.priority || 'normal',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    try {
      // Store job data
      await this.redis.setEx(
        `${this.jobPrefix}${job.id}`,
        3600, // 1 hour TTL
        JSON.stringify(job)
      );

      // Add to queue with priority
      const priority = this.getPriorityScore(job.priority);
      await this.redis.zAdd(this.queueKey, {
        score: priority,
        value: job.id
      });

      // Update metrics
      await this.incrementMetric('totalJobs');
      await this.incrementMetric('queuedJobs');

      logger.info('Job created', {
        jobId: job.id,
        type: job.type,
        priority: job.priority
      });

      return job;

    } catch (error) {
      logger.error('Failed to create job', {
        error: error.message,
        jobData
      });
      throw error;
    }
  }

  async getJob(jobId: string): Promise<Job | null> {
    try {
      const jobData = await this.redis.get(`${this.jobPrefix}${jobId}`);
      if (!jobData) return null;

      return JSON.parse(jobData);
    } catch (error) {
      logger.error('Failed to get job', {
        jobId,
        error: error.message
      });
      return null;
    }
  }

  async updateJobStatus(
    jobId: string, 
    status: Job['status'],
    updates: Partial<Job> = {}
  ): Promise<void> {
    try {
      const job = await this.getJob(jobId);
      if (!job) {
        throw new Error(`Job ${jobId} not found`);
      }

      const updatedJob: Job = {
        ...job,
        ...updates,
        status,
        updatedAt: new Date()
      };

      // Set status-specific timestamps
      if (status === 'processing' && !job.startedAt) {
        updatedJob.startedAt = new Date();
        await this.decrementMetric('queuedJobs');
        await this.incrementMetric('processingJobs');
      } else if (status === 'completed') {
        updatedJob.completedAt = new Date();
        await this.decrementMetric('processingJobs');
        await this.incrementMetric('completedJobs');
        
        // Calculate processing time
        if (updatedJob.startedAt) {
          const processingTime = updatedJob.completedAt.getTime() - updatedJob.startedAt.getTime();
          await this.updateAverageProcessingTime(processingTime);
        }
      } else if (status === 'failed') {
        updatedJob.completedAt = new Date();
        await this.decrementMetric('processingJobs');
        await this.incrementMetric('failedJobs');
      }

      // Store updated job
      await this.redis.setEx(
        `${this.jobPrefix}${jobId}`,
        3600,
        JSON.stringify(updatedJob)
      );

      logger.info('Job status updated', {
        jobId,
        status,
        previousStatus: job.status
      });

    } catch (error) {
      logger.error('Failed to update job status', {
        jobId,
        status,
        error: error.message
      });
      throw error;
    }
  }

  async completeJob(jobId: string, result: any): Promise<void> {
    await this.updateJobStatus(jobId, 'completed', { result });
  }

  async failJob(jobId: string, error: string): Promise<void> {
    await this.updateJobStatus(jobId, 'failed', { error });
  }

  async updateJobProgress(jobId: string, progress: number): Promise<void> {
    try {
      const job = await this.getJob(jobId);
      if (!job) return;

      const updates: Partial<Job> = { progress };

      // Estimate completion time based on progress
      if (progress > 0 && job.startedAt) {
        const elapsed = Date.now() - job.startedAt.getTime();
        const totalEstimated = elapsed / (progress / 100);
        const remaining = totalEstimated - elapsed;
        updates.estimatedCompletion = new Date(Date.now() + remaining);
      }

      await this.updateJobStatus(jobId, job.status, updates);

    } catch (error) {
      logger.error('Failed to update job progress', {
        jobId,
        progress,
        error: error.message
      });
    }
  }

  async getNextJob(): Promise<Job | null> {
    try {
      // Get highest priority job from queue
      const result = await this.redis.zPopMax(this.queueKey);
      if (!result) return null;

      const jobId = result.value;
      const job = await this.getJob(jobId);
      
      if (job && job.status === 'queued') {
        await this.updateJobStatus(jobId, 'processing');
        return await this.getJob(jobId); // Return updated job
      }

      return null;
    } catch (error) {
      logger.error('Failed to get next job', {
        error: error.message
      });
      return null;
    }
  }

  async getMetrics(): Promise<JobMetrics> {
    try {
      const metrics = await this.redis.hGetAll(this.metricsKey);
      
      const totalJobs = parseInt(metrics.totalJobs || '0');
      const completedJobs = parseInt(metrics.completedJobs || '0');
      const failedJobs = parseInt(metrics.failedJobs || '0');
      
      return {
        totalJobs,
        queuedJobs: parseInt(metrics.queuedJobs || '0'),
        processingJobs: parseInt(metrics.processingJobs || '0'),
        completedJobs,
        failedJobs,
        averageProcessingTime: parseFloat(metrics.averageProcessingTime || '0'),
        successRate: totalJobs > 0 ? (completedJobs / totalJobs) * 100 : 0
      };
    } catch (error) {
      logger.error('Failed to get job metrics', {
        error: error.message
      });
      return {
        totalJobs: 0,
        queuedJobs: 0,
        processingJobs: 0,
        completedJobs: 0,
        failedJobs: 0,
        averageProcessingTime: 0,
        successRate: 0
      };
    }
  }

  async cleanupExpiredJobs(): Promise<void> {
    // This would run periodically to clean up old job data
    // Implementation would scan for expired jobs and remove them
    logger.info('Job cleanup completed');
  }

  private getPriorityScore(priority: Job['priority']): number {
    switch (priority) {
      case 'high': return Date.now() + 1000000; // Process first
      case 'normal': return Date.now();
      case 'low': return Date.now() - 1000000; // Process last
      default: return Date.now();
    }
  }

  private async incrementMetric(metric: string): Promise<void> {
    await this.redis.hIncrBy(this.metricsKey, metric, 1);
  }

  private async decrementMetric(metric: string): Promise<void> {
    await this.redis.hIncrBy(this.metricsKey, metric, -1);
  }

  private async updateAverageProcessingTime(processingTime: number): Promise<void> {
    const metrics = await this.getMetrics();
    const currentAvg = metrics.averageProcessingTime;
    const completedJobs = metrics.completedJobs;
    
    // Calculate new moving average
    const newAvg = ((currentAvg * (completedJobs - 1)) + processingTime) / completedJobs;
    
    await this.redis.hSet(this.metricsKey, 'averageProcessingTime', newAvg.toString());
  }
}
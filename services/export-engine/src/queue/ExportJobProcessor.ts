import { JobProcessor, QueueJob } from './QueueManager';
import { ExportManager } from '../services/ExportManager';
import { exportDbOps } from '../database/operations';
import { logger } from '../utils/logger';

export interface ExportJobData {
  exportJobId: string;
  organizationId: string;
  userId: string;
  inputData: any;
  exportConfig: any;
  options: {
    format: string;
    template?: string;
    customSettings?: Record<string, any>;
    includeAssets?: boolean;
    includeInteractions?: boolean;
    target_platforms?: string[];
  };
}

export class ExportJobProcessor implements JobProcessor {
  constructor(private exportManager: ExportManager) {}

  async process(job: QueueJob): Promise<any> {
    const data = job.data as ExportJobData;
    
    logger.info('Processing export job', {
      jobId: job.id,
      exportJobId: data.exportJobId,
      format: data.options.format
    });

    try {
      // Update job status to processing
      await exportDbOps.updateExportJobStatus(
        data.exportJobId,
        'processing',
        { started_at: new Date() }
      );

      // Update progress
      await this.updateProgress(job.id, 10);

      // Generate export
      const result = await this.exportManager.generateExport(
        data.inputData,
        data.options,
        data.organizationId,
        data.userId,
        (progress) => this.updateProgress(job.id, 10 + (progress * 0.8)) // 10-90%
      );

      // Update progress
      await this.updateProgress(job.id, 95);

      // Update job status to completed
      await exportDbOps.updateExportJobStatus(
        data.exportJobId,
        'completed',
        { 
          completed_at: new Date(),
          processing_time_ms: Date.now() - job.processedAt!.getTime()
        }
      );

      // Update progress to 100%
      await this.updateProgress(job.id, 100);

      logger.info('Export job completed', {
        jobId: job.id,
        exportJobId: data.exportJobId,
        outputFiles: result.files?.length || 0
      });

      return {
        success: true,
        exportJobId: data.exportJobId,
        files: result.files,
        processingTime: Date.now() - job.processedAt!.getTime()
      };

    } catch (error) {
      logger.error('Export job failed', {
        jobId: job.id,
        exportJobId: data.exportJobId,
        error: error.message
      });

      // Update job status to failed
      await exportDbOps.updateExportJobStatus(
        data.exportJobId,
        'failed',
        { 
          error_message: error.message,
          error_code: error.code || 'EXPORT_ERROR'
        }
      );

      throw error;
    }
  }

  private async updateProgress(jobId: string, progress: number): Promise<void> {
    // This would be called by the QueueManager
    // For now, just log it
    logger.debug('Export job progress', { jobId, progress });
  }
}

export class BatchExportJobProcessor implements JobProcessor {
  constructor(private exportManager: ExportManager) {}

  async process(job: QueueJob): Promise<any> {
    const data = job.data as {
      batchId: string;
      organizationId: string;
      userId: string;
      exports: ExportJobData[];
      packageOptions?: {
        name?: string;
        compression?: string;
        includeManifest?: boolean;
      };
    };

    logger.info('Processing batch export job', {
      jobId: job.id,
      batchId: data.batchId,
      exportCount: data.exports.length
    });

    try {
      const results: any[] = [];
      const totalExports = data.exports.length;

      // Process each export
      for (let i = 0; i < data.exports.length; i++) {
        const exportData = data.exports[i];
        
        logger.debug('Processing batch export item', {
          batchId: data.batchId,
          item: i + 1,
          total: totalExports,
          exportJobId: exportData.exportJobId
        });

        try {
          // Update job status to processing
          await exportDbOps.updateExportJobStatus(
            exportData.exportJobId,
            'processing'
          );

          // Generate export
          const result = await this.exportManager.generateExport(
            exportData.inputData,
            exportData.options,
            data.organizationId,
            data.userId
          );

          // Update job status to completed
          await exportDbOps.updateExportJobStatus(
            exportData.exportJobId,
            'completed'
          );

          results.push({
            exportJobId: exportData.exportJobId,
            success: true,
            files: result.files
          });

        } catch (error) {
          logger.error('Batch export item failed', {
            batchId: data.batchId,
            exportJobId: exportData.exportJobId,
            error: error.message
          });

          // Update job status to failed
          await exportDbOps.updateExportJobStatus(
            exportData.exportJobId,
            'failed',
            { error_message: error.message }
          );

          results.push({
            exportJobId: exportData.exportJobId,
            success: false,
            error: error.message
          });
        }

        // Update overall progress
        const progress = ((i + 1) / totalExports) * 80; // 0-80%
        await this.updateProgress(job.id, progress);
      }

      // Create package if requested
      let packageResult = null;
      if (data.packageOptions) {
        logger.debug('Creating export package', { batchId: data.batchId });
        
        const successfulResults = results.filter(r => r.success);
        if (successfulResults.length > 0) {
          packageResult = await this.exportManager.createExportPackage(
            successfulResults,
            data.packageOptions,
            data.organizationId
          );
        }

        await this.updateProgress(job.id, 95);
      }

      await this.updateProgress(job.id, 100);

      const successCount = results.filter(r => r.success).length;
      const failureCount = results.filter(r => !r.success).length;

      logger.info('Batch export job completed', {
        jobId: job.id,
        batchId: data.batchId,
        total: totalExports,
        successful: successCount,
        failed: failureCount,
        hasPackage: !!packageResult
      });

      return {
        success: true,
        batchId: data.batchId,
        results,
        summary: {
          total: totalExports,
          successful: successCount,
          failed: failureCount
        },
        package: packageResult
      };

    } catch (error) {
      logger.error('Batch export job failed', {
        jobId: job.id,
        batchId: data.batchId,
        error: error.message
      });

      throw error;
    }
  }

  private async updateProgress(jobId: string, progress: number): Promise<void> {
    logger.debug('Batch export job progress', { jobId, progress });
  }
}

export class CleanupJobProcessor implements JobProcessor {
  constructor(private exportManager: ExportManager) {}

  async process(job: QueueJob): Promise<any> {
    const data = job.data as {
      organizationId: string;
      options: {
        olderThanDays: number;
        formatFilter?: string;
        sizeThresholdMb?: number;
        dryRun: boolean;
      };
    };

    logger.info('Processing cleanup job', {
      jobId: job.id,
      organizationId: data.organizationId,
      olderThanDays: data.options.olderThanDays,
      dryRun: data.options.dryRun
    });

    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - data.options.olderThanDays);

      // Get old export results
      const oldExports = await this.getOldExports(
        data.organizationId,
        cutoffDate,
        data.options
      );

      await this.updateProgress(job.id, 20);

      let deletedCount = 0;
      let deletedSize = 0;
      let errorCount = 0;

      if (!data.options.dryRun && oldExports.length > 0) {
        const totalItems = oldExports.length;
        
        for (let i = 0; i < oldExports.length; i++) {
          const exportResult = oldExports[i];
          
          try {
            // Delete from storage
            await this.exportManager.deleteExportResult(exportResult.id);
            
            deletedCount++;
            deletedSize += exportResult.content_size_bytes || 0;
            
            logger.debug('Deleted old export', {
              resultId: exportResult.id,
              filename: exportResult.file_name,
              size: exportResult.content_size_bytes
            });
            
          } catch (error) {
            errorCount++;
            logger.warn('Failed to delete old export', {
              resultId: exportResult.id,
              error: error.message
            });
          }

          // Update progress
          const progress = 20 + ((i + 1) / totalItems) * 75; // 20-95%
          await this.updateProgress(job.id, progress);
        }
      }

      await this.updateProgress(job.id, 100);

      const result = {
        success: true,
        organizationId: data.organizationId,
        cutoffDate: cutoffDate.toISOString(),
        found: oldExports.length,
        deleted: deletedCount,
        deletedSizeMb: Math.round(deletedSize / (1024 * 1024) * 100) / 100,
        errors: errorCount,
        dryRun: data.options.dryRun
      };

      logger.info('Cleanup job completed', result);
      return result;

    } catch (error) {
      logger.error('Cleanup job failed', {
        jobId: job.id,
        organizationId: data.organizationId,
        error: error.message
      });

      throw error;
    }
  }

  private async getOldExports(
    organizationId: string,
    cutoffDate: Date,
    options: {
      formatFilter?: string;
      sizeThresholdMb?: number;
    }
  ): Promise<any[]> {
    // This would query the database for old export results
    // For now, return empty array
    // In real implementation, this would use exportDbOps to query
    return [];
  }

  private async updateProgress(jobId: string, progress: number): Promise<void> {
    logger.debug('Cleanup job progress', { jobId, progress });
  }
}

export class ValidationJobProcessor implements JobProcessor {
  constructor(private exportManager: ExportManager) {}

  async process(job: QueueJob): Promise<any> {
    const data = job.data as {
      exportResultId: string;
      organizationId: string;
      validationRules: {
        format: string;
        accessibility?: boolean;
        performance?: boolean;
        codeQuality?: boolean;
        customRules?: any[];
      };
    };

    logger.info('Processing validation job', {
      jobId: job.id,
      exportResultId: data.exportResultId,
      format: data.validationRules.format
    });

    try {
      // Get the export result
      const exportResult = await this.exportManager.getExportResult(
        data.exportResultId,
        data.organizationId
      );

      if (!exportResult) {
        throw new Error(`Export result not found: ${data.exportResultId}`);
      }

      await this.updateProgress(job.id, 20);

      // Perform validation based on format and rules
      const validationResult = await this.exportManager.validateExport(
        exportResult,
        data.validationRules
      );

      await this.updateProgress(job.id, 80);

      // Update the export result with validation status
      await this.exportManager.updateExportValidation(
        data.exportResultId,
        validationResult
      );

      await this.updateProgress(job.id, 100);

      logger.info('Validation job completed', {
        jobId: job.id,
        exportResultId: data.exportResultId,
        passed: validationResult.passed,
        errorCount: validationResult.errors?.length || 0,
        warningCount: validationResult.warnings?.length || 0
      });

      return {
        success: true,
        exportResultId: data.exportResultId,
        validation: validationResult
      };

    } catch (error) {
      logger.error('Validation job failed', {
        jobId: job.id,
        exportResultId: data.exportResultId,
        error: error.message
      });

      throw error;
    }
  }

  private async updateProgress(jobId: string, progress: number): Promise<void> {
    logger.debug('Validation job progress', { jobId, progress });
  }
}
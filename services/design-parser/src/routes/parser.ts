import express from 'express';
import { validateRequest, schemas } from '../middleware/validation';
import { asyncHandler } from '../middleware/errorHandler';
import { DesignAnalyzer } from '../services/DesignAnalyzer';
import { ElementExtractor } from '../services/ElementExtractor';
import { JobManager } from '../services/JobManager';
import { logger } from '../utils/logger';

const router = express.Router();
const designAnalyzer = new DesignAnalyzer();
const elementExtractor = new ElementExtractor();
const jobManager = new JobManager();

/**
 * POST /api/v1/parser/analyze
 * Analyze a Figma design and extract visual elements
 */
router.post('/analyze', 
  validateRequest(schemas.analyzeDesign),
  asyncHandler(async (req: express.Request, res: express.Response) => {
    const { figmaFileId, nodeId, options } = req.body;
    const startTime = Date.now();

    logger.info('Design analysis request received', {
      figmaFileId,
      nodeId,
      options,
      ip: req.ip
    });

    // Create processing job
    const job = await jobManager.createJob({
      type: 'analyze_design',
      payload: { figmaFileId, nodeId, options },
      priority: options?.analysisDepth === 'comprehensive' ? 'high' : 'normal'
    });

    // Start async processing
    designAnalyzer.analyzeDesign(figmaFileId, nodeId, options)
      .then(result => {
        jobManager.completeJob(job.id, result);
        logger.info('Design analysis completed', {
          jobId: job.id,
          figmaFileId,
          duration: Date.now() - startTime,
          elementsFound: result.elements?.length || 0
        });
      })
      .catch(error => {
        jobManager.failJob(job.id, error.message);
        logger.error('Design analysis failed', {
          jobId: job.id,
          figmaFileId,
          error: error.message,
          duration: Date.now() - startTime
        });
      });

    res.status(202).json({
      jobId: job.id,
      status: 'processing',
      message: 'Design analysis started',
      estimatedTime: options?.analysisDepth === 'comprehensive' ? '60s' : '30s',
      statusUrl: `/api/v1/parser/status/${job.id}`
    });
  })
);

/**
 * POST /api/v1/parser/elements  
 * Extract UI elements from design data
 */
router.post('/elements',
  validateRequest(schemas.extractElements),
  asyncHandler(async (req: express.Request, res: express.Response) => {
    const { designData, options } = req.body;
    const startTime = Date.now();

    logger.info('Element extraction request received', {
      documentId: designData.document.id,
      documentName: designData.document.name,
      options,
      ip: req.ip
    });

    const result = await elementExtractor.extractElements(designData, options);

    logger.info('Element extraction completed', {
      documentId: designData.document.id,
      elementsExtracted: result.elements.length,
      confidence: result.averageConfidence,
      duration: Date.now() - startTime
    });

    res.json({
      success: true,
      data: {
        elements: result.elements,
        metadata: {
          totalElements: result.elements.length,
          averageConfidence: result.averageConfidence,
          processingTime: Date.now() - startTime,
          analysisDepth: options?.minConfidence ? 'custom' : 'standard'
        }
      }
    });
  })
);

/**
 * GET /api/v1/parser/status/:jobId
 * Get processing job status and results
 */
router.get('/status/:jobId',
  validateRequest(schemas.getJobStatus),
  asyncHandler(async (req: express.Request, res: express.Response) => {
    const { jobId } = req.params;

    const job = await jobManager.getJob(jobId);
    if (!job) {
      return res.status(404).json({
        error: {
          message: 'Job not found',
          jobId
        }
      });
    }

    const response: any = {
      jobId: job.id,
      status: job.status,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt
    };

    if (job.status === 'completed' && job.result) {
      response.data = job.result;
    } else if (job.status === 'failed' && job.error) {
      response.error = {
        message: job.error,
        type: 'processing_error'
      };
    } else if (job.status === 'processing') {
      response.estimatedCompletion = job.estimatedCompletion;
      response.progress = job.progress || 0;
    }

    res.json(response);
  })
);

/**
 * GET /api/v1/parser/metrics
 * Get service performance metrics
 */
router.get('/metrics', asyncHandler(async (req: express.Request, res: express.Response) => {
  const metrics = await jobManager.getMetrics();
  
  res.json({
    service: 'design-parser',
    version: '1.0.0',
    metrics: {
      jobs: metrics,
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      timestamp: new Date().toISOString()
    }
  });
}));

export default router;
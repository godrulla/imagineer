import express from 'express';
import { validateRequest } from '../middleware/validation';
import { asyncHandler } from '../middleware/errorHandler';
import { LLMManager, TranslationRequest, LLMProvider, OutputFormat, TranslationType } from '../services/LLMManager';
import { TemplateManager } from '../services/TemplateManager';
import { getDatabaseOperations } from '../database/connection';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

// ============================================================================
// HEALTH & STATUS ENDPOINTS
// ============================================================================

/**
 * GET /health - Health check endpoint
 */
router.get('/health',
  asyncHandler(async (req: express.Request, res: express.Response) => {
    const llmManager = req.llmManager;
    const templateManager = req.templateManager;
    const dbOps = getDatabaseOperations();

    const health = {
      status: 'healthy',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      uptime_seconds: process.uptime()
    };

    // Test LLM providers
    const llmHealthy = await llmManager.healthCheck();
    if (!llmHealthy) {
      health.status = 'degraded';
    }

    // Test database
    const dbHealthy = await dbOps.healthCheck();
    if (!dbHealthy) {
      health.status = 'unhealthy';
    }

    const statusCode = health.status === 'healthy' ? 200 : health.status === 'degraded' ? 200 : 503;
    res.status(statusCode).json(health);
  })
);

/**
 * GET /status - Detailed service status
 */
router.get('/status',
  asyncHandler(async (req: express.Request, res: express.Response) => {
    const llmManager = req.llmManager;
    const dbOps = getDatabaseOperations();

    const providers = llmManager.getAllProviderInfo();
    const connectionInfo = await dbOps.getConnectionInfo();
    const costStats = llmManager.getCostStatistics();

    const status = {
      status: 'healthy',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      llm_providers: providers.reduce((acc, provider) => {
        acc[provider.provider] = {
          status: provider.available ? 'healthy' : 'unhealthy',
          response_time_ms: 0, // Would be calculated from recent health checks
          last_check: provider.lastHealthCheck || new Date().toISOString()
        };
        return acc;
      }, {}),
      queue_status: {
        pending_jobs: 0, // Would be queried from database
        processing_jobs: providers.reduce((sum, p) => sum + p.currentLoad, 0),
        queue_depth: 0
      },
      metrics: {
        translations_per_minute: 0, // Would be calculated from recent activity
        average_processing_time_ms: 0,
        memory_usage_mb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        cpu_usage_percent: 0, // Would require additional monitoring
        database_connections: connectionInfo.totalConnections,
        total_cost_usd: costStats.total.cost,
        total_requests: costStats.total.requests
      }
    };

    // Determine overall status
    const unhealthyProviders = providers.filter(p => !p.available).length;
    const totalProviders = providers.length;

    if (unhealthyProviders === totalProviders) {
      status.status = 'unhealthy';
    } else if (unhealthyProviders > 0) {
      status.status = 'degraded';
    }

    res.json(status);
  })
);

// ============================================================================
// TRANSLATION TEMPLATES
// ============================================================================

/**
 * GET /templates - List translation templates
 */
router.get('/templates',
  asyncHandler(async (req: express.Request, res: express.Response) => {
    const templateManager = req.templateManager;
    
    const {
      page = 1,
      limit = 20,
      sort = 'created_at:desc',
      category,
      target_format,
      llm_provider,
      is_public,
      search
    } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = Math.min(parseInt(limit as string), 100);
    const offset = (pageNum - 1) * limitNum;

    const options = {
      category: category as string,
      outputFormat: target_format as OutputFormat,
      provider: llm_provider as LLMProvider,
      search: search as string,
      includeSystem: true,
      limit: limitNum,
      offset
    };

    const result = await templateManager.listTemplates(options);

    const response = {
      data: result.templates,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: result.total,
        pages: Math.ceil(result.total / limitNum),
        has_next: pageNum * limitNum < result.total,
        has_prev: pageNum > 1
      }
    };

    res.json(response);
  })
);

/**
 * POST /templates - Create translation template
 */
router.post('/templates',
  validateRequest({
    body: {
      name: { type: 'string', required: true, maxLength: 255 },
      description: { type: 'string', maxLength: 1000 },
      category: { type: 'string', maxLength: 100 },
      prompt_template: { type: 'string', required: true },
      system_prompt: { type: 'string' },
      example_input: { type: 'object' },
      example_output: { type: 'string' },
      target_format: { type: 'string', required: true, enum: ['markdown', 'json', 'yaml', 'html', 'text', 'xml', 'custom'] },
      llm_provider: { type: 'string', required: true, enum: ['openai_gpt4', 'openai_gpt35', 'anthropic_claude', 'google_gemini'] },
      model_version: { type: 'string', maxLength: 100 },
      max_tokens: { type: 'number', min: 100, max: 32000 },
      temperature: { type: 'number', min: 0, max: 2 },
      parameters: { type: 'object' },
      variables: { type: 'object' },
      is_public: { type: 'boolean' }
    }
  }),
  asyncHandler(async (req: express.Request, res: express.Response) => {
    const templateManager = req.templateManager;
    const dbOps = getDatabaseOperations();
    
    // Extract user info from headers or JWT (simplified for this example)
    const userId = req.headers['x-user-id'] as string || 'system';
    const organizationId = req.headers['x-organization-id'] as string || 'default';

    const templateData = {
      ...req.body,
      userPromptTemplate: req.body.prompt_template,
      outputFormat: req.body.target_format,
      provider: req.body.llm_provider,
      metadata: {
        description: req.body.description || '',
        category: req.body.category || 'general',
        tags: req.body.tags || [],
        author: userId,
        created: new Date(),
        updated: new Date()
      }
    };

    // Create in TemplateManager (in-memory)
    const template = await templateManager.createTemplate(templateData, userId);

    // Also store in database
    await dbOps.createTemplate({
      organizationId,
      name: template.name,
      description: template.metadata.description,
      category: template.metadata.category,
      promptTemplate: template.userPromptTemplate,
      systemPrompt: template.systemPrompt,
      exampleInput: req.body.example_input,
      exampleOutput: req.body.example_output,
      targetFormat: template.outputFormat,
      llmProvider: template.provider,
      modelVersion: req.body.model_version,
      maxTokens: req.body.max_tokens,
      temperature: req.body.temperature,
      parameters: req.body.parameters,
      variables: template.variables,
      isPublic: req.body.is_public,
      createdBy: userId
    });

    res.status(201).json(template);
  })
);

/**
 * GET /templates/:templateId - Get template details
 */
router.get('/templates/:templateId',
  asyncHandler(async (req: express.Request, res: express.Response) => {
    const templateManager = req.templateManager;
    const dbOps = getDatabaseOperations();
    const templateId = req.params.templateId;
    const organizationId = req.headers['x-organization-id'] as string;

    // Try to get from TemplateManager first
    let template = await templateManager.getTemplate(templateId);
    
    // If not found, try database
    if (!template) {
      const dbTemplate = await dbOps.getTemplate(templateId, organizationId);
      if (dbTemplate) {
        template = {
          id: dbTemplate.id,
          name: dbTemplate.name,
          systemPrompt: dbTemplate.system_prompt,
          userPromptTemplate: dbTemplate.prompt_template,
          variables: dbTemplate.variables,
          outputFormat: dbTemplate.target_format,
          provider: dbTemplate.llm_provider,
          version: dbTemplate.version,
          metadata: {
            description: dbTemplate.description,
            category: dbTemplate.category,
            tags: [],
            author: dbTemplate.created_by,
            created: dbTemplate.created_at,
            updated: dbTemplate.updated_at
          }
        };
      }
    }

    if (!template) {
      return res.status(404).json({
        error: {
          code: 'TEMPLATE_NOT_FOUND',
          message: 'Template not found'
        }
      });
    }

    // Get additional details
    const metrics = await templateManager.getTemplateMetrics(templateId);
    
    const templateDetail = {
      ...template,
      usage_stats: metrics ? {
        total_usage: metrics.usageCount,
        successful_runs: Math.round(metrics.usageCount * metrics.successRate),
        failed_runs: Math.round(metrics.usageCount * (1 - metrics.successRate)),
        average_rating: metrics.averageRating,
        last_used: metrics.lastUsed
      } : null,
      recent_jobs: [], // Would query from database
      version_history: [] // Would query from database
    };

    res.json(templateDetail);
  })
);

/**
 * PUT /templates/:templateId - Update template
 */
router.put('/templates/:templateId',
  validateRequest({
    body: {
      name: { type: 'string', maxLength: 255 },
      description: { type: 'string', maxLength: 1000 },
      category: { type: 'string', maxLength: 100 },
      prompt_template: { type: 'string' },
      system_prompt: { type: 'string' },
      example_input: { type: 'object' },
      example_output: { type: 'string' },
      target_format: { type: 'string', enum: ['markdown', 'json', 'yaml', 'html', 'text', 'xml', 'custom'] },
      llm_provider: { type: 'string', enum: ['openai_gpt4', 'openai_gpt35', 'anthropic_claude', 'google_gemini'] },
      model_version: { type: 'string', maxLength: 100 },
      max_tokens: { type: 'number', min: 100, max: 32000 },
      temperature: { type: 'number', min: 0, max: 2 },
      parameters: { type: 'object' },
      variables: { type: 'object' },
      is_public: { type: 'boolean' }
    }
  }),
  asyncHandler(async (req: express.Request, res: express.Response) => {
    const templateManager = req.templateManager;
    const dbOps = getDatabaseOperations();
    const templateId = req.params.templateId;
    const userId = req.headers['x-user-id'] as string || 'system';

    const updates = {
      ...req.body,
      userPromptTemplate: req.body.prompt_template,
      outputFormat: req.body.target_format,
      provider: req.body.llm_provider,
      metadata: {
        description: req.body.description,
        category: req.body.category,
        updated: new Date()
      }
    };

    // Update in TemplateManager
    const template = await templateManager.updateTemplate(templateId, updates, userId);
    
    if (!template) {
      return res.status(404).json({
        error: {
          code: 'TEMPLATE_NOT_FOUND',
          message: 'Template not found'
        }
      });
    }

    // Update in database
    await dbOps.updateTemplate(templateId, {
      name: req.body.name,
      description: req.body.description,
      category: req.body.category,
      promptTemplate: req.body.prompt_template,
      systemPrompt: req.body.system_prompt,
      exampleInput: req.body.example_input,
      exampleOutput: req.body.example_output,
      targetFormat: req.body.target_format,
      llmProvider: req.body.llm_provider,
      modelVersion: req.body.model_version,
      maxTokens: req.body.max_tokens,
      temperature: req.body.temperature,
      parameters: req.body.parameters,
      variables: req.body.variables,
      isPublic: req.body.is_public
    });

    res.json(template);
  })
);

/**
 * DELETE /templates/:templateId - Delete template
 */
router.delete('/templates/:templateId',
  asyncHandler(async (req: express.Request, res: express.Response) => {
    const templateManager = req.templateManager;
    const dbOps = getDatabaseOperations();
    const templateId = req.params.templateId;

    // Delete from TemplateManager
    const deleted = await templateManager.deleteTemplate(templateId);
    
    if (!deleted) {
      return res.status(404).json({
        error: {
          code: 'TEMPLATE_NOT_FOUND',
          message: 'Template not found'
        }
      });
    }

    // Soft delete in database
    await dbOps.deleteTemplate(templateId);

    res.status(204).send();
  })
);

/**
 * POST /templates/:templateId/test - Test template
 */
router.post('/templates/:templateId/test',
  validateRequest({
    body: {
      input_data: { type: 'object', required: true },
      context_data: { type: 'object' },
      override_params: { type: 'object' }
    }
  }),
  asyncHandler(async (req: express.Request, res: express.Response) => {
    const templateManager = req.templateManager;
    const templateId = req.params.templateId;

    const template = await templateManager.getTemplate(templateId);
    if (!template) {
      return res.status(404).json({
        error: {
          code: 'TEMPLATE_NOT_FOUND',
          message: 'Template not found'
        }
      });
    }

    const testResult = await templateManager.testTemplate(
      template,
      req.body.input_data,
      template.provider
    );

    const response = {
      success: testResult.success,
      result: testResult.success ? {
        id: uuidv4(),
        content: testResult.output,
        format: template.outputFormat,
        metadata: {
          template_id: templateId,
          test_mode: true
        },
        quality_score: testResult.metrics.qualityScore,
        tokens_used: testResult.metrics.tokenCount,
        processing_time_ms: testResult.metrics.responseTime,
        created_at: new Date().toISOString()
      } : null,
      validation_errors: testResult.errors || [],
      performance_metrics: {
        execution_time_ms: testResult.metrics.responseTime,
        tokens_used: testResult.metrics.tokenCount,
        cost_estimate_usd: testResult.metrics.cost
      }
    };

    res.json(response);
  })
);

/**
 * POST /templates/:templateId/clone - Clone template
 */
router.post('/templates/:templateId/clone',
  validateRequest({
    body: {
      name: { type: 'string', maxLength: 255 },
      description: { type: 'string', maxLength: 1000 },
      modifications: { type: 'object' }
    }
  }),
  asyncHandler(async (req: express.Request, res: express.Response) => {
    const templateManager = req.templateManager;
    const templateId = req.params.templateId;
    const userId = req.headers['x-user-id'] as string || 'system';

    const originalTemplate = await templateManager.getTemplate(templateId);
    if (!originalTemplate) {
      return res.status(404).json({
        error: {
          code: 'TEMPLATE_NOT_FOUND',
          message: 'Template not found'
        }
      });
    }

    const clonedTemplateData = {
      ...originalTemplate,
      name: req.body.name || `${originalTemplate.name} (Copy)`,
      metadata: {
        ...originalTemplate.metadata,
        description: req.body.description || originalTemplate.metadata.description,
        author: userId,
        created: new Date(),
        updated: new Date()
      },
      ...req.body.modifications
    };

    const clonedTemplate = await templateManager.createTemplate(clonedTemplateData, userId);

    res.status(201).json(clonedTemplate);
  })
);

// ============================================================================
// TRANSLATION JOBS
// ============================================================================

/**
 * GET /jobs - List translation jobs
 */
router.get('/jobs',
  asyncHandler(async (req: express.Request, res: express.Response) => {
    const dbOps = getDatabaseOperations();
    const organizationId = req.headers['x-organization-id'] as string;
    
    const {
      page = 1,
      limit = 20,
      sort = 'created_at:desc',
      project_id,
      status,
      llm_provider,
      translation_type
    } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = Math.min(parseInt(limit as string), 100);
    const offset = (pageNum - 1) * limitNum;

    const options = {
      organizationId,
      projectId: project_id as string,
      status: status as string,
      llmProvider: llm_provider as LLMProvider,
      translationType: translation_type as TranslationType,
      limit: limitNum,
      offset,
      orderBy: sort.includes(':') ? sort.split(':')[0] : 'created_at',
      orderDirection: sort.includes(':desc') ? 'DESC' as const : 'ASC' as const
    };

    const result = await dbOps.listTranslationJobs(options);

    const response = {
      data: result.jobs,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: result.total,
        pages: Math.ceil(result.total / limitNum),
        has_next: pageNum * limitNum < result.total,
        has_prev: pageNum > 1
      }
    };

    res.json(response);
  })
);

/**
 * POST /jobs - Create translation job
 */
router.post('/jobs',
  validateRequest({
    body: {
      project_id: { type: 'string', required: true, format: 'uuid' },
      design_file_id: { type: 'string', format: 'uuid' },
      parsed_design_id: { type: 'string', format: 'uuid' },
      template_id: { type: 'string', format: 'uuid' },
      job_name: { type: 'string', maxLength: 255 },
      translation_type: { type: 'string', required: true, enum: ['full', 'incremental', 'component', 'element', 'custom'] },
      llm_provider: { type: 'string', required: true, enum: ['openai_gpt4', 'openai_gpt35', 'anthropic_claude', 'google_gemini'] },
      model_version: { type: 'string', maxLength: 100 },
      system_prompt: { type: 'string' },
      user_prompt: { type: 'string', required: true },
      max_tokens: { type: 'number', min: 100, max: 32000 },
      temperature: { type: 'number', min: 0, max: 2 },
      top_p: { type: 'number', min: 0, max: 1 },
      frequency_penalty: { type: 'number', min: -2, max: 2 },
      presence_penalty: { type: 'number', min: -2, max: 2 },
      input_data: { type: 'object', required: true },
      context_data: { type: 'object' },
      priority: { type: 'number', min: 0, max: 10 },
      callback_url: { type: 'string', format: 'uri' }
    }
  }),
  asyncHandler(async (req: express.Request, res: express.Response) => {
    const dbOps = getDatabaseOperations();
    const organizationId = req.headers['x-organization-id'] as string || 'default';
    const userId = req.headers['x-user-id'] as string || 'system';

    const jobData = {
      organizationId,
      projectId: req.body.project_id,
      designFileId: req.body.design_file_id,
      parsedDesignId: req.body.parsed_design_id,
      templateId: req.body.template_id,
      jobName: req.body.job_name,
      translationType: req.body.translation_type,
      llmProvider: req.body.llm_provider,
      modelVersion: req.body.model_version || 'latest',
      systemPrompt: req.body.system_prompt,
      userPrompt: req.body.user_prompt,
      maxTokens: req.body.max_tokens,
      temperature: req.body.temperature,
      topP: req.body.top_p,
      frequencyPenalty: req.body.frequency_penalty,
      presencePenalty: req.body.presence_penalty,
      inputData: req.body.input_data,
      contextData: req.body.context_data,
      priority: req.body.priority,
      callbackUrl: req.body.callback_url,
      createdBy: userId
    };

    const jobId = await dbOps.createTranslationJob(jobData);

    // Queue the job for processing (in a real implementation, this would use a job queue)
    // For now, we'll return the job as created
    
    const job = await dbOps.getTranslationJob(jobId);

    res.status(201).json(job);
  })
);

/**
 * GET /jobs/:jobId - Get translation job details
 */
router.get('/jobs/:jobId',
  asyncHandler(async (req: express.Request, res: express.Response) => {
    const dbOps = getDatabaseOperations();
    const jobId = req.params.jobId;

    const job = await dbOps.getTranslationJob(jobId);
    
    if (!job) {
      return res.status(404).json({
        error: {
          code: 'JOB_NOT_FOUND',
          message: 'Translation job not found'
        }
      });
    }

    // Add additional details
    const jobDetail = {
      ...job,
      execution_logs: [], // Would query from logs table
      metrics: {
        queue_time_ms: job.queue_wait_time_ms,
        processing_time_ms: job.processing_time_ms,
        total_tokens: (job.input_tokens_used || 0) + (job.output_tokens_used || 0),
        input_tokens: job.input_tokens_used,
        output_tokens: job.output_tokens_used,
        cost_usd: job.actual_cost_usd,
        retries: job.retry_count
      }
    };

    res.json(jobDetail);
  })
);

/**
 * DELETE /jobs/:jobId - Cancel translation job
 */
router.delete('/jobs/:jobId',
  asyncHandler(async (req: express.Request, res: express.Response) => {
    const dbOps = getDatabaseOperations();
    const jobId = req.params.jobId;

    const job = await dbOps.getTranslationJob(jobId);
    
    if (!job) {
      return res.status(404).json({
        error: {
          code: 'JOB_NOT_FOUND',
          message: 'Translation job not found'
        }
      });
    }

    if (job.status === 'completed' || job.status === 'failed') {
      return res.status(400).json({
        error: {
          code: 'JOB_CANNOT_BE_CANCELLED',
          message: 'Job has already completed and cannot be cancelled'
        }
      });
    }

    await dbOps.updateTranslationJob(jobId, {
      status: 'cancelled',
      completedAt: new Date()
    });

    res.status(204).send();
  })
);

/**
 * POST /jobs/:jobId/retry - Retry translation job
 */
router.post('/jobs/:jobId/retry',
  asyncHandler(async (req: express.Request, res: express.Response) => {
    const dbOps = getDatabaseOperations();
    const jobId = req.params.jobId;

    const job = await dbOps.getTranslationJob(jobId);
    
    if (!job) {
      return res.status(404).json({
        error: {
          code: 'JOB_NOT_FOUND',
          message: 'Translation job not found'
        }
      });
    }

    if (job.status !== 'failed') {
      return res.status(400).json({
        error: {
          code: 'JOB_NOT_RETRYABLE',
          message: 'Only failed jobs can be retried'
        }
      });
    }

    if (job.retry_count >= job.max_retries) {
      return res.status(400).json({
        error: {
          code: 'MAX_RETRIES_EXCEEDED',
          message: 'Maximum retry count exceeded'
        }
      });
    }

    await dbOps.updateTranslationJob(jobId, {
      status: 'pending',
      retryCount: job.retry_count + 1,
      errorMessage: null,
      errorCode: null
    });

    const updatedJob = await dbOps.getTranslationJob(jobId);

    res.status(202).json(updatedJob);
  })
);

// ============================================================================
// DIRECT TRANSLATION
// ============================================================================

/**
 * POST /translate - Direct translation
 */
router.post('/translate',
  validateRequest({
    body: {
      template_id: { type: 'string', format: 'uuid' },
      llm_provider: { type: 'string', required: true, enum: ['openai_gpt4', 'openai_gpt35', 'anthropic_claude', 'google_gemini'] },
      model_version: { type: 'string', maxLength: 100 },
      system_prompt: { type: 'string' },
      user_prompt: { type: 'string', required: true },
      max_tokens: { type: 'number', min: 100, max: 32000 },
      temperature: { type: 'number', min: 0, max: 2 },
      input_data: { type: 'object', required: true },
      context_data: { type: 'object' },
      timeout_seconds: { type: 'number', min: 10, max: 300 }
    }
  }),
  asyncHandler(async (req: express.Request, res: express.Response) => {
    const llmManager = req.llmManager;
    const templateManager = req.templateManager;
    const dbOps = getDatabaseOperations();
    const organizationId = req.headers['x-organization-id'] as string || 'default';
    const userId = req.headers['x-user-id'] as string || 'system';

    const request: TranslationRequest = {
      designData: req.body.input_data,
      targetLLM: req.body.llm_provider,
      format: 'markdown', // Default format for direct translation
      translationType: 'full',
      templateId: req.body.template_id,
      systemPrompt: req.body.system_prompt,
      userPrompt: req.body.user_prompt,
      context: {
        ...req.body.context_data
      },
      options: {
        timeout: (req.body.timeout_seconds || 60) * 1000,
        maxRetries: 1
      }
    };

    const startTime = Date.now();
    
    try {
      // Generate translation
      const result = await llmManager.generateTranslation(request);
      
      // Log the interaction
      await dbOps.logLLMInteraction({
        organizationId,
        llmProvider: request.targetLLM,
        modelVersion: req.body.model_version || 'latest',
        requestId: result.id,
        prompt: request.userPrompt,
        systemPrompt: request.systemPrompt,
        responseText: result.content,
        promptTokens: result.usage.promptTokens,
        completionTokens: result.usage.completionTokens,
        totalTokens: result.usage.totalTokens,
        requestStartedAt: new Date(startTime),
        responseReceivedAt: new Date(),
        latencyMs: result.responseTime,
        totalCostUsd: result.cost,
        status: 'completed',
        responseQualityScore: result.quality?.score,
        userId
      });

      // Update template metrics if template was used
      if (request.templateId) {
        await templateManager.updateTemplateMetrics(request.templateId, {
          success: true,
          responseTime: result.responseTime,
          cost: result.cost
        });
      }

      const response = {
        id: result.id,
        content: result.content,
        format: 'markdown',
        metadata: {
          llm_provider: result.provider,
          model: result.model,
          template_id: request.templateId,
          request_id: result.id
        },
        quality_score: result.quality?.score,
        tokens_used: result.usage.totalTokens,
        processing_time_ms: result.responseTime,
        cost_usd: result.cost,
        created_at: new Date().toISOString()
      };

      res.json(response);

    } catch (error) {
      // Log failed interaction
      await dbOps.logLLMInteraction({
        organizationId,
        llmProvider: request.targetLLM,
        modelVersion: req.body.model_version || 'latest',
        prompt: request.userPrompt,
        systemPrompt: request.systemPrompt,
        requestStartedAt: new Date(startTime),
        latencyMs: Date.now() - startTime,
        status: 'failed',
        errorMessage: error.message,
        errorCode: error.code || 'TRANSLATION_ERROR',
        userId
      });

      throw error;
    }
  })
);

/**
 * POST /translate/batch - Batch translation
 */
router.post('/translate/batch',
  validateRequest({
    body: {
      translations: { 
        type: 'array', 
        required: true, 
        minItems: 1, 
        maxItems: 50,
        items: {
          type: 'object',
          properties: {
            template_id: { type: 'string', format: 'uuid' },
            llm_provider: { type: 'string', required: true },
            user_prompt: { type: 'string', required: true },
            input_data: { type: 'object', required: true }
          }
        }
      },
      batch_name: { type: 'string', maxLength: 255 },
      callback_url: { type: 'string', format: 'uri' }
    }
  }),
  asyncHandler(async (req: express.Request, res: express.Response) => {
    const dbOps = getDatabaseOperations();
    const organizationId = req.headers['x-organization-id'] as string || 'default';
    const userId = req.headers['x-user-id'] as string || 'system';

    const batchId = uuidv4();
    const jobIds: string[] = [];

    // Create individual jobs for each translation in the batch
    for (const translation of req.body.translations) {
      const jobData = {
        organizationId,
        projectId: uuidv4(), // Would use actual project ID in production
        translationType: 'full' as TranslationType,
        llmProvider: translation.llm_provider,
        modelVersion: translation.model_version || 'latest',
        systemPrompt: translation.system_prompt,
        userPrompt: translation.user_prompt,
        inputData: translation.input_data,
        contextData: translation.context_data,
        callbackUrl: req.body.callback_url,
        createdBy: userId
      };

      const jobId = await dbOps.createTranslationJob(jobData);
      jobIds.push(jobId);
    }

    const response = {
      batch_id: batchId,
      total_translations: req.body.translations.length,
      estimated_completion_time: new Date(Date.now() + req.body.translations.length * 30000).toISOString(), // Rough estimate
      status_url: `/api/v1/translate/batch/${batchId}/status`,
      individual_job_ids: jobIds
    };

    res.status(202).json(response);
  })
);

// ============================================================================
// LLM PROVIDERS
// ============================================================================

/**
 * GET /providers - List LLM providers
 */
router.get('/providers',
  asyncHandler(async (req: express.Request, res: express.Response) => {
    const llmManager = req.llmManager;
    const providers = llmManager.getAllProviderInfo();

    res.json(providers);
  })
);

/**
 * GET /providers/:provider/models - List provider models
 */
router.get('/providers/:provider/models',
  asyncHandler(async (req: express.Request, res: express.Response) => {
    const llmManager = req.llmManager;
    const provider = req.params.provider as LLMProvider;

    const capabilities = llmManager.getProviderCapabilities(provider);
    
    if (!capabilities) {
      return res.status(404).json({
        error: {
          code: 'PROVIDER_NOT_FOUND',
          message: 'LLM provider not found'
        }
      });
    }

    // Return model information (simplified)
    const models = [{
      model_id: capabilities.model,
      name: capabilities.model,
      description: `${provider} model`,
      max_tokens: capabilities.capabilities.maxContextLength,
      context_window: capabilities.capabilities.maxContextLength,
      capabilities: capabilities.capabilities.supportsFunctions ? ['completion', 'functions'] : ['completion'],
      recommended_for: ['design-translation', 'code-generation']
    }];

    res.json(models);
  })
);

/**
 * POST /providers/:provider/test - Test LLM provider
 */
router.post('/providers/:provider/test',
  validateRequest({
    body: {
      model_version: { type: 'string', maxLength: 100 },
      test_prompt: { type: 'string' }
    }
  }),
  asyncHandler(async (req: express.Request, res: express.Response) => {
    const llmManager = req.llmManager;
    const provider = req.params.provider as LLMProvider;

    const testResult = await llmManager.testProvider(
      provider, 
      req.body.test_prompt || 'Test prompt: Please respond with "Test successful"'
    );

    res.json(testResult);
  })
);

// ============================================================================
// ANALYTICS
// ============================================================================

/**
 * GET /analytics/usage - Get usage analytics
 */
router.get('/analytics/usage',
  asyncHandler(async (req: express.Request, res: express.Response) => {
    const llmManager = req.llmManager;
    const dbOps = getDatabaseOperations();
    const organizationId = req.headers['x-organization-id'] as string;

    const {
      start_date,
      end_date,
      granularity = 'day'
    } = req.query;

    const costStats = llmManager.getCostStatistics();
    
    // In a real implementation, this would query detailed analytics from the database
    const analytics = {
      period: {
        start_date: start_date || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        end_date: end_date || new Date().toISOString().split('T')[0]
      },
      total_translations: costStats.total.requests,
      successful_translations: Math.round(costStats.total.requests * 0.95), // 95% success rate assumption
      failed_translations: Math.round(costStats.total.requests * 0.05),
      total_tokens_used: costStats.total.tokens,
      total_cost_usd: costStats.total.cost,
      average_processing_time_ms: 2500, // Would be calculated from actual data
      provider_breakdown: costStats.byProvider,
      daily_stats: [] // Would be populated with actual daily statistics
    };

    res.json(analytics);
  })
);

/**
 * GET /analytics/quality - Get quality metrics
 */
router.get('/analytics/quality',
  asyncHandler(async (req: express.Request, res: express.Response) => {
    const dbOps = getDatabaseOperations();
    const organizationId = req.headers['x-organization-id'] as string;

    const {
      template_id,
      llm_provider
    } = req.query;

    // Query quality metrics from database
    const metrics = await dbOps.getQualityMetrics(organizationId, {
      templateId: template_id as string,
      startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
      endDate: new Date(),
      period: 'daily'
    });

    // Aggregate the metrics
    const qualityMetrics = {
      overall_quality_score: 0.85, // Would be calculated from actual feedback
      total_feedback_count: 0,
      rating_distribution: {
        "1": 0,
        "2": 0,
        "3": 5,
        "4": 15,
        "5": 25
      },
      success_rate: 0.95,
      average_processing_time: 2500,
      template_performance: [] // Would be populated with template-specific metrics
    };

    res.json(qualityMetrics);
  })
);

export default router;
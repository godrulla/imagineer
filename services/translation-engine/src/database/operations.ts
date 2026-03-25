import { Pool, PoolClient } from 'pg';
import { logger } from '../utils/logger';
import { 
  LLMProvider, 
  OutputFormat, 
  TranslationType, 
  PromptTemplate,
  LLMResponse,
  TranslationRequest
} from '../services/LLMManager';

export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl?: boolean;
  maxConnections?: number;
  idleTimeoutMillis?: number;
  connectionTimeoutMillis?: number;
}

export interface TranslationJobData {
  id?: string;
  organizationId: string;
  projectId: string;
  designFileId?: string;
  parsedDesignId?: string;
  templateId?: string;
  jobName?: string;
  translationType: TranslationType;
  llmProvider: LLMProvider;
  modelVersion: string;
  systemPrompt?: string;
  userPrompt: string;
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  inputData: any;
  contextData?: any;
  priority?: number;
  maxRetries?: number;
  callbackUrl?: string;
  createdBy: string;
}

export interface TranslationResultData {
  id?: string;
  translationJobId: string;
  resultType?: string;
  sequenceNumber?: number;
  title?: string;
  content: string;
  format: OutputFormat;
  metadata?: any;
  sections?: any[];
  components?: any[];
  elements?: any[];
  validationStatus?: string;
  validationErrors?: any[];
  validationWarnings?: any[];
  userRating?: number;
  userFeedback?: string;
  isApproved?: boolean;
  approvedBy?: string;
  approvedAt?: Date;
}

export interface LLMInteractionData {
  id?: string;
  translationJobId?: string;
  organizationId: string;
  interactionType?: string;
  llmProvider: LLMProvider;
  modelVersion: string;
  requestId?: string;
  prompt?: string;
  systemPrompt?: string;
  parameters?: any;
  responseText?: string;
  responseData?: any;
  finishReason?: string;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  requestStartedAt?: Date;
  responseReceivedAt?: Date;
  latencyMs?: number;
  costPerToken?: number;
  totalCostUsd?: number;
  status?: string;
  errorMessage?: string;
  errorCode?: string;
  responseQualityScore?: number;
  contentSafetyScore?: number;
  userId?: string;
}

export interface TemplateData {
  id?: string;
  organizationId: string;
  name: string;
  description?: string;
  category?: string;
  promptTemplate: string;
  systemPrompt?: string;
  exampleInput?: any;
  exampleOutput?: string;
  targetFormat: OutputFormat;
  llmProvider: LLMProvider;
  modelVersion?: string;
  maxTokens?: number;
  temperature?: number;
  parameters?: any;
  variables?: any;
  usageCount?: number;
  averageRating?: number;
  successRate?: number;
  version?: number;
  parentTemplateId?: string;
  isPublic?: boolean;
  isSystemTemplate?: boolean;
  status?: string;
  createdBy: string;
}

export interface QualityMetricsData {
  organizationId: string;
  projectId?: string;
  templateId?: string;
  modelConfigId?: string;
  metricDate: Date;
  metricPeriod?: string;
  totalTranslations?: number;
  successfulTranslations?: number;
  failedTranslations?: number;
  averageRating?: number;
  averageAccuracy?: number;
  averageCompleteness?: number;
  averageUsefulness?: number;
  averageClarity?: number;
  averageProcessingTimeMs?: number;
  averageTokensUsed?: number;
  totalCostUsd?: number;
  errorRate?: number;
  timeoutRate?: number;
  retryRate?: number;
  totalViews?: number;
  totalEdits?: number;
  totalExports?: number;
  approvalRate?: number;
}

export class DatabaseOperations {
  private pool: Pool;
  private isConnected: boolean = false;

  constructor(config: DatabaseConfig) {
    this.pool = new Pool({
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.username,
      password: config.password,
      ssl: config.ssl ? { rejectUnauthorized: false } : false,
      max: config.maxConnections || 20,
      idleTimeoutMillis: config.idleTimeoutMillis || 30000,
      connectionTimeoutMillis: config.connectionTimeoutMillis || 2000,
    });

    // Handle pool errors
    this.pool.on('error', (err) => {
      logger.error('Database pool error', { error: err.message });
    });
  }

  async connect(): Promise<void> {
    try {
      const client = await this.pool.connect();
      await client.query('SELECT 1');
      client.release();
      this.isConnected = true;
      logger.info('Database connected successfully');
    } catch (error) {
      logger.error('Failed to connect to database', { error: error.message });
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    try {
      await this.pool.end();
      this.isConnected = false;
      logger.info('Database disconnected successfully');
    } catch (error) {
      logger.error('Failed to disconnect from database', { error: error.message });
      throw error;
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const client = await this.pool.connect();
      const result = await client.query('SELECT NOW() as timestamp');
      client.release();
      return result.rows.length > 0;
    } catch (error) {
      logger.error('Database health check failed', { error: error.message });
      return false;
    }
  }

  // ============================================================================
  // TRANSLATION TEMPLATES
  // ============================================================================

  async createTemplate(templateData: TemplateData): Promise<string> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const query = `
        INSERT INTO translation.translation_templates (
          organization_id, name, description, category, prompt_template, system_prompt,
          example_input, example_output, target_format, llm_provider, model_version,
          max_tokens, temperature, parameters, variables, is_public, is_system_template,
          status, created_by
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19
        ) RETURNING id
      `;

      const values = [
        templateData.organizationId,
        templateData.name,
        templateData.description,
        templateData.category,
        templateData.promptTemplate,
        templateData.systemPrompt,
        templateData.exampleInput ? JSON.stringify(templateData.exampleInput) : null,
        templateData.exampleOutput,
        templateData.targetFormat,
        templateData.llmProvider,
        templateData.modelVersion,
        templateData.maxTokens || 4000,
        templateData.temperature || 0.7,
        templateData.parameters ? JSON.stringify(templateData.parameters) : '{}',
        templateData.variables ? JSON.stringify(templateData.variables) : '{}',
        templateData.isPublic || false,
        templateData.isSystemTemplate || false,
        templateData.status || 'active',
        templateData.createdBy
      ];

      const result = await client.query(query, values);
      await client.query('COMMIT');

      const templateId = result.rows[0].id;
      logger.info('Template created successfully', { templateId });
      return templateId;

    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Failed to create template', { error: error.message });
      throw error;
    } finally {
      client.release();
    }
  }

  async getTemplate(templateId: string, organizationId?: string): Promise<any | null> {
    try {
      let query = `
        SELECT 
          id, organization_id, name, description, category, prompt_template, system_prompt,
          example_input, example_output, target_format, llm_provider, model_version,
          max_tokens, temperature, parameters, variables, usage_count, average_rating,
          success_rate, version, parent_template_id, is_public, is_system_template,
          status, created_at, updated_at, created_by
        FROM translation.translation_templates 
        WHERE id = $1 AND is_deleted = FALSE
      `;

      const values = [templateId];

      if (organizationId) {
        query += ' AND (organization_id = $2 OR is_public = TRUE)';
        values.push(organizationId);
      }

      const result = await this.pool.query(query, values);
      
      if (result.rows.length === 0) {
        return null;
      }

      const template = result.rows[0];
      return {
        ...template,
        exampleInput: template.example_input ? JSON.parse(template.example_input) : null,
        parameters: JSON.parse(template.parameters || '{}'),
        variables: JSON.parse(template.variables || '{}')
      };

    } catch (error) {
      logger.error('Failed to get template', { templateId, error: error.message });
      throw error;
    }
  }

  async updateTemplate(templateId: string, updates: Partial<TemplateData>): Promise<boolean> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const setParts: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      // Build dynamic SET clause
      const updateFields = [
        'name', 'description', 'category', 'prompt_template', 'system_prompt',
        'example_input', 'example_output', 'target_format', 'llm_provider',
        'model_version', 'max_tokens', 'temperature', 'parameters', 'variables',
        'is_public', 'status'
      ];

      for (const field of updateFields) {
        const camelField = this.snakeToCamel(field);
        if (updates[camelField] !== undefined) {
          if (field === 'example_input' || field === 'parameters' || field === 'variables') {
            setParts.push(`${field} = $${paramIndex}`);
            values.push(JSON.stringify(updates[camelField]));
          } else {
            setParts.push(`${field} = $${paramIndex}`);
            values.push(updates[camelField]);
          }
          paramIndex++;
        }
      }

      if (setParts.length === 0) {
        await client.query('ROLLBACK');
        return false;
      }

      // Add version increment and updated_at
      setParts.push(`version = version + 1`);
      setParts.push(`updated_at = CURRENT_TIMESTAMP`);

      values.push(templateId);
      const query = `
        UPDATE translation.translation_templates 
        SET ${setParts.join(', ')}
        WHERE id = $${paramIndex} AND is_deleted = FALSE
      `;

      const result = await client.query(query, values);
      await client.query('COMMIT');

      const updated = result.rowCount > 0;
      if (updated) {
        logger.info('Template updated successfully', { templateId });
      }
      return updated;

    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Failed to update template', { templateId, error: error.message });
      throw error;
    } finally {
      client.release();
    }
  }

  async deleteTemplate(templateId: string): Promise<boolean> {
    try {
      const query = `
        UPDATE translation.translation_templates 
        SET is_deleted = TRUE, deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE id = $1 AND is_deleted = FALSE
      `;

      const result = await this.pool.query(query, [templateId]);
      const deleted = result.rowCount > 0;
      
      if (deleted) {
        logger.info('Template deleted successfully', { templateId });
      }
      return deleted;

    } catch (error) {
      logger.error('Failed to delete template', { templateId, error: error.message });
      throw error;
    }
  }

  async listTemplates(options: {
    organizationId?: string;
    category?: string;
    llmProvider?: LLMProvider;
    targetFormat?: OutputFormat;
    isPublic?: boolean;
    search?: string;
    limit?: number;
    offset?: number;
    orderBy?: string;
    orderDirection?: 'ASC' | 'DESC';
  } = {}): Promise<{ templates: any[]; total: number }> {
    try {
      const whereClauses: string[] = ['is_deleted = FALSE'];
      const values: any[] = [];
      let paramIndex = 1;

      // Build WHERE clause
      if (options.organizationId) {
        whereClauses.push(`(organization_id = $${paramIndex} OR is_public = TRUE)`);
        values.push(options.organizationId);
        paramIndex++;
      }

      if (options.category) {
        whereClauses.push(`category = $${paramIndex}`);
        values.push(options.category);
        paramIndex++;
      }

      if (options.llmProvider) {
        whereClauses.push(`llm_provider = $${paramIndex}`);
        values.push(options.llmProvider);
        paramIndex++;
      }

      if (options.targetFormat) {
        whereClauses.push(`target_format = $${paramIndex}`);
        values.push(options.targetFormat);
        paramIndex++;
      }

      if (options.isPublic !== undefined) {
        whereClauses.push(`is_public = $${paramIndex}`);
        values.push(options.isPublic);
        paramIndex++;
      }

      if (options.search) {
        whereClauses.push(`(name ILIKE $${paramIndex} OR description ILIKE $${paramIndex})`);
        values.push(`%${options.search}%`);
        paramIndex++;
      }

      const whereClause = whereClauses.join(' AND ');

      // Count query
      const countQuery = `
        SELECT COUNT(*) as total
        FROM translation.translation_templates
        WHERE ${whereClause}
      `;

      const countResult = await this.pool.query(countQuery, values);
      const total = parseInt(countResult.rows[0].total);

      // Main query
      const orderBy = options.orderBy || 'created_at';
      const orderDirection = options.orderDirection || 'DESC';
      const limit = options.limit || 50;
      const offset = options.offset || 0;

      const query = `
        SELECT 
          id, organization_id, name, description, category, target_format, llm_provider,
          model_version, usage_count, average_rating, success_rate, version, is_public,
          is_system_template, status, created_at, updated_at, created_by
        FROM translation.translation_templates
        WHERE ${whereClause}
        ORDER BY ${orderBy} ${orderDirection}
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;

      values.push(limit, offset);
      const result = await this.pool.query(query, values);

      return {
        templates: result.rows,
        total
      };

    } catch (error) {
      logger.error('Failed to list templates', { error: error.message });
      throw error;
    }
  }

  // ============================================================================
  // TRANSLATION JOBS
  // ============================================================================

  async createTranslationJob(jobData: TranslationJobData): Promise<string> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const query = `
        INSERT INTO translation.translation_jobs (
          organization_id, project_id, design_file_id, parsed_design_id, template_id,
          job_name, translation_type, llm_provider, model_version, system_prompt,
          user_prompt, max_tokens, temperature, top_p, frequency_penalty, presence_penalty,
          input_data, context_data, priority, max_retries, status, created_by
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, 'pending', $21
        ) RETURNING id
      `;

      const values = [
        jobData.organizationId,
        jobData.projectId,
        jobData.designFileId,
        jobData.parsedDesignId,
        jobData.templateId,
        jobData.jobName,
        jobData.translationType,
        jobData.llmProvider,
        jobData.modelVersion,
        jobData.systemPrompt,
        jobData.userPrompt,
        jobData.maxTokens || 4000,
        jobData.temperature || 0.7,
        jobData.topP || 1.0,
        jobData.frequencyPenalty || 0.0,
        jobData.presencePenalty || 0.0,
        JSON.stringify(jobData.inputData),
        jobData.contextData ? JSON.stringify(jobData.contextData) : '{}',
        jobData.priority || 0,
        jobData.maxRetries || 3,
        jobData.createdBy
      ];

      const result = await client.query(query, values);
      await client.query('COMMIT');

      const jobId = result.rows[0].id;
      logger.info('Translation job created successfully', { jobId });
      return jobId;

    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Failed to create translation job', { error: error.message });
      throw error;
    } finally {
      client.release();
    }
  }

  async getTranslationJob(jobId: string): Promise<any | null> {
    try {
      const query = `
        SELECT 
          id, organization_id, project_id, design_file_id, parsed_design_id, template_id,
          job_name, translation_type, llm_provider, model_version, system_prompt, user_prompt,
          max_tokens, temperature, top_p, frequency_penalty, presence_penalty,
          input_data, context_data, status, priority, retry_count, max_retries,
          queued_at, started_at, completed_at, processing_time_ms, queue_wait_time_ms,
          output_text, output_data, output_tokens_used, input_tokens_used,
          confidence_score, quality_rating, error_message, error_code, error_details,
          estimated_cost_usd, actual_cost_usd, created_at, updated_at, created_by
        FROM translation.translation_jobs 
        WHERE id = $1
      `;

      const result = await this.pool.query(query, [jobId]);
      
      if (result.rows.length === 0) {
        return null;
      }

      const job = result.rows[0];
      return {
        ...job,
        inputData: JSON.parse(job.input_data || '{}'),
        contextData: JSON.parse(job.context_data || '{}'),
        outputData: job.output_data ? JSON.parse(job.output_data) : null,
        errorDetails: job.error_details ? JSON.parse(job.error_details) : null
      };

    } catch (error) {
      logger.error('Failed to get translation job', { jobId, error: error.message });
      throw error;
    }
  }

  async updateTranslationJob(jobId: string, updates: {
    status?: string;
    queuedAt?: Date;
    startedAt?: Date;
    completedAt?: Date;
    outputText?: string;
    outputData?: any;
    outputTokensUsed?: number;
    inputTokensUsed?: number;
    confidenceScore?: number;
    qualityRating?: number;
    errorMessage?: string;
    errorCode?: string;
    errorDetails?: any;
    estimatedCostUsd?: number;
    actualCostUsd?: number;
    retryCount?: number;
  }): Promise<boolean> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const setParts: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      // Build dynamic SET clause
      for (const [key, value] of Object.entries(updates)) {
        if (value !== undefined) {
          const snakeKey = this.camelToSnake(key);
          if (key === 'outputData' || key === 'errorDetails') {
            setParts.push(`${snakeKey} = $${paramIndex}`);
            values.push(JSON.stringify(value));
          } else {
            setParts.push(`${snakeKey} = $${paramIndex}`);
            values.push(value);
          }
          paramIndex++;
        }
      }

      if (setParts.length === 0) {
        await client.query('ROLLBACK');
        return false;
      }

      setParts.push(`updated_at = CURRENT_TIMESTAMP`);
      values.push(jobId);

      const query = `
        UPDATE translation.translation_jobs 
        SET ${setParts.join(', ')}
        WHERE id = $${paramIndex}
      `;

      const result = await client.query(query, values);
      await client.query('COMMIT');

      const updated = result.rowCount > 0;
      if (updated) {
        logger.info('Translation job updated successfully', { jobId });
      }
      return updated;

    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Failed to update translation job', { jobId, error: error.message });
      throw error;
    } finally {
      client.release();
    }
  }

  async listTranslationJobs(options: {
    organizationId?: string;
    projectId?: string;
    status?: string;
    llmProvider?: LLMProvider;
    translationType?: TranslationType;
    limit?: number;
    offset?: number;
    orderBy?: string;
    orderDirection?: 'ASC' | 'DESC';
  } = {}): Promise<{ jobs: any[]; total: number }> {
    try {
      const whereClauses: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      // Build WHERE clause
      if (options.organizationId) {
        whereClauses.push(`organization_id = $${paramIndex}`);
        values.push(options.organizationId);
        paramIndex++;
      }

      if (options.projectId) {
        whereClauses.push(`project_id = $${paramIndex}`);
        values.push(options.projectId);
        paramIndex++;
      }

      if (options.status) {
        whereClauses.push(`status = $${paramIndex}`);
        values.push(options.status);
        paramIndex++;
      }

      if (options.llmProvider) {
        whereClauses.push(`llm_provider = $${paramIndex}`);
        values.push(options.llmProvider);
        paramIndex++;
      }

      if (options.translationType) {
        whereClauses.push(`translation_type = $${paramIndex}`);
        values.push(options.translationType);
        paramIndex++;
      }

      const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

      // Count query
      const countQuery = `
        SELECT COUNT(*) as total
        FROM translation.translation_jobs
        ${whereClause}
      `;

      const countResult = await this.pool.query(countQuery, values);
      const total = parseInt(countResult.rows[0].total);

      // Main query
      const orderBy = options.orderBy || 'created_at';
      const orderDirection = options.orderDirection || 'DESC';
      const limit = options.limit || 50;
      const offset = options.offset || 0;

      const query = `
        SELECT 
          id, organization_id, project_id, job_name, translation_type, llm_provider,
          model_version, status, priority, retry_count, max_retries, queued_at,
          started_at, completed_at, processing_time_ms, queue_wait_time_ms,
          output_tokens_used, input_tokens_used, quality_rating, actual_cost_usd,
          created_at, updated_at, created_by
        FROM translation.translation_jobs
        ${whereClause}
        ORDER BY ${orderBy} ${orderDirection}
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;

      values.push(limit, offset);
      const result = await this.pool.query(query, values);

      return {
        jobs: result.rows,
        total
      };

    } catch (error) {
      logger.error('Failed to list translation jobs', { error: error.message });
      throw error;
    }
  }

  // ============================================================================
  // TRANSLATION RESULTS
  // ============================================================================

  async createTranslationResult(resultData: TranslationResultData): Promise<string> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const query = `
        INSERT INTO translation.translation_results (
          translation_job_id, result_type, sequence_number, title, content, format,
          metadata, sections, components, elements, validation_status,
          validation_errors, validation_warnings
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13
        ) RETURNING id
      `;

      const values = [
        resultData.translationJobId,
        resultData.resultType || 'primary',
        resultData.sequenceNumber || 1,
        resultData.title,
        resultData.content,
        resultData.format,
        resultData.metadata ? JSON.stringify(resultData.metadata) : '{}',
        resultData.sections ? JSON.stringify(resultData.sections) : '[]',
        resultData.components ? JSON.stringify(resultData.components) : '[]',
        resultData.elements ? JSON.stringify(resultData.elements) : '[]',
        resultData.validationStatus || 'pending',
        resultData.validationErrors ? JSON.stringify(resultData.validationErrors) : '[]',
        resultData.validationWarnings ? JSON.stringify(resultData.validationWarnings) : '[]'
      ];

      const result = await client.query(query, values);
      await client.query('COMMIT');

      const resultId = result.rows[0].id;
      logger.info('Translation result created successfully', { resultId });
      return resultId;

    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Failed to create translation result', { error: error.message });
      throw error;
    } finally {
      client.release();
    }
  }

  async getTranslationResult(resultId: string): Promise<any | null> {
    try {
      const query = `
        SELECT 
          id, translation_job_id, result_type, sequence_number, title, content, format,
          metadata, sections, components, elements, validation_status, validation_errors,
          validation_warnings, user_rating, user_feedback, is_approved, approved_by,
          approved_at, view_count, edit_count, export_count, created_at, updated_at
        FROM translation.translation_results 
        WHERE id = $1
      `;

      const result = await this.pool.query(query, [resultId]);
      
      if (result.rows.length === 0) {
        return null;
      }

      const translationResult = result.rows[0];
      return {
        ...translationResult,
        metadata: JSON.parse(translationResult.metadata || '{}'),
        sections: JSON.parse(translationResult.sections || '[]'),
        components: JSON.parse(translationResult.components || '[]'),
        elements: JSON.parse(translationResult.elements || '[]'),
        validationErrors: JSON.parse(translationResult.validation_errors || '[]'),
        validationWarnings: JSON.parse(translationResult.validation_warnings || '[]')
      };

    } catch (error) {
      logger.error('Failed to get translation result', { resultId, error: error.message });
      throw error;
    }
  }

  // ============================================================================
  // LLM INTERACTIONS
  // ============================================================================

  async logLLMInteraction(interactionData: LLMInteractionData): Promise<string> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const query = `
        INSERT INTO translation.llm_interactions (
          translation_job_id, organization_id, interaction_type, llm_provider,
          model_version, request_id, prompt, system_prompt, parameters,
          response_text, response_data, finish_reason, prompt_tokens,
          completion_tokens, total_tokens, request_started_at, response_received_at,
          latency_ms, cost_per_token, total_cost_usd, status, error_message,
          error_code, response_quality_score, content_safety_score, user_id
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26
        ) RETURNING id
      `;

      const values = [
        interactionData.translationJobId,
        interactionData.organizationId,
        interactionData.interactionType || 'completion',
        interactionData.llmProvider,
        interactionData.modelVersion,
        interactionData.requestId,
        interactionData.prompt,
        interactionData.systemPrompt,
        interactionData.parameters ? JSON.stringify(interactionData.parameters) : '{}',
        interactionData.responseText,
        interactionData.responseData ? JSON.stringify(interactionData.responseData) : null,
        interactionData.finishReason,
        interactionData.promptTokens,
        interactionData.completionTokens,
        interactionData.totalTokens,
        interactionData.requestStartedAt || new Date(),
        interactionData.responseReceivedAt,
        interactionData.latencyMs,
        interactionData.costPerToken,
        interactionData.totalCostUsd,
        interactionData.status || 'completed',
        interactionData.errorMessage,
        interactionData.errorCode,
        interactionData.responseQualityScore,
        interactionData.contentSafetyScore,
        interactionData.userId
      ];

      const result = await client.query(query, values);
      await client.query('COMMIT');

      const interactionId = result.rows[0].id;
      logger.debug('LLM interaction logged successfully', { interactionId });
      return interactionId;

    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Failed to log LLM interaction', { error: error.message });
      throw error;
    } finally {
      client.release();
    }
  }

  // ============================================================================
  // QUALITY METRICS
  // ============================================================================

  async recordQualityMetrics(metricsData: QualityMetricsData): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const query = `
        INSERT INTO translation.quality_metrics (
          organization_id, project_id, template_id, model_config_id, metric_date,
          metric_period, total_translations, successful_translations, failed_translations,
          average_rating, average_accuracy, average_completeness, average_usefulness,
          average_clarity, average_processing_time_ms, average_tokens_used, total_cost_usd,
          error_rate, timeout_rate, retry_rate, total_views, total_edits, total_exports,
          approval_rate
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24
        )
        ON CONFLICT (organization_id, project_id, template_id, model_config_id, metric_date, metric_period)
        DO UPDATE SET
          total_translations = EXCLUDED.total_translations,
          successful_translations = EXCLUDED.successful_translations,
          failed_translations = EXCLUDED.failed_translations,
          average_rating = EXCLUDED.average_rating,
          average_accuracy = EXCLUDED.average_accuracy,
          average_completeness = EXCLUDED.average_completeness,
          average_usefulness = EXCLUDED.average_usefulness,
          average_clarity = EXCLUDED.average_clarity,
          average_processing_time_ms = EXCLUDED.average_processing_time_ms,
          average_tokens_used = EXCLUDED.average_tokens_used,
          total_cost_usd = EXCLUDED.total_cost_usd,
          error_rate = EXCLUDED.error_rate,
          timeout_rate = EXCLUDED.timeout_rate,
          retry_rate = EXCLUDED.retry_rate,
          total_views = EXCLUDED.total_views,
          total_edits = EXCLUDED.total_edits,
          total_exports = EXCLUDED.total_exports,
          approval_rate = EXCLUDED.approval_rate,
          created_at = CURRENT_TIMESTAMP
      `;

      const values = [
        metricsData.organizationId,
        metricsData.projectId,
        metricsData.templateId,
        metricsData.modelConfigId,
        metricsData.metricDate,
        metricsData.metricPeriod || 'daily',
        metricsData.totalTranslations || 0,
        metricsData.successfulTranslations || 0,
        metricsData.failedTranslations || 0,
        metricsData.averageRating,
        metricsData.averageAccuracy,
        metricsData.averageCompleteness,
        metricsData.averageUsefulness,
        metricsData.averageClarity,
        metricsData.averageProcessingTimeMs,
        metricsData.averageTokensUsed,
        metricsData.totalCostUsd || 0,
        metricsData.errorRate,
        metricsData.timeoutRate,
        metricsData.retryRate,
        metricsData.totalViews || 0,
        metricsData.totalEdits || 0,
        metricsData.totalExports || 0,
        metricsData.approvalRate
      ];

      await client.query(query, values);
      await client.query('COMMIT');

      logger.debug('Quality metrics recorded successfully');

    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Failed to record quality metrics', { error: error.message });
      throw error;
    } finally {
      client.release();
    }
  }

  async getQualityMetrics(organizationId: string, options: {
    projectId?: string;
    templateId?: string;
    startDate?: Date;
    endDate?: Date;
    period?: string;
  } = {}): Promise<any[]> {
    try {
      const whereClauses = ['organization_id = $1'];
      const values: any[] = [organizationId];
      let paramIndex = 2;

      if (options.projectId) {
        whereClauses.push(`project_id = $${paramIndex}`);
        values.push(options.projectId);
        paramIndex++;
      }

      if (options.templateId) {
        whereClauses.push(`template_id = $${paramIndex}`);
        values.push(options.templateId);
        paramIndex++;
      }

      if (options.startDate) {
        whereClauses.push(`metric_date >= $${paramIndex}`);
        values.push(options.startDate);
        paramIndex++;
      }

      if (options.endDate) {
        whereClauses.push(`metric_date <= $${paramIndex}`);
        values.push(options.endDate);
        paramIndex++;
      }

      if (options.period) {
        whereClauses.push(`metric_period = $${paramIndex}`);
        values.push(options.period);
        paramIndex++;
      }

      const query = `
        SELECT *
        FROM translation.quality_metrics
        WHERE ${whereClauses.join(' AND ')}
        ORDER BY metric_date DESC
      `;

      const result = await this.pool.query(query, values);
      return result.rows;

    } catch (error) {
      logger.error('Failed to get quality metrics', { organizationId, error: error.message });
      throw error;
    }
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  private camelToSnake(str: string): string {
    return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
  }

  private snakeToCamel(str: string): string {
    return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
  }

  async executeInTransaction<T>(operations: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await operations(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async getConnectionInfo(): Promise<{ totalConnections: number; idleConnections: number; waitingClients: number }> {
    return {
      totalConnections: this.pool.totalCount,
      idleConnections: this.pool.idleCount,
      waitingClients: this.pool.waitingCount
    };
  }
}
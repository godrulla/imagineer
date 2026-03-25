import { PoolClient } from 'pg';
import { db } from './connection';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

// Export Job interfaces
export interface ExportJob {
  id: string;
  organization_id: string;
  project_id: string;
  translation_result_id?: string;
  export_config_id: string;
  job_name?: string;
  export_type: 'full' | 'incremental' | 'component' | 'selection' | 'custom';
  input_source: 'translation_result' | 'design_file' | 'parsed_design' | 'custom_data';
  input_data: any;
  custom_settings: any;
  include_assets: boolean;
  include_interactions: boolean;
  include_animations: boolean;
  target_platforms: string[];
  status: 'pending' | 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';
  priority: number;
  retry_count: number;
  max_retries: number;
  queued_at?: Date;
  started_at?: Date;
  completed_at?: Date;
  processing_time_ms?: number;
  error_message?: string;
  error_code?: string;
  error_details?: any;
  validation_status: 'pending' | 'passed' | 'failed' | 'skipped';
  validation_errors: any[];
  validation_warnings: any[];
  created_at: Date;
  updated_at: Date;
  created_by: string;
}

export interface ExportConfiguration {
  id: string;
  organization_id: string;
  name: string;
  description?: string;
  format_type: string;
  template_content?: string;
  template_variables: any;
  output_structure: any;
  preprocessing_rules: any[];
  postprocessing_rules: any[];
  transformation_rules: any;
  format_settings: any;
  file_extension?: string;
  mime_type?: string;
  minify_output: boolean;
  include_metadata: boolean;
  include_comments: boolean;
  validate_output: boolean;
  usage_count: number;
  success_rate?: number;
  average_rating?: number;
  version: number;
  parent_config_id?: string;
  is_public: boolean;
  is_system_config: boolean;
  status: string;
  created_at: Date;
  updated_at: Date;
  created_by: string;
}

export interface ExportResult {
  id: string;
  export_job_id: string;
  result_type: 'primary' | 'alternative' | 'component' | 'asset' | 'fragment';
  file_name: string;
  file_path?: string;
  content?: string;
  content_size_bytes?: number;
  content_hash?: string;
  format_type: string;
  mime_type?: string;
  file_extension?: string;
  encoding: string;
  storage_provider: string;
  storage_bucket?: string;
  storage_key?: string;
  storage_url?: string;
  is_public: boolean;
  access_token?: string;
  expires_at?: Date;
  download_count: number;
  view_count: number;
  last_accessed_at?: Date;
  quality_score?: number;
  user_rating?: number;
  metadata: any;
  dependencies: string[];
  created_at: Date;
  updated_at: Date;
}

export interface ExportTemplate {
  id: string;
  organization_id: string;
  name: string;
  description?: string;
  category?: string;
  format_type: string;
  template_content: string;
  sample_output?: string;
  variables: any;
  sections: any[];
  components: any;
  engine: 'handlebars' | 'mustache' | 'liquid' | 'jinja2' | 'custom';
  engine_config: any;
  custom_helpers: any;
  usage_count: number;
  average_rating?: number;
  version: number;
  parent_template_id?: string;
  is_public: boolean;
  is_system_template: boolean;
  status: string;
  created_at: Date;
  updated_at: Date;
  created_by: string;
}

export class ExportDatabaseOperations {
  // Export Job Operations
  async createExportJob(jobData: Partial<ExportJob>): Promise<ExportJob> {
    const id = uuidv4();
    const now = new Date();
    
    const query = `
      INSERT INTO export.export_jobs (
        id, organization_id, project_id, translation_result_id, export_config_id,
        job_name, export_type, input_source, input_data, custom_settings,
        include_assets, include_interactions, include_animations, target_platforms,
        status, priority, retry_count, max_retries, created_at, updated_at, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
      RETURNING *
    `;
    
    const values = [
      id,
      jobData.organization_id,
      jobData.project_id,
      jobData.translation_result_id || null,
      jobData.export_config_id,
      jobData.job_name || null,
      jobData.export_type || 'full',
      jobData.input_source || 'translation_result',
      JSON.stringify(jobData.input_data || {}),
      JSON.stringify(jobData.custom_settings || {}),
      jobData.include_assets ?? true,
      jobData.include_interactions ?? true,
      jobData.include_animations ?? false,
      jobData.target_platforms || [],
      jobData.status || 'pending',
      jobData.priority || 5,
      jobData.retry_count || 0,
      jobData.max_retries || 3,
      now,
      now,
      jobData.created_by
    ];
    
    try {
      const result = await db.query(query, values);
      return this.mapExportJobRow(result.rows[0]);
    } catch (error) {
      logger.error('Failed to create export job', { error: error.message, jobData });
      throw error;
    }
  }

  async getExportJob(id: string, organizationId: string): Promise<ExportJob | null> {
    const query = `
      SELECT * FROM export.export_jobs 
      WHERE id = $1 AND organization_id = $2
    `;
    
    try {
      const result = await db.query(query, [id, organizationId]);
      return result.rows[0] ? this.mapExportJobRow(result.rows[0]) : null;
    } catch (error) {
      logger.error('Failed to get export job', { error: error.message, id, organizationId });
      throw error;
    }
  }

  async updateExportJobStatus(
    id: string, 
    status: ExportJob['status'], 
    additionalData?: Partial<ExportJob>
  ): Promise<void> {
    const now = new Date();
    let updateFields = ['status = $2', 'updated_at = $3'];
    let values = [id, status, now];
    let paramIndex = 4;

    if (status === 'queued' && !additionalData?.queued_at) {
      updateFields.push(`queued_at = $${paramIndex++}`);
      values.push(now);
    }

    if (status === 'processing' && !additionalData?.started_at) {
      updateFields.push(`started_at = $${paramIndex++}`);
      values.push(now);
    }

    if (status === 'completed' && !additionalData?.completed_at) {
      updateFields.push(`completed_at = $${paramIndex++}`);
      values.push(now);
    }

    if (additionalData) {
      if (additionalData.error_message !== undefined) {
        updateFields.push(`error_message = $${paramIndex++}`);
        values.push(additionalData.error_message);
      }
      if (additionalData.error_code !== undefined) {
        updateFields.push(`error_code = $${paramIndex++}`);
        values.push(additionalData.error_code);
      }
      if (additionalData.processing_time_ms !== undefined) {
        updateFields.push(`processing_time_ms = $${paramIndex++}`);
        values.push(additionalData.processing_time_ms);
      }
      if (additionalData.validation_status !== undefined) {
        updateFields.push(`validation_status = $${paramIndex++}`);
        values.push(additionalData.validation_status);
      }
    }

    const query = `
      UPDATE export.export_jobs 
      SET ${updateFields.join(', ')}
      WHERE id = $1
    `;

    try {
      await db.query(query, values);
    } catch (error) {
      logger.error('Failed to update export job status', { error: error.message, id, status });
      throw error;
    }
  }

  async getQueuedJobs(limit: number = 10): Promise<ExportJob[]> {
    const query = `
      SELECT * FROM export.export_jobs 
      WHERE status IN ('pending', 'queued')
      ORDER BY priority DESC, created_at ASC
      LIMIT $1
    `;
    
    try {
      const result = await db.query(query, [limit]);
      return result.rows.map(row => this.mapExportJobRow(row));
    } catch (error) {
      logger.error('Failed to get queued jobs', { error: error.message });
      throw error;
    }
  }

  async listExportJobs(
    organizationId: string,
    filters: {
      project_id?: string;
      status?: string;
      created_after?: Date;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<{ jobs: ExportJob[]; total: number }> {
    let whereConditions = ['organization_id = $1'];
    let values: any[] = [organizationId];
    let paramIndex = 2;

    if (filters.project_id) {
      whereConditions.push(`project_id = $${paramIndex++}`);
      values.push(filters.project_id);
    }

    if (filters.status) {
      whereConditions.push(`status = $${paramIndex++}`);
      values.push(filters.status);
    }

    if (filters.created_after) {
      whereConditions.push(`created_at >= $${paramIndex++}`);
      values.push(filters.created_after);
    }

    const whereClause = whereConditions.join(' AND ');
    const limit = filters.limit || 20;
    const offset = filters.offset || 0;

    const countQuery = `SELECT COUNT(*) FROM export.export_jobs WHERE ${whereClause}`;
    const dataQuery = `
      SELECT * FROM export.export_jobs 
      WHERE ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex}
    `;

    values.push(limit, offset);

    try {
      const [countResult, dataResult] = await Promise.all([
        db.query(countQuery, values.slice(0, -2)),
        db.query(dataQuery, values)
      ]);

      return {
        jobs: dataResult.rows.map(row => this.mapExportJobRow(row)),
        total: parseInt(countResult.rows[0].count)
      };
    } catch (error) {
      logger.error('Failed to list export jobs', { error: error.message, organizationId, filters });
      throw error;
    }
  }

  // Export Configuration Operations
  async createExportConfiguration(configData: Partial<ExportConfiguration>): Promise<ExportConfiguration> {
    const id = uuidv4();
    const now = new Date();
    
    const query = `
      INSERT INTO export.export_configurations (
        id, organization_id, name, description, format_type, template_content,
        template_variables, output_structure, preprocessing_rules, postprocessing_rules,
        transformation_rules, format_settings, file_extension, mime_type,
        minify_output, include_metadata, include_comments, validate_output,
        version, is_public, is_system_config, status, created_at, updated_at, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25)
      RETURNING *
    `;
    
    const values = [
      id,
      configData.organization_id,
      configData.name,
      configData.description || null,
      configData.format_type,
      configData.template_content || null,
      JSON.stringify(configData.template_variables || {}),
      JSON.stringify(configData.output_structure || {}),
      JSON.stringify(configData.preprocessing_rules || []),
      JSON.stringify(configData.postprocessing_rules || []),
      JSON.stringify(configData.transformation_rules || {}),
      JSON.stringify(configData.format_settings || {}),
      configData.file_extension || null,
      configData.mime_type || null,
      configData.minify_output ?? false,
      configData.include_metadata ?? true,
      configData.include_comments ?? true,
      configData.validate_output ?? true,
      configData.version || 1,
      configData.is_public ?? false,
      configData.is_system_config ?? false,
      configData.status || 'active',
      now,
      now,
      configData.created_by
    ];
    
    try {
      const result = await db.query(query, values);
      return this.mapExportConfigurationRow(result.rows[0]);
    } catch (error) {
      logger.error('Failed to create export configuration', { error: error.message, configData });
      throw error;
    }
  }

  async getExportConfiguration(id: string, organizationId: string): Promise<ExportConfiguration | null> {
    const query = `
      SELECT * FROM export.export_configurations 
      WHERE id = $1 AND (organization_id = $2 OR is_public = true OR is_system_config = true)
      AND is_deleted = false
    `;
    
    try {
      const result = await db.query(query, [id, organizationId]);
      return result.rows[0] ? this.mapExportConfigurationRow(result.rows[0]) : null;
    } catch (error) {
      logger.error('Failed to get export configuration', { error: error.message, id, organizationId });
      throw error;
    }
  }

  // Export Result Operations
  async createExportResult(resultData: Partial<ExportResult>): Promise<ExportResult> {
    const id = uuidv4();
    const now = new Date();
    
    const query = `
      INSERT INTO export.export_results (
        id, export_job_id, result_type, file_name, file_path, content,
        content_size_bytes, content_hash, format_type, mime_type, file_extension,
        encoding, storage_provider, storage_bucket, storage_key, storage_url,
        is_public, access_token, expires_at, metadata, dependencies, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23)
      RETURNING *
    `;
    
    const values = [
      id,
      resultData.export_job_id,
      resultData.result_type || 'primary',
      resultData.file_name,
      resultData.file_path || null,
      resultData.content || null,
      resultData.content_size_bytes || null,
      resultData.content_hash || null,
      resultData.format_type,
      resultData.mime_type || null,
      resultData.file_extension || null,
      resultData.encoding || 'UTF-8',
      resultData.storage_provider || 's3',
      resultData.storage_bucket || null,
      resultData.storage_key || null,
      resultData.storage_url || null,
      resultData.is_public ?? false,
      resultData.access_token || null,
      resultData.expires_at || null,
      JSON.stringify(resultData.metadata || {}),
      resultData.dependencies || [],
      now,
      now
    ];
    
    try {
      const result = await db.query(query, values);
      return this.mapExportResultRow(result.rows[0]);
    } catch (error) {
      logger.error('Failed to create export result', { error: error.message, resultData });
      throw error;
    }
  }

  async getExportResultsByJob(jobId: string): Promise<ExportResult[]> {
    const query = `
      SELECT * FROM export.export_results 
      WHERE export_job_id = $1
      ORDER BY created_at ASC
    `;
    
    try {
      const result = await db.query(query, [jobId]);
      return result.rows.map(row => this.mapExportResultRow(row));
    } catch (error) {
      logger.error('Failed to get export results by job', { error: error.message, jobId });
      throw error;
    }
  }

  // Export Template Operations
  async createExportTemplate(templateData: Partial<ExportTemplate>): Promise<ExportTemplate> {
    const id = uuidv4();
    const now = new Date();
    
    const query = `
      INSERT INTO export.export_templates (
        id, organization_id, name, description, category, format_type,
        template_content, sample_output, variables, sections, components,
        engine, engine_config, custom_helpers, version, is_public, is_system_template,
        status, created_at, updated_at, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
      RETURNING *
    `;
    
    const values = [
      id,
      templateData.organization_id,
      templateData.name,
      templateData.description || null,
      templateData.category || null,
      templateData.format_type,
      templateData.template_content,
      templateData.sample_output || null,
      JSON.stringify(templateData.variables || {}),
      JSON.stringify(templateData.sections || []),
      JSON.stringify(templateData.components || {}),
      templateData.engine || 'handlebars',
      JSON.stringify(templateData.engine_config || {}),
      JSON.stringify(templateData.custom_helpers || {}),
      templateData.version || 1,
      templateData.is_public ?? false,
      templateData.is_system_template ?? false,
      templateData.status || 'active',
      now,
      now,
      templateData.created_by
    ];
    
    try {
      const result = await db.query(query, values);
      return this.mapExportTemplateRow(result.rows[0]);
    } catch (error) {
      logger.error('Failed to create export template', { error: error.message, templateData });
      throw error;
    }
  }

  async getExportTemplate(id: string, organizationId: string): Promise<ExportTemplate | null> {
    const query = `
      SELECT * FROM export.export_templates 
      WHERE id = $1 AND (organization_id = $2 OR is_public = true OR is_system_template = true)
      AND is_deleted = false
    `;
    
    try {
      const result = await db.query(query, [id, organizationId]);
      return result.rows[0] ? this.mapExportTemplateRow(result.rows[0]) : null;
    } catch (error) {
      logger.error('Failed to get export template', { error: error.message, id, organizationId });
      throw error;
    }
  }

  async listExportTemplates(
    organizationId: string,
    filters: {
      format_type?: string;
      category?: string;
      is_public?: boolean;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<{ templates: ExportTemplate[]; total: number }> {
    let whereConditions = ['(organization_id = $1 OR is_public = true OR is_system_template = true)', 'is_deleted = false'];
    let values: any[] = [organizationId];
    let paramIndex = 2;

    if (filters.format_type) {
      whereConditions.push(`format_type = $${paramIndex++}`);
      values.push(filters.format_type);
    }

    if (filters.category) {
      whereConditions.push(`category = $${paramIndex++}`);
      values.push(filters.category);
    }

    if (filters.is_public !== undefined) {
      whereConditions.push(`is_public = $${paramIndex++}`);
      values.push(filters.is_public);
    }

    const whereClause = whereConditions.join(' AND ');
    const limit = filters.limit || 20;
    const offset = filters.offset || 0;

    const countQuery = `SELECT COUNT(*) FROM export.export_templates WHERE ${whereClause}`;
    const dataQuery = `
      SELECT * FROM export.export_templates 
      WHERE ${whereClause}
      ORDER BY usage_count DESC, average_rating DESC, created_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex}
    `;

    values.push(limit, offset);

    try {
      const [countResult, dataResult] = await Promise.all([
        db.query(countQuery, values.slice(0, -2)),
        db.query(dataQuery, values)
      ]);

      return {
        templates: dataResult.rows.map(row => this.mapExportTemplateRow(row)),
        total: parseInt(countResult.rows[0].count)
      };
    } catch (error) {
      logger.error('Failed to list export templates', { error: error.message, organizationId, filters });
      throw error;
    }
  }

  // Helper methods for mapping database rows to objects
  private mapExportJobRow(row: any): ExportJob {
    return {
      id: row.id,
      organization_id: row.organization_id,
      project_id: row.project_id,
      translation_result_id: row.translation_result_id,
      export_config_id: row.export_config_id,
      job_name: row.job_name,
      export_type: row.export_type,
      input_source: row.input_source,
      input_data: row.input_data,
      custom_settings: row.custom_settings,
      include_assets: row.include_assets,
      include_interactions: row.include_interactions,
      include_animations: row.include_animations,
      target_platforms: row.target_platforms,
      status: row.status,
      priority: row.priority,
      retry_count: row.retry_count,
      max_retries: row.max_retries,
      queued_at: row.queued_at,
      started_at: row.started_at,
      completed_at: row.completed_at,
      processing_time_ms: row.processing_time_ms,
      error_message: row.error_message,
      error_code: row.error_code,
      error_details: row.error_details,
      validation_status: row.validation_status,
      validation_errors: row.validation_errors,
      validation_warnings: row.validation_warnings,
      created_at: row.created_at,
      updated_at: row.updated_at,
      created_by: row.created_by
    };
  }

  private mapExportConfigurationRow(row: any): ExportConfiguration {
    return {
      id: row.id,
      organization_id: row.organization_id,
      name: row.name,
      description: row.description,
      format_type: row.format_type,
      template_content: row.template_content,
      template_variables: row.template_variables,
      output_structure: row.output_structure,
      preprocessing_rules: row.preprocessing_rules,
      postprocessing_rules: row.postprocessing_rules,
      transformation_rules: row.transformation_rules,
      format_settings: row.format_settings,
      file_extension: row.file_extension,
      mime_type: row.mime_type,
      minify_output: row.minify_output,
      include_metadata: row.include_metadata,
      include_comments: row.include_comments,
      validate_output: row.validate_output,
      usage_count: row.usage_count,
      success_rate: row.success_rate,
      average_rating: row.average_rating,
      version: row.version,
      parent_config_id: row.parent_config_id,
      is_public: row.is_public,
      is_system_config: row.is_system_config,
      status: row.status,
      created_at: row.created_at,
      updated_at: row.updated_at,
      created_by: row.created_by
    };
  }

  private mapExportResultRow(row: any): ExportResult {
    return {
      id: row.id,
      export_job_id: row.export_job_id,
      result_type: row.result_type,
      file_name: row.file_name,
      file_path: row.file_path,
      content: row.content,
      content_size_bytes: row.content_size_bytes,
      content_hash: row.content_hash,
      format_type: row.format_type,
      mime_type: row.mime_type,
      file_extension: row.file_extension,
      encoding: row.encoding,
      storage_provider: row.storage_provider,
      storage_bucket: row.storage_bucket,
      storage_key: row.storage_key,
      storage_url: row.storage_url,
      is_public: row.is_public,
      access_token: row.access_token,
      expires_at: row.expires_at,
      download_count: row.download_count,
      view_count: row.view_count,
      last_accessed_at: row.last_accessed_at,
      quality_score: row.quality_score,
      user_rating: row.user_rating,
      metadata: row.metadata,
      dependencies: row.dependencies,
      created_at: row.created_at,
      updated_at: row.updated_at
    };
  }

  private mapExportTemplateRow(row: any): ExportTemplate {
    return {
      id: row.id,
      organization_id: row.organization_id,
      name: row.name,
      description: row.description,
      category: row.category,
      format_type: row.format_type,
      template_content: row.template_content,
      sample_output: row.sample_output,
      variables: row.variables,
      sections: row.sections,
      components: row.components,
      engine: row.engine,
      engine_config: row.engine_config,
      custom_helpers: row.custom_helpers,
      usage_count: row.usage_count,
      average_rating: row.average_rating,
      version: row.version,
      parent_template_id: row.parent_template_id,
      is_public: row.is_public,
      is_system_template: row.is_system_template,
      status: row.status,
      created_at: row.created_at,
      updated_at: row.updated_at,
      created_by: row.created_by
    };
  }
}

export const exportDbOps = new ExportDatabaseOperations();
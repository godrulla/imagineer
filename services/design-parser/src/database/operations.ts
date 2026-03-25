import { Pool, Client } from 'pg';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

export interface DatabaseProject {
  id: string;
  organization_id: string;
  team_id?: string;
  name: string;
  slug: string;
  description?: string;
  source_tool: string;
  source_url?: string;
  source_file_id?: string;
  settings: any;
  auto_sync: boolean;
  sync_frequency_minutes: number;
  last_sync_at?: Date;
  next_sync_at?: Date;
  thumbnail_url?: string;
  tags: string[];
  category?: string;
  visibility: 'private' | 'team' | 'organization';
  view_count: number;
  translation_count: number;
  export_count: number;
  status: 'active' | 'archived' | 'deleted';
  created_at: Date;
  updated_at: Date;
  deleted_at?: Date;
  is_deleted: boolean;
  created_by: string;
}

export interface DatabaseDesignFile {
  id: string;
  project_id: string;
  name: string;
  original_filename?: string;
  file_type: string;
  file_size_bytes?: number;
  file_hash?: string;
  storage_path?: string;
  storage_provider: string;
  storage_bucket?: string;
  storage_key?: string;
  external_id?: string;
  external_url?: string;
  external_last_modified?: Date;
  processing_status: 'pending' | 'processing' | 'completed' | 'failed' | 'skipped';
  processing_started_at?: Date;
  processing_completed_at?: Date;
  processing_error?: string;
  processing_metadata: any;
  metadata: any;
  created_at: Date;
  updated_at: Date;
  uploaded_by?: string;
}

export interface DatabaseParsedDesign {
  id: string;
  design_file_id: string;
  version_id?: string;
  parser_version: string;
  parser_engine: string;
  raw_data: any;
  raw_data_size?: number;
  elements: any;
  styles: any;
  layout: any;
  components: any;
  interactions: any;
  complexity_score?: number;
  element_count?: number;
  layer_depth?: number;
  has_interactions: boolean;
  has_animations: boolean;
  responsive_breakpoints?: string[];
  processing_time_ms?: number;
  memory_usage_mb?: number;
  parsing_confidence?: number;
  validation_errors: any[];
  validation_warnings: any[];
  created_at: Date;
  updated_at: Date;
}

export interface DatabaseDesignElement {
  id: string;
  parsed_design_id: string;
  element_id: string;
  parent_id?: string;
  element_type: string;
  element_name?: string;
  level: number;
  order_index: number;
  path?: string;
  properties: any;
  styles: any;
  constraints: any;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  rotation: number;
  text_content?: string;
  image_url?: string;
  is_visible: boolean;
  is_locked: boolean;
  states: any;
  variants: any;
  created_at: Date;
}

export interface DatabaseSyncLog {
  id: string;
  project_id: string;
  sync_type: 'manual' | 'automatic' | 'webhook';
  trigger_source?: string;
  status: 'started' | 'completed' | 'failed' | 'partial';
  files_processed: number;
  files_updated: number;
  files_added: number;
  files_deleted: number;
  started_at: Date;
  completed_at?: Date;
  duration_ms?: number;
  changes_detected: any;
  error_message?: string;
  error_details?: any;
  external_version?: string;
  sync_metadata: any;
  triggered_by?: string;
}

export class DatabaseOperations {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  // ============================================================================
  // PROJECT OPERATIONS
  // ============================================================================

  async createProject(project: Omit<DatabaseProject, 'id' | 'created_at' | 'updated_at'>): Promise<DatabaseProject> {
    const client = await this.pool.connect();
    try {
      const id = uuidv4();
      const now = new Date();

      const query = `
        INSERT INTO design.projects (
          id, organization_id, team_id, name, slug, description, source_tool,
          source_url, source_file_id, settings, auto_sync, sync_frequency_minutes,
          last_sync_at, next_sync_at, thumbnail_url, tags, category, visibility,
          view_count, translation_count, export_count, status, created_at,
          updated_at, deleted_at, is_deleted, created_by
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16,
          $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27
        ) RETURNING *
      `;

      const values = [
        id, project.organization_id, project.team_id, project.name, project.slug,
        project.description, project.source_tool, project.source_url, project.source_file_id,
        JSON.stringify(project.settings), project.auto_sync, project.sync_frequency_minutes,
        project.last_sync_at, project.next_sync_at, project.thumbnail_url, project.tags,
        project.category, project.visibility, project.view_count, project.translation_count,
        project.export_count, project.status, now, now, project.deleted_at,
        project.is_deleted, project.created_by
      ];

      const result = await client.query(query, values);
      logger.info('Project created successfully', { projectId: id, name: project.name });
      
      return this.mapRowToProject(result.rows[0]);
    } catch (error) {
      logger.error('Failed to create project', { error: error.message, project: project.name });
      throw error;
    } finally {
      client.release();
    }
  }

  async getProject(id: string): Promise<DatabaseProject | null> {
    const client = await this.pool.connect();
    try {
      const query = 'SELECT * FROM design.projects WHERE id = $1 AND is_deleted = FALSE';
      const result = await client.query(query, [id]);
      
      if (result.rows.length === 0) {
        return null;
      }

      return this.mapRowToProject(result.rows[0]);
    } catch (error) {
      logger.error('Failed to get project', { error: error.message, projectId: id });
      throw error;
    } finally {
      client.release();
    }
  }

  async getProjectBySlug(organizationId: string, slug: string): Promise<DatabaseProject | null> {
    const client = await this.pool.connect();
    try {
      const query = 'SELECT * FROM design.projects WHERE organization_id = $1 AND slug = $2 AND is_deleted = FALSE';
      const result = await client.query(query, [organizationId, slug]);
      
      if (result.rows.length === 0) {
        return null;
      }

      return this.mapRowToProject(result.rows[0]);
    } catch (error) {
      logger.error('Failed to get project by slug', { error: error.message, organizationId, slug });
      throw error;
    } finally {
      client.release();
    }
  }

  async getProjectsByOrganization(
    organizationId: string,
    options: {
      teamId?: string;
      status?: string;
      sourceTool?: string;
      search?: string;
      page?: number;
      limit?: number;
      sort?: string;
    } = {}
  ): Promise<{ projects: DatabaseProject[]; total: number }> {
    const client = await this.pool.connect();
    try {
      let whereConditions = ['organization_id = $1', 'is_deleted = FALSE'];
      let params: any[] = [organizationId];
      let paramIndex = 2;

      if (options.teamId) {
        whereConditions.push(`team_id = $${paramIndex++}`);
        params.push(options.teamId);
      }

      if (options.status) {
        whereConditions.push(`status = $${paramIndex++}`);
        params.push(options.status);
      }

      if (options.sourceTool) {
        whereConditions.push(`source_tool = $${paramIndex++}`);
        params.push(options.sourceTool);
      }

      if (options.search) {
        whereConditions.push(`(name ILIKE $${paramIndex} OR description ILIKE $${paramIndex})`);
        params.push(`%${options.search}%`);
        paramIndex++;
      }

      const whereClause = whereConditions.join(' AND ');
      
      // Parse sort parameter
      const sortOptions = options.sort?.split(':') || ['created_at', 'desc'];
      const sortField = sortOptions[0] || 'created_at';
      const sortDirection = sortOptions[1]?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
      
      // Count query
      const countQuery = `SELECT COUNT(*) FROM design.projects WHERE ${whereClause}`;
      const countResult = await client.query(countQuery, params);
      const total = parseInt(countResult.rows[0].count);

      // Data query with pagination
      const page = options.page || 1;
      const limit = Math.min(options.limit || 20, 100);
      const offset = (page - 1) * limit;

      const dataQuery = `
        SELECT * FROM design.projects 
        WHERE ${whereClause}
        ORDER BY ${sortField} ${sortDirection}
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;
      params.push(limit, offset);

      const dataResult = await client.query(dataQuery, params);
      const projects = dataResult.rows.map(row => this.mapRowToProject(row));

      return { projects, total };
    } catch (error) {
      logger.error('Failed to get projects by organization', { error: error.message, organizationId });
      throw error;
    } finally {
      client.release();
    }
  }

  async updateProject(id: string, updates: Partial<DatabaseProject>): Promise<DatabaseProject | null> {
    const client = await this.pool.connect();
    try {
      const updateFields = [];
      const params = [];
      let paramIndex = 1;

      // Build dynamic update query
      Object.entries(updates).forEach(([key, value]) => {
        if (key !== 'id' && key !== 'created_at' && value !== undefined) {
          if (key === 'settings' || key === 'tags') {
            updateFields.push(`${key} = $${paramIndex++}`);
            params.push(typeof value === 'object' ? JSON.stringify(value) : value);
          } else {
            updateFields.push(`${key} = $${paramIndex++}`);
            params.push(value);
          }
        }
      });

      if (updateFields.length === 0) {
        return await this.getProject(id);
      }

      updateFields.push(`updated_at = $${paramIndex++}`);
      params.push(new Date());
      params.push(id);

      const query = `
        UPDATE design.projects 
        SET ${updateFields.join(', ')}
        WHERE id = $${paramIndex} AND is_deleted = FALSE
        RETURNING *
      `;

      const result = await client.query(query, params);
      
      if (result.rows.length === 0) {
        return null;
      }

      logger.info('Project updated successfully', { projectId: id });
      return this.mapRowToProject(result.rows[0]);
    } catch (error) {
      logger.error('Failed to update project', { error: error.message, projectId: id });
      throw error;
    } finally {
      client.release();
    }
  }

  async deleteProject(id: string): Promise<boolean> {
    const client = await this.pool.connect();
    try {
      const query = `
        UPDATE design.projects 
        SET is_deleted = TRUE, deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE id = $1 AND is_deleted = FALSE
      `;

      const result = await client.query(query, [id]);
      logger.info('Project soft deleted successfully', { projectId: id });
      
      return result.rowCount > 0;
    } catch (error) {
      logger.error('Failed to delete project', { error: error.message, projectId: id });
      throw error;
    } finally {
      client.release();
    }
  }

  // ============================================================================
  // DESIGN FILE OPERATIONS
  // ============================================================================

  async createDesignFile(file: Omit<DatabaseDesignFile, 'id' | 'created_at' | 'updated_at'>): Promise<DatabaseDesignFile> {
    const client = await this.pool.connect();
    try {
      const id = uuidv4();
      const now = new Date();

      const query = `
        INSERT INTO design.design_files (
          id, project_id, name, original_filename, file_type, file_size_bytes,
          file_hash, storage_path, storage_provider, storage_bucket, storage_key,
          external_id, external_url, external_last_modified, processing_status,
          processing_started_at, processing_completed_at, processing_error,
          processing_metadata, metadata, created_at, updated_at, uploaded_by
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
          $16, $17, $18, $19, $20, $21, $22, $23
        ) RETURNING *
      `;

      const values = [
        id, file.project_id, file.name, file.original_filename, file.file_type,
        file.file_size_bytes, file.file_hash, file.storage_path, file.storage_provider,
        file.storage_bucket, file.storage_key, file.external_id, file.external_url,
        file.external_last_modified, file.processing_status, file.processing_started_at,
        file.processing_completed_at, file.processing_error, JSON.stringify(file.processing_metadata),
        JSON.stringify(file.metadata), now, now, file.uploaded_by
      ];

      const result = await client.query(query, values);
      logger.info('Design file created successfully', { fileId: id, name: file.name });
      
      return this.mapRowToDesignFile(result.rows[0]);
    } catch (error) {
      logger.error('Failed to create design file', { error: error.message, fileName: file.name });
      throw error;
    } finally {
      client.release();
    }
  }

  async getDesignFile(id: string): Promise<DatabaseDesignFile | null> {
    const client = await this.pool.connect();
    try {
      const query = 'SELECT * FROM design.design_files WHERE id = $1';
      const result = await client.query(query, [id]);
      
      if (result.rows.length === 0) {
        return null;
      }

      return this.mapRowToDesignFile(result.rows[0]);
    } catch (error) {
      logger.error('Failed to get design file', { error: error.message, fileId: id });
      throw error;
    } finally {
      client.release();
    }
  }

  async getDesignFilesByProject(
    projectId: string,
    options: {
      fileType?: string;
      processingStatus?: string;
      page?: number;
      limit?: number;
    } = {}
  ): Promise<{ files: DatabaseDesignFile[]; total: number }> {
    const client = await this.pool.connect();
    try {
      let whereConditions = ['project_id = $1'];
      let params: any[] = [projectId];
      let paramIndex = 2;

      if (options.fileType) {
        whereConditions.push(`file_type = $${paramIndex++}`);
        params.push(options.fileType);
      }

      if (options.processingStatus) {
        whereConditions.push(`processing_status = $${paramIndex++}`);
        params.push(options.processingStatus);
      }

      const whereClause = whereConditions.join(' AND ');
      
      // Count query
      const countQuery = `SELECT COUNT(*) FROM design.design_files WHERE ${whereClause}`;
      const countResult = await client.query(countQuery, params);
      const total = parseInt(countResult.rows[0].count);

      // Data query with pagination
      const page = options.page || 1;
      const limit = Math.min(options.limit || 20, 100);
      const offset = (page - 1) * limit;

      const dataQuery = `
        SELECT * FROM design.design_files 
        WHERE ${whereClause}
        ORDER BY created_at DESC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;
      params.push(limit, offset);

      const dataResult = await client.query(dataQuery, params);
      const files = dataResult.rows.map(row => this.mapRowToDesignFile(row));

      return { files, total };
    } catch (error) {
      logger.error('Failed to get design files by project', { error: error.message, projectId });
      throw error;
    } finally {
      client.release();
    }
  }

  async updateDesignFile(id: string, updates: Partial<DatabaseDesignFile>): Promise<DatabaseDesignFile | null> {
    const client = await this.pool.connect();
    try {
      const updateFields = [];
      const params = [];
      let paramIndex = 1;

      // Build dynamic update query
      Object.entries(updates).forEach(([key, value]) => {
        if (key !== 'id' && key !== 'created_at' && value !== undefined) {
          if (key === 'processing_metadata' || key === 'metadata') {
            updateFields.push(`${key} = $${paramIndex++}`);
            params.push(JSON.stringify(value));
          } else {
            updateFields.push(`${key} = $${paramIndex++}`);
            params.push(value);
          }
        }
      });

      if (updateFields.length === 0) {
        return await this.getDesignFile(id);
      }

      updateFields.push(`updated_at = $${paramIndex++}`);
      params.push(new Date());
      params.push(id);

      const query = `
        UPDATE design.design_files 
        SET ${updateFields.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING *
      `;

      const result = await client.query(query, params);
      
      if (result.rows.length === 0) {
        return null;
      }

      logger.info('Design file updated successfully', { fileId: id });
      return this.mapRowToDesignFile(result.rows[0]);
    } catch (error) {
      logger.error('Failed to update design file', { error: error.message, fileId: id });
      throw error;
    } finally {
      client.release();
    }
  }

  // ============================================================================
  // PARSED DESIGN OPERATIONS
  // ============================================================================

  async createParsedDesign(design: Omit<DatabaseParsedDesign, 'id' | 'created_at' | 'updated_at'>): Promise<DatabaseParsedDesign> {
    const client = await this.pool.connect();
    try {
      const id = uuidv4();
      const now = new Date();

      const query = `
        INSERT INTO design.parsed_designs (
          id, design_file_id, version_id, parser_version, parser_engine, raw_data,
          elements, styles, layout, components, interactions, complexity_score,
          element_count, layer_depth, has_interactions, has_animations,
          responsive_breakpoints, processing_time_ms, memory_usage_mb,
          parsing_confidence, validation_errors, validation_warnings,
          created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
          $16, $17, $18, $19, $20, $21, $22, $23, $24
        ) RETURNING *
      `;

      const values = [
        id, design.design_file_id, design.version_id, design.parser_version,
        design.parser_engine, JSON.stringify(design.raw_data), JSON.stringify(design.elements),
        JSON.stringify(design.styles), JSON.stringify(design.layout), JSON.stringify(design.components),
        JSON.stringify(design.interactions), design.complexity_score, design.element_count,
        design.layer_depth, design.has_interactions, design.has_animations,
        design.responsive_breakpoints, design.processing_time_ms, design.memory_usage_mb,
        design.parsing_confidence, JSON.stringify(design.validation_errors),
        JSON.stringify(design.validation_warnings), now, now
      ];

      const result = await client.query(query, values);
      logger.info('Parsed design created successfully', { parsedDesignId: id, fileId: design.design_file_id });
      
      return this.mapRowToParsedDesign(result.rows[0]);
    } catch (error) {
      logger.error('Failed to create parsed design', { error: error.message, fileId: design.design_file_id });
      throw error;
    } finally {
      client.release();
    }
  }

  async getParsedDesignByFile(fileId: string): Promise<DatabaseParsedDesign | null> {
    const client = await this.pool.connect();
    try {
      const query = 'SELECT * FROM design.parsed_designs WHERE design_file_id = $1 ORDER BY created_at DESC LIMIT 1';
      const result = await client.query(query, [fileId]);
      
      if (result.rows.length === 0) {
        return null;
      }

      return this.mapRowToParsedDesign(result.rows[0]);
    } catch (error) {
      logger.error('Failed to get parsed design by file', { error: error.message, fileId });
      throw error;
    } finally {
      client.release();
    }
  }

  // ============================================================================
  // DESIGN ELEMENT OPERATIONS
  // ============================================================================

  async createDesignElements(elements: Omit<DatabaseDesignElement, 'id' | 'created_at'>[]): Promise<DatabaseDesignElement[]> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const insertedElements: DatabaseDesignElement[] = [];
      const now = new Date();

      for (const element of elements) {
        const id = uuidv4();
        
        const query = `
          INSERT INTO design.design_elements (
            id, parsed_design_id, element_id, parent_id, element_type, element_name,
            level, order_index, path, properties, styles, constraints, x, y, width,
            height, rotation, text_content, image_url, is_visible, is_locked,
            states, variants, created_at
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
            $16, $17, $18, $19, $20, $21, $22, $23, $24
          ) RETURNING *
        `;

        const values = [
          id, element.parsed_design_id, element.element_id, element.parent_id,
          element.element_type, element.element_name, element.level, element.order_index,
          element.path, JSON.stringify(element.properties), JSON.stringify(element.styles),
          JSON.stringify(element.constraints), element.x, element.y, element.width,
          element.height, element.rotation, element.text_content, element.image_url,
          element.is_visible, element.is_locked, JSON.stringify(element.states),
          JSON.stringify(element.variants), now
        ];

        const result = await client.query(query, values);
        insertedElements.push(this.mapRowToDesignElement(result.rows[0]));
      }

      await client.query('COMMIT');
      logger.info('Design elements created successfully', { 
        parsedDesignId: elements[0]?.parsed_design_id,
        elementCount: insertedElements.length 
      });
      
      return insertedElements;
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Failed to create design elements', { error: error.message });
      throw error;
    } finally {
      client.release();
    }
  }

  async getDesignElementsByParsedDesign(
    parsedDesignId: string,
    options: {
      elementType?: string;
      layerName?: string;
      page?: number;
      limit?: number;
    } = {}
  ): Promise<{ elements: DatabaseDesignElement[]; total: number }> {
    const client = await this.pool.connect();
    try {
      let whereConditions = ['parsed_design_id = $1'];
      let params: any[] = [parsedDesignId];
      let paramIndex = 2;

      if (options.elementType) {
        whereConditions.push(`element_type = $${paramIndex++}`);
        params.push(options.elementType);
      }

      if (options.layerName) {
        whereConditions.push(`element_name ILIKE $${paramIndex++}`);
        params.push(`%${options.layerName}%`);
      }

      const whereClause = whereConditions.join(' AND ');
      
      // Count query
      const countQuery = `SELECT COUNT(*) FROM design.design_elements WHERE ${whereClause}`;
      const countResult = await client.query(countQuery, params);
      const total = parseInt(countResult.rows[0].count);

      // Data query with pagination
      const page = options.page || 1;
      const limit = Math.min(options.limit || 100, 500);
      const offset = (page - 1) * limit;

      const dataQuery = `
        SELECT * FROM design.design_elements 
        WHERE ${whereClause}
        ORDER BY level ASC, order_index ASC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;
      params.push(limit, offset);

      const dataResult = await client.query(dataQuery, params);
      const elements = dataResult.rows.map(row => this.mapRowToDesignElement(row));

      return { elements, total };
    } catch (error) {
      logger.error('Failed to get design elements by parsed design', { error: error.message, parsedDesignId });
      throw error;
    } finally {
      client.release();
    }
  }

  // ============================================================================
  // SYNC LOG OPERATIONS
  // ============================================================================

  async createSyncLog(syncLog: Omit<DatabaseSyncLog, 'id' | 'started_at'>): Promise<DatabaseSyncLog> {
    const client = await this.pool.connect();
    try {
      const id = uuidv4();
      const now = new Date();

      const query = `
        INSERT INTO design.sync_logs (
          id, project_id, sync_type, trigger_source, status, files_processed,
          files_updated, files_added, files_deleted, started_at, completed_at,
          duration_ms, changes_detected, error_message, error_details,
          external_version, sync_metadata, triggered_by
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18
        ) RETURNING *
      `;

      const values = [
        id, syncLog.project_id, syncLog.sync_type, syncLog.trigger_source,
        syncLog.status, syncLog.files_processed, syncLog.files_updated,
        syncLog.files_added, syncLog.files_deleted, now, syncLog.completed_at,
        syncLog.duration_ms, JSON.stringify(syncLog.changes_detected),
        syncLog.error_message, JSON.stringify(syncLog.error_details),
        syncLog.external_version, JSON.stringify(syncLog.sync_metadata),
        syncLog.triggered_by
      ];

      const result = await client.query(query, values);
      logger.info('Sync log created successfully', { syncLogId: id, projectId: syncLog.project_id });
      
      return this.mapRowToSyncLog(result.rows[0]);
    } catch (error) {
      logger.error('Failed to create sync log', { error: error.message, projectId: syncLog.project_id });
      throw error;
    } finally {
      client.release();
    }
  }

  async updateSyncLog(id: string, updates: Partial<DatabaseSyncLog>): Promise<DatabaseSyncLog | null> {
    const client = await this.pool.connect();
    try {
      const updateFields = [];
      const params = [];
      let paramIndex = 1;

      // Build dynamic update query
      Object.entries(updates).forEach(([key, value]) => {
        if (key !== 'id' && key !== 'started_at' && value !== undefined) {
          if (key === 'changes_detected' || key === 'error_details' || key === 'sync_metadata') {
            updateFields.push(`${key} = $${paramIndex++}`);
            params.push(JSON.stringify(value));
          } else {
            updateFields.push(`${key} = $${paramIndex++}`);
            params.push(value);
          }
        }
      });

      if (updateFields.length === 0) {
        const query = 'SELECT * FROM design.sync_logs WHERE id = $1';
        const result = await client.query(query, [id]);
        return result.rows.length > 0 ? this.mapRowToSyncLog(result.rows[0]) : null;
      }

      params.push(id);

      const query = `
        UPDATE design.sync_logs 
        SET ${updateFields.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING *
      `;

      const result = await client.query(query, params);
      
      if (result.rows.length === 0) {
        return null;
      }

      logger.info('Sync log updated successfully', { syncLogId: id });
      return this.mapRowToSyncLog(result.rows[0]);
    } catch (error) {
      logger.error('Failed to update sync log', { error: error.message, syncLogId: id });
      throw error;
    } finally {
      client.release();
    }
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  private mapRowToProject(row: any): DatabaseProject {
    return {
      id: row.id,
      organization_id: row.organization_id,
      team_id: row.team_id,
      name: row.name,
      slug: row.slug,
      description: row.description,
      source_tool: row.source_tool,
      source_url: row.source_url,
      source_file_id: row.source_file_id,
      settings: typeof row.settings === 'string' ? JSON.parse(row.settings) : row.settings,
      auto_sync: row.auto_sync,
      sync_frequency_minutes: row.sync_frequency_minutes,
      last_sync_at: row.last_sync_at,
      next_sync_at: row.next_sync_at,
      thumbnail_url: row.thumbnail_url,
      tags: row.tags || [],
      category: row.category,
      visibility: row.visibility,
      view_count: row.view_count,
      translation_count: row.translation_count,
      export_count: row.export_count,
      status: row.status,
      created_at: row.created_at,
      updated_at: row.updated_at,
      deleted_at: row.deleted_at,
      is_deleted: row.is_deleted,
      created_by: row.created_by
    };
  }

  private mapRowToDesignFile(row: any): DatabaseDesignFile {
    return {
      id: row.id,
      project_id: row.project_id,
      name: row.name,
      original_filename: row.original_filename,
      file_type: row.file_type,
      file_size_bytes: row.file_size_bytes,
      file_hash: row.file_hash,
      storage_path: row.storage_path,
      storage_provider: row.storage_provider,
      storage_bucket: row.storage_bucket,
      storage_key: row.storage_key,
      external_id: row.external_id,
      external_url: row.external_url,
      external_last_modified: row.external_last_modified,
      processing_status: row.processing_status,
      processing_started_at: row.processing_started_at,
      processing_completed_at: row.processing_completed_at,
      processing_error: row.processing_error,
      processing_metadata: typeof row.processing_metadata === 'string' ? JSON.parse(row.processing_metadata) : row.processing_metadata,
      metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata,
      created_at: row.created_at,
      updated_at: row.updated_at,
      uploaded_by: row.uploaded_by
    };
  }

  private mapRowToParsedDesign(row: any): DatabaseParsedDesign {
    return {
      id: row.id,
      design_file_id: row.design_file_id,
      version_id: row.version_id,
      parser_version: row.parser_version,
      parser_engine: row.parser_engine,
      raw_data: typeof row.raw_data === 'string' ? JSON.parse(row.raw_data) : row.raw_data,
      raw_data_size: row.raw_data_size,
      elements: typeof row.elements === 'string' ? JSON.parse(row.elements) : row.elements,
      styles: typeof row.styles === 'string' ? JSON.parse(row.styles) : row.styles,
      layout: typeof row.layout === 'string' ? JSON.parse(row.layout) : row.layout,
      components: typeof row.components === 'string' ? JSON.parse(row.components) : row.components,
      interactions: typeof row.interactions === 'string' ? JSON.parse(row.interactions) : row.interactions,
      complexity_score: row.complexity_score,
      element_count: row.element_count,
      layer_depth: row.layer_depth,
      has_interactions: row.has_interactions,
      has_animations: row.has_animations,
      responsive_breakpoints: row.responsive_breakpoints,
      processing_time_ms: row.processing_time_ms,
      memory_usage_mb: row.memory_usage_mb,
      parsing_confidence: row.parsing_confidence,
      validation_errors: typeof row.validation_errors === 'string' ? JSON.parse(row.validation_errors) : row.validation_errors,
      validation_warnings: typeof row.validation_warnings === 'string' ? JSON.parse(row.validation_warnings) : row.validation_warnings,
      created_at: row.created_at,
      updated_at: row.updated_at
    };
  }

  private mapRowToDesignElement(row: any): DatabaseDesignElement {
    return {
      id: row.id,
      parsed_design_id: row.parsed_design_id,
      element_id: row.element_id,
      parent_id: row.parent_id,
      element_type: row.element_type,
      element_name: row.element_name,
      level: row.level,
      order_index: row.order_index,
      path: row.path,
      properties: typeof row.properties === 'string' ? JSON.parse(row.properties) : row.properties,
      styles: typeof row.styles === 'string' ? JSON.parse(row.styles) : row.styles,
      constraints: typeof row.constraints === 'string' ? JSON.parse(row.constraints) : row.constraints,
      x: row.x,
      y: row.y,
      width: row.width,
      height: row.height,
      rotation: row.rotation,
      text_content: row.text_content,
      image_url: row.image_url,
      is_visible: row.is_visible,
      is_locked: row.is_locked,
      states: typeof row.states === 'string' ? JSON.parse(row.states) : row.states,
      variants: typeof row.variants === 'string' ? JSON.parse(row.variants) : row.variants,
      created_at: row.created_at
    };
  }

  private mapRowToSyncLog(row: any): DatabaseSyncLog {
    return {
      id: row.id,
      project_id: row.project_id,
      sync_type: row.sync_type,
      trigger_source: row.trigger_source,
      status: row.status,
      files_processed: row.files_processed,
      files_updated: row.files_updated,
      files_added: row.files_added,
      files_deleted: row.files_deleted,
      started_at: row.started_at,
      completed_at: row.completed_at,
      duration_ms: row.duration_ms,
      changes_detected: typeof row.changes_detected === 'string' ? JSON.parse(row.changes_detected) : row.changes_detected,
      error_message: row.error_message,
      error_details: typeof row.error_details === 'string' ? JSON.parse(row.error_details) : row.error_details,
      external_version: row.external_version,
      sync_metadata: typeof row.sync_metadata === 'string' ? JSON.parse(row.sync_metadata) : row.sync_metadata,
      triggered_by: row.triggered_by
    };
  }
}
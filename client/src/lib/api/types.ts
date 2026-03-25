// API Types for Imagineer Platform
// Generated from OpenAPI specifications

export interface ApiResponse<T = any> {
  data: T;
  success: boolean;
  message?: string;
  error?: ApiError;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, any>;
  request_id?: string;
  validation_errors?: ValidationError[];
}

export interface ValidationError {
  field: string;
  message: string;
  value?: any;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
    has_next: boolean;
    has_prev: boolean;
  };
}

// ============================================================================
// DESIGN PARSER SERVICE TYPES
// ============================================================================

export interface Project {
  id: string;
  organization_id: string;
  team_id?: string;
  name: string;
  slug: string;
  description?: string;
  source_tool: DesignTool;
  source_url?: string;
  source_file_id?: string;
  settings: Record<string, any>;
  auto_sync: boolean;
  sync_frequency_minutes: number;
  last_sync_at?: string;
  next_sync_at?: string;
  thumbnail_url?: string;
  tags: string[];
  category?: string;
  visibility: 'private' | 'team' | 'organization';
  view_count: number;
  translation_count: number;
  export_count: number;
  status: ProjectStatus;
  created_at: string;
  updated_at: string;
  created_by: string;
}

export interface ProjectDetail extends Project {
  files_count: number;
  latest_files: DesignFile[];
  collaborators: ProjectCollaborator[];
  sync_history: SyncEvent[];
}

export interface DesignFile {
  id: string;
  project_id: string;
  name: string;
  original_filename?: string;
  file_type: string;
  file_size_bytes?: number;
  file_hash?: string;
  storage_path?: string;
  external_id?: string;
  external_url?: string;
  external_last_modified?: string;
  processing_status: ProcessingStatus;
  processing_started_at?: string;
  processing_completed_at?: string;
  processing_error?: string;
  processing_metadata: Record<string, any>;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
  uploaded_by?: string;
}

export interface DesignFileDetail extends DesignFile {
  versions: DesignVersion[];
  parsed_data?: ParsedDesign;
  elements_count: number;
  processing_logs: ProcessingLog[];
}

export interface ParsedDesign {
  id: string;
  design_file_id: string;
  version: number;
  canvas_data: Record<string, any>;
  layout_structure: Record<string, any>;
  component_tree: Record<string, any>;
  style_tokens: Record<string, any>;
  design_system: Record<string, any>;
  metadata: Record<string, any>;
  processing_metadata: Record<string, any>;
  created_at: string;
}

export interface DesignElement {
  id: string;
  parsed_design_id: string;
  element_type: ElementType;
  name: string;
  layer_name: string;
  parent_element_id?: string;
  position: Position;
  dimensions: Dimensions;
  styles: Record<string, any>;
  properties: Record<string, any>;
  content?: string;
  children_count: number;
  metadata: Record<string, any>;
}

export interface Position {
  x: number;
  y: number;
  z?: number;
}

export interface Dimensions {
  width: number;
  height: number;
}

// ============================================================================
// TRANSLATION ENGINE TYPES
// ============================================================================

export interface TranslationRequest {
  design_file_id: string;
  target_format: 'markdown' | 'json' | 'yaml' | 'custom';
  llm_provider: 'openai' | 'anthropic' | 'google' | 'custom';
  model_name: string;
  context_strategy: 'minimal' | 'comprehensive' | 'custom';
  include_assets: boolean;
  custom_instructions?: string;
  template_id?: string;
  optimization_level: 'speed' | 'quality' | 'balanced';
}

export interface TranslationResult {
  id: string;
  translation_request_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  generated_prompt: string;
  llm_response?: string;
  confidence_score: number;
  token_usage: {
    input_tokens: number;
    output_tokens: number;
    total_cost: number;
  };
  metadata: Record<string, any>;
  created_at: string;
  completed_at?: string;
}

// ============================================================================
// EXPORT ENGINE TYPES
// ============================================================================

export interface ExportRequest {
  source_type: 'design_file' | 'translation_result' | 'custom';
  source_id: string;
  export_format: ExportFormat;
  template_id?: string;
  customizations: Record<string, any>;
  output_options: {
    include_assets: boolean;
    asset_optimization: 'none' | 'basic' | 'aggressive';
    bundle_type: 'single_file' | 'multi_file' | 'archive';
  };
}

export interface ExportResult {
  id: string;
  export_request_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  output_files: ExportFile[];
  download_url?: string;
  metadata: Record<string, any>;
  created_at: string;
  completed_at?: string;
}

export interface ExportFile {
  filename: string;
  file_type: string;
  file_size_bytes: number;
  download_url: string;
}

// ============================================================================
// COLLABORATION HUB TYPES
// ============================================================================

export interface CollaborationSession {
  id: string;
  project_id: string;
  design_file_id?: string;
  session_type: 'design_editing' | 'review' | 'translation';
  participants: SessionParticipant[];
  created_at: string;
  updated_at: string;
  is_active: boolean;
}

export interface SessionParticipant {
  user_id: string;
  role: 'owner' | 'editor' | 'reviewer' | 'viewer';
  joined_at: string;
  last_activity: string;
  is_online: boolean;
  cursor_position?: Position;
  selection?: string[];
}

export interface CollaborationEvent {
  id: string;
  session_id: string;
  user_id: string;
  event_type: 'cursor_move' | 'selection_change' | 'element_edit' | 'comment_add' | 'join' | 'leave';
  event_data: Record<string, any>;
  timestamp: string;
}

// ============================================================================
// REQUEST/RESPONSE TYPES
// ============================================================================

export interface CreateProjectRequest {
  name: string;
  description?: string;
  team_id?: string;
  source_tool: DesignTool;
  source_url?: string;
  source_file_id?: string;
  settings?: Record<string, any>;
  auto_sync?: boolean;
  sync_frequency_minutes?: number;
  tags?: string[];
  category?: string;
  visibility?: 'private' | 'team' | 'organization';
}

export interface UpdateProjectRequest {
  name?: string;
  description?: string;
  team_id?: string;
  source_url?: string;
  source_file_id?: string;
  settings?: Record<string, any>;
  auto_sync?: boolean;
  sync_frequency_minutes?: number;
  tags?: string[];
  category?: string;
  visibility?: 'private' | 'team' | 'organization';
}

export interface ImportFigmaRequest {
  figma_file_key: string;
  project_id: string;
  access_token?: string;
  pages?: string[];
  auto_sync?: boolean;
}

export interface ProcessFileRequest {
  force_reprocess?: boolean;
  processing_options?: Record<string, any>;
  priority?: number;
}

// ============================================================================
// JOB TYPES
// ============================================================================

export interface Job {
  id: string;
  job_type: JobType;
  status: JobStatus;
  progress_percentage: number;
  started_at?: string;
  completed_at?: string;
  error_message?: string;
  metadata: Record<string, any>;
}

export interface JobDetail extends Job {
  input_data: Record<string, any>;
  output_data: Record<string, any>;
  processing_logs: ProcessingLog[];
}

// ============================================================================
// SUPPORTING TYPES
// ============================================================================

export interface ProjectCollaborator {
  user_id: string;
  role: 'owner' | 'admin' | 'editor' | 'viewer';
  permissions: string[];
  added_at: string;
}

export interface SyncEvent {
  id: string;
  sync_type: 'manual' | 'automatic' | 'webhook';
  status: 'success' | 'failed' | 'partial';
  changes_detected: number;
  files_updated: number;
  started_at: string;
  completed_at: string;
  error_message?: string;
}

export interface DesignVersion {
  id: string;
  version_number: number;
  file_hash: string;
  changes_summary: string;
  created_at: string;
  created_by?: string;
}

export interface ProcessingLog {
  timestamp: string;
  level: 'debug' | 'info' | 'warning' | 'error';
  message: string;
  metadata: Record<string, any>;
}

// ============================================================================
// ENUMS
// ============================================================================

export type DesignTool = 
  | 'figma' 
  | 'sketch' 
  | 'adobe_xd' 
  | 'photoshop' 
  | 'illustrator' 
  | 'invision' 
  | 'marvel' 
  | 'principle' 
  | 'framer' 
  | 'other';

export type ProjectStatus = 'active' | 'archived' | 'deleted';

export type ProcessingStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'skipped';

export type ElementType = 
  | 'frame' 
  | 'group' 
  | 'text' 
  | 'image' 
  | 'vector' 
  | 'component' 
  | 'instance' 
  | 'slice' 
  | 'line' 
  | 'rectangle' 
  | 'ellipse' 
  | 'polygon' 
  | 'star' 
  | 'boolean_operation';

export type JobType = 
  | 'file_upload' 
  | 'file_processing' 
  | 'figma_import' 
  | 'project_sync' 
  | 'element_extraction';

export type JobStatus = 
  | 'queued' 
  | 'processing' 
  | 'completed' 
  | 'failed' 
  | 'cancelled' 
  | 'timeout';

export type ExportFormat = 
  | 'html_css' 
  | 'react_typescript' 
  | 'vue_typescript' 
  | 'angular_typescript' 
  | 'flutter_dart' 
  | 'react_native' 
  | 'markdown' 
  | 'json_schema' 
  | 'yaml_config' 
  | 'figma_plugin';

// ============================================================================
// WEBSOCKET TYPES
// ============================================================================

export interface WebSocketMessage {
  type: string;
  payload: Record<string, any>;
  timestamp: string;
  user_id?: string;
  session_id?: string;
}

export interface CursorUpdateMessage extends WebSocketMessage {
  type: 'cursor_update';
  payload: {
    position: Position;
    user_id: string;
    user_name: string;
  };
}

export interface SelectionUpdateMessage extends WebSocketMessage {
  type: 'selection_update';
  payload: {
    selected_elements: string[];
    user_id: string;
  };
}

export interface ElementUpdateMessage extends WebSocketMessage {
  type: 'element_update';
  payload: {
    element_id: string;
    changes: Record<string, any>;
    user_id: string;
  };
}

export interface CommentMessage extends WebSocketMessage {
  type: 'comment_add';
  payload: {
    comment_id: string;
    content: string;
    position: Position;
    user_id: string;
    user_name: string;
  };
}

// ============================================================================
// AUTHENTICATION TYPES
// ============================================================================

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  avatar_url?: string;
  organizations: Organization[];
  current_organization_id: string;
  permissions: string[];
  preferences: Record<string, any>;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  plan: 'free' | 'pro' | 'enterprise';
  role: 'owner' | 'admin' | 'member';
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  token_type: 'Bearer';
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
  organization_name?: string;
}
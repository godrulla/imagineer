-- Imagineer Platform - Complete Database Schema
-- PostgreSQL 15+ with advanced features for enterprise-scale design-to-LLM platform

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "btree_gin";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";
CREATE EXTENSION IF NOT EXISTS "vector"; -- For embeddings support

-- Create custom types
CREATE TYPE user_role AS ENUM ('owner', 'admin', 'editor', 'reviewer', 'viewer');
CREATE TYPE project_status AS ENUM ('active', 'archived', 'deleted');
CREATE TYPE collaboration_event_type AS ENUM (
  'cursor_move', 'element_select', 'element_modify', 'element_add', 'element_delete',
  'comment_add', 'comment_resolve', 'version_save', 'user_join', 'user_leave'
);
CREATE TYPE export_format AS ENUM (
  'markdown', 'json', 'yaml', 'html', 'css', 'jsx', 'vue', 'angular', 'pdf', 'zip', 'custom'
);
CREATE TYPE translation_status AS ENUM ('pending', 'processing', 'completed', 'failed');

-- ============================================================================
-- CORE ENTITIES
-- ============================================================================

-- Users table with enterprise features
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255),
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  avatar_url VARCHAR(500),
  
  -- OAuth providers
  figma_user_id VARCHAR(100),
  google_user_id VARCHAR(100),
  github_user_id VARCHAR(100),
  
  -- Account status
  is_active BOOLEAN DEFAULT true,
  is_verified BOOLEAN DEFAULT false,
  last_login TIMESTAMP,
  
  -- Preferences
  preferences JSONB DEFAULT '{}',
  timezone VARCHAR(50) DEFAULT 'UTC',
  
  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  -- Indexes
  CONSTRAINT email_format CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

-- User sessions for JWT management
CREATE TABLE user_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_token VARCHAR(255) UNIQUE NOT NULL,
  refresh_token VARCHAR(255) UNIQUE,
  device_info JSONB,
  ip_address INET,
  user_agent TEXT,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  last_accessed TIMESTAMP DEFAULT NOW()
);

-- Teams for enterprise collaboration
CREATE TABLE teams (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  settings JSONB DEFAULT '{}',
  billing_email VARCHAR(255),
  
  -- Subscription info
  plan_type VARCHAR(50) DEFAULT 'free',
  plan_limits JSONB DEFAULT '{}',
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Team memberships with roles
CREATE TABLE team_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role user_role NOT NULL DEFAULT 'viewer',
  joined_at TIMESTAMP DEFAULT NOW(),
  invited_by UUID REFERENCES users(id),
  
  UNIQUE(team_id, user_id)
);

-- ============================================================================
-- PROJECT MANAGEMENT
-- ============================================================================

-- Projects with comprehensive metadata
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  
  -- Ownership
  owner_id UUID NOT NULL REFERENCES users(id),
  team_id UUID REFERENCES teams(id),
  
  -- External integrations
  figma_file_id VARCHAR(255),
  figma_node_id VARCHAR(255),
  figma_url VARCHAR(500),
  
  -- Project settings
  settings JSONB DEFAULT '{}',
  tags TEXT[],
  
  -- Status and metadata
  status project_status DEFAULT 'active',
  is_public BOOLEAN DEFAULT false,
  
  -- Analytics
  view_count INTEGER DEFAULT 0,
  last_accessed TIMESTAMP,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Project access control
CREATE TABLE project_access (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role user_role NOT NULL DEFAULT 'viewer',
  granted_by UUID NOT NULL REFERENCES users(id),
  granted_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(project_id, user_id)
);

-- ============================================================================
-- DESIGN DATA STORAGE
-- ============================================================================

-- Design snapshots with versioning
CREATE TABLE design_snapshots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  
  -- Version info
  version_number INTEGER NOT NULL DEFAULT 1,
  parent_version_id UUID REFERENCES design_snapshots(id),
  
  -- External references
  figma_node_id VARCHAR(255),
  figma_version VARCHAR(100),
  
  -- Design data (parsed and raw)
  design_data JSONB NOT NULL,           -- Processed design elements
  raw_design_data JSONB,               -- Original Figma/source data
  parsed_elements JSONB,               -- Extracted UI elements
  design_tokens JSONB,                 -- Color, typography, spacing tokens
  
  -- Metadata
  thumbnail_url VARCHAR(500),
  element_count INTEGER DEFAULT 0,
  complexity_score FLOAT,
  
  -- Processing status
  processing_status VARCHAR(50) DEFAULT 'pending',
  processing_error TEXT,
  processing_duration INTEGER,         -- in milliseconds
  
  -- Analytics
  accuracy_score FLOAT,               -- Design parsing accuracy (0-1)
  confidence_score FLOAT,             -- Overall confidence (0-1)
  
  created_at TIMESTAMP DEFAULT NOW(),
  created_by UUID REFERENCES users(id)
);

-- Design elements with hierarchical structure
CREATE TABLE design_elements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  snapshot_id UUID NOT NULL REFERENCES design_snapshots(id) ON DELETE CASCADE,
  
  -- Element identification
  figma_node_id VARCHAR(255),
  element_name VARCHAR(255),
  element_type VARCHAR(100) NOT NULL,
  
  -- Hierarchy
  parent_element_id UUID REFERENCES design_elements(id),
  path LTREE,                         -- Hierarchical path for efficient queries
  depth INTEGER DEFAULT 0,
  sort_order INTEGER DEFAULT 0,
  
  -- Visual properties
  bounds JSONB NOT NULL,              -- x, y, width, height
  styles JSONB DEFAULT '{}',          -- fills, strokes, effects, typography
  constraints JSONB DEFAULT '{}',     -- layout constraints
  
  -- Classification
  semantic_role VARCHAR(100),         -- button, input, text, etc.
  ui_category VARCHAR(100),           -- navigation, content, form, etc.
  confidence_score FLOAT,             -- Classification confidence
  
  -- Interactions
  interactions JSONB DEFAULT '{}',    -- Click, hover, etc.
  
  -- Metadata
  is_visible BOOLEAN DEFAULT true,
  is_locked BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================================
-- TRANSLATION SYSTEM
-- ============================================================================

-- Translation jobs and results
CREATE TABLE translations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  snapshot_id UUID REFERENCES design_snapshots(id) ON DELETE CASCADE,
  
  -- Translation configuration
  target_llm VARCHAR(100) NOT NULL,   -- gpt-4, claude-3, gemini-pro
  output_format export_format NOT NULL,
  translation_options JSONB DEFAULT '{}',
  
  -- Processing
  status translation_status DEFAULT 'pending',
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  processing_time INTEGER,            -- milliseconds
  
  -- Results
  translation_content TEXT,           -- Generated prompt/content
  translation_metadata JSONB DEFAULT '{}',
  
  -- Quality metrics
  accuracy_score FLOAT,              -- Translation accuracy (0-1)
  token_count INTEGER,               -- Token usage
  quality_metrics JSONB DEFAULT '{}',
  
  -- Error handling
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  
  created_at TIMESTAMP DEFAULT NOW(),
  created_by UUID REFERENCES users(id)
);

-- Translation templates for reuse
CREATE TABLE translation_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  
  -- Template configuration
  target_llm VARCHAR(100),
  output_format export_format NOT NULL,
  template_content TEXT NOT NULL,
  
  -- Template metadata
  category VARCHAR(100),              -- ui-framework, documentation, handoff
  tags TEXT[],
  variables JSONB DEFAULT '[]',       -- Template variables
  
  -- Usage tracking
  usage_count INTEGER DEFAULT 0,
  rating FLOAT,                      -- Average user rating
  
  -- Access control
  is_public BOOLEAN DEFAULT false,
  created_by UUID NOT NULL REFERENCES users(id),
  team_id UUID REFERENCES teams(id),
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================================
-- EXPORT SYSTEM
-- ============================================================================

-- Export jobs and files
CREATE TABLE exports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  translation_id UUID REFERENCES translations(id),
  
  -- Export configuration
  export_format export_format NOT NULL,
  export_options JSONB DEFAULT '{}',
  template_id UUID REFERENCES translation_templates(id),
  
  -- File information
  file_name VARCHAR(255),
  file_path VARCHAR(500),
  file_url VARCHAR(500),
  file_size BIGINT,
  mime_type VARCHAR(100),
  
  -- Processing
  status VARCHAR(50) DEFAULT 'pending',
  processing_time INTEGER,
  error_message TEXT,
  
  -- Metadata
  download_count INTEGER DEFAULT 0,
  expires_at TIMESTAMP,
  
  created_at TIMESTAMP DEFAULT NOW(),
  created_by UUID REFERENCES users(id)
);

-- ============================================================================
-- COLLABORATION SYSTEM
-- ============================================================================

-- Real-time collaboration events
CREATE TABLE collaboration_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  
  -- Event details
  event_type collaboration_event_type NOT NULL,
  event_data JSONB NOT NULL,
  
  -- Context
  element_id UUID REFERENCES design_elements(id),
  session_id VARCHAR(255),
  
  -- Timing
  timestamp TIMESTAMP DEFAULT NOW(),
  sequence_number BIGSERIAL
);

-- User presence tracking
CREATE TABLE user_presence (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Presence data
  socket_id VARCHAR(255),
  status VARCHAR(50) NOT NULL,        -- active, idle, away, offline
  cursor_position JSONB,              -- x, y, elementId
  selected_element_id UUID REFERENCES design_elements(id),
  
  -- Timing
  last_activity TIMESTAMP DEFAULT NOW(),
  session_start TIMESTAMP DEFAULT NOW(),
  
  -- Unique constraint for active sessions
  UNIQUE(project_id, user_id)
);

-- Comments and annotations
CREATE TABLE comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  element_id UUID REFERENCES design_elements(id),
  
  -- Comment content
  content TEXT NOT NULL,
  content_type VARCHAR(50) DEFAULT 'text',
  
  -- Threading
  parent_comment_id UUID REFERENCES comments(id),
  thread_id UUID,
  
  -- Position (for annotations)
  position JSONB,                     -- x, y coordinates
  
  -- Status
  is_resolved BOOLEAN DEFAULT false,
  resolved_at TIMESTAMP,
  resolved_by UUID REFERENCES users(id),
  
  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by UUID NOT NULL REFERENCES users(id)
);

-- Version control and history
CREATE TABLE project_versions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  snapshot_id UUID NOT NULL REFERENCES design_snapshots(id),
  
  -- Version metadata
  version_number INTEGER NOT NULL,
  version_name VARCHAR(255),
  description TEXT,
  
  -- Changes summary
  changes_summary JSONB,              -- Summary of what changed
  diff_data JSONB,                   -- Detailed diff information
  
  -- Branching
  parent_version_id UUID REFERENCES project_versions(id),
  is_main_branch BOOLEAN DEFAULT true,
  branch_name VARCHAR(100),
  
  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  created_by UUID NOT NULL REFERENCES users(id)
);

-- ============================================================================
-- ANALYTICS AND MONITORING
-- ============================================================================

-- Usage analytics
CREATE TABLE analytics_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Event identification
  event_name VARCHAR(100) NOT NULL,
  event_category VARCHAR(100),
  
  -- User context
  user_id UUID REFERENCES users(id),
  session_id VARCHAR(255),
  
  -- Project context
  project_id UUID REFERENCES projects(id),
  
  -- Event data
  properties JSONB DEFAULT '{}',
  
  -- Technical metadata
  user_agent TEXT,
  ip_address INET,
  referrer TEXT,
  
  -- Timing
  timestamp TIMESTAMP DEFAULT NOW(),
  duration INTEGER                   -- Event duration in milliseconds
);

-- Performance monitoring
CREATE TABLE performance_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Service identification
  service_name VARCHAR(100) NOT NULL,
  operation_name VARCHAR(100) NOT NULL,
  
  -- Performance data
  duration INTEGER NOT NULL,         -- milliseconds
  success BOOLEAN NOT NULL,
  error_message TEXT,
  
  -- Context
  user_id UUID REFERENCES users(id),
  project_id UUID REFERENCES projects(id),
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  timestamp TIMESTAMP DEFAULT NOW()
);

-- ============================================================================
-- VECTOR DATABASE FOR AI/ML
-- ============================================================================

-- Design embeddings for similarity search
CREATE TABLE design_embeddings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Reference to design
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  element_id UUID REFERENCES design_elements(id) ON DELETE CASCADE,
  
  -- Embedding data
  embedding_type VARCHAR(100) NOT NULL, -- 'visual', 'semantic', 'layout'
  embedding VECTOR(768),                -- 768-dimensional vector (adjustable)
  model_version VARCHAR(100),
  
  -- Metadata for search
  metadata JSONB DEFAULT '{}',
  tags TEXT[],
  
  created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- User indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_active ON users(is_active) WHERE is_active = true;
CREATE INDEX idx_user_sessions_token ON user_sessions(session_token);
CREATE INDEX idx_user_sessions_expires ON user_sessions(expires_at);

-- Project indexes
CREATE INDEX idx_projects_owner ON projects(owner_id);
CREATE INDEX idx_projects_team ON projects(team_id);
CREATE INDEX idx_projects_status ON projects(status);
CREATE INDEX idx_projects_figma_file ON projects(figma_file_id);
CREATE INDEX idx_projects_updated ON projects(updated_at DESC);

-- Design data indexes
CREATE INDEX idx_design_snapshots_project ON design_snapshots(project_id);
CREATE INDEX idx_design_snapshots_version ON design_snapshots(project_id, version_number DESC);
CREATE INDEX idx_design_elements_snapshot ON design_elements(snapshot_id);
CREATE INDEX idx_design_elements_parent ON design_elements(parent_element_id);
CREATE INDEX idx_design_elements_path ON design_elements USING GIST(path);
CREATE INDEX idx_design_elements_type ON design_elements(element_type);

-- Translation indexes
CREATE INDEX idx_translations_project ON translations(project_id);
CREATE INDEX idx_translations_status ON translations(status);
CREATE INDEX idx_translations_llm ON translations(target_llm);
CREATE INDEX idx_translations_created ON translations(created_at DESC);

-- Collaboration indexes
CREATE INDEX idx_collaboration_events_project ON collaboration_events(project_id);
CREATE INDEX idx_collaboration_events_user ON collaboration_events(user_id);
CREATE INDEX idx_collaboration_events_timestamp ON collaboration_events(timestamp DESC);
CREATE INDEX idx_user_presence_project ON user_presence(project_id);
CREATE INDEX idx_comments_project ON comments(project_id);
CREATE INDEX idx_comments_element ON comments(element_id);
CREATE INDEX idx_comments_thread ON comments(thread_id);

-- Analytics indexes
CREATE INDEX idx_analytics_events_name ON analytics_events(event_name);
CREATE INDEX idx_analytics_events_user ON analytics_events(user_id);
CREATE INDEX idx_analytics_events_timestamp ON analytics_events(timestamp DESC);
CREATE INDEX idx_performance_metrics_service ON performance_metrics(service_name, operation_name);

-- Vector search indexes
CREATE INDEX ON design_embeddings USING hnsw (embedding vector_cosine_ops);
CREATE INDEX idx_design_embeddings_type ON design_embeddings(embedding_type);
CREATE INDEX idx_design_embeddings_project ON design_embeddings(project_id);

-- Full-text search indexes
CREATE INDEX idx_projects_name_search ON projects USING GIN(to_tsvector('english', name));
CREATE INDEX idx_comments_content_search ON comments USING GIN(to_tsvector('english', content));

-- ============================================================================
-- FUNCTIONS AND TRIGGERS
-- ============================================================================

-- Update timestamp function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at triggers
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_teams_updated_at BEFORE UPDATE ON teams
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_translation_templates_updated_at BEFORE UPDATE ON translation_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_comments_updated_at BEFORE UPDATE ON comments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Automatic path generation for design elements
CREATE OR REPLACE FUNCTION generate_element_path()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.parent_element_id IS NULL THEN
    NEW.path = NEW.id::text::ltree;
  ELSE
    SELECT path || NEW.id::text::ltree INTO NEW.path
    FROM design_elements WHERE id = NEW.parent_element_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER design_elements_path_trigger
  BEFORE INSERT ON design_elements
  FOR EACH ROW EXECUTE FUNCTION generate_element_path();

-- ============================================================================
-- SAMPLE DATA FOR DEVELOPMENT
-- ============================================================================

-- Create default admin user
INSERT INTO users (id, email, first_name, last_name, is_active, is_verified)
VALUES (
  uuid_generate_v4(),
  'admin@imagineer.dev',
  'Admin',
  'User',
  true,
  true
);

-- Create sample team
INSERT INTO teams (id, name, description, plan_type)
VALUES (
  uuid_generate_v4(),
  'Imagineer Development Team',
  'Internal development and testing team',
  'enterprise'
);

-- Performance optimization settings
ALTER SYSTEM SET shared_preload_libraries = 'pg_stat_statements';
ALTER SYSTEM SET track_activity_query_size = 2048;
ALTER SYSTEM SET pg_stat_statements.track = 'all';

-- ============================================================================
-- VIEWS FOR COMMON QUERIES
-- ============================================================================

-- Project overview with team and access info
CREATE VIEW project_overview AS
SELECT 
  p.*,
  u.email as owner_email,
  u.first_name as owner_first_name,
  u.last_name as owner_last_name,
  t.name as team_name,
  (SELECT COUNT(*) FROM design_snapshots ds WHERE ds.project_id = p.id) as snapshot_count,
  (SELECT COUNT(*) FROM translations tr WHERE tr.project_id = p.id) as translation_count,
  (SELECT MAX(created_at) FROM design_snapshots ds WHERE ds.project_id = p.id) as last_snapshot_at
FROM projects p
LEFT JOIN users u ON p.owner_id = u.id
LEFT JOIN teams t ON p.team_id = t.id;

-- User activity summary
CREATE VIEW user_activity_summary AS
SELECT 
  u.id,
  u.email,
  u.first_name,
  u.last_name,
  COUNT(DISTINCT p.id) as project_count,
  COUNT(DISTINCT t.id) as translation_count,
  COUNT(DISTINCT c.id) as comment_count,
  MAX(ae.timestamp) as last_activity
FROM users u
LEFT JOIN projects p ON u.id = p.owner_id
LEFT JOIN translations t ON u.id = t.created_by
LEFT JOIN comments c ON u.id = c.created_by
LEFT JOIN analytics_events ae ON u.id = ae.user_id
GROUP BY u.id, u.email, u.first_name, u.last_name;
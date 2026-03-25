-- ============================================================================
-- DESIGN PARSER SERVICE SCHEMA
-- Handles parsing and storage of design files from various tools
-- ============================================================================

-- Projects - Main container for design work
CREATE TABLE design.projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES core.organizations(id) ON DELETE CASCADE,
    team_id UUID REFERENCES core.teams(id) ON DELETE SET NULL,
    
    -- Basic information
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL,
    description TEXT,
    
    -- Design source
    source_tool design.tool_type NOT NULL,
    source_url core.url,
    source_file_id VARCHAR(255), -- External file ID (Figma file ID, etc)
    
    -- Project settings
    settings JSONB DEFAULT '{}',
    auto_sync BOOLEAN DEFAULT TRUE,
    sync_frequency_minutes INTEGER DEFAULT 60,
    last_sync_at TIMESTAMP WITH TIME ZONE,
    next_sync_at TIMESTAMP WITH TIME ZONE,
    
    -- Metadata
    thumbnail_url core.url,
    tags TEXT[] DEFAULT '{}',
    category VARCHAR(100),
    
    -- Access control
    visibility VARCHAR(20) DEFAULT 'team' CHECK (visibility IN ('private', 'team', 'organization')),
    
    -- Analytics
    view_count INTEGER DEFAULT 0,
    translation_count INTEGER DEFAULT 0,
    export_count INTEGER DEFAULT 0,
    
    -- Status
    status core.status DEFAULT 'active',
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE,
    is_deleted BOOLEAN DEFAULT FALSE,
    created_by UUID NOT NULL REFERENCES core.users(id),
    
    UNIQUE(organization_id, slug)
);

-- Design files within projects
CREATE TABLE design.design_files (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES design.projects(id) ON DELETE CASCADE,
    
    -- File information
    name VARCHAR(255) NOT NULL,
    original_filename VARCHAR(500),
    file_type VARCHAR(50) NOT NULL,
    file_size_bytes BIGINT,
    file_hash VARCHAR(64), -- SHA256 hash for deduplication
    
    -- Storage
    storage_path VARCHAR(1000),
    storage_provider VARCHAR(50) DEFAULT 's3',
    storage_bucket VARCHAR(255),
    storage_key VARCHAR(1000),
    
    -- External source tracking
    external_id VARCHAR(255), -- External file/page ID
    external_url core.url,
    external_last_modified TIMESTAMP WITH TIME ZONE,
    
    -- Processing status
    processing_status VARCHAR(50) DEFAULT 'pending' CHECK (
        processing_status IN ('pending', 'processing', 'completed', 'failed', 'skipped')
    ),
    processing_started_at TIMESTAMP WITH TIME ZONE,
    processing_completed_at TIMESTAMP WITH TIME ZONE,
    processing_error TEXT,
    processing_metadata JSONB DEFAULT '{}',
    
    -- File metadata
    metadata JSONB DEFAULT '{}',
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    uploaded_by UUID REFERENCES core.users(id)
);

-- Design versions for file history
CREATE TABLE design.design_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    design_file_id UUID NOT NULL REFERENCES design.design_files(id) ON DELETE CASCADE,
    
    -- Version information
    version_number INTEGER NOT NULL,
    version_name VARCHAR(255),
    description TEXT,
    
    -- File snapshot
    file_size_bytes BIGINT,
    file_hash VARCHAR(64),
    storage_key VARCHAR(1000),
    
    -- Changes
    change_summary TEXT,
    changes_detected JSONB DEFAULT '{}',
    
    -- External sync
    external_version_id VARCHAR(255),
    external_last_modified TIMESTAMP WITH TIME ZONE,
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES core.users(id),
    
    UNIQUE(design_file_id, version_number)
);

-- Parsed design data (main storage for design elements)
CREATE TABLE design.parsed_designs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    design_file_id UUID NOT NULL REFERENCES design.design_files(id) ON DELETE CASCADE,
    version_id UUID REFERENCES design.design_versions(id),
    
    -- Parser information
    parser_version VARCHAR(50) NOT NULL,
    parser_engine VARCHAR(50) NOT NULL,
    
    -- Raw parsed data
    raw_data JSONB NOT NULL,
    raw_data_size BIGINT GENERATED ALWAYS AS (core.calculate_storage_size(raw_data)) STORED,
    
    -- Structured data
    elements JSONB DEFAULT '{}',
    styles JSONB DEFAULT '{}',
    layout JSONB DEFAULT '{}',
    components JSONB DEFAULT '{}',
    interactions JSONB DEFAULT '{}',
    
    -- Analysis results
    complexity_score INTEGER,
    element_count INTEGER,
    layer_depth INTEGER,
    has_interactions BOOLEAN DEFAULT FALSE,
    has_animations BOOLEAN DEFAULT FALSE,
    responsive_breakpoints TEXT[],
    
    -- Processing metadata
    processing_time_ms INTEGER,
    memory_usage_mb INTEGER,
    
    -- Quality metrics
    parsing_confidence DECIMAL(5,4) CHECK (parsing_confidence >= 0 AND parsing_confidence <= 1),
    validation_errors JSONB DEFAULT '[]',
    validation_warnings JSONB DEFAULT '[]',
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Design elements extracted from parsed designs
CREATE TABLE design.design_elements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    parsed_design_id UUID NOT NULL REFERENCES design.parsed_designs(id) ON DELETE CASCADE,
    
    -- Element identification
    element_id VARCHAR(255) NOT NULL, -- Original ID from design tool
    parent_id VARCHAR(255), -- Parent element ID
    element_type VARCHAR(100) NOT NULL,
    element_name VARCHAR(255),
    
    -- Hierarchy
    level INTEGER NOT NULL DEFAULT 0,
    order_index INTEGER NOT NULL DEFAULT 0,
    path TEXT, -- Hierarchical path like "/root/frame1/button"
    
    -- Properties
    properties JSONB NOT NULL DEFAULT '{}',
    styles JSONB DEFAULT '{}',
    constraints JSONB DEFAULT '{}',
    
    -- Geometric properties
    x DECIMAL(10,2),
    y DECIMAL(10,2),
    width DECIMAL(10,2),
    height DECIMAL(10,2),
    rotation DECIMAL(5,2) DEFAULT 0,
    
    -- Content
    text_content TEXT,
    image_url core.url,
    
    -- State and variants
    is_visible BOOLEAN DEFAULT TRUE,
    is_locked BOOLEAN DEFAULT FALSE,
    states JSONB DEFAULT '{}',
    variants JSONB DEFAULT '{}',
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Design components (reusable elements)
CREATE TABLE design.design_components (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES design.projects(id) ON DELETE CASCADE,
    
    -- Component information
    name VARCHAR(255) NOT NULL,
    description TEXT,
    component_type VARCHAR(100) NOT NULL,
    
    -- Component definition
    definition JSONB NOT NULL,
    props_schema JSONB DEFAULT '{}',
    variants JSONB DEFAULT '{}',
    
    -- Usage tracking
    usage_count INTEGER DEFAULT 0,
    instances JSONB DEFAULT '[]',
    
    -- Metadata
    tags TEXT[] DEFAULT '{}',
    category VARCHAR(100),
    
    -- Status
    status core.status DEFAULT 'active',
    is_published BOOLEAN DEFAULT FALSE,
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES core.users(id)
);

-- Design assets (images, icons, etc.)
CREATE TABLE design.design_assets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES design.projects(id) ON DELETE CASCADE,
    
    -- Asset information
    name VARCHAR(255) NOT NULL,
    asset_type VARCHAR(50) NOT NULL, -- image, icon, font, video, etc.
    file_format VARCHAR(20) NOT NULL,
    file_size_bytes BIGINT,
    
    -- Content
    original_url core.url,
    processed_url core.url,
    thumbnail_url core.url,
    
    -- Storage
    storage_key VARCHAR(1000),
    alt_text TEXT,
    description TEXT,
    
    -- Metadata
    dimensions JSONB, -- {width: 100, height: 100}
    color_palette JSONB, -- Extracted colors
    metadata JSONB DEFAULT '{}',
    
    -- Usage tracking
    usage_count INTEGER DEFAULT 0,
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    extracted_by UUID REFERENCES core.users(id)
);

-- Design annotations and comments
CREATE TABLE design.design_annotations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    design_file_id UUID NOT NULL REFERENCES design.design_files(id) ON DELETE CASCADE,
    element_id UUID REFERENCES design.design_elements(id) ON DELETE CASCADE,
    
    -- Annotation content
    content TEXT NOT NULL,
    annotation_type VARCHAR(50) DEFAULT 'comment' CHECK (
        annotation_type IN ('comment', 'note', 'specification', 'issue', 'suggestion')
    ),
    
    -- Position (if applicable)
    x DECIMAL(10,2),
    y DECIMAL(10,2),
    
    -- Thread support
    parent_id UUID REFERENCES design.design_annotations(id),
    thread_root_id UUID,
    
    -- Status
    status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'closed')),
    priority VARCHAR(20) DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
    
    -- Visibility
    visibility VARCHAR(20) DEFAULT 'team' CHECK (visibility IN ('private', 'team', 'organization')),
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID NOT NULL REFERENCES core.users(id),
    resolved_by UUID REFERENCES core.users(id),
    resolved_at TIMESTAMP WITH TIME ZONE
);

-- Design sync logs
CREATE TABLE design.sync_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES design.projects(id) ON DELETE CASCADE,
    
    -- Sync information
    sync_type VARCHAR(50) NOT NULL CHECK (sync_type IN ('manual', 'automatic', 'webhook')),
    trigger_source VARCHAR(100),
    
    -- Results
    status VARCHAR(20) NOT NULL CHECK (status IN ('started', 'completed', 'failed', 'partial')),
    files_processed INTEGER DEFAULT 0,
    files_updated INTEGER DEFAULT 0,
    files_added INTEGER DEFAULT 0,
    files_deleted INTEGER DEFAULT 0,
    
    -- Timing
    started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE,
    duration_ms INTEGER,
    
    -- Details
    changes_detected JSONB DEFAULT '{}',
    error_message TEXT,
    error_details JSONB,
    
    -- Metadata
    external_version VARCHAR(255),
    sync_metadata JSONB DEFAULT '{}',
    
    -- Audit
    triggered_by UUID REFERENCES core.users(id)
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Projects
CREATE INDEX idx_projects_organization ON design.projects(organization_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_projects_team ON design.projects(team_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_projects_slug ON design.projects(organization_id, slug) WHERE is_deleted = FALSE;
CREATE INDEX idx_projects_source ON design.projects(source_tool, source_file_id);
CREATE INDEX idx_projects_tags ON design.projects USING GIN(tags);
CREATE INDEX idx_projects_status ON design.projects(status, last_sync_at);

-- Design files
CREATE INDEX idx_design_files_project ON design.design_files(project_id);
CREATE INDEX idx_design_files_hash ON design.design_files(file_hash);
CREATE INDEX idx_design_files_external ON design.design_files(external_id, external_url);
CREATE INDEX idx_design_files_processing ON design.design_files(processing_status, processing_started_at);

-- Design versions
CREATE INDEX idx_design_versions_file ON design.design_versions(design_file_id, version_number DESC);
CREATE INDEX idx_design_versions_external ON design.design_versions(external_version_id, external_last_modified);

-- Parsed designs
CREATE INDEX idx_parsed_designs_file ON design.parsed_designs(design_file_id);
CREATE INDEX idx_parsed_designs_version ON design.parsed_designs(version_id);
CREATE INDEX idx_parsed_designs_data ON design.parsed_designs USING GIN(raw_data);
CREATE INDEX idx_parsed_designs_elements ON design.parsed_designs USING GIN(elements);
CREATE INDEX idx_parsed_designs_complexity ON design.parsed_designs(complexity_score, element_count);

-- Design elements
CREATE INDEX idx_design_elements_parsed ON design.design_elements(parsed_design_id);
CREATE INDEX idx_design_elements_hierarchy ON design.design_elements(parent_id, level, order_index);
CREATE INDEX idx_design_elements_type ON design.design_elements(element_type, element_name);
CREATE INDEX idx_design_elements_properties ON design.design_elements USING GIN(properties);
CREATE INDEX idx_design_elements_position ON design.design_elements(x, y, width, height);

-- Design components
CREATE INDEX idx_design_components_project ON design.design_components(project_id) WHERE status = 'active';
CREATE INDEX idx_design_components_type ON design.design_components(component_type, is_published);
CREATE INDEX idx_design_components_usage ON design.design_components(usage_count DESC);
CREATE INDEX idx_design_components_tags ON design.design_components USING GIN(tags);

-- Design assets
CREATE INDEX idx_design_assets_project ON design.design_assets(project_id);
CREATE INDEX idx_design_assets_type ON design.design_assets(asset_type, file_format);
CREATE INDEX idx_design_assets_size ON design.design_assets(file_size_bytes);
CREATE INDEX idx_design_assets_usage ON design.design_assets(usage_count DESC);

-- Design annotations
CREATE INDEX idx_design_annotations_file ON design.design_annotations(design_file_id);
CREATE INDEX idx_design_annotations_element ON design.design_annotations(element_id);
CREATE INDEX idx_design_annotations_thread ON design.design_annotations(thread_root_id, parent_id);
CREATE INDEX idx_design_annotations_status ON design.design_annotations(status, priority);

-- Sync logs
CREATE INDEX idx_sync_logs_project ON design.sync_logs(project_id, started_at DESC);
CREATE INDEX idx_sync_logs_status ON design.sync_logs(status, sync_type);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Update updated_at timestamp
CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON design.projects
    FOR EACH ROW EXECUTE FUNCTION core.update_updated_at();

CREATE TRIGGER update_design_files_updated_at BEFORE UPDATE ON design.design_files
    FOR EACH ROW EXECUTE FUNCTION core.update_updated_at();

CREATE TRIGGER update_parsed_designs_updated_at BEFORE UPDATE ON design.parsed_designs
    FOR EACH ROW EXECUTE FUNCTION core.update_updated_at();

CREATE TRIGGER update_design_components_updated_at BEFORE UPDATE ON design.design_components
    FOR EACH ROW EXECUTE FUNCTION core.update_updated_at();

CREATE TRIGGER update_design_annotations_updated_at BEFORE UPDATE ON design.design_annotations
    FOR EACH ROW EXECUTE FUNCTION core.update_updated_at();

-- Set thread root ID
CREATE OR REPLACE FUNCTION design.set_thread_root_id()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.parent_id IS NOT NULL THEN
        -- Get the root ID from parent
        SELECT COALESCE(thread_root_id, id) INTO NEW.thread_root_id
        FROM design.design_annotations
        WHERE id = NEW.parent_id;
    ELSE
        -- This is a root comment
        NEW.thread_root_id = NEW.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_annotation_thread_root BEFORE INSERT ON design.design_annotations
    FOR EACH ROW EXECUTE FUNCTION design.set_thread_root_id();
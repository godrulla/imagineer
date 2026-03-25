-- ============================================================================
-- EXPORT ENGINE SCHEMA
-- Handles generation and management of various export formats
-- ============================================================================

-- Export configurations
CREATE TABLE export.export_configurations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES core.organizations(id) ON DELETE CASCADE,
    
    -- Configuration details
    name VARCHAR(255) NOT NULL,
    description TEXT,
    format_type export.format_type NOT NULL,
    
    -- Template and structure
    template_content TEXT,
    template_variables JSONB DEFAULT '{}',
    output_structure JSONB DEFAULT '{}',
    
    -- Processing rules
    preprocessing_rules JSONB DEFAULT '[]',
    postprocessing_rules JSONB DEFAULT '[]',
    transformation_rules JSONB DEFAULT '{}',
    
    -- Format-specific settings
    format_settings JSONB DEFAULT '{}',
    file_extension VARCHAR(10),
    mime_type VARCHAR(100),
    
    -- Quality settings
    minify_output BOOLEAN DEFAULT FALSE,
    include_metadata BOOLEAN DEFAULT TRUE,
    include_comments BOOLEAN DEFAULT TRUE,
    validate_output BOOLEAN DEFAULT TRUE,
    
    -- Usage tracking
    usage_count INTEGER DEFAULT 0,
    success_rate DECIMAL(5,4),
    average_rating DECIMAL(3,2),
    
    -- Versioning
    version INTEGER DEFAULT 1,
    parent_config_id UUID REFERENCES export.export_configurations(id),
    
    -- Visibility
    is_public BOOLEAN DEFAULT FALSE,
    is_system_config BOOLEAN DEFAULT FALSE,
    
    -- Status
    status core.status DEFAULT 'active',
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE,
    is_deleted BOOLEAN DEFAULT FALSE,
    created_by UUID NOT NULL REFERENCES core.users(id),
    
    UNIQUE(organization_id, name) WHERE is_deleted = FALSE
);

-- Export jobs
CREATE TABLE export.export_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES core.organizations(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES design.projects(id) ON DELETE CASCADE,
    translation_result_id UUID REFERENCES translation.translation_results(id) ON DELETE CASCADE,
    export_config_id UUID NOT NULL REFERENCES export.export_configurations(id),
    
    -- Job details
    job_name VARCHAR(255),
    export_type VARCHAR(50) DEFAULT 'full' CHECK (
        export_type IN ('full', 'incremental', 'component', 'selection', 'custom')
    ),
    
    -- Input data
    input_source VARCHAR(50) NOT NULL CHECK (
        input_source IN ('translation_result', 'design_file', 'parsed_design', 'custom_data')
    ),
    input_data JSONB NOT NULL,
    input_data_size BIGINT GENERATED ALWAYS AS (core.calculate_storage_size(input_data)) STORED,
    
    -- Export settings
    custom_settings JSONB DEFAULT '{}',
    include_assets BOOLEAN DEFAULT TRUE,
    include_interactions BOOLEAN DEFAULT TRUE,
    include_animations BOOLEAN DEFAULT FALSE,
    target_platforms TEXT[] DEFAULT '{}',
    
    -- Job execution
    status VARCHAR(20) DEFAULT 'pending' CHECK (
        status IN ('pending', 'queued', 'processing', 'completed', 'failed', 'cancelled')
    ),
    priority INTEGER DEFAULT 0,
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    
    -- Timing
    queued_at TIMESTAMP WITH TIME ZONE,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    processing_time_ms INTEGER,
    
    -- Error handling
    error_message TEXT,
    error_code VARCHAR(50),
    error_details JSONB,
    
    -- Quality metrics
    validation_status VARCHAR(20) DEFAULT 'pending' CHECK (
        validation_status IN ('pending', 'passed', 'failed', 'skipped')
    ),
    validation_errors JSONB DEFAULT '[]',
    validation_warnings JSONB DEFAULT '[]',
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID NOT NULL REFERENCES core.users(id)
);

-- Export results
CREATE TABLE export.export_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    export_job_id UUID NOT NULL REFERENCES export.export_jobs(id) ON DELETE CASCADE,
    
    -- Result identification
    result_type VARCHAR(50) DEFAULT 'primary' CHECK (
        result_type IN ('primary', 'alternative', 'component', 'asset', 'fragment')
    ),
    file_name VARCHAR(500) NOT NULL,
    file_path VARCHAR(1000),
    
    -- Content
    content TEXT,
    content_size_bytes BIGINT,
    content_hash VARCHAR(64), -- SHA256 hash
    
    -- File metadata
    format_type export.format_type NOT NULL,
    mime_type VARCHAR(100),
    file_extension VARCHAR(10),
    encoding VARCHAR(20) DEFAULT 'UTF-8',
    
    -- Storage
    storage_provider VARCHAR(50) DEFAULT 's3',
    storage_bucket VARCHAR(255),
    storage_key VARCHAR(1000),
    storage_url core.url,
    
    -- Access control
    is_public BOOLEAN DEFAULT FALSE,
    access_token VARCHAR(255),
    expires_at TIMESTAMP WITH TIME ZONE,
    
    -- Usage tracking
    download_count INTEGER DEFAULT 0,
    view_count INTEGER DEFAULT 0,
    last_accessed_at TIMESTAMP WITH TIME ZONE,
    
    -- Quality metrics
    quality_score DECIMAL(5,4),
    user_rating INTEGER CHECK (user_rating >= 1 AND user_rating <= 5),
    
    -- Metadata
    metadata JSONB DEFAULT '{}',
    dependencies TEXT[], -- List of dependent files
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Export packages (grouped exports)
CREATE TABLE export.export_packages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES core.organizations(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES design.projects(id) ON DELETE CASCADE,
    
    -- Package information
    name VARCHAR(255) NOT NULL,
    description TEXT,
    version VARCHAR(50) DEFAULT '1.0.0',
    
    -- Package content
    export_job_ids UUID[] NOT NULL,
    package_structure JSONB DEFAULT '{}',
    
    -- Packaging settings
    compression_type VARCHAR(20) DEFAULT 'zip' CHECK (
        compression_type IN ('zip', 'tar', 'tar.gz', 'none')
    ),
    include_manifest BOOLEAN DEFAULT TRUE,
    include_readme BOOLEAN DEFAULT TRUE,
    
    -- Package file
    package_file_name VARCHAR(500),
    package_file_size_bytes BIGINT,
    package_file_hash VARCHAR(64),
    
    -- Storage
    storage_provider VARCHAR(50) DEFAULT 's3',
    storage_bucket VARCHAR(255),
    storage_key VARCHAR(1000),
    storage_url core.url,
    
    -- Access control
    is_public BOOLEAN DEFAULT FALSE,
    access_token VARCHAR(255),
    expires_at TIMESTAMP WITH TIME ZONE,
    
    -- Usage tracking
    download_count INTEGER DEFAULT 0,
    last_downloaded_at TIMESTAMP WITH TIME ZONE,
    
    -- Status
    status VARCHAR(20) DEFAULT 'pending' CHECK (
        status IN ('pending', 'processing', 'completed', 'failed')
    ),
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID NOT NULL REFERENCES core.users(id)
);

-- Export templates
CREATE TABLE export.export_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES core.organizations(id) ON DELETE CASCADE,
    
    -- Template information
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100),
    format_type export.format_type NOT NULL,
    
    -- Template content
    template_content TEXT NOT NULL,
    sample_output TEXT,
    
    -- Template structure
    variables JSONB DEFAULT '{}',
    sections JSONB DEFAULT '[]',
    components JSONB DEFAULT '{}',
    
    -- Rendering engine
    engine VARCHAR(50) DEFAULT 'handlebars' CHECK (
        engine IN ('handlebars', 'mustache', 'liquid', 'jinja2', 'custom')
    ),
    engine_config JSONB DEFAULT '{}',
    
    -- Helper functions
    custom_helpers JSONB DEFAULT '{}',
    
    -- Usage and quality
    usage_count INTEGER DEFAULT 0,
    average_rating DECIMAL(3,2),
    
    -- Versioning
    version INTEGER DEFAULT 1,
    parent_template_id UUID REFERENCES export.export_templates(id),
    
    -- Visibility
    is_public BOOLEAN DEFAULT FALSE,
    is_system_template BOOLEAN DEFAULT FALSE,
    
    -- Status
    status core.status DEFAULT 'active',
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE,
    is_deleted BOOLEAN DEFAULT FALSE,
    created_by UUID NOT NULL REFERENCES core.users(id),
    
    UNIQUE(organization_id, name) WHERE is_deleted = FALSE
);

-- Export assets (generated files like images, icons, etc.)
CREATE TABLE export.export_assets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    export_result_id UUID NOT NULL REFERENCES export.export_results(id) ON DELETE CASCADE,
    
    -- Asset information
    asset_name VARCHAR(255) NOT NULL,
    asset_type VARCHAR(50) NOT NULL, -- image, icon, font, style, etc.
    original_design_asset_id UUID REFERENCES design.design_assets(id),
    
    -- File information
    file_name VARCHAR(500) NOT NULL,
    file_size_bytes BIGINT,
    file_hash VARCHAR(64),
    mime_type VARCHAR(100),
    
    -- Processing information
    processing_applied JSONB DEFAULT '[]', -- List of transformations applied
    optimization_applied BOOLEAN DEFAULT FALSE,
    quality_settings JSONB DEFAULT '{}',
    
    -- Storage
    storage_provider VARCHAR(50) DEFAULT 's3',
    storage_bucket VARCHAR(255),
    storage_key VARCHAR(1000),
    storage_url core.url,
    
    -- Metadata
    dimensions JSONB, -- {width: 100, height: 100}
    color_profile VARCHAR(50),
    metadata JSONB DEFAULT '{}',
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Export feedback
CREATE TABLE export.export_feedback (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    export_result_id UUID REFERENCES export.export_results(id) ON DELETE CASCADE,
    export_package_id UUID REFERENCES export.export_packages(id) ON DELETE CASCADE,
    
    -- Feedback details
    feedback_type VARCHAR(50) DEFAULT 'rating' CHECK (
        feedback_type IN ('rating', 'comment', 'bug_report', 'feature_request', 'quality_issue')
    ),
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    
    -- Specific areas
    accuracy_rating INTEGER CHECK (accuracy_rating >= 1 AND accuracy_rating <= 5),
    usability_rating INTEGER CHECK (usability_rating >= 1 AND usability_rating <= 5),
    completeness_rating INTEGER CHECK (completeness_rating >= 1 AND completeness_rating <= 5),
    format_quality_rating INTEGER CHECK (format_quality_rating >= 1 AND format_quality_rating <= 5),
    
    -- Issue details
    issue_category VARCHAR(100),
    issue_severity VARCHAR(20) DEFAULT 'normal' CHECK (
        issue_severity IN ('low', 'normal', 'high', 'critical')
    ),
    
    -- Response tracking
    status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open', 'acknowledged', 'resolved', 'closed')),
    response TEXT,
    responded_by UUID REFERENCES core.users(id),
    responded_at TIMESTAMP WITH TIME ZONE,
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID NOT NULL REFERENCES core.users(id)
);

-- Export analytics
CREATE TABLE export.export_analytics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES core.organizations(id) ON DELETE CASCADE,
    project_id UUID REFERENCES design.projects(id) ON DELETE CASCADE,
    export_config_id UUID REFERENCES export.export_configurations(id),
    
    -- Time period
    analytics_date DATE NOT NULL,
    analytics_period VARCHAR(20) DEFAULT 'daily' CHECK (
        analytics_period IN ('hourly', 'daily', 'weekly', 'monthly')
    ),
    
    -- Volume metrics
    total_exports INTEGER DEFAULT 0,
    successful_exports INTEGER DEFAULT 0,
    failed_exports INTEGER DEFAULT 0,
    
    -- Format breakdown
    format_breakdown JSONB DEFAULT '{}',
    
    -- Performance metrics
    average_processing_time_ms INTEGER,
    average_file_size_bytes BIGINT,
    total_storage_used_bytes BIGINT,
    
    -- Quality metrics
    average_rating DECIMAL(3,2),
    validation_pass_rate DECIMAL(5,4),
    
    -- Usage metrics
    total_downloads INTEGER DEFAULT 0,
    unique_downloaders INTEGER DEFAULT 0,
    total_views INTEGER DEFAULT 0,
    
    -- Error metrics
    error_rate DECIMAL(5,4),
    common_errors JSONB DEFAULT '{}',
    
    -- Created timestamp
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(organization_id, project_id, export_config_id, analytics_date, analytics_period)
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Export configurations
CREATE INDEX idx_export_configurations_org ON export.export_configurations(organization_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_export_configurations_format ON export.export_configurations(format_type, is_public);
CREATE INDEX idx_export_configurations_usage ON export.export_configurations(usage_count DESC, average_rating DESC);

-- Export jobs
CREATE INDEX idx_export_jobs_org ON export.export_jobs(organization_id);
CREATE INDEX idx_export_jobs_project ON export.export_jobs(project_id);
CREATE INDEX idx_export_jobs_config ON export.export_jobs(export_config_id);
CREATE INDEX idx_export_jobs_status ON export.export_jobs(status, priority, created_at);
CREATE INDEX idx_export_jobs_timing ON export.export_jobs(queued_at, started_at, completed_at);
CREATE INDEX idx_export_jobs_translation ON export.export_jobs(translation_result_id);

-- Export results
CREATE INDEX idx_export_results_job ON export.export_results(export_job_id);
CREATE INDEX idx_export_results_format ON export.export_results(format_type, result_type);
CREATE INDEX idx_export_results_storage ON export.export_results(storage_provider, storage_key);
CREATE INDEX idx_export_results_access ON export.export_results(is_public, expires_at);
CREATE INDEX idx_export_results_usage ON export.export_results(download_count DESC, view_count DESC);

-- Export packages
CREATE INDEX idx_export_packages_org ON export.export_packages(organization_id);
CREATE INDEX idx_export_packages_project ON export.export_packages(project_id);
CREATE INDEX idx_export_packages_status ON export.export_packages(status, created_at DESC);
CREATE INDEX idx_export_packages_downloads ON export.export_packages(download_count DESC);
CREATE INDEX idx_export_packages_jobs ON export.export_packages USING GIN(export_job_ids);

-- Export templates
CREATE INDEX idx_export_templates_org ON export.export_templates(organization_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_export_templates_format ON export.export_templates(format_type, category);
CREATE INDEX idx_export_templates_usage ON export.export_templates(usage_count DESC, average_rating DESC);
CREATE INDEX idx_export_templates_engine ON export.export_templates(engine);

-- Export assets
CREATE INDEX idx_export_assets_result ON export.export_assets(export_result_id);
CREATE INDEX idx_export_assets_type ON export.export_assets(asset_type, mime_type);
CREATE INDEX idx_export_assets_design ON export.export_assets(original_design_asset_id);
CREATE INDEX idx_export_assets_storage ON export.export_assets(storage_provider, storage_key);

-- Export feedback
CREATE INDEX idx_export_feedback_result ON export.export_feedback(export_result_id);
CREATE INDEX idx_export_feedback_package ON export.export_feedback(export_package_id);
CREATE INDEX idx_export_feedback_type ON export.export_feedback(feedback_type, status);
CREATE INDEX idx_export_feedback_rating ON export.export_feedback(rating, issue_severity);

-- Export analytics
CREATE INDEX idx_export_analytics_org_date ON export.export_analytics(organization_id, analytics_date DESC);
CREATE INDEX idx_export_analytics_project ON export.export_analytics(project_id, analytics_date DESC);
CREATE INDEX idx_export_analytics_config ON export.export_analytics(export_config_id, analytics_date DESC);
CREATE INDEX idx_export_analytics_period ON export.export_analytics(analytics_period, analytics_date DESC);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Update updated_at timestamp
CREATE TRIGGER update_export_configurations_updated_at BEFORE UPDATE ON export.export_configurations
    FOR EACH ROW EXECUTE FUNCTION core.update_updated_at();

CREATE TRIGGER update_export_jobs_updated_at BEFORE UPDATE ON export.export_jobs
    FOR EACH ROW EXECUTE FUNCTION core.update_updated_at();

CREATE TRIGGER update_export_results_updated_at BEFORE UPDATE ON export.export_results
    FOR EACH ROW EXECUTE FUNCTION core.update_updated_at();

CREATE TRIGGER update_export_packages_updated_at BEFORE UPDATE ON export.export_packages
    FOR EACH ROW EXECUTE FUNCTION core.update_updated_at();

CREATE TRIGGER update_export_templates_updated_at BEFORE UPDATE ON export.export_templates
    FOR EACH ROW EXECUTE FUNCTION core.update_updated_at();

CREATE TRIGGER update_export_feedback_updated_at BEFORE UPDATE ON export.export_feedback
    FOR EACH ROW EXECUTE FUNCTION core.update_updated_at();

-- Calculate processing time for export jobs
CREATE OR REPLACE FUNCTION export.calculate_processing_time()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status != 'completed' AND NEW.status = 'completed' AND NEW.started_at IS NOT NULL THEN
        NEW.processing_time_ms = EXTRACT(EPOCH FROM (NEW.completed_at - NEW.started_at)) * 1000;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER calculate_export_job_timing BEFORE UPDATE ON export.export_jobs
    FOR EACH ROW EXECUTE FUNCTION export.calculate_processing_time();

-- Update configuration usage count
CREATE OR REPLACE FUNCTION export.update_configuration_usage()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE export.export_configurations 
    SET usage_count = usage_count + 1,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = NEW.export_config_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_configuration_usage_count AFTER INSERT ON export.export_jobs
    FOR EACH ROW EXECUTE FUNCTION export.update_configuration_usage();

-- Update template usage count
CREATE OR REPLACE FUNCTION export.update_template_usage()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.parent_template_id IS NOT NULL THEN
        UPDATE export.export_templates 
        SET usage_count = usage_count + 1,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = NEW.parent_template_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_template_usage_count AFTER INSERT ON export.export_configurations
    FOR EACH ROW EXECUTE FUNCTION export.update_template_usage();
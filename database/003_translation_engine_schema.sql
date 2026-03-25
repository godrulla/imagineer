-- ============================================================================
-- TRANSLATION ENGINE SCHEMA
-- Handles LLM translation of designs to prompts and various formats
-- ============================================================================

-- Translation templates
CREATE TABLE translation.translation_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES core.organizations(id) ON DELETE CASCADE,
    
    -- Template information
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100),
    
    -- Template content
    prompt_template TEXT NOT NULL,
    system_prompt TEXT,
    example_input JSONB,
    example_output TEXT,
    
    -- Configuration
    target_format VARCHAR(50) DEFAULT 'markdown',
    llm_provider translation.llm_provider DEFAULT 'openai_gpt4',
    model_version VARCHAR(100),
    max_tokens INTEGER DEFAULT 4000,
    temperature DECIMAL(3,2) DEFAULT 0.7,
    
    -- Template parameters
    parameters JSONB DEFAULT '{}',
    variables JSONB DEFAULT '{}',
    
    -- Usage and quality
    usage_count INTEGER DEFAULT 0,
    average_rating DECIMAL(3,2),
    success_rate DECIMAL(5,4),
    
    -- Versioning
    version INTEGER DEFAULT 1,
    parent_template_id UUID REFERENCES translation.translation_templates(id),
    
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

-- Translation jobs
CREATE TABLE translation.translation_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES core.organizations(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES design.projects(id) ON DELETE CASCADE,
    design_file_id UUID REFERENCES design.design_files(id) ON DELETE CASCADE,
    parsed_design_id UUID REFERENCES design.parsed_designs(id) ON DELETE CASCADE,
    template_id UUID REFERENCES translation.translation_templates(id),
    
    -- Job configuration
    job_name VARCHAR(255),
    translation_type VARCHAR(50) DEFAULT 'full' CHECK (
        translation_type IN ('full', 'incremental', 'component', 'element', 'custom')
    ),
    
    -- LLM configuration
    llm_provider translation.llm_provider NOT NULL,
    model_version VARCHAR(100) NOT NULL,
    system_prompt TEXT,
    user_prompt TEXT NOT NULL,
    max_tokens INTEGER DEFAULT 4000,
    temperature DECIMAL(3,2) DEFAULT 0.7,
    top_p DECIMAL(3,2) DEFAULT 1.0,
    frequency_penalty DECIMAL(3,2) DEFAULT 0.0,
    presence_penalty DECIMAL(3,2) DEFAULT 0.0,
    
    -- Input data
    input_data JSONB NOT NULL,
    input_data_size BIGINT GENERATED ALWAYS AS (core.calculate_storage_size(input_data)) STORED,
    context_data JSONB DEFAULT '{}',
    
    -- Job execution
    status VARCHAR(20) DEFAULT 'pending' CHECK (
        status IN ('pending', 'queued', 'processing', 'completed', 'failed', 'cancelled', 'timeout')
    ),
    priority INTEGER DEFAULT 0,
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    
    -- Timing
    queued_at TIMESTAMP WITH TIME ZONE,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    processing_time_ms INTEGER,
    queue_wait_time_ms INTEGER,
    
    -- Results
    output_text TEXT,
    output_data JSONB,
    output_tokens_used INTEGER,
    input_tokens_used INTEGER,
    
    -- Quality metrics
    confidence_score DECIMAL(5,4),
    quality_rating INTEGER CHECK (quality_rating >= 1 AND quality_rating <= 5),
    
    -- Error handling
    error_message TEXT,
    error_code VARCHAR(50),
    error_details JSONB,
    
    -- Cost tracking
    estimated_cost_usd DECIMAL(10,6),
    actual_cost_usd DECIMAL(10,6),
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID NOT NULL REFERENCES core.users(id)
);

-- Translation results storage
CREATE TABLE translation.translation_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    translation_job_id UUID NOT NULL REFERENCES translation.translation_jobs(id) ON DELETE CASCADE,
    
    -- Result identification
    result_type VARCHAR(50) DEFAULT 'primary' CHECK (
        result_type IN ('primary', 'alternative', 'revision', 'variant', 'fragment')
    ),
    sequence_number INTEGER DEFAULT 1,
    
    -- Content
    title VARCHAR(255),
    content TEXT NOT NULL,
    format VARCHAR(50) DEFAULT 'markdown',
    metadata JSONB DEFAULT '{}',
    
    -- Structure
    sections JSONB DEFAULT '[]',
    components JSONB DEFAULT '[]',
    elements JSONB DEFAULT '[]',
    
    -- Quality and validation
    validation_status VARCHAR(20) DEFAULT 'pending' CHECK (
        validation_status IN ('pending', 'valid', 'invalid', 'warning')
    ),
    validation_errors JSONB DEFAULT '[]',
    validation_warnings JSONB DEFAULT '[]',
    
    -- User feedback
    user_rating INTEGER CHECK (user_rating >= 1 AND user_rating <= 5),
    user_feedback TEXT,
    is_approved BOOLEAN,
    approved_by UUID REFERENCES core.users(id),
    approved_at TIMESTAMP WITH TIME ZONE,
    
    -- Usage tracking
    view_count INTEGER DEFAULT 0,
    edit_count INTEGER DEFAULT 0,
    export_count INTEGER DEFAULT 0,
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Translation revisions for versioning
CREATE TABLE translation.translation_revisions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    translation_result_id UUID NOT NULL REFERENCES translation.translation_results(id) ON DELETE CASCADE,
    
    -- Revision information
    revision_number INTEGER NOT NULL,
    revision_type VARCHAR(50) DEFAULT 'manual' CHECK (
        revision_type IN ('manual', 'auto_improve', 'feedback_based', 'template_update')
    ),
    change_summary TEXT,
    
    -- Content snapshot
    content_before TEXT,
    content_after TEXT NOT NULL,
    diff_data JSONB,
    
    -- Change metadata
    changes_made JSONB DEFAULT '{}',
    improvement_areas TEXT[],
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID NOT NULL REFERENCES core.users(id),
    
    UNIQUE(translation_result_id, revision_number)
);

-- LLM interactions log
CREATE TABLE translation.llm_interactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    translation_job_id UUID REFERENCES translation.translation_jobs(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES core.organizations(id) ON DELETE CASCADE,
    
    -- Interaction details
    interaction_type VARCHAR(50) DEFAULT 'completion' CHECK (
        interaction_type IN ('completion', 'chat', 'embedding', 'moderation', 'fine_tune')
    ),
    llm_provider translation.llm_provider NOT NULL,
    model_version VARCHAR(100) NOT NULL,
    
    -- Request details
    request_id VARCHAR(255),
    prompt TEXT,
    system_prompt TEXT,
    parameters JSONB DEFAULT '{}',
    
    -- Response details
    response_text TEXT,
    response_data JSONB,
    finish_reason VARCHAR(50),
    
    -- Token usage
    prompt_tokens INTEGER,
    completion_tokens INTEGER,
    total_tokens INTEGER,
    
    -- Timing and performance
    request_started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    response_received_at TIMESTAMP WITH TIME ZONE,
    latency_ms INTEGER,
    
    -- Cost tracking
    cost_per_token DECIMAL(10,8),
    total_cost_usd DECIMAL(10,6),
    
    -- Status and errors
    status VARCHAR(20) DEFAULT 'completed' CHECK (
        status IN ('completed', 'failed', 'timeout', 'cancelled', 'rate_limited')
    ),
    error_message TEXT,
    error_code VARCHAR(50),
    
    -- Quality metrics
    response_quality_score DECIMAL(5,4),
    content_safety_score DECIMAL(5,4),
    
    -- Audit
    user_id UUID REFERENCES core.users(id)
);

-- Translation feedback and ratings
CREATE TABLE translation.translation_feedback (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    translation_result_id UUID NOT NULL REFERENCES translation.translation_results(id) ON DELETE CASCADE,
    
    -- Feedback details
    feedback_type VARCHAR(50) DEFAULT 'rating' CHECK (
        feedback_type IN ('rating', 'comment', 'suggestion', 'error_report', 'improvement')
    ),
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    
    -- Specific feedback areas
    accuracy_rating INTEGER CHECK (accuracy_rating >= 1 AND accuracy_rating <= 5),
    completeness_rating INTEGER CHECK (completeness_rating >= 1 AND completeness_rating <= 5),
    usefulness_rating INTEGER CHECK (usefulness_rating >= 1 AND usefulness_rating <= 5),
    clarity_rating INTEGER CHECK (clarity_rating >= 1 AND clarity_rating <= 5),
    
    -- Improvement suggestions
    suggested_improvements TEXT,
    priority VARCHAR(20) DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'critical')),
    
    -- Response tracking
    status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open', 'acknowledged', 'addressed', 'closed')),
    response TEXT,
    responded_by UUID REFERENCES core.users(id),
    responded_at TIMESTAMP WITH TIME ZONE,
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID NOT NULL REFERENCES core.users(id)
);

-- Translation model configurations
CREATE TABLE translation.model_configurations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES core.organizations(id) ON DELETE CASCADE,
    
    -- Model information
    name VARCHAR(255) NOT NULL,
    description TEXT,
    llm_provider translation.llm_provider NOT NULL,
    model_version VARCHAR(100) NOT NULL,
    
    -- Default parameters
    default_temperature DECIMAL(3,2) DEFAULT 0.7,
    default_max_tokens INTEGER DEFAULT 4000,
    default_top_p DECIMAL(3,2) DEFAULT 1.0,
    default_frequency_penalty DECIMAL(3,2) DEFAULT 0.0,
    default_presence_penalty DECIMAL(3,2) DEFAULT 0.0,
    
    -- Specialized settings
    system_prompt_template TEXT,
    pre_processing_rules JSONB DEFAULT '[]',
    post_processing_rules JSONB DEFAULT '[]',
    
    -- Performance characteristics
    average_latency_ms INTEGER,
    average_cost_per_1k_tokens DECIMAL(8,6),
    quality_score DECIMAL(5,4),
    
    -- Usage constraints
    max_daily_requests INTEGER,
    max_concurrent_requests INTEGER DEFAULT 5,
    rate_limit_per_minute INTEGER DEFAULT 60,
    
    -- Status
    status core.status DEFAULT 'active',
    is_default BOOLEAN DEFAULT FALSE,
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID NOT NULL REFERENCES core.users(id),
    
    UNIQUE(organization_id, name)
);

-- Translation quality metrics aggregation
CREATE TABLE translation.quality_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES core.organizations(id) ON DELETE CASCADE,
    project_id UUID REFERENCES design.projects(id) ON DELETE CASCADE,
    template_id UUID REFERENCES translation.translation_templates(id),
    model_config_id UUID REFERENCES translation.model_configurations(id),
    
    -- Time period
    metric_date DATE NOT NULL,
    metric_period VARCHAR(20) DEFAULT 'daily' CHECK (metric_period IN ('hourly', 'daily', 'weekly', 'monthly')),
    
    -- Volume metrics
    total_translations INTEGER DEFAULT 0,
    successful_translations INTEGER DEFAULT 0,
    failed_translations INTEGER DEFAULT 0,
    
    -- Quality metrics
    average_rating DECIMAL(3,2),
    average_accuracy DECIMAL(5,4),
    average_completeness DECIMAL(5,4),
    average_usefulness DECIMAL(5,4),
    average_clarity DECIMAL(5,4),
    
    -- Performance metrics
    average_processing_time_ms INTEGER,
    average_tokens_used INTEGER,
    total_cost_usd DECIMAL(10,2),
    
    -- Error metrics
    error_rate DECIMAL(5,4),
    timeout_rate DECIMAL(5,4),
    retry_rate DECIMAL(5,4),
    
    -- User engagement
    total_views INTEGER DEFAULT 0,
    total_edits INTEGER DEFAULT 0,
    total_exports INTEGER DEFAULT 0,
    approval_rate DECIMAL(5,4),
    
    -- Created timestamp
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(organization_id, project_id, template_id, model_config_id, metric_date, metric_period)
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Translation templates
CREATE INDEX idx_translation_templates_org ON translation.translation_templates(organization_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_translation_templates_category ON translation.translation_templates(category, is_public);
CREATE INDEX idx_translation_templates_usage ON translation.translation_templates(usage_count DESC, average_rating DESC);
CREATE INDEX idx_translation_templates_provider ON translation.translation_templates(llm_provider, model_version);

-- Translation jobs
CREATE INDEX idx_translation_jobs_org ON translation.translation_jobs(organization_id);
CREATE INDEX idx_translation_jobs_project ON translation.translation_jobs(project_id);
CREATE INDEX idx_translation_jobs_status ON translation.translation_jobs(status, priority, created_at);
CREATE INDEX idx_translation_jobs_timing ON translation.translation_jobs(queued_at, started_at, completed_at);
CREATE INDEX idx_translation_jobs_provider ON translation.translation_jobs(llm_provider, model_version);
CREATE INDEX idx_translation_jobs_retry ON translation.translation_jobs(retry_count, max_retries) WHERE status = 'failed';

-- Translation results
CREATE INDEX idx_translation_results_job ON translation.translation_results(translation_job_id);
CREATE INDEX idx_translation_results_type ON translation.translation_results(result_type, sequence_number);
CREATE INDEX idx_translation_results_validation ON translation.translation_results(validation_status);
CREATE INDEX idx_translation_results_rating ON translation.translation_results(user_rating DESC, is_approved);
CREATE INDEX idx_translation_results_usage ON translation.translation_results(view_count DESC, export_count DESC);

-- Translation revisions
CREATE INDEX idx_translation_revisions_result ON translation.translation_revisions(translation_result_id, revision_number DESC);
CREATE INDEX idx_translation_revisions_type ON translation.translation_revisions(revision_type, created_at DESC);

-- LLM interactions
CREATE INDEX idx_llm_interactions_job ON translation.llm_interactions(translation_job_id);
CREATE INDEX idx_llm_interactions_org ON translation.llm_interactions(organization_id, request_started_at DESC);
CREATE INDEX idx_llm_interactions_provider ON translation.llm_interactions(llm_provider, model_version);
CREATE INDEX idx_llm_interactions_cost ON translation.llm_interactions(total_cost_usd, request_started_at DESC);
CREATE INDEX idx_llm_interactions_tokens ON translation.llm_interactions(total_tokens DESC);
CREATE INDEX idx_llm_interactions_performance ON translation.llm_interactions(latency_ms, response_quality_score);

-- Translation feedback
CREATE INDEX idx_translation_feedback_result ON translation.translation_feedback(translation_result_id);
CREATE INDEX idx_translation_feedback_type ON translation.translation_feedback(feedback_type, status);
CREATE INDEX idx_translation_feedback_rating ON translation.translation_feedback(rating, priority);

-- Model configurations
CREATE INDEX idx_model_configurations_org ON translation.model_configurations(organization_id) WHERE status = 'active';
CREATE INDEX idx_model_configurations_provider ON translation.model_configurations(llm_provider, model_version);
CREATE INDEX idx_model_configurations_default ON translation.model_configurations(is_default) WHERE status = 'active';

-- Quality metrics
CREATE INDEX idx_quality_metrics_org_date ON translation.quality_metrics(organization_id, metric_date DESC);
CREATE INDEX idx_quality_metrics_project ON translation.quality_metrics(project_id, metric_date DESC);
CREATE INDEX idx_quality_metrics_template ON translation.quality_metrics(template_id, metric_date DESC);
CREATE INDEX idx_quality_metrics_period ON translation.quality_metrics(metric_period, metric_date DESC);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Update updated_at timestamp
CREATE TRIGGER update_translation_templates_updated_at BEFORE UPDATE ON translation.translation_templates
    FOR EACH ROW EXECUTE FUNCTION core.update_updated_at();

CREATE TRIGGER update_translation_jobs_updated_at BEFORE UPDATE ON translation.translation_jobs
    FOR EACH ROW EXECUTE FUNCTION core.update_updated_at();

CREATE TRIGGER update_translation_results_updated_at BEFORE UPDATE ON translation.translation_results
    FOR EACH ROW EXECUTE FUNCTION core.update_updated_at();

CREATE TRIGGER update_translation_feedback_updated_at BEFORE UPDATE ON translation.translation_feedback
    FOR EACH ROW EXECUTE FUNCTION core.update_updated_at();

CREATE TRIGGER update_model_configurations_updated_at BEFORE UPDATE ON translation.model_configurations
    FOR EACH ROW EXECUTE FUNCTION core.update_updated_at();

-- Calculate processing time for translation jobs
CREATE OR REPLACE FUNCTION translation.calculate_processing_time()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status != 'completed' AND NEW.status = 'completed' AND NEW.started_at IS NOT NULL THEN
        NEW.processing_time_ms = EXTRACT(EPOCH FROM (NEW.completed_at - NEW.started_at)) * 1000;
    END IF;
    
    IF OLD.status != 'processing' AND NEW.status = 'processing' AND NEW.queued_at IS NOT NULL THEN
        NEW.queue_wait_time_ms = EXTRACT(EPOCH FROM (NEW.started_at - NEW.queued_at)) * 1000;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER calculate_translation_job_timing BEFORE UPDATE ON translation.translation_jobs
    FOR EACH ROW EXECUTE FUNCTION translation.calculate_processing_time();

-- Update template usage count
CREATE OR REPLACE FUNCTION translation.update_template_usage()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.template_id IS NOT NULL THEN
        UPDATE translation.translation_templates 
        SET usage_count = usage_count + 1,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = NEW.template_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_template_usage_count AFTER INSERT ON translation.translation_jobs
    FOR EACH ROW EXECUTE FUNCTION translation.update_template_usage();
-- ============================================================================
-- AUDIT AND ANALYTICS SCHEMA
-- Comprehensive logging, monitoring, and business intelligence
-- ============================================================================

-- Audit logs for all system changes
CREATE TABLE audit.audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES core.organizations(id) ON DELETE SET NULL,
    user_id UUID REFERENCES core.users(id) ON DELETE SET NULL,
    
    -- Event identification
    event_type VARCHAR(100) NOT NULL,
    event_category VARCHAR(50) NOT NULL CHECK (
        event_category IN ('authentication', 'authorization', 'data_access', 'data_modification', 
                          'system_admin', 'security', 'billing', 'api_access', 'user_action')
    ),
    action VARCHAR(100) NOT NULL, -- CREATE, UPDATE, DELETE, LOGIN, LOGOUT, etc.
    
    -- Target information
    resource_type VARCHAR(100) NOT NULL,
    resource_id UUID,
    resource_name VARCHAR(255),
    
    -- Change details
    old_values JSONB,
    new_values JSONB,
    changes_made JSONB,
    
    -- Context
    session_id VARCHAR(255),
    request_id VARCHAR(255),
    correlation_id VARCHAR(255),
    
    -- Source information
    ip_address INET,
    user_agent TEXT,
    source_application VARCHAR(100),
    api_key_id UUID REFERENCES core.api_keys(id),
    
    -- Request details
    http_method VARCHAR(10),
    endpoint_path VARCHAR(500),
    query_parameters JSONB,
    request_size_bytes INTEGER,
    response_status INTEGER,
    response_size_bytes INTEGER,
    
    -- Timing
    processing_time_ms INTEGER,
    
    -- Risk and security
    risk_level VARCHAR(20) DEFAULT 'low' CHECK (
        risk_level IN ('low', 'medium', 'high', 'critical')
    ),
    is_suspicious BOOLEAN DEFAULT FALSE,
    security_flags TEXT[] DEFAULT '{}',
    
    -- Metadata
    metadata JSONB DEFAULT '{}',
    tags TEXT[] DEFAULT '{}',
    
    -- Created timestamp (immutable)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- System performance metrics
CREATE TABLE audit.performance_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Metric identification
    metric_name VARCHAR(100) NOT NULL,
    metric_category VARCHAR(50) NOT NULL CHECK (
        metric_category IN ('database', 'api', 'translation', 'export', 'storage', 'network', 'user_experience')
    ),
    
    -- Timing period
    measurement_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    time_period_minutes INTEGER DEFAULT 1,
    
    -- Values
    metric_value DECIMAL(15,6) NOT NULL,
    metric_unit VARCHAR(20) NOT NULL, -- ms, seconds, MB, requests, percentage, etc.
    
    -- Aggregation info
    aggregation_type VARCHAR(20) DEFAULT 'average' CHECK (
        aggregation_type IN ('sum', 'average', 'min', 'max', 'count', 'percentile_95', 'percentile_99')
    ),
    sample_count INTEGER,
    
    -- Breakdown dimensions
    organization_id UUID REFERENCES core.organizations(id) ON DELETE CASCADE,
    service_name VARCHAR(100),
    environment VARCHAR(50),
    region VARCHAR(50),
    
    -- Thresholds and alerts
    is_anomaly BOOLEAN DEFAULT FALSE,
    threshold_breached VARCHAR(50), -- warning, critical, etc.
    
    -- Metadata
    metadata JSONB DEFAULT '{}',
    
    UNIQUE(metric_name, metric_category, measurement_time, organization_id, service_name)
);

-- Error tracking and monitoring
CREATE TABLE audit.error_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES core.organizations(id) ON DELETE SET NULL,
    user_id UUID REFERENCES core.users(id) ON DELETE SET NULL,
    
    -- Error identification
    error_id VARCHAR(255), -- External error tracking ID
    error_type VARCHAR(100) NOT NULL,
    error_code VARCHAR(50),
    error_message TEXT NOT NULL,
    
    -- Error details
    stack_trace TEXT,
    error_context JSONB DEFAULT '{}',
    
    -- Source information
    service_name VARCHAR(100),
    component_name VARCHAR(100),
    function_name VARCHAR(200),
    file_path VARCHAR(500),
    line_number INTEGER,
    
    -- Request context
    request_id VARCHAR(255),
    session_id VARCHAR(255),
    correlation_id VARCHAR(255),
    
    -- HTTP context
    http_method VARCHAR(10),
    endpoint_path VARCHAR(500),
    status_code INTEGER,
    
    -- User context
    ip_address INET,
    user_agent TEXT,
    
    -- Environment
    environment VARCHAR(50),
    deployment_version VARCHAR(100),
    
    -- Severity and impact
    severity VARCHAR(20) DEFAULT 'error' CHECK (
        severity IN ('debug', 'info', 'warning', 'error', 'critical', 'fatal')
    ),
    impact_level VARCHAR(20) DEFAULT 'low' CHECK (
        impact_level IN ('none', 'low', 'medium', 'high', 'critical')
    ),
    
    -- Resolution
    is_resolved BOOLEAN DEFAULT FALSE,
    resolved_at TIMESTAMP WITH TIME ZONE,
    resolved_by UUID REFERENCES core.users(id),
    resolution_notes TEXT,
    
    -- Grouping and frequency
    error_hash VARCHAR(64), -- Hash of error signature for grouping
    occurrence_count INTEGER DEFAULT 1,
    first_seen_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Created timestamp
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- User behavior analytics
CREATE TABLE analytics.user_behavior (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES core.users(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES core.organizations(id) ON DELETE CASCADE,
    session_id VARCHAR(255),
    
    -- Event details
    event_name VARCHAR(100) NOT NULL,
    event_category VARCHAR(50) NOT NULL,
    page_path VARCHAR(500),
    
    -- Event properties
    properties JSONB DEFAULT '{}',
    
    -- Context
    device_type VARCHAR(50),
    browser_name VARCHAR(100),
    browser_version VARCHAR(50),
    os_name VARCHAR(100),
    os_version VARCHAR(50),
    screen_resolution VARCHAR(20),
    viewport_size VARCHAR(20),
    
    -- Location (if available)
    country_code VARCHAR(2),
    region_code VARCHAR(10),
    city VARCHAR(100),
    timezone VARCHAR(50),
    
    -- Referrer
    referrer_url core.url,
    referrer_domain VARCHAR(255),
    utm_source VARCHAR(100),
    utm_medium VARCHAR(100),
    utm_campaign VARCHAR(100),
    
    -- Performance
    page_load_time_ms INTEGER,
    
    -- Created timestamp
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Usage analytics aggregated by day
CREATE TABLE analytics.daily_usage (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES core.organizations(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    
    -- User metrics
    active_users INTEGER DEFAULT 0,
    new_users INTEGER DEFAULT 0,
    returning_users INTEGER DEFAULT 0,
    
    -- Project metrics
    projects_created INTEGER DEFAULT 0,
    projects_updated INTEGER DEFAULT 0,
    active_projects INTEGER DEFAULT 0,
    
    -- Design metrics
    designs_uploaded INTEGER DEFAULT 0,
    designs_parsed INTEGER DEFAULT 0,
    parsing_success_rate DECIMAL(5,4),
    
    -- Translation metrics
    translations_started INTEGER DEFAULT 0,
    translations_completed INTEGER DEFAULT 0,
    translation_success_rate DECIMAL(5,4),
    avg_translation_time_ms INTEGER,
    
    -- Export metrics
    exports_created INTEGER DEFAULT 0,
    exports_downloaded INTEGER DEFAULT 0,
    total_exports_size_mb DECIMAL(10,2),
    
    -- Collaboration metrics
    comments_created INTEGER DEFAULT 0,
    approval_requests INTEGER DEFAULT 0,
    approvals_given INTEGER DEFAULT 0,
    
    -- Performance metrics
    avg_response_time_ms INTEGER,
    error_rate DECIMAL(5,4),
    uptime_percentage DECIMAL(5,4),
    
    -- Storage metrics
    storage_used_mb DECIMAL(10,2),
    bandwidth_used_mb DECIMAL(10,2),
    
    -- API metrics
    api_requests INTEGER DEFAULT 0,
    api_errors INTEGER DEFAULT 0,
    
    -- Created timestamp
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(organization_id, date)
);

-- Feature usage tracking
CREATE TABLE analytics.feature_usage (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES core.organizations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES core.users(id) ON DELETE CASCADE,
    
    -- Feature details
    feature_name VARCHAR(100) NOT NULL,
    feature_category VARCHAR(50) NOT NULL,
    action_taken VARCHAR(100) NOT NULL,
    
    -- Usage context
    context JSONB DEFAULT '{}',
    
    -- Timing
    duration_ms INTEGER,
    
    -- Success/failure
    was_successful BOOLEAN DEFAULT TRUE,
    error_message TEXT,
    
    -- A/B testing
    experiment_id VARCHAR(100),
    variant_id VARCHAR(100),
    
    -- Created timestamp
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Billing and usage tracking
CREATE TABLE analytics.billing_usage (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES core.organizations(id) ON DELETE CASCADE,
    billing_period_start DATE NOT NULL,
    billing_period_end DATE NOT NULL,
    
    -- Translation usage
    translations_count INTEGER DEFAULT 0,
    translation_tokens_used BIGINT DEFAULT 0,
    translation_cost_usd DECIMAL(10,4) DEFAULT 0,
    
    -- Export usage
    exports_count INTEGER DEFAULT 0,
    export_storage_mb DECIMAL(10,2) DEFAULT 0,
    export_bandwidth_mb DECIMAL(10,2) DEFAULT 0,
    
    -- Storage usage
    design_files_storage_mb DECIMAL(10,2) DEFAULT 0,
    assets_storage_mb DECIMAL(10,2) DEFAULT 0,
    total_storage_mb DECIMAL(10,2) DEFAULT 0,
    
    -- API usage
    api_requests_count INTEGER DEFAULT 0,
    api_bandwidth_mb DECIMAL(10,2) DEFAULT 0,
    
    -- Collaboration usage
    active_collaborators INTEGER DEFAULT 0,
    collaboration_sessions INTEGER DEFAULT 0,
    
    -- Overage tracking
    storage_overage_mb DECIMAL(10,2) DEFAULT 0,
    translation_overage INTEGER DEFAULT 0,
    api_overage INTEGER DEFAULT 0,
    
    -- Costs
    base_subscription_cost_usd DECIMAL(10,2) DEFAULT 0,
    overage_costs_usd DECIMAL(10,4) DEFAULT 0,
    total_cost_usd DECIMAL(10,2) DEFAULT 0,
    
    -- Status
    is_finalized BOOLEAN DEFAULT FALSE,
    finalized_at TIMESTAMP WITH TIME ZONE,
    
    -- Created timestamp
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(organization_id, billing_period_start, billing_period_end)
);

-- Business intelligence views and aggregations
CREATE TABLE analytics.business_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    metric_date DATE NOT NULL,
    metric_period VARCHAR(20) DEFAULT 'daily' CHECK (
        metric_period IN ('daily', 'weekly', 'monthly', 'quarterly', 'yearly')
    ),
    
    -- Growth metrics
    total_organizations INTEGER DEFAULT 0,
    active_organizations INTEGER DEFAULT 0,
    new_organizations INTEGER DEFAULT 0,
    churned_organizations INTEGER DEFAULT 0,
    
    -- User metrics
    total_users INTEGER DEFAULT 0,
    active_users INTEGER DEFAULT 0,
    new_users INTEGER DEFAULT 0,
    
    -- Engagement metrics
    avg_session_duration_minutes DECIMAL(8,2),
    avg_projects_per_org DECIMAL(6,2),
    avg_translations_per_project DECIMAL(6,2),
    avg_exports_per_project DECIMAL(6,2),
    
    -- Revenue metrics
    total_revenue_usd DECIMAL(12,2) DEFAULT 0,
    recurring_revenue_usd DECIMAL(12,2) DEFAULT 0,
    one_time_revenue_usd DECIMAL(12,2) DEFAULT 0,
    average_revenue_per_org_usd DECIMAL(10,2) DEFAULT 0,
    
    -- Product metrics
    translation_success_rate DECIMAL(5,4),
    export_success_rate DECIMAL(5,4),
    avg_translation_quality_score DECIMAL(5,4),
    avg_export_quality_score DECIMAL(5,4),
    
    -- Support metrics
    support_tickets INTEGER DEFAULT 0,
    avg_resolution_time_hours DECIMAL(8,2),
    customer_satisfaction_score DECIMAL(3,2),
    
    -- Technical metrics
    system_uptime_percentage DECIMAL(5,4),
    avg_response_time_ms INTEGER,
    error_rate DECIMAL(5,4),
    
    -- Created timestamp
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(metric_date, metric_period)
);

-- Data retention policies
CREATE TABLE audit.data_retention_policies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Policy details
    policy_name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    
    -- Target tables and data
    table_name VARCHAR(100) NOT NULL,
    schema_name VARCHAR(100) NOT NULL,
    
    -- Retention rules
    retention_days INTEGER NOT NULL,
    archive_before_delete BOOLEAN DEFAULT TRUE,
    archive_location VARCHAR(500),
    
    -- Conditions
    retention_conditions JSONB DEFAULT '{}',
    
    -- Execution
    is_active BOOLEAN DEFAULT TRUE,
    last_executed_at TIMESTAMP WITH TIME ZONE,
    next_execution_at TIMESTAMP WITH TIME ZONE,
    execution_frequency_days INTEGER DEFAULT 1,
    
    -- Status
    status core.status DEFAULT 'active',
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES core.users(id)
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Audit logs
CREATE INDEX idx_audit_logs_org_time ON audit.audit_logs(organization_id, created_at DESC);
CREATE INDEX idx_audit_logs_user_time ON audit.audit_logs(user_id, created_at DESC);
CREATE INDEX idx_audit_logs_event ON audit.audit_logs(event_type, event_category, created_at DESC);
CREATE INDEX idx_audit_logs_resource ON audit.audit_logs(resource_type, resource_id);
CREATE INDEX idx_audit_logs_session ON audit.audit_logs(session_id, request_id);
CREATE INDEX idx_audit_logs_security ON audit.audit_logs(risk_level, is_suspicious) WHERE risk_level != 'low' OR is_suspicious = TRUE;
CREATE INDEX idx_audit_logs_ip ON audit.audit_logs(ip_address, created_at DESC);

-- Performance metrics
CREATE INDEX idx_performance_metrics_time ON audit.performance_metrics(measurement_time DESC);
CREATE INDEX idx_performance_metrics_category ON audit.performance_metrics(metric_category, metric_name);
CREATE INDEX idx_performance_metrics_org ON audit.performance_metrics(organization_id, measurement_time DESC);
CREATE INDEX idx_performance_metrics_service ON audit.performance_metrics(service_name, measurement_time DESC);
CREATE INDEX idx_performance_metrics_anomaly ON audit.performance_metrics(is_anomaly, threshold_breached) WHERE is_anomaly = TRUE;

-- Error logs
CREATE INDEX idx_error_logs_time ON audit.error_logs(created_at DESC);
CREATE INDEX idx_error_logs_org ON audit.error_logs(organization_id, created_at DESC);
CREATE INDEX idx_error_logs_type ON audit.error_logs(error_type, severity);
CREATE INDEX idx_error_logs_hash ON audit.error_logs(error_hash, last_seen_at DESC);
CREATE INDEX idx_error_logs_service ON audit.error_logs(service_name, created_at DESC);
CREATE INDEX idx_error_logs_severity ON audit.error_logs(severity, impact_level) WHERE severity IN ('error', 'critical', 'fatal');
CREATE INDEX idx_error_logs_unresolved ON audit.error_logs(is_resolved, severity) WHERE is_resolved = FALSE;

-- User behavior
CREATE INDEX idx_user_behavior_user ON analytics.user_behavior(user_id, created_at DESC);
CREATE INDEX idx_user_behavior_org ON analytics.user_behavior(organization_id, created_at DESC);
CREATE INDEX idx_user_behavior_event ON analytics.user_behavior(event_name, event_category);
CREATE INDEX idx_user_behavior_session ON analytics.user_behavior(session_id, created_at);
CREATE INDEX idx_user_behavior_time ON analytics.user_behavior(created_at DESC);

-- Daily usage
CREATE INDEX idx_daily_usage_org ON analytics.daily_usage(organization_id, date DESC);
CREATE INDEX idx_daily_usage_date ON analytics.daily_usage(date DESC);

-- Feature usage
CREATE INDEX idx_feature_usage_org ON analytics.feature_usage(organization_id, created_at DESC);
CREATE INDEX idx_feature_usage_user ON analytics.feature_usage(user_id, created_at DESC);
CREATE INDEX idx_feature_usage_feature ON analytics.feature_usage(feature_name, feature_category);
CREATE INDEX idx_feature_usage_experiment ON analytics.feature_usage(experiment_id, variant_id);

-- Billing usage
CREATE INDEX idx_billing_usage_org ON analytics.billing_usage(organization_id, billing_period_start DESC);
CREATE INDEX idx_billing_usage_period ON analytics.billing_usage(billing_period_start, billing_period_end);
CREATE INDEX idx_billing_usage_finalized ON analytics.billing_usage(is_finalized, billing_period_end DESC);

-- Business metrics
CREATE INDEX idx_business_metrics_date ON analytics.business_metrics(metric_date DESC, metric_period);

-- Data retention policies
CREATE INDEX idx_retention_policies_table ON audit.data_retention_policies(schema_name, table_name) WHERE is_active = TRUE;
CREATE INDEX idx_retention_policies_execution ON audit.data_retention_policies(next_execution_at) WHERE is_active = TRUE;

-- ============================================================================
-- PARTITIONING (for large tables)
-- ============================================================================

-- Partition audit_logs by month for performance
-- Note: This would be implemented during database setup
-- ALTER TABLE audit.audit_logs PARTITION BY RANGE (created_at);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Update updated_at timestamp
CREATE TRIGGER update_data_retention_policies_updated_at BEFORE UPDATE ON audit.data_retention_policies
    FOR EACH ROW EXECUTE FUNCTION core.update_updated_at();

-- Automatic error grouping by hash
CREATE OR REPLACE FUNCTION audit.update_error_grouping()
RETURNS TRIGGER AS $$
BEGIN
    -- Generate error hash for grouping similar errors
    NEW.error_hash = encode(
        digest(
            COALESCE(NEW.error_type, '') || '|' || 
            COALESCE(NEW.error_code, '') || '|' || 
            COALESCE(NEW.service_name, '') || '|' || 
            COALESCE(NEW.component_name, ''),
            'sha256'
        ),
        'hex'
    );
    
    -- Check if this error already exists and update counts
    UPDATE audit.error_logs 
    SET occurrence_count = occurrence_count + 1,
        last_seen_at = NEW.created_at
    WHERE error_hash = NEW.error_hash 
      AND id != NEW.id
      AND created_at >= NEW.created_at - INTERVAL '24 hours';
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_error_grouping BEFORE INSERT ON audit.error_logs
    FOR EACH ROW EXECUTE FUNCTION audit.update_error_grouping();

-- Automatic performance anomaly detection
CREATE OR REPLACE FUNCTION audit.detect_performance_anomalies()
RETURNS TRIGGER AS $$
DECLARE
    avg_value DECIMAL(15,6);
    std_dev DECIMAL(15,6);
    threshold_multiplier DECIMAL(3,1) := 2.0; -- 2 standard deviations
BEGIN
    -- Calculate average and standard deviation for the metric over the last 24 hours
    SELECT AVG(metric_value), STDDEV(metric_value)
    INTO avg_value, std_dev
    FROM audit.performance_metrics
    WHERE metric_name = NEW.metric_name
      AND metric_category = NEW.metric_category
      AND measurement_time >= NEW.measurement_time - INTERVAL '24 hours'
      AND measurement_time < NEW.measurement_time;
    
    -- Mark as anomaly if value is significantly different from the average
    IF avg_value IS NOT NULL AND std_dev IS NOT NULL AND std_dev > 0 THEN
        IF ABS(NEW.metric_value - avg_value) > (threshold_multiplier * std_dev) THEN
            NEW.is_anomaly = TRUE;
            
            -- Set threshold breach level
            IF ABS(NEW.metric_value - avg_value) > (3.0 * std_dev) THEN
                NEW.threshold_breached = 'critical';
            ELSE
                NEW.threshold_breached = 'warning';
            END IF;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER detect_performance_anomalies BEFORE INSERT ON audit.performance_metrics
    FOR EACH ROW EXECUTE FUNCTION audit.detect_performance_anomalies();
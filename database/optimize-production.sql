-- Database Optimization Script for Imagineer Platform Production
-- Performance tuning, indexing, and maintenance procedures

-- =============================================================================
-- PERFORMANCE INDEXES
-- =============================================================================

-- Core entity indexes for fast lookups
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_email_active 
ON users (email) WHERE active = true;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_projects_user_created 
ON projects (user_id, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_designs_project_status 
ON designs (project_id, status) WHERE status != 'deleted';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_translations_design_provider 
ON translations (design_id, llm_provider, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_exports_translation_format 
ON exports (translation_id, export_format, created_at DESC);

-- Collaboration and real-time features
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_collaboration_sessions_room_active 
ON collaboration_sessions (room_id, is_active) WHERE is_active = true;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_design_changes_timestamp 
ON design_changes (design_id, timestamp DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_sessions_active 
ON user_sessions (user_id, expires_at) WHERE is_active = true;

-- Job processing and queues
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_jobs_status_priority 
ON jobs (status, priority DESC, created_at ASC) WHERE status IN ('pending', 'processing');

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_jobs_user_type_created 
ON jobs (user_id, job_type, created_at DESC);

-- Audit and analytics
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_timestamp 
ON audit_logs (timestamp DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_user_action 
ON audit_logs (user_id, action_type, timestamp DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_analytics_events_timestamp 
ON analytics_events (event_timestamp DESC);

-- Composite indexes for complex queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_designs_complex_lookup 
ON designs (user_id, project_id, status, created_at DESC) 
WHERE status != 'deleted';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_translations_performance 
ON translations (design_id, status, llm_provider, created_at DESC) 
WHERE status = 'completed';

-- Full-text search indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_projects_search 
ON projects USING GIN (to_tsvector('english', name || ' ' || description));

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_designs_search 
ON designs USING GIN (to_tsvector('english', name || ' ' || COALESCE(description, '')));

-- =============================================================================
-- PARTITIONING FOR LARGE TABLES
-- =============================================================================

-- Partition audit logs by month for better performance
DO $$
DECLARE
    start_date date := date_trunc('month', CURRENT_DATE - INTERVAL '1 year');
    end_date date := date_trunc('month', CURRENT_DATE + INTERVAL '1 year');
    current_date date := start_date;
    table_name text;
BEGIN
    -- Create partitioned audit logs table if not exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'audit_logs_partitioned'
    ) THEN
        -- Create parent table
        CREATE TABLE audit_logs_partitioned (
            LIKE audit_logs INCLUDING ALL
        ) PARTITION BY RANGE (timestamp);
        
        -- Create monthly partitions
        WHILE current_date < end_date LOOP
            table_name := 'audit_logs_' || to_char(current_date, 'YYYY_MM');
            
            EXECUTE format('
                CREATE TABLE IF NOT EXISTS %I PARTITION OF audit_logs_partitioned
                FOR VALUES FROM (%L) TO (%L)',
                table_name,
                current_date,
                current_date + INTERVAL '1 month'
            );
            
            current_date := current_date + INTERVAL '1 month';
        END LOOP;
    END IF;
END $$;

-- Partition analytics events by month
DO $$
DECLARE
    start_date date := date_trunc('month', CURRENT_DATE - INTERVAL '1 year');
    end_date date := date_trunc('month', CURRENT_DATE + INTERVAL '1 year');
    current_date date := start_date;
    table_name text;
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'analytics_events_partitioned'
    ) THEN
        CREATE TABLE analytics_events_partitioned (
            LIKE analytics_events INCLUDING ALL
        ) PARTITION BY RANGE (event_timestamp);
        
        WHILE current_date < end_date LOOP
            table_name := 'analytics_events_' || to_char(current_date, 'YYYY_MM');
            
            EXECUTE format('
                CREATE TABLE IF NOT EXISTS %I PARTITION OF analytics_events_partitioned
                FOR VALUES FROM (%L) TO (%L)',
                table_name,
                current_date,
                current_date + INTERVAL '1 month'
            );
            
            current_date := current_date + INTERVAL '1 month';
        END LOOP;
    END IF;
END $$;

-- =============================================================================
-- MATERIALIZED VIEWS FOR ANALYTICS
-- =============================================================================

-- User activity summary
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_user_activity_summary AS
SELECT 
    u.id as user_id,
    u.email,
    COUNT(DISTINCT p.id) as total_projects,
    COUNT(DISTINCT d.id) as total_designs,
    COUNT(DISTINCT t.id) as total_translations,
    COUNT(DISTINCT e.id) as total_exports,
    MAX(al.timestamp) as last_activity,
    DATE_TRUNC('day', MAX(al.timestamp)) as last_active_date
FROM users u
LEFT JOIN projects p ON u.id = p.user_id
LEFT JOIN designs d ON p.id = d.project_id
LEFT JOIN translations t ON d.id = t.design_id
LEFT JOIN exports e ON t.id = e.translation_id
LEFT JOIN audit_logs al ON u.id = al.user_id
WHERE u.active = true
GROUP BY u.id, u.email;

CREATE UNIQUE INDEX ON mv_user_activity_summary (user_id);
CREATE INDEX ON mv_user_activity_summary (last_active_date DESC);

-- Daily platform metrics
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_daily_metrics AS
SELECT 
    DATE_TRUNC('day', timestamp) as metric_date,
    COUNT(*) FILTER (WHERE action_type = 'user_login') as daily_logins,
    COUNT(*) FILTER (WHERE action_type = 'design_import') as daily_imports,
    COUNT(*) FILTER (WHERE action_type = 'translation_completed') as daily_translations,
    COUNT(*) FILTER (WHERE action_type = 'export_generated') as daily_exports,
    COUNT(DISTINCT user_id) as daily_active_users
FROM audit_logs 
WHERE timestamp >= CURRENT_DATE - INTERVAL '90 days'
GROUP BY DATE_TRUNC('day', timestamp)
ORDER BY metric_date DESC;

CREATE UNIQUE INDEX ON mv_daily_metrics (metric_date);

-- Translation performance metrics
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_translation_performance AS
SELECT 
    llm_provider,
    AVG(processing_time_seconds) as avg_processing_time,
    PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY processing_time_seconds) as median_processing_time,
    PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY processing_time_seconds) as p95_processing_time,
    COUNT(*) as total_translations,
    COUNT(*) FILTER (WHERE status = 'completed') as successful_translations,
    (COUNT(*) FILTER (WHERE status = 'completed')::float / COUNT(*)) as success_rate
FROM translations 
WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY llm_provider;

CREATE UNIQUE INDEX ON mv_translation_performance (llm_provider);

-- =============================================================================
-- AUTOMATED MAINTENANCE PROCEDURES
-- =============================================================================

-- Function to refresh materialized views
CREATE OR REPLACE FUNCTION refresh_analytics_views()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_user_activity_summary;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_daily_metrics;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_translation_performance;
    
    -- Log the refresh
    INSERT INTO system_logs (level, message, created_at)
    VALUES ('INFO', 'Analytics materialized views refreshed', NOW());
END;
$$ LANGUAGE plpgsql;

-- Function to clean up old data
CREATE OR REPLACE FUNCTION cleanup_old_data()
RETURNS void AS $$
DECLARE
    deleted_count integer;
BEGIN
    -- Clean up old audit logs (keep 1 year)
    DELETE FROM audit_logs 
    WHERE timestamp < CURRENT_DATE - INTERVAL '1 year';
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    IF deleted_count > 0 THEN
        INSERT INTO system_logs (level, message, created_at)
        VALUES ('INFO', format('Cleaned up %s old audit log entries', deleted_count), NOW());
    END IF;
    
    -- Clean up old analytics events (keep 6 months)
    DELETE FROM analytics_events 
    WHERE event_timestamp < CURRENT_DATE - INTERVAL '6 months';
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    IF deleted_count > 0 THEN
        INSERT INTO system_logs (level, message, created_at)
        VALUES ('INFO', format('Cleaned up %s old analytics events', deleted_count), NOW());
    END IF;
    
    -- Clean up expired user sessions
    DELETE FROM user_sessions 
    WHERE expires_at < NOW() OR (last_activity < NOW() - INTERVAL '30 days');
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    IF deleted_count > 0 THEN
        INSERT INTO system_logs (level, message, created_at)
        VALUES ('INFO', format('Cleaned up %s expired user sessions', deleted_count), NOW());
    END IF;
    
    -- Clean up old job records (keep 3 months)
    DELETE FROM jobs 
    WHERE status IN ('completed', 'failed') 
    AND updated_at < CURRENT_DATE - INTERVAL '3 months';
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    IF deleted_count > 0 THEN
        INSERT INTO system_logs (level, message, created_at)
        VALUES ('INFO', format('Cleaned up %s old job records', deleted_count), NOW());
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to analyze and optimize tables
CREATE OR REPLACE FUNCTION optimize_database()
RETURNS void AS $$
DECLARE
    table_record record;
BEGIN
    -- Analyze all tables for query planner optimization
    FOR table_record IN 
        SELECT schemaname, tablename 
        FROM pg_tables 
        WHERE schemaname = 'public'
    LOOP
        EXECUTE format('ANALYZE %I.%I', table_record.schemaname, table_record.tablename);
    END LOOP;
    
    -- Vacuum analyze critical tables
    VACUUM ANALYZE users, projects, designs, translations, exports;
    
    -- Reindex if needed (check for bloated indexes)
    REINDEX INDEX CONCURRENTLY idx_users_email_active;
    REINDEX INDEX CONCURRENTLY idx_projects_user_created;
    REINDEX INDEX CONCURRENTLY idx_designs_project_status;
    
    INSERT INTO system_logs (level, message, created_at)
    VALUES ('INFO', 'Database optimization completed', NOW());
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- PERFORMANCE MONITORING VIEWS
-- =============================================================================

-- View for monitoring slow queries
CREATE OR REPLACE VIEW v_slow_queries AS
SELECT 
    query,
    calls,
    total_time,
    mean_time,
    stddev_time,
    rows,
    100.0 * shared_blks_hit / nullif(shared_blks_hit + shared_blks_read, 0) AS hit_percent
FROM pg_stat_statements 
WHERE mean_time > 1000  -- Queries taking more than 1 second
ORDER BY total_time DESC;

-- View for monitoring table sizes
CREATE OR REPLACE VIEW v_table_sizes AS
SELECT 
    schemaname,
    tablename,
    attname,
    n_distinct,
    correlation,
    most_common_vals,
    most_common_freqs,
    histogram_bounds
FROM pg_stats 
WHERE schemaname = 'public'
ORDER BY schemaname, tablename;

-- View for monitoring index usage
CREATE OR REPLACE VIEW v_index_usage AS
SELECT 
    schemaname,
    tablename,
    attname,
    n_distinct,
    correlation
FROM pg_stats 
WHERE schemaname = 'public'
ORDER BY schemaname, tablename;

-- =============================================================================
-- SCHEDULED MAINTENANCE
-- =============================================================================

-- Note: These would typically be scheduled via cron or a job scheduler
-- Daily maintenance at 2 AM
-- 0 2 * * * psql -d imagineer -c "SELECT cleanup_old_data();"

-- Weekly optimization on Sundays at 3 AM
-- 0 3 * * 0 psql -d imagineer -c "SELECT optimize_database();"

-- Hourly materialized view refresh
-- 0 * * * * psql -d imagineer -c "SELECT refresh_analytics_views();"

-- =============================================================================
-- CONNECTION POOLING OPTIMIZATION
-- =============================================================================

-- Set optimal connection parameters
ALTER SYSTEM SET max_connections = 200;
ALTER SYSTEM SET shared_buffers = '256MB';
ALTER SYSTEM SET effective_cache_size = '1GB';
ALTER SYSTEM SET work_mem = '4MB';
ALTER SYSTEM SET maintenance_work_mem = '64MB';

-- Reload configuration
SELECT pg_reload_conf();

-- =============================================================================
-- MONITORING ALERTS
-- =============================================================================

-- Function to check system health
CREATE OR REPLACE FUNCTION check_system_health()
RETURNS TABLE(
    metric_name text,
    metric_value numeric,
    threshold numeric,
    status text
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        'Active Connections'::text,
        (SELECT count(*) FROM pg_stat_activity WHERE state = 'active')::numeric,
        150::numeric,
        CASE WHEN (SELECT count(*) FROM pg_stat_activity WHERE state = 'active') > 150 
             THEN 'WARNING' ELSE 'OK' END::text
    
    UNION ALL
    
    SELECT 
        'Long Running Queries'::text,
        (SELECT count(*) FROM pg_stat_activity 
         WHERE state = 'active' AND now() - query_start > interval '5 minutes')::numeric,
        5::numeric,
        CASE WHEN (SELECT count(*) FROM pg_stat_activity 
                  WHERE state = 'active' AND now() - query_start > interval '5 minutes') > 5 
             THEN 'CRITICAL' ELSE 'OK' END::text
    
    UNION ALL
    
    SELECT 
        'Database Size (GB)'::text,
        (SELECT pg_database_size(current_database()) / 1024 / 1024 / 1024)::numeric,
        50::numeric,
        CASE WHEN (SELECT pg_database_size(current_database()) / 1024 / 1024 / 1024) > 50 
             THEN 'WARNING' ELSE 'OK' END::text;
END;
$$ LANGUAGE plpgsql;
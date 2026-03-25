# Imagineer Database Architecture

A comprehensive PostgreSQL database system designed for the Imagineer design-to-LLM translation platform. This database architecture follows microservices principles with multi-tenant security, comprehensive audit trails, and future-proof scalability.

## Architecture Overview

The database is organized into 7 logical schemas, each representing a distinct service domain:

- **`core`** - Organization management, users, teams, and system configuration
- **`design`** - Design file parsing, storage, and element extraction
- **`translation`** - LLM translation engine and job management
- **`export`** - Multi-format export engine and file generation
- **`collab`** - Real-time collaboration, comments, and approval workflows
- **`audit`** - Comprehensive audit logging and error tracking
- **`analytics`** - Business intelligence and usage analytics

## Key Features

### 🏗️ Enterprise-Grade Architecture
- **Multi-tenant by design** with organization-based row-level security
- **Microservices ready** with clear service boundaries
- **Event-sourced design elements** for complete change tracking
- **JSONB optimization** for flexible design data storage

### 🔐 Security & Compliance
- **Row Level Security (RLS)** for tenant isolation
- **Comprehensive audit trails** with 7-year retention
- **API key management** with rate limiting
- **Role-based access control** with granular permissions

### 📈 Performance & Scalability
- **Optimized indexing strategy** for sub-100ms queries
- **Partition-ready tables** for horizontal scaling
- **Connection pooling support** for high concurrency
- **Efficient JSONB queries** for design data

### 🔄 Real-time Collaboration
- **WebSocket-ready** activity feeds and notifications
- **Comment threading** with reaction support
- **Approval workflows** with parallel/sequential processing
- **Live collaboration sessions** with participant tracking

### 📊 Analytics & Intelligence
- **Daily usage aggregation** for business metrics
- **Performance monitoring** with anomaly detection
- **User behavior tracking** for product insights
- **Billing usage calculation** with overage tracking

## Quick Start

### Prerequisites
- PostgreSQL 14+ (recommended: 15+)
- `psql` client installed
- Database with appropriate permissions

### 1. Run Migration Script
```bash
# Default local setup
./migrate.sh

# Custom database URL
./migrate.sh -u "postgresql://user:pass@host:5432/imagineer"

# Production setup (skip seed data)
./migrate.sh -u $DATABASE_URL --skip-seed

# Reset and recreate (DESTRUCTIVE)
./migrate.sh --reset
```

### 2. Verify Installation
```sql
-- Check schemas
SELECT schema_name FROM information_schema.schemata 
WHERE schema_name IN ('core', 'design', 'translation', 'export', 'collab', 'audit', 'analytics');

-- Check table counts
SELECT schemaname, COUNT(*) as table_count 
FROM pg_tables 
WHERE schemaname IN ('core', 'design', 'translation', 'export', 'collab', 'audit', 'analytics')
GROUP BY schemaname;
```

### 3. Application Setup
```javascript
// Example connection configuration
const config = {
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production',
  max: 20, // Connection pool size
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000
};
```

## Schema Documentation

### Core Schema (`core`)
Foundation tables for multi-tenant architecture:
- `organizations` - Top-level tenants with subscription management
- `users` - User profiles with authentication integration
- `teams` - Team organization within companies
- `organization_members` / `team_members` - Role-based membership
- `api_keys` - Programmatic access with rate limiting
- `webhooks` - Event notification configuration
- `feature_flags` - Gradual feature rollout
- `system_config` - Application configuration

### Design Schema (`design`)
Design file management and parsing:
- `projects` - Design project containers
- `design_files` - Uploaded design files with version tracking
- `design_versions` - File version history and change tracking
- `parsed_designs` - Extracted design data in JSONB format
- `design_elements` - Individual UI elements with properties
- `design_components` - Reusable component definitions
- `design_assets` - Images, icons, and media files
- `design_annotations` - Comments and feedback on designs
- `sync_logs` - External tool synchronization history

### Translation Schema (`translation`)
LLM-powered translation engine:
- `translation_templates` - Reusable prompt templates
- `translation_jobs` - Queued translation tasks
- `translation_results` - Generated LLM outputs
- `translation_revisions` - Result version history
- `llm_interactions` - Raw LLM API interaction logs
- `translation_feedback` - Quality ratings and feedback
- `model_configurations` - LLM provider settings
- `quality_metrics` - Aggregated quality analytics

### Export Schema (`export`)
Multi-format export system:
- `export_configurations` - Output format definitions
- `export_jobs` - Queued export tasks
- `export_results` - Generated files and content
- `export_packages` - Bundled export collections
- `export_templates` - Rendering templates
- `export_assets` - Generated media and resources
- `export_feedback` - Quality feedback on exports
- `export_analytics` - Usage and performance metrics

### Collaboration Schema (`collab`)
Real-time collaboration features:
- `collaboration_sessions` - Live collaboration rooms
- `session_participants` - Session membership tracking
- `comments` - Threaded discussions on designs
- `comment_reactions` - Like/reaction system
- `approval_workflows` - Configurable approval processes
- `approval_requests` - Individual approval instances
- `approval_stages` - Multi-stage approval tracking
- `approval_responses` - Individual approver decisions
- `activity_feed` - Real-time activity notifications
- `notifications` - User notification delivery
- `chat_messages` - Optional team chat feature

### Audit Schema (`audit`)
Comprehensive system monitoring:
- `audit_logs` - Complete system activity audit trail
- `performance_metrics` - System performance monitoring
- `error_logs` - Error tracking with automatic grouping
- `data_retention_policies` - Automated data lifecycle management

### Analytics Schema (`analytics`)
Business intelligence and metrics:
- `user_behavior` - User interaction tracking
- `daily_usage` - Aggregated daily metrics
- `feature_usage` - Feature adoption tracking
- `billing_usage` - Usage-based billing calculation
- `business_metrics` - High-level business KPIs

## Security Model

### Row Level Security (RLS)
Every table implements tenant isolation through RLS policies:
```sql
-- Example: Users can only see their organization's projects
CREATE POLICY projects_access_policy ON design.projects
FOR ALL USING (
    organization_id = ANY(core.current_user_organization_ids()) OR
    visibility = 'public'
);
```

### Application Roles
- `imagineer_app_user` - Standard application access
- `imagineer_app_admin` - Elevated administrative access
- `imagineer_app_service` - Service account permissions
- `imagineer_app_readonly` - Read-only access for reporting

### Session Context
Applications must set session variables for RLS:
```sql
-- Set current user context
SET app.current_user_id = 'user-uuid-here';
SET app.is_super_admin = 'false';
```

## Performance Optimizations

### Indexing Strategy
- **Composite indexes** for common query patterns
- **Partial indexes** for filtered queries
- **GIN indexes** for JSONB and array columns
- **Covering indexes** to avoid table lookups

### Query Patterns
```sql
-- Optimized project listing with team filtering
SELECT p.*, t.name as team_name
FROM design.projects p
LEFT JOIN core.teams t ON p.team_id = t.id
WHERE p.organization_id = $1
  AND p.is_deleted = FALSE
ORDER BY p.updated_at DESC
LIMIT 20;

-- Efficient design element search
SELECT *
FROM design.design_elements
WHERE parsed_design_id = $1
  AND properties @> '{"type": "button"}'
ORDER BY level, order_index;
```

### Connection Pooling
Recommended settings for production:
- **Pool size**: 20-50 connections
- **Max lifetime**: 30 minutes
- **Idle timeout**: 10 minutes
- **Connection timeout**: 2 seconds

## Data Migration and Versioning

### Migration Files
1. `000_extensions.sql` - PostgreSQL extensions and utilities
2. `001_core_schema.sql` - Foundation tables and multi-tenancy
3. `002_design_parser_schema.sql` - Design file management
4. `003_translation_engine_schema.sql` - LLM translation system
5. `004_export_engine_schema.sql` - Export and generation
6. `005_collaboration_hub_schema.sql` - Real-time collaboration
7. `006_audit_analytics_schema.sql` - Monitoring and BI
8. `007_row_level_security.sql` - Security policies
9. `008_seed_data.sql` - Development seed data

### Version Control
- **Schema versioning** through migration files
- **Rollback scripts** for safe deployments
- **Automated testing** for schema changes
- **Blue-green deployment** support

## Monitoring and Maintenance

### Health Checks
```sql
-- Connection health
SELECT COUNT(*) FROM pg_stat_activity;

-- Table sizes
SELECT schemaname, tablename, pg_size_pretty(pg_total_relation_size(tablename::regclass))
FROM pg_tables 
WHERE schemaname IN ('core', 'design', 'translation', 'export', 'collab');

-- Index usage
SELECT schemaname, tablename, indexname, idx_scan, idx_tup_read
FROM pg_stat_user_indexes
ORDER BY idx_scan DESC;
```

### Backup Strategy
- **Daily full backups** with point-in-time recovery
- **Continuous WAL archiving** for zero data loss
- **Cross-region replication** for disaster recovery
- **Automated backup testing** with restore validation

### Performance Monitoring
- **Query performance** tracking with pg_stat_statements
- **Connection pooling** metrics and alerting
- **Table bloat** monitoring and maintenance
- **Index effectiveness** analysis and optimization

## Development Guidelines

### Naming Conventions
- **Tables**: `snake_case` with descriptive names
- **Columns**: `snake_case` following domain language
- **Indexes**: `idx_tablename_columns` format
- **Constraints**: `tablename_column_constraint` format

### JSONB Best Practices
```sql
-- Store structured data efficiently
INSERT INTO design.parsed_designs (design_file_id, raw_data, elements)
VALUES ($1, $2, '{
  "components": [...],
  "styles": {...},
  "layout": {...}
}'::jsonb);

-- Query JSONB efficiently
SELECT * FROM design.design_elements
WHERE properties @> '{"type": "button", "variant": "primary"}';

-- Use GIN indexes for JSONB queries
CREATE INDEX idx_design_elements_properties 
ON design.design_elements USING GIN(properties);
```

### Error Handling
- **Graceful degradation** for non-critical failures
- **Structured error responses** with error codes
- **Retry mechanisms** for transient failures
- **Circuit breakers** for external service calls

## Production Deployment

### Infrastructure Requirements
- **PostgreSQL 15+** with sufficient RAM for working set
- **SSD storage** for optimal I/O performance
- **Connection pooling** (PgBouncer recommended)
- **Monitoring** (pg_stat_monitor, New Relic, etc.)

### Configuration Tuning
```postgresql
# postgresql.conf recommendations
shared_buffers = 256MB                    # 25% of RAM
effective_cache_size = 1GB               # 75% of RAM
work_mem = 4MB                           # For complex queries
maintenance_work_mem = 64MB              # For maintenance operations
checkpoint_completion_target = 0.9       # Spread checkpoints
wal_buffers = 16MB                       # WAL buffer size
random_page_cost = 1.1                   # SSD optimization
```

### Security Hardening
- **SSL/TLS encryption** for all connections
- **Certificate-based authentication** for services
- **Network isolation** with VPC/private subnets
- **Regular security updates** and patching

## Troubleshooting

### Common Issues

#### 1. Connection Pool Exhaustion
```sql
-- Check active connections
SELECT count(*), state FROM pg_stat_activity GROUP BY state;

-- Kill long-running queries
SELECT pg_terminate_backend(pid) 
FROM pg_stat_activity 
WHERE state = 'active' AND query_start < now() - interval '1 hour';
```

#### 2. Slow Queries
```sql
-- Find slow queries
SELECT query, mean_time, calls, total_time
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 10;

-- Analyze query execution
EXPLAIN (ANALYZE, BUFFERS) SELECT ...;
```

#### 3. Storage Issues
```sql
-- Check table sizes
SELECT schemaname, tablename, 
       pg_size_pretty(pg_total_relation_size(tablename::regclass)) as size
FROM pg_tables 
ORDER BY pg_total_relation_size(tablename::regclass) DESC;

-- Check for table bloat
SELECT schemaname, tablename, n_dead_tup, n_live_tup,
       round(n_dead_tup * 100.0 / (n_live_tup + n_dead_tup), 2) as dead_ratio
FROM pg_stat_user_tables
WHERE n_live_tup > 0
ORDER BY dead_ratio DESC;
```

## Support and Contributing

### Getting Help
- **Documentation**: Comprehensive schema documentation in code
- **Issues**: GitHub issues for bug reports and feature requests
- **Community**: Slack/Discord for real-time support
- **Professional**: Enterprise support options available

### Contributing
- **Schema changes**: Create migration files with rollback scripts
- **Performance**: Include query plans and benchmarks
- **Security**: Security issues reported privately
- **Testing**: Include unit tests for new functionality

---

Built with ❤️ for the future of design-to-code automation.
-- ============================================================================
-- SEED DATA FOR IMAGINEER PLATFORM
-- Development and testing data
-- ============================================================================

-- Disable RLS temporarily for seeding
SET row_security = off;

-- ============================================================================
-- SYSTEM CONFIGURATION
-- ============================================================================

INSERT INTO core.system_config (key, value, description, is_secret) VALUES
('app.name', '"Imagineer"', 'Application name', false),
('app.version', '"1.0.0"', 'Current application version', false),
('app.environment', '"development"', 'Current environment', false),
('app.max_file_size_mb', '100', 'Maximum file upload size in MB', false),
('app.max_projects_per_org', '1000', 'Maximum projects per organization', false),
('app.default_translation_timeout_minutes', '30', 'Default translation timeout', false),
('app.default_export_timeout_minutes', '15', 'Default export timeout', false),
('storage.default_provider', '"s3"', 'Default storage provider', false),
('storage.bucket_name', '"imagineer-dev-storage"', 'Default storage bucket', false),
('translation.default_provider', '"openai_gpt4"', 'Default LLM provider', false),
('translation.max_tokens_default', '4000', 'Default max tokens for translations', false),
('translation.temperature_default', '0.7', 'Default temperature for translations', false),
('collaboration.max_session_participants', '50', 'Maximum participants per collaboration session', false),
('collaboration.session_timeout_hours', '24', 'Session timeout in hours', false),
('analytics.retention_days', '365', 'Analytics data retention period', false),
('audit.retention_days', '2555', 'Audit log retention period (7 years)', false);

-- ============================================================================
-- FEATURE FLAGS
-- ============================================================================

INSERT INTO core.feature_flags (name, description, enabled_globally, rollout_percentage) VALUES
('design_parser_v2', 'Enhanced design parser with AI capabilities', false, 0),
('real_time_collaboration', 'Real-time collaboration features', true, 100),
('advanced_analytics', 'Advanced analytics dashboard', false, 25),
('ai_suggestions', 'AI-powered design suggestions', false, 0),
('export_templates_marketplace', 'Community export templates marketplace', false, 10),
('figma_auto_sync', 'Automatic Figma synchronization', true, 80),
('slack_integration', 'Slack workspace integration', false, 50),
('approval_workflows', 'Advanced approval workflows', true, 100),
('multi_language_support', 'Multi-language interface support', false, 0),
('enterprise_sso', 'Enterprise SSO integration', false, 0);

-- ============================================================================
-- DEMO ORGANIZATION AND USERS
-- ============================================================================

-- Create demo organization
INSERT INTO core.organizations (
    id, name, slug, description, subscription_tier, max_projects, max_team_members, 
    max_storage_gb, max_monthly_translations, billing_email, industry, company_size
) VALUES (
    '01234567-89ab-cdef-0123-456789abcdef',
    'Imagineer Demo Company',
    'imagineer-demo',
    'Demo organization for testing and showcase purposes',
    'professional',
    100,
    50,
    100,
    10000,
    'demo@imagineer.dev',
    'Software',
    '11-50'
);

-- Create demo users
INSERT INTO core.users (
    id, email, username, first_name, last_name, display_name, 
    status, email_verified, timezone, locale
) VALUES 
(
    '11111111-1111-1111-1111-111111111111',
    'admin@imagineer.dev',
    'admin',
    'Admin',
    'User',
    'Admin User',
    'active',
    true,
    'UTC',
    'en-US'
),
(
    '22222222-2222-2222-2222-222222222222',
    'designer@imagineer.dev',
    'designer',
    'Jane',
    'Designer',
    'Jane Designer',
    'active',
    true,
    'America/New_York',
    'en-US'
),
(
    '33333333-3333-3333-3333-333333333333',
    'developer@imagineer.dev',
    'developer',
    'John',
    'Developer',
    'John Developer',
    'active',
    true,
    'America/Los_Angeles',
    'en-US'
),
(
    '44444444-4444-4444-4444-444444444444',
    'manager@imagineer.dev',
    'manager',
    'Sarah',
    'Manager',
    'Sarah Manager',
    'active',
    true,
    'Europe/London',
    'en-GB'
);

-- Create organization memberships
INSERT INTO core.organization_members (
    organization_id, user_id, role, is_owner, status
) VALUES 
(
    '01234567-89ab-cdef-0123-456789abcdef',
    '11111111-1111-1111-1111-111111111111',
    'org_admin',
    true,
    'active'
),
(
    '01234567-89ab-cdef-0123-456789abcdef',
    '22222222-2222-2222-2222-222222222222',
    'designer',
    false,
    'active'
),
(
    '01234567-89ab-cdef-0123-456789abcdef',
    '33333333-3333-3333-3333-333333333333',
    'developer',
    false,
    'active'
),
(
    '01234567-89ab-cdef-0123-456789abcdef',
    '44444444-4444-4444-4444-444444444444',
    'team_lead',
    false,
    'active'
);

-- Create demo teams
INSERT INTO core.teams (
    id, organization_id, name, slug, description, created_by
) VALUES 
(
    '55555555-5555-5555-5555-555555555555',
    '01234567-89ab-cdef-0123-456789abcdef',
    'Design Team',
    'design-team',
    'Product design and UX team',
    '11111111-1111-1111-1111-111111111111'
),
(
    '66666666-6666-6666-6666-666666666666',
    '01234567-89ab-cdef-0123-456789abcdef',
    'Development Team',
    'dev-team',
    'Frontend and backend development team',
    '11111111-1111-1111-1111-111111111111'
);

-- Create team memberships
INSERT INTO core.team_members (
    team_id, user_id, role, is_lead, added_by
) VALUES 
(
    '55555555-5555-5555-5555-555555555555',
    '22222222-2222-2222-2222-222222222222',
    'designer',
    true,
    '11111111-1111-1111-1111-111111111111'
),
(
    '55555555-5555-5555-5555-555555555555',
    '44444444-4444-4444-4444-444444444444',
    'team_lead',
    false,
    '11111111-1111-1111-1111-111111111111'
),
(
    '66666666-6666-6666-6666-666666666666',
    '33333333-3333-3333-3333-333333333333',
    'developer',
    true,
    '11111111-1111-1111-1111-111111111111'
),
(
    '66666666-6666-6666-6666-666666666666',
    '44444444-4444-4444-4444-444444444444',
    'team_lead',
    false,
    '11111111-1111-1111-1111-111111111111'
);

-- ============================================================================
-- DEMO PROJECTS AND DESIGNS
-- ============================================================================

-- Create demo projects
INSERT INTO design.projects (
    id, organization_id, team_id, name, slug, description, source_tool, 
    source_url, tags, category, visibility, created_by
) VALUES 
(
    '77777777-7777-7777-7777-777777777777',
    '01234567-89ab-cdef-0123-456789abcdef',
    '55555555-5555-5555-5555-555555555555',
    'E-commerce Mobile App',
    'ecommerce-mobile-app',
    'Mobile application design for online shopping platform',
    'figma',
    'https://figma.com/file/demo-ecommerce-app',
    ARRAY['mobile', 'ecommerce', 'ios', 'android'],
    'Mobile App',
    'team',
    '22222222-2222-2222-2222-222222222222'
),
(
    '88888888-8888-8888-8888-888888888888',
    '01234567-89ab-cdef-0123-456789abcdef',
    '55555555-5555-5555-5555-555555555555',
    'Dashboard Web Interface',
    'dashboard-web-interface',
    'Admin dashboard for analytics and management',
    'figma',
    'https://figma.com/file/demo-dashboard',
    ARRAY['web', 'dashboard', 'analytics', 'admin'],
    'Web Application',
    'team',
    '22222222-2222-2222-2222-222222222222'
),
(
    '99999999-9999-9999-9999-999999999999',
    '01234567-89ab-cdef-0123-456789abcdef',
    '55555555-5555-5555-5555-555555555555',
    'Marketing Landing Page',
    'marketing-landing-page',
    'Landing page for product marketing campaign',
    'figma',
    'https://figma.com/file/demo-landing',
    ARRAY['web', 'marketing', 'landing', 'conversion'],
    'Marketing',
    'organization',
    '22222222-2222-2222-2222-222222222222'
);

-- ============================================================================
-- TRANSLATION TEMPLATES
-- ============================================================================

-- Create demo translation templates
INSERT INTO translation.translation_templates (
    id, organization_id, name, description, category, prompt_template, 
    system_prompt, target_format, llm_provider, is_public, created_by
) VALUES 
(
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    '01234567-89ab-cdef-0123-456789abcdef',
    'React Component Generator',
    'Generates React components from Figma designs',
    'React',
    'Convert this design to a React component:\n\n{design_data}\n\nInclude:\n- Proper component structure\n- CSS-in-JS styling\n- Props interface\n- Responsive design considerations',
    'You are an expert React developer. Create clean, maintainable, and accessible React components based on design specifications.',
    'markdown',
    'openai_gpt4',
    true,
    '11111111-1111-1111-1111-111111111111'
),
(
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    '01234567-89ab-cdef-0123-456789abcdef',
    'Flutter Widget Generator',
    'Generates Flutter widgets from mobile designs',
    'Flutter',
    'Convert this mobile design to Flutter widgets:\n\n{design_data}\n\nInclude:\n- Widget hierarchy\n- Material Design principles\n- Responsive layout\n- State management considerations',
    'You are a Flutter expert. Create efficient, beautiful Flutter widgets that follow Material Design guidelines.',
    'markdown',
    'openai_gpt4',
    true,
    '11111111-1111-1111-1111-111111111111'
),
(
    'cccccccc-cccc-cccc-cccc-cccccccccccc',
    '01234567-89ab-cdef-0123-456789abcdef',
    'HTML/CSS Generator',
    'Generates semantic HTML and CSS from designs',
    'Web',
    'Convert this design to semantic HTML and CSS:\n\n{design_data}\n\nInclude:\n- Semantic HTML structure\n- Modern CSS (Grid/Flexbox)\n- Accessibility considerations\n- Mobile-first responsive design',
    'You are a frontend expert specializing in semantic HTML and modern CSS. Create accessible, performant web interfaces.',
    'markdown',
    'openai_gpt4',
    true,
    '11111111-1111-1111-1111-111111111111'
);

-- ============================================================================
-- EXPORT CONFIGURATIONS
-- ============================================================================

-- Create demo export configurations
INSERT INTO export.export_configurations (
    id, organization_id, name, description, format_type, file_extension, 
    mime_type, is_public, created_by
) VALUES 
(
    'dddddddd-dddd-dddd-dddd-dddddddddddd',
    '01234567-89ab-cdef-0123-456789abcdef',
    'React Component Package',
    'Exports complete React component with stories and tests',
    'custom_dsl',
    'zip',
    'application/zip',
    true,
    '11111111-1111-1111-1111-111111111111'
),
(
    'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
    '01234567-89ab-cdef-0123-456789abcdef',
    'Design Specification Document',
    'Comprehensive design specification in markdown format',
    'markdown',
    'md',
    'text/markdown',
    true,
    '11111111-1111-1111-1111-111111111111'
),
(
    'ffffffff-ffff-ffff-ffff-ffffffffffff',
    '01234567-89ab-cdef-0123-456789abcdef',
    'JSON Design Tokens',
    'Design tokens exported as JSON for design systems',
    'json',
    'json',
    'application/json',
    true,
    '11111111-1111-1111-1111-111111111111'
);

-- ============================================================================
-- APPROVAL WORKFLOWS
-- ============================================================================

-- Create demo approval workflows
INSERT INTO collab.approval_workflows (
    id, organization_id, name, description, workflow_type, stages, 
    is_default, created_by
) VALUES 
(
    '12121212-1212-1212-1212-121212121212',
    '01234567-89ab-cdef-0123-456789abcdef',
    'Design Review Workflow',
    'Standard design review and approval process',
    'sequential',
    '[
        {
            "name": "Design Review",
            "type": "review",
            "assignedRoles": ["designer", "team_lead"],
            "requiredApprovals": 1,
            "timeoutHours": 48
        },
        {
            "name": "Stakeholder Approval",
            "type": "approval", 
            "assignedRoles": ["org_admin"],
            "requiredApprovals": 1,
            "timeoutHours": 72
        }
    ]'::jsonb,
    true,
    '11111111-1111-1111-1111-111111111111'
),
(
    '13131313-1313-1313-1313-131313131313',
    '01234567-89ab-cdef-0123-456789abcdef',
    'Translation Quality Check',
    'Quality assurance for translation outputs',
    'parallel',
    '[
        {
            "name": "Technical Review",
            "type": "review",
            "assignedRoles": ["developer"],
            "requiredApprovals": 1,
            "timeoutHours": 24
        },
        {
            "name": "Design Validation",
            "type": "validation",
            "assignedRoles": ["designer"],
            "requiredApprovals": 1,
            "timeoutHours": 24
        }
    ]'::jsonb,
    false,
    '11111111-1111-1111-1111-111111111111'
);

-- ============================================================================
-- SAMPLE ACTIVITY DATA
-- ============================================================================

-- Create sample activity feed entries
INSERT INTO collab.activity_feed (
    organization_id, project_id, activity_type, activity_title, 
    activity_description, target_type, target_name, created_by
) VALUES 
(
    '01234567-89ab-cdef-0123-456789abcdef',
    '77777777-7777-7777-7777-777777777777',
    'project_created',
    'Project Created',
    'E-commerce Mobile App project was created',
    'project',
    'E-commerce Mobile App',
    '22222222-2222-2222-2222-222222222222'
),
(
    '01234567-89ab-cdef-0123-456789abcdef',
    '88888888-8888-8888-8888-888888888888',
    'project_created',
    'Project Created',
    'Dashboard Web Interface project was created',
    'project',
    'Dashboard Web Interface',
    '22222222-2222-2222-2222-222222222222'
),
(
    '01234567-89ab-cdef-0123-456789abcdef',
    '77777777-7777-7777-7777-777777777777',
    'member_added',
    'Team Member Added',
    'John Developer was added to the project',
    'user',
    'John Developer',
    '44444444-4444-4444-4444-444444444444'
);

-- ============================================================================
-- ANALYTICS SEED DATA
-- ============================================================================

-- Create sample daily usage data for the last 30 days
INSERT INTO analytics.daily_usage (
    organization_id, date, active_users, new_users, projects_created, 
    designs_uploaded, translations_completed, exports_created
)
SELECT 
    '01234567-89ab-cdef-0123-456789abcdef',
    date_series.date,
    (random() * 10 + 5)::integer,
    (random() * 3)::integer,
    (random() * 2)::integer,
    (random() * 5 + 2)::integer,
    (random() * 8 + 3)::integer,
    (random() * 6 + 1)::integer
FROM (
    SELECT generate_series(
        CURRENT_DATE - INTERVAL '30 days',
        CURRENT_DATE - INTERVAL '1 day',
        INTERVAL '1 day'
    )::date AS date
) date_series;

-- Create sample business metrics
INSERT INTO analytics.business_metrics (
    metric_date, metric_period, total_organizations, active_organizations, 
    total_users, active_users, total_revenue_usd, translation_success_rate, 
    export_success_rate, system_uptime_percentage
) VALUES 
(
    CURRENT_DATE,
    'daily',
    1,
    1,
    4,
    4,
    299.00,
    0.9850,
    0.9920,
    0.9995
);

-- ============================================================================
-- DEVELOPMENT API KEYS
-- ============================================================================

-- Create development API key (hashed version of 'dev-api-key-123')
INSERT INTO core.api_keys (
    organization_id, name, key_hash, key_prefix, permissions, 
    rate_limit_per_hour, created_by
) VALUES (
    '01234567-89ab-cdef-0123-456789abcdef',
    'Development API Key',
    '$2b$12$LQv3c1yqBwLVX5FQwjJ.dOYzaU7L5c8k9U5X1v2Q7w3E4R5T6Y7U8',
    'dev_',
    '{"read": true, "write": true, "admin": false}'::jsonb,
    1000,
    '11111111-1111-1111-1111-111111111111'
);

-- ============================================================================
-- MODEL CONFIGURATIONS
-- ============================================================================

-- Create sample model configurations
INSERT INTO translation.model_configurations (
    id, organization_id, name, description, llm_provider, model_version,
    default_temperature, default_max_tokens, system_prompt_template,
    is_default, created_by
) VALUES 
(
    '14141414-1414-1414-1414-141414141414',
    '01234567-89ab-cdef-0123-456789abcdef',
    'GPT-4 Standard',
    'Standard GPT-4 configuration for general translations',
    'openai_gpt4',
    'gpt-4-turbo-preview',
    0.7,
    4000,
    'You are an expert in converting design specifications to code. Focus on accuracy, maintainability, and best practices.',
    true,
    '11111111-1111-1111-1111-111111111111'
),
(
    '15151515-1515-1515-1515-151515151515',
    '01234567-89ab-cdef-0123-456789abcdef',
    'Claude Creative',
    'Claude configuration optimized for creative and detailed outputs',
    'anthropic_claude',
    'claude-3-opus-20240229',
    0.8,
    4000,
    'You are a creative developer who excels at interpreting design intent and creating beautiful, functional code.',
    false,
    '11111111-1111-1111-1111-111111111111'
);

-- Re-enable RLS
SET row_security = on;

-- ============================================================================
-- DATA VALIDATION
-- ============================================================================

-- Verify seed data was created successfully
DO $$
DECLARE
    org_count INTEGER;
    user_count INTEGER;
    project_count INTEGER;
    template_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO org_count FROM core.organizations;
    SELECT COUNT(*) INTO user_count FROM core.users;
    SELECT COUNT(*) INTO project_count FROM design.projects;
    SELECT COUNT(*) INTO template_count FROM translation.translation_templates;
    
    RAISE NOTICE 'Seed data summary:';
    RAISE NOTICE '- Organizations: %', org_count;
    RAISE NOTICE '- Users: %', user_count;
    RAISE NOTICE '- Projects: %', project_count;
    RAISE NOTICE '- Translation Templates: %', template_count;
    
    IF org_count = 0 OR user_count = 0 THEN
        RAISE EXCEPTION 'Seed data creation failed - missing core data';
    END IF;
    
    RAISE NOTICE 'Seed data created successfully!';
END $$;
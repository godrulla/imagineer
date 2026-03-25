-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- Multi-tenant security with organization-based isolation
-- ============================================================================

-- Enable RLS on all tables that need tenant isolation
ALTER TABLE core.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.webhooks ENABLE ROW LEVEL SECURITY;

ALTER TABLE design.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE design.design_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE design.design_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE design.parsed_designs ENABLE ROW LEVEL SECURITY;
ALTER TABLE design.design_elements ENABLE ROW LEVEL SECURITY;
ALTER TABLE design.design_components ENABLE ROW LEVEL SECURITY;
ALTER TABLE design.design_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE design.design_annotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE design.sync_logs ENABLE ROW LEVEL SECURITY;

ALTER TABLE translation.translation_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE translation.translation_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE translation.translation_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE translation.translation_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE translation.llm_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE translation.translation_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE translation.model_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE translation.quality_metrics ENABLE ROW LEVEL SECURITY;

ALTER TABLE export.export_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE export.export_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE export.export_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE export.export_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE export.export_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE export.export_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE export.export_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE export.export_analytics ENABLE ROW LEVEL SECURITY;

ALTER TABLE collab.collaboration_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE collab.session_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE collab.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE collab.comment_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE collab.approval_workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE collab.approval_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE collab.approval_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE collab.approval_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE collab.activity_feed ENABLE ROW LEVEL SECURITY;
ALTER TABLE collab.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE collab.chat_messages ENABLE ROW LEVEL SECURITY;

ALTER TABLE audit.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit.performance_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit.error_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics.user_behavior ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics.daily_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics.feature_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics.billing_usage ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS HELPER FUNCTIONS
-- ============================================================================

-- Function to get current user's organization IDs
CREATE OR REPLACE FUNCTION core.current_user_organization_ids()
RETURNS UUID[] AS $$
DECLARE
    user_orgs UUID[];
BEGIN
    -- Get organization IDs for the current user
    SELECT ARRAY_AGG(organization_id)
    INTO user_orgs
    FROM core.organization_members
    WHERE user_id = core.current_user_id()
      AND status = 'active'
      AND is_deleted = FALSE;
    
    RETURN COALESCE(user_orgs, '{}');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get current user ID from session
CREATE OR REPLACE FUNCTION core.current_user_id()
RETURNS UUID AS $$
BEGIN
    RETURN COALESCE(
        current_setting('app.current_user_id', true)::UUID,
        NULL
    );
END;
$$ LANGUAGE plpgsql;

-- Function to check if user is super admin
CREATE OR REPLACE FUNCTION core.is_super_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN COALESCE(
        current_setting('app.is_super_admin', true)::BOOLEAN,
        FALSE
    );
END;
$$ LANGUAGE plpgsql;

-- Function to check if user is organization admin
CREATE OR REPLACE FUNCTION core.is_organization_admin(org_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    user_role core.user_role;
BEGIN
    SELECT role INTO user_role
    FROM core.organization_members
    WHERE organization_id = org_id
      AND user_id = core.current_user_id()
      AND status = 'active'
      AND is_deleted = FALSE;
    
    RETURN user_role IN ('super_admin', 'org_admin') OR is_owner = TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user's accessible project IDs
CREATE OR REPLACE FUNCTION core.accessible_project_ids()
RETURNS UUID[] AS $$
DECLARE
    project_ids UUID[];
    user_org_ids UUID[];
BEGIN
    -- Get user's organization IDs
    user_org_ids := core.current_user_organization_ids();
    
    -- Get projects accessible to the user
    SELECT ARRAY_AGG(DISTINCT p.id)
    INTO project_ids
    FROM design.projects p
    WHERE p.organization_id = ANY(user_org_ids)
      OR (p.visibility = 'public');
    
    RETURN COALESCE(project_ids, '{}');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- CORE SCHEMA RLS POLICIES
-- ============================================================================

-- Organizations: Users can only see organizations they belong to
CREATE POLICY organizations_access_policy ON core.organizations
    FOR ALL
    USING (
        core.is_super_admin() OR
        id = ANY(core.current_user_organization_ids())
    );

-- Teams: Users can see teams in their organizations
CREATE POLICY teams_access_policy ON core.teams
    FOR ALL
    USING (
        core.is_super_admin() OR
        organization_id = ANY(core.current_user_organization_ids())
    );

-- Organization members: Users can see members of their organizations
CREATE POLICY org_members_access_policy ON core.organization_members
    FOR ALL
    USING (
        core.is_super_admin() OR
        organization_id = ANY(core.current_user_organization_ids()) OR
        user_id = core.current_user_id()
    );

-- Team members: Users can see team members in their organizations
CREATE POLICY team_members_access_policy ON core.team_members
    FOR ALL
    USING (
        core.is_super_admin() OR
        team_id IN (
            SELECT id FROM core.teams 
            WHERE organization_id = ANY(core.current_user_organization_ids())
        ) OR
        user_id = core.current_user_id()
    );

-- API keys: Only organization admins can see API keys
CREATE POLICY api_keys_access_policy ON core.api_keys
    FOR ALL
    USING (
        core.is_super_admin() OR
        (organization_id = ANY(core.current_user_organization_ids()) AND 
         core.is_organization_admin(organization_id))
    );

-- Webhooks: Only organization admins can see webhooks
CREATE POLICY webhooks_access_policy ON core.webhooks
    FOR ALL
    USING (
        core.is_super_admin() OR
        (organization_id = ANY(core.current_user_organization_ids()) AND 
         core.is_organization_admin(organization_id))
    );

-- ============================================================================
-- DESIGN SCHEMA RLS POLICIES
-- ============================================================================

-- Projects: Users can see projects in their organizations
CREATE POLICY projects_access_policy ON design.projects
    FOR ALL
    USING (
        core.is_super_admin() OR
        organization_id = ANY(core.current_user_organization_ids()) OR
        (visibility = 'public' AND is_deleted = FALSE)
    );

-- Design files: Users can see files in accessible projects
CREATE POLICY design_files_access_policy ON design.design_files
    FOR ALL
    USING (
        core.is_super_admin() OR
        project_id = ANY(core.accessible_project_ids())
    );

-- Design versions: Users can see versions of accessible design files
CREATE POLICY design_versions_access_policy ON design.design_versions
    FOR ALL
    USING (
        core.is_super_admin() OR
        design_file_id IN (
            SELECT id FROM design.design_files 
            WHERE project_id = ANY(core.accessible_project_ids())
        )
    );

-- Parsed designs: Users can see parsed designs of accessible files
CREATE POLICY parsed_designs_access_policy ON design.parsed_designs
    FOR ALL
    USING (
        core.is_super_admin() OR
        design_file_id IN (
            SELECT id FROM design.design_files 
            WHERE project_id = ANY(core.accessible_project_ids())
        )
    );

-- Design elements: Users can see elements of accessible parsed designs
CREATE POLICY design_elements_access_policy ON design.design_elements
    FOR ALL
    USING (
        core.is_super_admin() OR
        parsed_design_id IN (
            SELECT pd.id FROM design.parsed_designs pd
            JOIN design.design_files df ON pd.design_file_id = df.id
            WHERE df.project_id = ANY(core.accessible_project_ids())
        )
    );

-- Design components: Users can see components in accessible projects
CREATE POLICY design_components_access_policy ON design.design_components
    FOR ALL
    USING (
        core.is_super_admin() OR
        project_id = ANY(core.accessible_project_ids())
    );

-- Design assets: Users can see assets in accessible projects
CREATE POLICY design_assets_access_policy ON design.design_assets
    FOR ALL
    USING (
        core.is_super_admin() OR
        project_id = ANY(core.accessible_project_ids())
    );

-- Design annotations: Users can see annotations on accessible design files
CREATE POLICY design_annotations_access_policy ON design.design_annotations
    FOR ALL
    USING (
        core.is_super_admin() OR
        design_file_id IN (
            SELECT id FROM design.design_files 
            WHERE project_id = ANY(core.accessible_project_ids())
        ) OR
        created_by = core.current_user_id()
    );

-- Sync logs: Users can see sync logs for accessible projects
CREATE POLICY sync_logs_access_policy ON design.sync_logs
    FOR ALL
    USING (
        core.is_super_admin() OR
        project_id = ANY(core.accessible_project_ids())
    );

-- ============================================================================
-- TRANSLATION SCHEMA RLS POLICIES
-- ============================================================================

-- Translation templates: Users can see templates in their organizations
CREATE POLICY translation_templates_access_policy ON translation.translation_templates
    FOR ALL
    USING (
        core.is_super_admin() OR
        organization_id = ANY(core.current_user_organization_ids()) OR
        (is_public = TRUE AND is_deleted = FALSE)
    );

-- Translation jobs: Users can see jobs for accessible projects
CREATE POLICY translation_jobs_access_policy ON translation.translation_jobs
    FOR ALL
    USING (
        core.is_super_admin() OR
        organization_id = ANY(core.current_user_organization_ids()) OR
        created_by = core.current_user_id()
    );

-- Translation results: Users can see results of accessible jobs
CREATE POLICY translation_results_access_policy ON translation.translation_results
    FOR ALL
    USING (
        core.is_super_admin() OR
        translation_job_id IN (
            SELECT id FROM translation.translation_jobs 
            WHERE organization_id = ANY(core.current_user_organization_ids())
               OR created_by = core.current_user_id()
        )
    );

-- Translation revisions: Users can see revisions of accessible results
CREATE POLICY translation_revisions_access_policy ON translation.translation_revisions
    FOR ALL
    USING (
        core.is_super_admin() OR
        translation_result_id IN (
            SELECT tr.id FROM translation.translation_results tr
            JOIN translation.translation_jobs tj ON tr.translation_job_id = tj.id
            WHERE tj.organization_id = ANY(core.current_user_organization_ids())
               OR tj.created_by = core.current_user_id()
        ) OR
        created_by = core.current_user_id()
    );

-- LLM interactions: Users can see interactions for their organizations
CREATE POLICY llm_interactions_access_policy ON translation.llm_interactions
    FOR ALL
    USING (
        core.is_super_admin() OR
        organization_id = ANY(core.current_user_organization_ids()) OR
        user_id = core.current_user_id()
    );

-- Translation feedback: Users can see feedback on accessible results
CREATE POLICY translation_feedback_access_policy ON translation.translation_feedback
    FOR ALL
    USING (
        core.is_super_admin() OR
        translation_result_id IN (
            SELECT tr.id FROM translation.translation_results tr
            JOIN translation.translation_jobs tj ON tr.translation_job_id = tj.id
            WHERE tj.organization_id = ANY(core.current_user_organization_ids())
        ) OR
        created_by = core.current_user_id()
    );

-- Model configurations: Users can see configurations in their organizations
CREATE POLICY model_configurations_access_policy ON translation.model_configurations
    FOR ALL
    USING (
        core.is_super_admin() OR
        organization_id = ANY(core.current_user_organization_ids())
    );

-- Quality metrics: Users can see metrics for their organizations
CREATE POLICY quality_metrics_access_policy ON translation.quality_metrics
    FOR ALL
    USING (
        core.is_super_admin() OR
        organization_id = ANY(core.current_user_organization_ids())
    );

-- ============================================================================
-- EXPORT SCHEMA RLS POLICIES
-- ============================================================================

-- Export configurations: Users can see configurations in their organizations
CREATE POLICY export_configurations_access_policy ON export.export_configurations
    FOR ALL
    USING (
        core.is_super_admin() OR
        organization_id = ANY(core.current_user_organization_ids()) OR
        (is_public = TRUE AND is_deleted = FALSE)
    );

-- Export jobs: Users can see jobs for their organizations
CREATE POLICY export_jobs_access_policy ON export.export_jobs
    FOR ALL
    USING (
        core.is_super_admin() OR
        organization_id = ANY(core.current_user_organization_ids()) OR
        created_by = core.current_user_id()
    );

-- Export results: Users can see results of accessible jobs
CREATE POLICY export_results_access_policy ON export.export_results
    FOR ALL
    USING (
        core.is_super_admin() OR
        export_job_id IN (
            SELECT id FROM export.export_jobs 
            WHERE organization_id = ANY(core.current_user_organization_ids())
               OR created_by = core.current_user_id()
        ) OR
        is_public = TRUE
    );

-- Export packages: Users can see packages for their organizations
CREATE POLICY export_packages_access_policy ON export.export_packages
    FOR ALL
    USING (
        core.is_super_admin() OR
        organization_id = ANY(core.current_user_organization_ids()) OR
        created_by = core.current_user_id() OR
        is_public = TRUE
    );

-- Export templates: Users can see templates in their organizations
CREATE POLICY export_templates_access_policy ON export.export_templates
    FOR ALL
    USING (
        core.is_super_admin() OR
        organization_id = ANY(core.current_user_organization_ids()) OR
        (is_public = TRUE AND is_deleted = FALSE)
    );

-- Export assets: Users can see assets of accessible results
CREATE POLICY export_assets_access_policy ON export.export_assets
    FOR ALL
    USING (
        core.is_super_admin() OR
        export_result_id IN (
            SELECT er.id FROM export.export_results er
            JOIN export.export_jobs ej ON er.export_job_id = ej.id
            WHERE ej.organization_id = ANY(core.current_user_organization_ids())
               OR er.is_public = TRUE
        )
    );

-- Export feedback: Users can see feedback on accessible results
CREATE POLICY export_feedback_access_policy ON export.export_feedback
    FOR ALL
    USING (
        core.is_super_admin() OR
        export_result_id IN (
            SELECT er.id FROM export.export_results er
            JOIN export.export_jobs ej ON er.export_job_id = ej.id
            WHERE ej.organization_id = ANY(core.current_user_organization_ids())
        ) OR
        created_by = core.current_user_id()
    );

-- Export analytics: Users can see analytics for their organizations
CREATE POLICY export_analytics_access_policy ON export.export_analytics
    FOR ALL
    USING (
        core.is_super_admin() OR
        organization_id = ANY(core.current_user_organization_ids())
    );

-- ============================================================================
-- COLLABORATION SCHEMA RLS POLICIES
-- ============================================================================

-- Collaboration sessions: Users can see sessions for accessible projects
CREATE POLICY collaboration_sessions_access_policy ON collab.collaboration_sessions
    FOR ALL
    USING (
        core.is_super_admin() OR
        project_id = ANY(core.accessible_project_ids()) OR
        created_by = core.current_user_id() OR
        id IN (
            SELECT session_id FROM collab.session_participants 
            WHERE user_id = core.current_user_id()
        )
    );

-- Session participants: Users can see participants in accessible sessions
CREATE POLICY session_participants_access_policy ON collab.session_participants
    FOR ALL
    USING (
        core.is_super_admin() OR
        session_id IN (
            SELECT id FROM collab.collaboration_sessions
            WHERE project_id = ANY(core.accessible_project_ids())
               OR created_by = core.current_user_id()
        ) OR
        user_id = core.current_user_id()
    );

-- Comments: Users can see comments on accessible resources
CREATE POLICY comments_access_policy ON collab.comments
    FOR ALL
    USING (
        core.is_super_admin() OR
        organization_id = ANY(core.current_user_organization_ids()) OR
        created_by = core.current_user_id() OR
        (is_private = FALSE AND project_id = ANY(core.accessible_project_ids()))
    );

-- Comment reactions: Users can see reactions on accessible comments
CREATE POLICY comment_reactions_access_policy ON collab.comment_reactions
    FOR ALL
    USING (
        core.is_super_admin() OR
        comment_id IN (
            SELECT id FROM collab.comments
            WHERE organization_id = ANY(core.current_user_organization_ids())
               OR created_by = core.current_user_id()
               OR (is_private = FALSE AND project_id = ANY(core.accessible_project_ids()))
        ) OR
        user_id = core.current_user_id()
    );

-- Approval workflows: Users can see workflows in their organizations
CREATE POLICY approval_workflows_access_policy ON collab.approval_workflows
    FOR ALL
    USING (
        core.is_super_admin() OR
        organization_id = ANY(core.current_user_organization_ids())
    );

-- Approval requests: Users can see requests they're involved in
CREATE POLICY approval_requests_access_policy ON collab.approval_requests
    FOR ALL
    USING (
        core.is_super_admin() OR
        organization_id = ANY(core.current_user_organization_ids()) OR
        created_by = core.current_user_id() OR
        id IN (
            SELECT DISTINCT ar.id 
            FROM collab.approval_requests ar
            JOIN collab.approval_stages ast ON ar.id = ast.approval_request_id
            WHERE core.current_user_id() = ANY(ast.assigned_users)
        )
    );

-- Approval stages: Users can see stages of accessible requests
CREATE POLICY approval_stages_access_policy ON collab.approval_stages
    FOR ALL
    USING (
        core.is_super_admin() OR
        approval_request_id IN (
            SELECT id FROM collab.approval_requests
            WHERE organization_id = ANY(core.current_user_organization_ids())
               OR created_by = core.current_user_id()
        ) OR
        core.current_user_id() = ANY(assigned_users)
    );

-- Approval responses: Users can see responses to accessible stages
CREATE POLICY approval_responses_access_policy ON collab.approval_responses
    FOR ALL
    USING (
        core.is_super_admin() OR
        approval_stage_id IN (
            SELECT ast.id FROM collab.approval_stages ast
            JOIN collab.approval_requests ar ON ast.approval_request_id = ar.id
            WHERE ar.organization_id = ANY(core.current_user_organization_ids())
        ) OR
        user_id = core.current_user_id()
    );

-- Activity feed: Users can see activity for their organizations
CREATE POLICY activity_feed_access_policy ON collab.activity_feed
    FOR ALL
    USING (
        core.is_super_admin() OR
        organization_id = ANY(core.current_user_organization_ids()) OR
        created_by = core.current_user_id() OR
        (visibility = 'public')
    );

-- Notifications: Users can only see their own notifications
CREATE POLICY notifications_access_policy ON collab.notifications
    FOR ALL
    USING (
        core.is_super_admin() OR
        user_id = core.current_user_id()
    );

-- Chat messages: Users can see messages in accessible contexts
CREATE POLICY chat_messages_access_policy ON collab.chat_messages
    FOR ALL
    USING (
        core.is_super_admin() OR
        organization_id = ANY(core.current_user_organization_ids()) OR
        created_by = core.current_user_id() OR
        (project_id = ANY(core.accessible_project_ids()) AND is_deleted = FALSE) OR
        session_id IN (
            SELECT session_id FROM collab.session_participants 
            WHERE user_id = core.current_user_id()
        )
    );

-- ============================================================================
-- AUDIT AND ANALYTICS SCHEMA RLS POLICIES
-- ============================================================================

-- Audit logs: Users can see logs for their organizations (limited access)
CREATE POLICY audit_logs_access_policy ON audit.audit_logs
    FOR SELECT
    USING (
        core.is_super_admin() OR
        (organization_id = ANY(core.current_user_organization_ids()) AND 
         core.is_organization_admin(organization_id)) OR
        user_id = core.current_user_id()
    );

-- Performance metrics: Only super admins and org admins can see metrics
CREATE POLICY performance_metrics_access_policy ON audit.performance_metrics
    FOR SELECT
    USING (
        core.is_super_admin() OR
        (organization_id = ANY(core.current_user_organization_ids()) AND 
         core.is_organization_admin(organization_id))
    );

-- Error logs: Only super admins and org admins can see error logs
CREATE POLICY error_logs_access_policy ON audit.error_logs
    FOR SELECT
    USING (
        core.is_super_admin() OR
        (organization_id = ANY(core.current_user_organization_ids()) AND 
         core.is_organization_admin(organization_id))
    );

-- User behavior: Users can see their own behavior data
CREATE POLICY user_behavior_access_policy ON analytics.user_behavior
    FOR SELECT
    USING (
        core.is_super_admin() OR
        user_id = core.current_user_id() OR
        (organization_id = ANY(core.current_user_organization_ids()) AND 
         core.is_organization_admin(organization_id))
    );

-- Daily usage: Only org admins can see usage analytics
CREATE POLICY daily_usage_access_policy ON analytics.daily_usage
    FOR SELECT
    USING (
        core.is_super_admin() OR
        (organization_id = ANY(core.current_user_organization_ids()) AND 
         core.is_organization_admin(organization_id))
    );

-- Feature usage: Users can see their own feature usage
CREATE POLICY feature_usage_access_policy ON analytics.feature_usage
    FOR SELECT
    USING (
        core.is_super_admin() OR
        user_id = core.current_user_id() OR
        (organization_id = ANY(core.current_user_organization_ids()) AND 
         core.is_organization_admin(organization_id))
    );

-- Billing usage: Only org admins can see billing data
CREATE POLICY billing_usage_access_policy ON analytics.billing_usage
    FOR SELECT
    USING (
        core.is_super_admin() OR
        (organization_id = ANY(core.current_user_organization_ids()) AND 
         core.is_organization_admin(organization_id))
    );

-- ============================================================================
-- APPLICATION ROLES
-- ============================================================================

-- Create application roles for different access levels
CREATE ROLE imagineer_app_user;
CREATE ROLE imagineer_app_admin;
CREATE ROLE imagineer_app_service;
CREATE ROLE imagineer_app_readonly;

-- Grant basic permissions to app user role
GRANT USAGE ON SCHEMA core, design, translation, export, collab TO imagineer_app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA core TO imagineer_app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA design TO imagineer_app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA translation TO imagineer_app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA export TO imagineer_app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA collab TO imagineer_app_user;

-- Grant elevated permissions to app admin role
GRANT imagineer_app_user TO imagineer_app_admin;
GRANT USAGE ON SCHEMA audit, analytics TO imagineer_app_admin;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA audit TO imagineer_app_admin;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA analytics TO imagineer_app_admin;

-- Grant service account permissions
GRANT imagineer_app_admin TO imagineer_app_service;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA core, design, translation, export, collab, audit, analytics TO imagineer_app_service;

-- Grant readonly permissions
GRANT USAGE ON SCHEMA core, design, translation, export, collab, audit, analytics TO imagineer_app_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA core TO imagineer_app_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA design TO imagineer_app_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA translation TO imagineer_app_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA export TO imagineer_app_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA collab TO imagineer_app_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA audit TO imagineer_app_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA analytics TO imagineer_app_readonly;
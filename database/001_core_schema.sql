-- ============================================================================
-- CORE SCHEMA - Foundation Tables
-- Multi-tenant architecture with organization-based isolation
-- ============================================================================

-- Organizations (Top-level tenant)
CREATE TABLE core.organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    short_id TEXT UNIQUE DEFAULT core.generate_short_id(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    description TEXT,
    
    -- Subscription and limits
    subscription_tier VARCHAR(50) DEFAULT 'free',
    subscription_expires_at TIMESTAMP WITH TIME ZONE,
    max_projects INTEGER DEFAULT 5,
    max_team_members INTEGER DEFAULT 10,
    max_storage_gb INTEGER DEFAULT 10,
    max_monthly_translations INTEGER DEFAULT 1000,
    
    -- Settings
    settings JSONB DEFAULT '{}',
    features JSONB DEFAULT '{"figma": true, "collaboration": true}',
    
    -- Contact and billing
    billing_email core.email,
    billing_address JSONB,
    stripe_customer_id VARCHAR(255),
    
    -- Metadata
    logo_url core.url,
    website_url core.url,
    industry VARCHAR(100),
    company_size VARCHAR(50),
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE,
    is_deleted BOOLEAN DEFAULT FALSE,
    created_by UUID,
    
    CONSTRAINT check_subscription_tier CHECK (
        subscription_tier IN ('free', 'starter', 'professional', 'enterprise', 'custom')
    )
);

-- Teams within organizations
CREATE TABLE core.teams (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES core.organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL,
    description TEXT,
    
    -- Team settings
    settings JSONB DEFAULT '{}',
    permissions JSONB DEFAULT '{}',
    
    -- Limits (can override org limits)
    max_projects INTEGER,
    max_members INTEGER,
    
    -- Metadata
    icon_emoji VARCHAR(10),
    color VARCHAR(7), -- Hex color
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE,
    is_deleted BOOLEAN DEFAULT FALSE,
    created_by UUID,
    
    UNIQUE(organization_id, slug)
);

-- Users table
CREATE TABLE core.users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    auth_id VARCHAR(255) UNIQUE, -- External auth provider ID (Auth0, Firebase, etc)
    email core.email UNIQUE NOT NULL,
    username VARCHAR(100) UNIQUE,
    
    -- Profile information
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    display_name VARCHAR(200),
    avatar_url core.url,
    bio TEXT,
    
    -- Contact
    phone VARCHAR(50),
    timezone VARCHAR(50) DEFAULT 'UTC',
    locale VARCHAR(10) DEFAULT 'en-US',
    
    -- Preferences
    preferences JSONB DEFAULT '{}',
    notification_settings JSONB DEFAULT '{"email": true, "push": false}',
    
    -- Status
    status core.status DEFAULT 'active',
    email_verified BOOLEAN DEFAULT FALSE,
    email_verified_at TIMESTAMP WITH TIME ZONE,
    last_login_at TIMESTAMP WITH TIME ZONE,
    last_activity_at TIMESTAMP WITH TIME ZONE,
    
    -- Security
    mfa_enabled BOOLEAN DEFAULT FALSE,
    mfa_secret VARCHAR(255),
    password_changed_at TIMESTAMP WITH TIME ZONE,
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE,
    is_deleted BOOLEAN DEFAULT FALSE
);

-- Organization members (users in organizations with roles)
CREATE TABLE core.organization_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES core.organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES core.users(id) ON DELETE CASCADE,
    role core.user_role NOT NULL DEFAULT 'viewer',
    
    -- Permissions and access
    custom_permissions JSONB DEFAULT '{}',
    is_owner BOOLEAN DEFAULT FALSE,
    
    -- Invitation tracking
    invited_by UUID REFERENCES core.users(id),
    invited_at TIMESTAMP WITH TIME ZONE,
    invitation_token VARCHAR(255),
    invitation_accepted_at TIMESTAMP WITH TIME ZONE,
    
    -- Status
    status core.status DEFAULT 'active',
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE,
    is_deleted BOOLEAN DEFAULT FALSE,
    
    UNIQUE(organization_id, user_id)
);

-- Team members
CREATE TABLE core.team_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_id UUID NOT NULL REFERENCES core.teams(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES core.users(id) ON DELETE CASCADE,
    role core.user_role NOT NULL DEFAULT 'viewer',
    
    -- Permissions
    custom_permissions JSONB DEFAULT '{}',
    is_lead BOOLEAN DEFAULT FALSE,
    
    -- Status
    status core.status DEFAULT 'active',
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE,
    is_deleted BOOLEAN DEFAULT FALSE,
    added_by UUID REFERENCES core.users(id),
    
    UNIQUE(team_id, user_id)
);

-- API Keys for programmatic access
CREATE TABLE core.api_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES core.organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    key_hash VARCHAR(255) NOT NULL, -- Hashed API key
    key_prefix VARCHAR(20) NOT NULL, -- First few chars for identification
    
    -- Permissions and limits
    permissions JSONB DEFAULT '{}',
    rate_limit_per_hour INTEGER DEFAULT 1000,
    
    -- Usage tracking
    last_used_at TIMESTAMP WITH TIME ZONE,
    usage_count BIGINT DEFAULT 0,
    
    -- Expiration
    expires_at TIMESTAMP WITH TIME ZONE,
    
    -- Status
    status core.status DEFAULT 'active',
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    revoked_at TIMESTAMP WITH TIME ZONE,
    created_by UUID REFERENCES core.users(id),
    
    UNIQUE(organization_id, key_prefix)
);

-- Webhooks configuration
CREATE TABLE core.webhooks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES core.organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    url core.url NOT NULL,
    
    -- Configuration
    events TEXT[] NOT NULL, -- Array of event types to listen to
    headers JSONB DEFAULT '{}',
    secret VARCHAR(255), -- For signature verification
    
    -- Retry configuration
    max_retries INTEGER DEFAULT 3,
    retry_delay_seconds INTEGER DEFAULT 60,
    timeout_seconds INTEGER DEFAULT 30,
    
    -- Status and monitoring
    status core.status DEFAULT 'active',
    last_triggered_at TIMESTAMP WITH TIME ZONE,
    last_success_at TIMESTAMP WITH TIME ZONE,
    last_failure_at TIMESTAMP WITH TIME ZONE,
    failure_count INTEGER DEFAULT 0,
    success_count INTEGER DEFAULT 0,
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE,
    is_deleted BOOLEAN DEFAULT FALSE,
    created_by UUID REFERENCES core.users(id)
);

-- Feature flags for gradual rollout
CREATE TABLE core.feature_flags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) UNIQUE NOT NULL,
    description TEXT,
    
    -- Targeting
    enabled_globally BOOLEAN DEFAULT FALSE,
    enabled_for_orgs UUID[] DEFAULT '{}',
    enabled_for_users UUID[] DEFAULT '{}',
    rollout_percentage INTEGER DEFAULT 0 CHECK (rollout_percentage >= 0 AND rollout_percentage <= 100),
    
    -- Configuration
    config JSONB DEFAULT '{}',
    
    -- Status
    status core.status DEFAULT 'active',
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES core.users(id)
);

-- System configuration
CREATE TABLE core.system_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key VARCHAR(255) UNIQUE NOT NULL,
    value JSONB NOT NULL,
    description TEXT,
    is_secret BOOLEAN DEFAULT FALSE,
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_by UUID REFERENCES core.users(id)
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Organizations
CREATE INDEX idx_organizations_slug ON core.organizations(slug) WHERE is_deleted = FALSE;
CREATE INDEX idx_organizations_subscription ON core.organizations(subscription_tier, subscription_expires_at) WHERE is_deleted = FALSE;
CREATE INDEX idx_organizations_created_at ON core.organizations(created_at DESC);

-- Teams
CREATE INDEX idx_teams_organization ON core.teams(organization_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_teams_slug ON core.teams(organization_id, slug) WHERE is_deleted = FALSE;

-- Users
CREATE INDEX idx_users_email ON core.users(email) WHERE is_deleted = FALSE;
CREATE INDEX idx_users_username ON core.users(username) WHERE is_deleted = FALSE;
CREATE INDEX idx_users_auth_id ON core.users(auth_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_users_last_activity ON core.users(last_activity_at DESC) WHERE is_deleted = FALSE;

-- Organization members
CREATE INDEX idx_org_members_organization ON core.organization_members(organization_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_org_members_user ON core.organization_members(user_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_org_members_role ON core.organization_members(organization_id, role) WHERE is_deleted = FALSE;

-- Team members
CREATE INDEX idx_team_members_team ON core.team_members(team_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_team_members_user ON core.team_members(user_id) WHERE is_deleted = FALSE;

-- API Keys
CREATE INDEX idx_api_keys_organization ON core.api_keys(organization_id) WHERE status = 'active';
CREATE INDEX idx_api_keys_prefix ON core.api_keys(key_prefix);

-- Webhooks
CREATE INDEX idx_webhooks_organization ON core.webhooks(organization_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_webhooks_events ON core.webhooks USING GIN(events);

-- Feature flags
CREATE INDEX idx_feature_flags_name ON core.feature_flags(name) WHERE status = 'active';
CREATE INDEX idx_feature_flags_orgs ON core.feature_flags USING GIN(enabled_for_orgs);
CREATE INDEX idx_feature_flags_users ON core.feature_flags USING GIN(enabled_for_users);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Update updated_at timestamp
CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON core.organizations
    FOR EACH ROW EXECUTE FUNCTION core.update_updated_at();

CREATE TRIGGER update_teams_updated_at BEFORE UPDATE ON core.teams
    FOR EACH ROW EXECUTE FUNCTION core.update_updated_at();

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON core.users
    FOR EACH ROW EXECUTE FUNCTION core.update_updated_at();

CREATE TRIGGER update_org_members_updated_at BEFORE UPDATE ON core.organization_members
    FOR EACH ROW EXECUTE FUNCTION core.update_updated_at();

CREATE TRIGGER update_team_members_updated_at BEFORE UPDATE ON core.team_members
    FOR EACH ROW EXECUTE FUNCTION core.update_updated_at();

CREATE TRIGGER update_api_keys_updated_at BEFORE UPDATE ON core.api_keys
    FOR EACH ROW EXECUTE FUNCTION core.update_updated_at();

CREATE TRIGGER update_webhooks_updated_at BEFORE UPDATE ON core.webhooks
    FOR EACH ROW EXECUTE FUNCTION core.update_updated_at();

CREATE TRIGGER update_feature_flags_updated_at BEFORE UPDATE ON core.feature_flags
    FOR EACH ROW EXECUTE FUNCTION core.update_updated_at();

CREATE TRIGGER update_system_config_updated_at BEFORE UPDATE ON core.system_config
    FOR EACH ROW EXECUTE FUNCTION core.update_updated_at();
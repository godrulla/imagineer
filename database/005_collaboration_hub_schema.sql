-- ============================================================================
-- COLLABORATION HUB SCHEMA
-- Handles real-time collaboration, comments, approvals, and workflows
-- ============================================================================

-- Collaboration sessions
CREATE TABLE collab.collaboration_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES design.projects(id) ON DELETE CASCADE,
    
    -- Session information
    name VARCHAR(255),
    description TEXT,
    session_type VARCHAR(50) DEFAULT 'design_review' CHECK (
        session_type IN ('design_review', 'translation_review', 'feedback_session', 'approval_workflow', 'brainstorming')
    ),
    
    -- Session configuration
    max_participants INTEGER DEFAULT 50,
    allow_anonymous BOOLEAN DEFAULT FALSE,
    require_approval_to_join BOOLEAN DEFAULT FALSE,
    recording_enabled BOOLEAN DEFAULT FALSE,
    
    -- Session state
    status VARCHAR(20) DEFAULT 'scheduled' CHECK (
        status IN ('scheduled', 'active', 'paused', 'completed', 'cancelled')
    ),
    started_at TIMESTAMP WITH TIME ZONE,
    ended_at TIMESTAMP WITH TIME ZONE,
    duration_minutes INTEGER,
    
    -- Access control
    is_public BOOLEAN DEFAULT FALSE,
    join_code VARCHAR(20),
    access_level VARCHAR(20) DEFAULT 'team' CHECK (
        access_level IN ('private', 'team', 'organization', 'public')
    ),
    
    -- Recording and artifacts
    recording_url core.url,
    session_artifacts JSONB DEFAULT '{}',
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID NOT NULL REFERENCES core.users(id)
);

-- Session participants
CREATE TABLE collab.session_participants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES collab.collaboration_sessions(id) ON DELETE CASCADE,
    user_id UUID REFERENCES core.users(id) ON DELETE CASCADE,
    
    -- Participant information
    display_name VARCHAR(255),
    email core.email,
    is_anonymous BOOLEAN DEFAULT FALSE,
    
    -- Role in session
    role VARCHAR(50) DEFAULT 'participant' CHECK (
        role IN ('host', 'moderator', 'presenter', 'participant', 'observer')
    ),
    permissions JSONB DEFAULT '{}',
    
    -- Participation tracking
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    left_at TIMESTAMP WITH TIME ZONE,
    last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Status
    status VARCHAR(20) DEFAULT 'active' CHECK (
        status IN ('invited', 'active', 'inactive', 'removed', 'left')
    ),
    
    -- Connection info
    connection_id VARCHAR(255),
    user_agent TEXT,
    ip_address INET,
    
    -- Activity metrics
    messages_sent INTEGER DEFAULT 0,
    reactions_added INTEGER DEFAULT 0,
    time_active_minutes INTEGER DEFAULT 0
);

-- Comments and discussions
CREATE TABLE collab.comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES core.organizations(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES design.projects(id) ON DELETE CASCADE,
    
    -- Comment targeting
    target_type VARCHAR(50) NOT NULL CHECK (
        target_type IN ('project', 'design_file', 'design_element', 'translation_result', 'export_result')
    ),
    target_id UUID NOT NULL,
    element_id UUID REFERENCES design.design_elements(id),
    
    -- Comment content
    content TEXT NOT NULL,
    content_format VARCHAR(20) DEFAULT 'markdown' CHECK (
        content_format IN ('text', 'markdown', 'html')
    ),
    
    -- Comment metadata
    comment_type VARCHAR(50) DEFAULT 'comment' CHECK (
        comment_type IN ('comment', 'suggestion', 'question', 'issue', 'approval', 'rejection')
    ),
    priority VARCHAR(20) DEFAULT 'normal' CHECK (
        priority IN ('low', 'normal', 'high', 'urgent')
    ),
    
    -- Thread structure
    parent_id UUID REFERENCES collab.comments(id),
    thread_root_id UUID,
    reply_count INTEGER DEFAULT 0,
    
    -- Position (for design elements)
    position_x DECIMAL(10,2),
    position_y DECIMAL(10,2),
    
    -- Status and resolution
    status VARCHAR(20) DEFAULT 'open' CHECK (
        status IN ('open', 'in_progress', 'resolved', 'closed', 'archived')
    ),
    resolved_at TIMESTAMP WITH TIME ZONE,
    resolved_by UUID REFERENCES core.users(id),
    resolution_comment TEXT,
    
    -- Reactions and engagement
    reaction_counts JSONB DEFAULT '{}', -- {"like": 5, "love": 2, "laugh": 1}
    is_pinned BOOLEAN DEFAULT FALSE,
    is_private BOOLEAN DEFAULT FALSE,
    
    -- Mentions and notifications
    mentioned_users UUID[] DEFAULT '{}',
    notification_sent BOOLEAN DEFAULT FALSE,
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE,
    is_deleted BOOLEAN DEFAULT FALSE,
    created_by UUID NOT NULL REFERENCES core.users(id),
    edited_by UUID REFERENCES core.users(id),
    edited_at TIMESTAMP WITH TIME ZONE
);

-- Comment reactions
CREATE TABLE collab.comment_reactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    comment_id UUID NOT NULL REFERENCES collab.comments(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES core.users(id) ON DELETE CASCADE,
    
    -- Reaction details
    reaction_type VARCHAR(20) NOT NULL CHECK (
        reaction_type IN ('like', 'love', 'laugh', 'wow', 'sad', 'angry', 'thumbs_up', 'thumbs_down')
    ),
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(comment_id, user_id, reaction_type)
);

-- Approval workflows
CREATE TABLE collab.approval_workflows (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES core.organizations(id) ON DELETE CASCADE,
    
    -- Workflow definition
    name VARCHAR(255) NOT NULL,
    description TEXT,
    workflow_type VARCHAR(50) DEFAULT 'sequential' CHECK (
        workflow_type IN ('sequential', 'parallel', 'conditional', 'custom')
    ),
    
    -- Workflow configuration
    stages JSONB NOT NULL, -- Array of stage definitions
    conditions JSONB DEFAULT '{}',
    escalation_rules JSONB DEFAULT '{}',
    
    -- Auto-approval settings
    auto_approve_conditions JSONB DEFAULT '{}',
    timeout_hours INTEGER DEFAULT 72,
    
    -- Notifications
    notification_settings JSONB DEFAULT '{}',
    
    -- Usage tracking
    usage_count INTEGER DEFAULT 0,
    
    -- Status
    status core.status DEFAULT 'active',
    is_default BOOLEAN DEFAULT FALSE,
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID NOT NULL REFERENCES core.users(id),
    
    UNIQUE(organization_id, name) WHERE status = 'active'
);

-- Approval requests
CREATE TABLE collab.approval_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES core.organizations(id) ON DELETE CASCADE,
    workflow_id UUID NOT NULL REFERENCES collab.approval_workflows(id),
    
    -- Request details
    title VARCHAR(255) NOT NULL,
    description TEXT,
    request_type VARCHAR(50) DEFAULT 'general' CHECK (
        request_type IN ('design_approval', 'translation_approval', 'export_approval', 'project_approval', 'general')
    ),
    
    -- Target being approved
    target_type VARCHAR(50) NOT NULL CHECK (
        target_type IN ('project', 'design_file', 'translation_result', 'export_result', 'comment')
    ),
    target_id UUID NOT NULL,
    
    -- Workflow state
    current_stage INTEGER DEFAULT 1,
    current_stage_name VARCHAR(255),
    overall_status VARCHAR(20) DEFAULT 'pending' CHECK (
        overall_status IN ('pending', 'in_progress', 'approved', 'rejected', 'cancelled', 'expired')
    ),
    
    -- Timing
    due_date TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,
    approved_at TIMESTAMP WITH TIME ZONE,
    rejected_at TIMESTAMP WITH TIME ZONE,
    
    -- Results
    final_decision VARCHAR(20) CHECK (final_decision IN ('approved', 'rejected')),
    final_comment TEXT,
    
    -- Priority and urgency
    priority VARCHAR(20) DEFAULT 'normal' CHECK (
        priority IN ('low', 'normal', 'high', 'urgent')
    ),
    is_urgent BOOLEAN DEFAULT FALSE,
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID NOT NULL REFERENCES core.users(id)
);

-- Individual approval stages within requests
CREATE TABLE collab.approval_stages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    approval_request_id UUID NOT NULL REFERENCES collab.approval_requests(id) ON DELETE CASCADE,
    
    -- Stage information
    stage_number INTEGER NOT NULL,
    stage_name VARCHAR(255) NOT NULL,
    stage_type VARCHAR(50) DEFAULT 'approval' CHECK (
        stage_type IN ('approval', 'review', 'feedback', 'validation', 'notification')
    ),
    
    -- Assignees
    assigned_users UUID[] DEFAULT '{}',
    assigned_roles TEXT[] DEFAULT '{}',
    required_approvals INTEGER DEFAULT 1,
    
    -- Stage configuration
    can_delegate BOOLEAN DEFAULT TRUE,
    can_skip BOOLEAN DEFAULT FALSE,
    is_optional BOOLEAN DEFAULT FALSE,
    timeout_hours INTEGER DEFAULT 24,
    
    -- Stage status
    status VARCHAR(20) DEFAULT 'pending' CHECK (
        status IN ('pending', 'in_progress', 'completed', 'skipped', 'expired')
    ),
    
    -- Results
    approvals_received INTEGER DEFAULT 0,
    rejections_received INTEGER DEFAULT 0,
    decision VARCHAR(20) CHECK (decision IN ('approved', 'rejected', 'skipped')),
    
    -- Timing
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    due_at TIMESTAMP WITH TIME ZONE,
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Individual approver responses
CREATE TABLE collab.approval_responses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    approval_stage_id UUID NOT NULL REFERENCES collab.approval_stages(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES core.users(id) ON DELETE CASCADE,
    
    -- Response details
    decision VARCHAR(20) NOT NULL CHECK (decision IN ('approved', 'rejected', 'delegated')),
    comment TEXT,
    conditions TEXT, -- Any conditions for approval
    
    -- Delegation (if applicable)
    delegated_to UUID REFERENCES core.users(id),
    delegation_reason TEXT,
    
    -- Response timing
    responded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    response_time_hours DECIMAL(8,2),
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(approval_stage_id, user_id)
);

-- Real-time activity feed
CREATE TABLE collab.activity_feed (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES core.organizations(id) ON DELETE CASCADE,
    project_id UUID REFERENCES design.projects(id) ON DELETE CASCADE,
    
    -- Activity details
    activity_type collab.event_type NOT NULL,
    activity_title VARCHAR(255) NOT NULL,
    activity_description TEXT,
    
    -- Target information
    target_type VARCHAR(50),
    target_id UUID,
    target_name VARCHAR(255),
    
    -- Activity metadata
    metadata JSONB DEFAULT '{}',
    changes JSONB DEFAULT '{}',
    
    -- Visibility
    visibility VARCHAR(20) DEFAULT 'team' CHECK (
        visibility IN ('private', 'team', 'organization', 'public')
    ),
    
    -- Engagement
    is_important BOOLEAN DEFAULT FALSE,
    view_count INTEGER DEFAULT 0,
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID NOT NULL REFERENCES core.users(id)
);

-- User notifications
CREATE TABLE collab.notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES core.users(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES core.organizations(id) ON DELETE CASCADE,
    
    -- Notification content
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    notification_type VARCHAR(50) NOT NULL CHECK (
        notification_type IN ('comment', 'mention', 'approval_request', 'approval_response', 
                             'project_update', 'translation_complete', 'export_ready', 'system')
    ),
    
    -- Targeting
    related_type VARCHAR(50),
    related_id UUID,
    
    -- Delivery channels
    send_email BOOLEAN DEFAULT TRUE,
    send_push BOOLEAN DEFAULT FALSE,
    send_sms BOOLEAN DEFAULT FALSE,
    
    -- Status
    is_read BOOLEAN DEFAULT FALSE,
    is_clicked BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMP WITH TIME ZONE,
    clicked_at TIMESTAMP WITH TIME ZONE,
    
    -- Delivery tracking
    email_sent BOOLEAN DEFAULT FALSE,
    email_sent_at TIMESTAMP WITH TIME ZONE,
    push_sent BOOLEAN DEFAULT FALSE,
    push_sent_at TIMESTAMP WITH TIME ZONE,
    
    -- Priority
    priority VARCHAR(20) DEFAULT 'normal' CHECK (
        priority IN ('low', 'normal', 'high', 'urgent')
    ),
    
    -- Expiration
    expires_at TIMESTAMP WITH TIME ZONE,
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Team chat messages (optional real-time chat feature)
CREATE TABLE collab.chat_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES core.organizations(id) ON DELETE CASCADE,
    project_id UUID REFERENCES design.projects(id) ON DELETE CASCADE,
    session_id UUID REFERENCES collab.collaboration_sessions(id) ON DELETE CASCADE,
    
    -- Message content
    content TEXT NOT NULL,
    message_type VARCHAR(50) DEFAULT 'text' CHECK (
        message_type IN ('text', 'image', 'file', 'link', 'code', 'reaction', 'system')
    ),
    
    -- Thread structure
    parent_id UUID REFERENCES collab.chat_messages(id),
    thread_root_id UUID,
    
    -- File attachments
    attachments JSONB DEFAULT '[]',
    
    -- Message metadata
    metadata JSONB DEFAULT '{}',
    
    -- Status
    is_edited BOOLEAN DEFAULT FALSE,
    edited_at TIMESTAMP WITH TIME ZONE,
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMP WITH TIME ZONE,
    
    -- Delivery tracking
    delivered_to UUID[] DEFAULT '{}',
    read_by UUID[] DEFAULT '{}',
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID NOT NULL REFERENCES core.users(id)
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Collaboration sessions
CREATE INDEX idx_collaboration_sessions_project ON collab.collaboration_sessions(project_id);
CREATE INDEX idx_collaboration_sessions_status ON collab.collaboration_sessions(status, started_at DESC);
CREATE INDEX idx_collaboration_sessions_type ON collab.collaboration_sessions(session_type);

-- Session participants
CREATE INDEX idx_session_participants_session ON collab.session_participants(session_id);
CREATE INDEX idx_session_participants_user ON collab.session_participants(user_id);
CREATE INDEX idx_session_participants_status ON collab.session_participants(status, joined_at DESC);

-- Comments
CREATE INDEX idx_comments_organization ON collab.comments(organization_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_comments_project ON collab.comments(project_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_comments_target ON collab.comments(target_type, target_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_comments_thread ON collab.comments(thread_root_id, parent_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_comments_status ON collab.comments(status, priority, created_at DESC) WHERE is_deleted = FALSE;
CREATE INDEX idx_comments_mentions ON collab.comments USING GIN(mentioned_users) WHERE is_deleted = FALSE;
CREATE INDEX idx_comments_element ON collab.comments(element_id) WHERE is_deleted = FALSE;

-- Comment reactions
CREATE INDEX idx_comment_reactions_comment ON collab.comment_reactions(comment_id);
CREATE INDEX idx_comment_reactions_user ON collab.comment_reactions(user_id);
CREATE INDEX idx_comment_reactions_type ON collab.comment_reactions(reaction_type);

-- Approval workflows
CREATE INDEX idx_approval_workflows_org ON collab.approval_workflows(organization_id) WHERE status = 'active';
CREATE INDEX idx_approval_workflows_type ON collab.approval_workflows(workflow_type, is_default);

-- Approval requests
CREATE INDEX idx_approval_requests_org ON collab.approval_requests(organization_id);
CREATE INDEX idx_approval_requests_workflow ON collab.approval_requests(workflow_id);
CREATE INDEX idx_approval_requests_target ON collab.approval_requests(target_type, target_id);
CREATE INDEX idx_approval_requests_status ON collab.approval_requests(overall_status, priority, created_at DESC);
CREATE INDEX idx_approval_requests_due ON collab.approval_requests(due_date, expires_at) WHERE overall_status = 'pending';

-- Approval stages
CREATE INDEX idx_approval_stages_request ON collab.approval_stages(approval_request_id, stage_number);
CREATE INDEX idx_approval_stages_assignees ON collab.approval_stages USING GIN(assigned_users);
CREATE INDEX idx_approval_stages_status ON collab.approval_stages(status, due_at);

-- Approval responses
CREATE INDEX idx_approval_responses_stage ON collab.approval_responses(approval_stage_id);
CREATE INDEX idx_approval_responses_user ON collab.approval_responses(user_id);
CREATE INDEX idx_approval_responses_decision ON collab.approval_responses(decision, responded_at DESC);

-- Activity feed
CREATE INDEX idx_activity_feed_org ON collab.activity_feed(organization_id, created_at DESC);
CREATE INDEX idx_activity_feed_project ON collab.activity_feed(project_id, created_at DESC);
CREATE INDEX idx_activity_feed_type ON collab.activity_feed(activity_type, created_at DESC);
CREATE INDEX idx_activity_feed_target ON collab.activity_feed(target_type, target_id);
CREATE INDEX idx_activity_feed_visibility ON collab.activity_feed(visibility, is_important);

-- Notifications
CREATE INDEX idx_notifications_user ON collab.notifications(user_id, created_at DESC);
CREATE INDEX idx_notifications_unread ON collab.notifications(user_id, is_read, priority) WHERE is_read = FALSE;
CREATE INDEX idx_notifications_type ON collab.notifications(notification_type, created_at DESC);
CREATE INDEX idx_notifications_related ON collab.notifications(related_type, related_id);

-- Chat messages
CREATE INDEX idx_chat_messages_org ON collab.chat_messages(organization_id, created_at DESC) WHERE is_deleted = FALSE;
CREATE INDEX idx_chat_messages_project ON collab.chat_messages(project_id, created_at DESC) WHERE is_deleted = FALSE;
CREATE INDEX idx_chat_messages_session ON collab.chat_messages(session_id, created_at DESC) WHERE is_deleted = FALSE;
CREATE INDEX idx_chat_messages_thread ON collab.chat_messages(thread_root_id, parent_id) WHERE is_deleted = FALSE;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Update updated_at timestamp
CREATE TRIGGER update_collaboration_sessions_updated_at BEFORE UPDATE ON collab.collaboration_sessions
    FOR EACH ROW EXECUTE FUNCTION core.update_updated_at();

CREATE TRIGGER update_comments_updated_at BEFORE UPDATE ON collab.comments
    FOR EACH ROW EXECUTE FUNCTION core.update_updated_at();

CREATE TRIGGER update_approval_workflows_updated_at BEFORE UPDATE ON collab.approval_workflows
    FOR EACH ROW EXECUTE FUNCTION core.update_updated_at();

CREATE TRIGGER update_approval_requests_updated_at BEFORE UPDATE ON collab.approval_requests
    FOR EACH ROW EXECUTE FUNCTION core.update_updated_at();

CREATE TRIGGER update_approval_stages_updated_at BEFORE UPDATE ON collab.approval_stages
    FOR EACH ROW EXECUTE FUNCTION core.update_updated_at();

CREATE TRIGGER update_notifications_updated_at BEFORE UPDATE ON collab.notifications
    FOR EACH ROW EXECUTE FUNCTION core.update_updated_at();

CREATE TRIGGER update_chat_messages_updated_at BEFORE UPDATE ON collab.chat_messages
    FOR EACH ROW EXECUTE FUNCTION core.update_updated_at();

-- Set thread root ID for comments
CREATE OR REPLACE FUNCTION collab.set_comment_thread_root_id()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.parent_id IS NOT NULL THEN
        -- Get the root ID from parent
        SELECT COALESCE(thread_root_id, id) INTO NEW.thread_root_id
        FROM collab.comments
        WHERE id = NEW.parent_id;
        
        -- Update reply count
        UPDATE collab.comments 
        SET reply_count = reply_count + 1,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = NEW.thread_root_id;
    ELSE
        -- This is a root comment
        NEW.thread_root_id = NEW.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_comment_thread_root BEFORE INSERT ON collab.comments
    FOR EACH ROW EXECUTE FUNCTION collab.set_comment_thread_root_id();

-- Update reaction counts on comments
CREATE OR REPLACE FUNCTION collab.update_reaction_counts()
RETURNS TRIGGER AS $$
DECLARE
    reaction_summary JSONB;
BEGIN
    -- Recalculate reaction counts for the comment
    SELECT COALESCE(
        jsonb_object_agg(reaction_type, reaction_count),
        '{}'::jsonb
    ) INTO reaction_summary
    FROM (
        SELECT reaction_type, COUNT(*) as reaction_count
        FROM collab.comment_reactions 
        WHERE comment_id = COALESCE(NEW.comment_id, OLD.comment_id)
        GROUP BY reaction_type
    ) subq;
    
    -- Update the comment
    UPDATE collab.comments 
    SET reaction_counts = reaction_summary,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = COALESCE(NEW.comment_id, OLD.comment_id);
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_comment_reaction_counts AFTER INSERT OR DELETE ON collab.comment_reactions
    FOR EACH ROW EXECUTE FUNCTION collab.update_reaction_counts();

-- Set chat message thread root ID
CREATE OR REPLACE FUNCTION collab.set_chat_thread_root_id()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.parent_id IS NOT NULL THEN
        -- Get the root ID from parent
        SELECT COALESCE(thread_root_id, id) INTO NEW.thread_root_id
        FROM collab.chat_messages
        WHERE id = NEW.parent_id;
    ELSE
        -- This is a root message
        NEW.thread_root_id = NEW.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_chat_thread_root BEFORE INSERT ON collab.chat_messages
    FOR EACH ROW EXECUTE FUNCTION collab.set_chat_thread_root_id();
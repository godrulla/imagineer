-- ============================================================================
-- IMAGINEER DATABASE FOUNDATION
-- Extensions and Core Setup
-- ============================================================================

-- Enable required PostgreSQL extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";      -- UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";       -- Cryptographic functions
CREATE EXTENSION IF NOT EXISTS "btree_gist";     -- GiST indexing for exclusion constraints
CREATE EXTENSION IF NOT EXISTS "pg_trgm";        -- Trigram text search
CREATE EXTENSION IF NOT EXISTS "postgres_fdw";   -- Foreign data wrapper for sharding
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements"; -- Query performance monitoring

-- Create schemas for logical separation
CREATE SCHEMA IF NOT EXISTS core;          -- Core system tables
CREATE SCHEMA IF NOT EXISTS design;        -- Design parser service
CREATE SCHEMA IF NOT EXISTS translation;   -- Translation engine
CREATE SCHEMA IF NOT EXISTS export;        -- Export engine
CREATE SCHEMA IF NOT EXISTS collab;        -- Collaboration hub
CREATE SCHEMA IF NOT EXISTS audit;         -- Audit and logging
CREATE SCHEMA IF NOT EXISTS analytics;     -- Analytics and metrics

-- Set default search path
SET search_path TO core, design, translation, export, collab, audit, public;

-- ============================================================================
-- CUSTOM TYPES AND DOMAINS
-- ============================================================================

-- Status enums used across the system
CREATE TYPE core.status AS ENUM (
    'active',
    'inactive',
    'pending',
    'processing',
    'completed',
    'failed',
    'archived',
    'deleted'
);

-- User roles
CREATE TYPE core.user_role AS ENUM (
    'super_admin',
    'org_admin',
    'team_lead',
    'designer',
    'developer',
    'viewer',
    'guest'
);

-- Design tool types
CREATE TYPE design.tool_type AS ENUM (
    'figma',
    'sketch',
    'adobe_xd',
    'photoshop',
    'illustrator',
    'canva',
    'framer',
    'principle',
    'custom'
);

-- Export formats
CREATE TYPE export.format_type AS ENUM (
    'markdown',
    'json',
    'yaml',
    'xml',
    'custom_dsl',
    'html',
    'react',
    'vue',
    'swift',
    'kotlin'
);

-- LLM providers
CREATE TYPE translation.llm_provider AS ENUM (
    'openai_gpt4',
    'openai_gpt35',
    'anthropic_claude',
    'google_gemini',
    'meta_llama',
    'custom',
    'local'
);

-- Collaboration event types
CREATE TYPE collab.event_type AS ENUM (
    'project_created',
    'project_updated',
    'member_added',
    'member_removed',
    'design_uploaded',
    'translation_generated',
    'export_created',
    'comment_added',
    'approval_requested',
    'approval_given'
);

-- Create domain for email validation
CREATE DOMAIN core.email AS TEXT
    CHECK (VALUE ~ '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$');

-- Create domain for URL validation
CREATE DOMAIN core.url AS TEXT
    CHECK (VALUE ~ '^https?://[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}');

-- ============================================================================
-- UTILITY FUNCTIONS
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION core.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to generate short unique IDs (for public facing IDs)
CREATE OR REPLACE FUNCTION core.generate_short_id()
RETURNS TEXT AS $$
DECLARE
    chars TEXT := 'abcdefghijklmnopqrstuvwxyz0123456789';
    result TEXT := '';
    i INTEGER;
BEGIN
    FOR i IN 1..8 LOOP
        result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
    END LOOP;
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Function for soft delete
CREATE OR REPLACE FUNCTION core.soft_delete()
RETURNS TRIGGER AS $$
BEGIN
    NEW.deleted_at = CURRENT_TIMESTAMP;
    NEW.is_deleted = TRUE;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to validate JSON schema
CREATE OR REPLACE FUNCTION core.validate_json_schema(data JSONB, schema JSONB)
RETURNS BOOLEAN AS $$
BEGIN
    -- Placeholder for JSON schema validation
    -- In production, use pg_jsonschema extension or custom implementation
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate storage size
CREATE OR REPLACE FUNCTION core.calculate_storage_size(data JSONB)
RETURNS BIGINT AS $$
BEGIN
    RETURN octet_length(data::TEXT);
END;
$$ LANGUAGE plpgsql;
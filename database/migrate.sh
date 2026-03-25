#!/bin/bash

# ============================================================================
# IMAGINEER DATABASE MIGRATION SCRIPT
# Executes all database schema files in the correct order
# ============================================================================

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEFAULT_DB_URL="postgresql://localhost:5432/imagineer_dev"
DB_URL="${DATABASE_URL:-$DEFAULT_DB_URL}"

# Functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

check_dependencies() {
    log_info "Checking dependencies..."
    
    if ! command -v psql &> /dev/null; then
        log_error "PostgreSQL client (psql) is not installed or not in PATH"
        exit 1
    fi
    
    if ! command -v pg_isready &> /dev/null; then
        log_error "pg_isready is not installed or not in PATH"
        exit 1
    fi
    
    log_success "Dependencies check passed"
}

check_database_connection() {
    log_info "Checking database connection..."
    
    # Extract connection details for pg_isready
    if [[ $DB_URL =~ postgresql://([^:]+):([^@]+)@([^:]+):([^/]+)/(.+) ]]; then
        HOST="${BASH_REMATCH[3]}"
        PORT="${BASH_REMATCH[4]}"
        DBNAME="${BASH_REMATCH[5]}"
    else
        log_error "Invalid database URL format"
        exit 1
    fi
    
    if ! pg_isready -h "$HOST" -p "$PORT" -d "$DBNAME" &> /dev/null; then
        log_error "Cannot connect to database at $HOST:$PORT/$DBNAME"
        log_error "Please ensure PostgreSQL is running and accessible"
        exit 1
    fi
    
    log_success "Database connection successful"
}

execute_sql_file() {
    local file="$1"
    local filename=$(basename "$file")
    
    log_info "Executing $filename..."
    
    if ! psql "$DB_URL" -f "$file" -v ON_ERROR_STOP=1 -q; then
        log_error "Failed to execute $filename"
        exit 1
    fi
    
    log_success "Completed $filename"
}

show_usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -h, --help              Show this help message"
    echo "  -u, --url URL           Database URL (default: $DEFAULT_DB_URL)"
    echo "  -s, --skip-seed         Skip seed data insertion"
    echo "  -c, --check-only        Only check connection, don't run migrations"
    echo "  -f, --force             Force migration even if tables exist"
    echo "  --reset                 Drop all schemas and recreate (DESTRUCTIVE!)"
    echo ""
    echo "Environment Variables:"
    echo "  DATABASE_URL            Database connection URL"
    echo ""
    echo "Examples:"
    echo "  $0                                          # Run with defaults"
    echo "  $0 -u postgresql://user:pass@host:5432/db  # Custom database URL"
    echo "  $0 --skip-seed                             # Skip inserting seed data"
    echo "  $0 --reset                                 # Reset entire database"
}

check_existing_tables() {
    log_info "Checking for existing tables..."
    
    local table_count=$(psql "$DB_URL" -t -c "
        SELECT COUNT(*) 
        FROM information_schema.tables 
        WHERE table_schema IN ('core', 'design', 'translation', 'export', 'collab', 'audit', 'analytics')
    " 2>/dev/null || echo "0")
    
    if [[ "$table_count" -gt 0 ]]; then
        log_warning "Found $table_count existing tables in Imagineer schemas"
        if [[ "$FORCE_MIGRATION" != "true" ]]; then
            log_error "Database appears to already contain Imagineer tables"
            log_error "Use --force to proceed anyway or --reset to start fresh"
            exit 1
        fi
    fi
}

reset_database() {
    log_warning "DESTRUCTIVE OPERATION: Resetting entire database..."
    read -p "Are you sure you want to drop all Imagineer schemas? (yes/no): " confirm
    
    if [[ "$confirm" != "yes" ]]; then
        log_info "Database reset cancelled"
        exit 0
    fi
    
    log_info "Dropping all Imagineer schemas..."
    psql "$DB_URL" -c "
        DROP SCHEMA IF EXISTS analytics CASCADE;
        DROP SCHEMA IF EXISTS audit CASCADE;
        DROP SCHEMA IF EXISTS collab CASCADE;
        DROP SCHEMA IF EXISTS export CASCADE;
        DROP SCHEMA IF EXISTS translation CASCADE;
        DROP SCHEMA IF EXISTS design CASCADE;
        DROP SCHEMA IF EXISTS core CASCADE;
    " -v ON_ERROR_STOP=1
    
    log_success "Database reset completed"
}

run_migrations() {
    log_info "Starting Imagineer database migration..."
    log_info "Database URL: $DB_URL"
    
    # Array of migration files in execution order
    local migration_files=(
        "000_extensions.sql"
        "001_core_schema.sql"
        "002_design_parser_schema.sql"
        "003_translation_engine_schema.sql"
        "004_export_engine_schema.sql"
        "005_collaboration_hub_schema.sql"
        "006_audit_analytics_schema.sql"
        "007_row_level_security.sql"
    )
    
    # Execute each migration file
    for file in "${migration_files[@]}"; do
        local filepath="$SCRIPT_DIR/$file"
        if [[ ! -f "$filepath" ]]; then
            log_error "Migration file not found: $filepath"
            exit 1
        fi
        execute_sql_file "$filepath"
    done
    
    # Execute seed data if not skipped
    if [[ "$SKIP_SEED" != "true" ]]; then
        local seed_file="$SCRIPT_DIR/008_seed_data.sql"
        if [[ -f "$seed_file" ]]; then
            execute_sql_file "$seed_file"
        else
            log_warning "Seed data file not found: $seed_file"
        fi
    fi
}

show_completion_summary() {
    log_success "Migration completed successfully!"
    echo ""
    echo "Database Summary:"
    
    # Count tables by schema
    psql "$DB_URL" -c "
        SELECT 
            schemaname as \"Schema\",
            COUNT(*) as \"Tables\"
        FROM pg_tables 
        WHERE schemaname IN ('core', 'design', 'translation', 'export', 'collab', 'audit', 'analytics')
        GROUP BY schemaname
        ORDER BY schemaname;
    "
    
    echo ""
    log_info "Next steps:"
    echo "1. Configure your application to use the database"
    echo "2. Set up connection pooling for production"
    echo "3. Configure backup and monitoring"
    echo "4. Review and customize the seed data"
    echo ""
    echo "Connection string: $DB_URL"
}

# Parse command line arguments
SKIP_SEED=false
CHECK_ONLY=false
FORCE_MIGRATION=false
RESET_DATABASE=false

while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            show_usage
            exit 0
            ;;
        -u|--url)
            DB_URL="$2"
            shift 2
            ;;
        -s|--skip-seed)
            SKIP_SEED=true
            shift
            ;;
        -c|--check-only)
            CHECK_ONLY=true
            shift
            ;;
        -f|--force)
            FORCE_MIGRATION=true
            shift
            ;;
        --reset)
            RESET_DATABASE=true
            shift
            ;;
        *)
            log_error "Unknown option: $1"
            show_usage
            exit 1
            ;;
    esac
done

# Main execution
main() {
    echo "============================================================================"
    echo "                    IMAGINEER DATABASE MIGRATION"
    echo "============================================================================"
    echo ""
    
    check_dependencies
    check_database_connection
    
    if [[ "$CHECK_ONLY" == "true" ]]; then
        log_success "Connection check completed successfully"
        exit 0
    fi
    
    if [[ "$RESET_DATABASE" == "true" ]]; then
        reset_database
    fi
    
    check_existing_tables
    run_migrations
    show_completion_summary
}

# Execute main function
main "$@"
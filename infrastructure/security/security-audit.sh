#!/bin/bash

# =============================================================================
# IMAGINEER PLATFORM SECURITY AUDIT SCRIPT
# Comprehensive security assessment for production deployment
# =============================================================================

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
AUDIT_LOG="${PROJECT_ROOT}/security-audit-$(date +%Y%m%d-%H%M%S).log"
FAILED_CHECKS=0

# =============================================================================
# LOGGING FUNCTIONS
# =============================================================================

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1" | tee -a "$AUDIT_LOG"
}

log_success() {
    echo -e "${GREEN}[PASS]${NC} $1" | tee -a "$AUDIT_LOG"
}

log_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1" | tee -a "$AUDIT_LOG"
}

log_error() {
    echo -e "${RED}[FAIL]${NC} $1" | tee -a "$AUDIT_LOG"
    ((FAILED_CHECKS++))
}

log_separator() {
    echo -e "\n${BLUE}$1${NC}" | tee -a "$AUDIT_LOG"
    echo "$(printf '=%.0s' {1..80})" | tee -a "$AUDIT_LOG"
}

# =============================================================================
# SECURITY CHECK FUNCTIONS
# =============================================================================

check_environment_variables() {
    log_separator "ENVIRONMENT VARIABLES SECURITY CHECK"
    
    local env_file="${PROJECT_ROOT}/.env.production"
    
    if [[ ! -f "$env_file" ]]; then
        log_error "Production environment file not found: $env_file"
        return 1
    fi
    
    # Check for default/weak passwords
    local weak_patterns=(
        "password.*=.*password"
        "password.*=.*123"
        "secret.*=.*secret"
        "key.*=.*change"
        "token.*=.*example"
    )
    
    for pattern in "${weak_patterns[@]}"; do
        if grep -i "$pattern" "$env_file" >/dev/null 2>&1; then
            log_error "Weak/default password detected matching pattern: $pattern"
        fi
    done
    
    # Check for required security variables
    local required_vars=(
        "JWT_SECRET"
        "POSTGRES_PASSWORD"
        "REDIS_PASSWORD"
        "GRAFANA_PASSWORD"
        "SSL_CERT_PATH"
        "SSL_KEY_PATH"
    )
    
    for var in "${required_vars[@]}"; do
        if ! grep "^${var}=" "$env_file" >/dev/null 2>&1; then
            log_error "Required security variable missing: $var"
        else
            log_success "Required security variable present: $var"
        fi
    done
    
    # Check password strength
    local jwt_secret
    jwt_secret=$(grep "^JWT_SECRET=" "$env_file" 2>/dev/null | cut -d'=' -f2- || echo "")
    if [[ ${#jwt_secret} -lt 64 ]]; then
        log_error "JWT_SECRET is too short (minimum 64 characters recommended)"
    else
        log_success "JWT_SECRET meets length requirements"
    fi
}

check_docker_security() {
    log_separator "DOCKER SECURITY CHECK"
    
    # Check if Docker is running as root
    if docker info >/dev/null 2>&1; then
        log_success "Docker daemon is accessible"
        
        # Check for non-root user in Dockerfiles
        local dockerfiles=(
            "${PROJECT_ROOT}/services/*/Dockerfile.production"
            "${PROJECT_ROOT}/docker-compose.production.yml"
        )
        
        for dockerfile in ${dockerfiles[@]}; do
            if [[ -f "$dockerfile" ]]; then
                if grep -q "USER.*root\|USER.*0" "$dockerfile"; then
                    log_error "Container running as root user in: $dockerfile"
                elif grep -q "USER" "$dockerfile"; then
                    log_success "Non-root user configured in: $dockerfile"
                else
                    log_warning "No USER directive found in: $dockerfile"
                fi
            fi
        done
        
        # Check for security options in docker-compose
        local compose_file="${PROJECT_ROOT}/docker-compose.production.yml"
        if [[ -f "$compose_file" ]]; then
            if grep -q "read_only.*true\|no-new-privileges.*true" "$compose_file"; then
                log_success "Security hardening options found in docker-compose"
            else
                log_warning "Consider adding security hardening options (read_only, no-new-privileges)"
            fi
        fi
    else
        log_error "Docker daemon not accessible"
    fi
}

check_ssl_certificates() {
    log_separator "SSL/TLS CERTIFICATE CHECK"
    
    local ssl_cert_path
    ssl_cert_path=$(grep "^SSL_CERT_PATH=" "${PROJECT_ROOT}/.env.production" 2>/dev/null | cut -d'=' -f2- || echo "")
    
    if [[ -n "$ssl_cert_path" ]]; then
        if [[ -f "$ssl_cert_path" ]]; then
            # Check certificate validity
            local cert_expiry
            cert_expiry=$(openssl x509 -in "$ssl_cert_path" -noout -enddate 2>/dev/null | cut -d'=' -f2 || echo "")
            
            if [[ -n "$cert_expiry" ]]; then
                local expiry_epoch
                expiry_epoch=$(date -d "$cert_expiry" +%s 2>/dev/null || echo "0")
                local current_epoch
                current_epoch=$(date +%s)
                local days_until_expiry=$(( (expiry_epoch - current_epoch) / 86400 ))
                
                if [[ $days_until_expiry -gt 30 ]]; then
                    log_success "SSL certificate valid for $days_until_expiry days"
                elif [[ $days_until_expiry -gt 0 ]]; then
                    log_warning "SSL certificate expires in $days_until_expiry days"
                else
                    log_error "SSL certificate has expired"
                fi
            else
                log_error "Unable to read SSL certificate expiration date"
            fi
        else
            log_error "SSL certificate file not found: $ssl_cert_path"
        fi
    else
        log_warning "SSL certificate path not configured"
    fi
}

check_database_security() {
    log_separator "DATABASE SECURITY CHECK"
    
    local db_config="${PROJECT_ROOT}/infrastructure/production/postgresql.conf"
    
    if [[ -f "$db_config" ]]; then
        # Check SSL configuration
        if grep -q "ssl.*=.*on" "$db_config"; then
            log_success "PostgreSQL SSL enabled"
        else
            log_error "PostgreSQL SSL not enabled"
        fi
        
        # Check password encryption
        if grep -q "password_encryption.*=.*scram-sha-256" "$db_config"; then
            log_success "Strong password encryption configured (SCRAM-SHA-256)"
        else
            log_warning "Consider using SCRAM-SHA-256 password encryption"
        fi
        
        # Check connection limits
        local max_connections
        max_connections=$(grep "max_connections" "$db_config" | head -1 | awk '{print $3}' || echo "0")
        if [[ "$max_connections" -gt 0 && "$max_connections" -le 500 ]]; then
            log_success "Reasonable connection limit configured: $max_connections"
        else
            log_warning "Review connection limit configuration: $max_connections"
        fi
    else
        log_warning "PostgreSQL configuration file not found"
    fi
    
    # Check for database initialization scripts
    local db_scripts="${PROJECT_ROOT}/database/*.sql"
    for script in $db_scripts; do
        if [[ -f "$script" ]]; then
            # Check for SQL injection vulnerabilities
            if grep -i "concat\|'\s*+\|exec\|eval" "$script" >/dev/null 2>&1; then
                log_warning "Potential SQL injection patterns found in: $script"
            fi
            
            # Check for proper permissions
            if grep -i "grant.*all\|superuser" "$script" >/dev/null 2>&1; then
                log_warning "Overly permissive database grants found in: $script"
            fi
        fi
    done
}

check_api_security() {
    log_separator "API SECURITY CHECK"
    
    local kong_config="${PROJECT_ROOT}/infrastructure/api-gateway/kong-production.yml"
    
    if [[ -f "$kong_config" ]]; then
        # Check rate limiting configuration
        if grep -q "rate-limiting" "$kong_config"; then
            log_success "API rate limiting configured"
        else
            log_error "API rate limiting not configured"
        fi
        
        # Check CORS configuration
        if grep -q "cors" "$kong_config"; then
            log_success "CORS configuration found"
            
            # Check for wildcard origins
            if grep -A 10 "cors" "$kong_config" | grep -q "\*"; then
                log_warning "Wildcard CORS origin detected - review for security"
            fi
        else
            log_warning "CORS configuration not found"
        fi
        
        # Check authentication plugins
        if grep -q "jwt\|oauth\|key-auth" "$kong_config"; then
            log_success "Authentication plugins configured"
        else
            log_warning "No authentication plugins found"
        fi
        
        # Check security headers
        if grep -q "response-transformer" "$kong_config"; then
            log_success "Response transformation (security headers) configured"
        else
            log_warning "Security headers transformation not configured"
        fi
    else
        log_error "Kong configuration file not found"
    fi
}

check_nginx_security() {
    log_separator "NGINX SECURITY CHECK"
    
    local nginx_config="${PROJECT_ROOT}/infrastructure/nginx/nginx-production.conf"
    local security_headers="${PROJECT_ROOT}/infrastructure/nginx/security-headers.conf"
    
    if [[ -f "$nginx_config" ]]; then
        # Check server tokens
        if grep -q "server_tokens.*off" "$nginx_config"; then
            log_success "Server tokens disabled"
        else
            log_warning "Server tokens not disabled"
        fi
        
        # Check SSL configuration
        if grep -q "ssl_protocols.*TLSv1\.[23]" "$nginx_config"; then
            log_success "Strong SSL/TLS protocols configured"
        else
            log_warning "Review SSL/TLS protocol configuration"
        fi
        
        # Check rate limiting
        if grep -q "limit_req_zone\|limit_conn_zone" "$nginx_config"; then
            log_success "Rate limiting configured"
        else
            log_warning "Rate limiting not configured"
        fi
        
        # Check for security headers file inclusion
        if grep -q "security-headers.conf" "$nginx_config"; then
            log_success "Security headers configuration included"
        else
            log_warning "Security headers not included"
        fi
    else
        log_error "Nginx configuration file not found"
    fi
    
    if [[ -f "$security_headers" ]]; then
        # Check for essential security headers
        local required_headers=(
            "Content-Security-Policy"
            "Strict-Transport-Security"
            "X-Frame-Options"
            "X-Content-Type-Options"
            "X-XSS-Protection"
        )
        
        for header in "${required_headers[@]}"; do
            if grep -q "$header" "$security_headers"; then
                log_success "Security header configured: $header"
            else
                log_warning "Security header missing: $header"
            fi
        done
    else
        log_error "Security headers configuration file not found"
    fi
}

check_secrets_management() {
    log_separator "SECRETS MANAGEMENT CHECK"
    
    # Check for hardcoded secrets in code
    local source_dirs=(
        "${PROJECT_ROOT}/services"
        "${PROJECT_ROOT}/client/src"
        "${PROJECT_ROOT}/infrastructure"
    )
    
    local secret_patterns=(
        "password\s*=\s*['\"][^'\"]*['\"]"
        "secret\s*=\s*['\"][^'\"]*['\"]"
        "key\s*=\s*['\"][a-zA-Z0-9]{20,}['\"]"
        "token\s*=\s*['\"][^'\"]*['\"]"
        "api_key\s*=\s*['\"][^'\"]*['\"]"
    )
    
    for dir in "${source_dirs[@]}"; do
        if [[ -d "$dir" ]]; then
            for pattern in "${secret_patterns[@]}"; do
                local findings
                findings=$(find "$dir" -type f \( -name "*.js" -o -name "*.ts" -o -name "*.tsx" -o -name "*.json" -o -name "*.yml" -o -name "*.yaml" \) -exec grep -l -E "$pattern" {} \; 2>/dev/null || echo "")
                
                if [[ -n "$findings" ]]; then
                    log_warning "Potential hardcoded secrets found in: $findings"
                fi
            done
        fi
    done
    
    # Check .env files are in .gitignore
    local gitignore="${PROJECT_ROOT}/.gitignore"
    if [[ -f "$gitignore" ]]; then
        if grep -q "\.env" "$gitignore"; then
            log_success "Environment files excluded from git"
        else
            log_error "Environment files not excluded from git"
        fi
    else
        log_warning ".gitignore file not found"
    fi
    
    # Check for committed secrets
    if git -C "$PROJECT_ROOT" rev-parse --git-dir >/dev/null 2>&1; then
        local secret_files
        secret_files=$(git -C "$PROJECT_ROOT" ls-files | grep -E "\.env$|\.key$|\.pem$|secret" || echo "")
        
        if [[ -n "$secret_files" ]]; then
            log_error "Potential secret files committed to git: $secret_files"
        else
            log_success "No obvious secret files in git repository"
        fi
    fi
}

check_dependency_security() {
    log_separator "DEPENDENCY SECURITY CHECK"
    
    # Check Node.js dependencies
    local package_files=(
        "${PROJECT_ROOT}/package.json"
        "${PROJECT_ROOT}/client/package.json"
        "${PROJECT_ROOT}/services/*/package.json"
    )
    
    for package_file in ${package_files[@]}; do
        if [[ -f "$package_file" ]]; then
            local package_dir
            package_dir=$(dirname "$package_file")
            
            # Check if package-lock.json exists (security)
            if [[ -f "${package_dir}/package-lock.json" ]]; then
                log_success "Package lock file exists: ${package_dir}/package-lock.json"
            else
                log_warning "Package lock file missing: ${package_dir}/package-lock.json"
            fi
            
            # Run npm audit if available
            if command -v npm >/dev/null 2>&1; then
                cd "$package_dir"
                local audit_output
                audit_output=$(npm audit --audit-level=moderate 2>/dev/null || echo "audit_failed")
                
                if [[ "$audit_output" == "audit_failed" ]]; then
                    log_warning "npm audit failed for: $package_file"
                elif echo "$audit_output" | grep -q "vulnerabilities"; then
                    local vuln_count
                    vuln_count=$(echo "$audit_output" | grep -o "[0-9]* vulnerabilities" | head -1 | cut -d' ' -f1 || echo "0")
                    
                    if [[ "$vuln_count" -gt 0 ]]; then
                        log_error "npm audit found $vuln_count vulnerabilities in: $package_file"
                    else
                        log_success "npm audit passed for: $package_file"
                    fi
                fi
                cd - >/dev/null
            fi
        fi
    done
}

check_monitoring_security() {
    log_separator "MONITORING & LOGGING SECURITY CHECK"
    
    # Check Prometheus security
    local prometheus_config="${PROJECT_ROOT}/monitoring/prometheus-production.yml"
    if [[ -f "$prometheus_config" ]]; then
        # Check for authentication
        if grep -q "basic_auth" "$prometheus_config"; then
            log_success "Prometheus authentication configured"
        else
            log_warning "Prometheus authentication not configured"
        fi
        
        # Check for external exposure
        if grep -q "127.0.0.1\|localhost" "$prometheus_config"; then
            log_success "Prometheus bound to localhost"
        else
            log_warning "Review Prometheus network binding"
        fi
    fi
    
    # Check Grafana security
    local grafana_env
    grafana_env=$(grep "GRAFANA_" "${PROJECT_ROOT}/.env.production" 2>/dev/null || echo "")
    
    if echo "$grafana_env" | grep -q "GRAFANA_PASSWORD"; then
        log_success "Grafana admin password configured"
    else
        log_error "Grafana admin password not configured"
    fi
    
    if echo "$grafana_env" | grep -q "GF_USERS_ALLOW_SIGN_UP.*false"; then
        log_success "Grafana user registration disabled"
    else
        log_warning "Review Grafana user registration settings"
    fi
}

check_file_permissions() {
    log_separator "FILE PERMISSIONS CHECK"
    
    # Check sensitive file permissions
    local sensitive_files=(
        "${PROJECT_ROOT}/.env.production"
        "${PROJECT_ROOT}/infrastructure/ssl"
        "${PROJECT_ROOT}/database"
    )
    
    for file_path in "${sensitive_files[@]}"; do
        if [[ -e "$file_path" ]]; then
            local perms
            perms=$(stat -c "%a" "$file_path" 2>/dev/null || stat -f "%A" "$file_path" 2>/dev/null || echo "000")
            
            if [[ -f "$file_path" ]]; then
                # Files should not be world-readable
                if [[ "${perms: -1}" -eq 0 ]]; then
                    log_success "File permissions secure: $file_path ($perms)"
                else
                    log_warning "File may be world-readable: $file_path ($perms)"
                fi
            elif [[ -d "$file_path" ]]; then
                # Directories should have appropriate access
                if [[ "${perms: -1}" -le 5 ]]; then
                    log_success "Directory permissions secure: $file_path ($perms)"
                else
                    log_warning "Directory may be world-writable: $file_path ($perms)"
                fi
            fi
        fi
    done
}

# =============================================================================
# COMPLIANCE CHECKS
# =============================================================================

check_gdpr_compliance() {
    log_separator "GDPR COMPLIANCE CHECK"
    
    # Check for privacy policy and data handling
    local privacy_indicators=(
        "privacy"
        "gdpr"
        "data.*retention"
        "cookie.*consent"
        "personal.*data"
    )
    
    local source_files
    source_files=$(find "${PROJECT_ROOT}" -type f \( -name "*.md" -o -name "*.txt" -o -name "*.js" -o -name "*.ts" -o -name "*.tsx" \) 2>/dev/null || echo "")
    
    local privacy_found=false
    for pattern in "${privacy_indicators[@]}"; do
        if echo "$source_files" | xargs grep -l -i "$pattern" >/dev/null 2>&1; then
            privacy_found=true
            break
        fi
    done
    
    if [[ "$privacy_found" == true ]]; then
        log_success "Privacy/GDPR references found in codebase"
    else
        log_warning "No privacy/GDPR references found - ensure compliance documentation exists"
    fi
    
    # Check for data retention settings
    if grep -q "DATA_RETENTION\|RETENTION_DAYS" "${PROJECT_ROOT}/.env.production" 2>/dev/null; then
        log_success "Data retention configuration found"
    else
        log_warning "Data retention configuration not found"
    fi
}

# =============================================================================
# MAIN EXECUTION
# =============================================================================

main() {
    log_info "Starting Imagineer Platform Security Audit"
    log_info "Audit log: $AUDIT_LOG"
    log_info "Project root: $PROJECT_ROOT"
    
    # Run all security checks
    check_environment_variables
    check_docker_security
    check_ssl_certificates
    check_database_security
    check_api_security
    check_nginx_security
    check_secrets_management
    check_dependency_security
    check_monitoring_security
    check_file_permissions
    check_gdpr_compliance
    
    # Summary
    log_separator "SECURITY AUDIT SUMMARY"
    
    if [[ $FAILED_CHECKS -eq 0 ]]; then
        log_success "Security audit completed with no critical issues"
        echo -e "\n${GREEN}✅ SECURITY AUDIT PASSED${NC}" | tee -a "$AUDIT_LOG"
    else
        log_error "Security audit found $FAILED_CHECKS critical issues"
        echo -e "\n${RED}❌ SECURITY AUDIT FAILED${NC}" | tee -a "$AUDIT_LOG"
        echo -e "${RED}Please address the critical issues before production deployment${NC}" | tee -a "$AUDIT_LOG"
    fi
    
    log_info "Full audit log saved to: $AUDIT_LOG"
    
    # Return non-zero exit code if critical issues found
    exit $FAILED_CHECKS
}

# Run the audit
main "$@"
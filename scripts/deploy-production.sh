#!/bin/bash

# =============================================================================
# IMAGINEER PRODUCTION DEPLOYMENT SCRIPT
# Zero-downtime deployment with comprehensive health checks and rollback capability
# =============================================================================

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
DEPLOYMENT_LOG="/var/log/imagineer-deployment-$(date +%Y%m%d-%H%M%S).log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Deployment configuration
DEPLOYMENT_TYPE="${1:-rolling}"  # rolling, blue-green, canary
VERSION="${2:-latest}"
ENVIRONMENT="${3:-production}"
DRY_RUN="${4:-false}"

# Service configuration
SERVICES=("design-parser" "translation-engine" "export-engine" "collaboration-hub")
REGISTRY="ghcr.io/imagineer"
NAMESPACE="imagineer-prod"

# Health check configuration
HEALTH_CHECK_TIMEOUT=300
HEALTH_CHECK_INTERVAL=10
MAX_ROLLBACK_ATTEMPTS=3

# =============================================================================
# LOGGING FUNCTIONS
# =============================================================================

log_info() {
    echo -e "${BLUE}[INFO]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a "$DEPLOYMENT_LOG"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a "$DEPLOYMENT_LOG"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a "$DEPLOYMENT_LOG"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a "$DEPLOYMENT_LOG"
}

log_separator() {
    echo -e "\n${BLUE}$1${NC}" | tee -a "$DEPLOYMENT_LOG"
    echo "$(printf '=%.0s' {1..80})" | tee -a "$DEPLOYMENT_LOG"
}

# =============================================================================
# UTILITY FUNCTIONS
# =============================================================================

check_prerequisites() {
    log_separator "CHECKING PREREQUISITES"
    
    # Check required tools
    local required_tools=("kubectl" "helm" "docker" "jq" "curl")
    for tool in "${required_tools[@]}"; do
        if command -v "$tool" >/dev/null 2>&1; then
            log_success "Tool available: $tool"
        else
            log_error "Required tool not found: $tool"
            exit 1
        fi
    done
    
    # Check kubectl context
    local current_context
    current_context=$(kubectl config current-context)
    if [[ "$current_context" == *"$ENVIRONMENT"* ]]; then
        log_success "Kubectl context verified: $current_context"
    else
        log_error "Invalid kubectl context: $current_context (expected: *$ENVIRONMENT*)"
        exit 1
    fi
    
    # Check Helm charts
    if [[ -d "$PROJECT_ROOT/helm/imagineer" ]]; then
        log_success "Helm charts found"
    else
        log_error "Helm charts not found in $PROJECT_ROOT/helm/imagineer"
        exit 1
    fi
    
    # Check environment configuration
    local values_file="$PROJECT_ROOT/helm/values-${ENVIRONMENT}.yaml"
    if [[ -f "$values_file" ]]; then
        log_success "Environment values file found: $values_file"
    else
        log_error "Environment values file not found: $values_file"
        exit 1
    fi
}

create_backup() {
    log_separator "CREATING PRE-DEPLOYMENT BACKUP"
    
    local backup_name="backup-pre-deploy-$(date +%Y%m%d-%H%M%S)"
    
    # Database backup
    log_info "Creating database backup: $backup_name"
    if kubectl create job --from=cronjob/database-backup "$backup_name" -n "$NAMESPACE" >/dev/null 2>&1; then
        log_success "Database backup job created: $backup_name"
        
        # Wait for backup to complete
        local timeout=300
        local elapsed=0
        while [[ $elapsed -lt $timeout ]]; do
            local job_status
            job_status=$(kubectl get job "$backup_name" -n "$NAMESPACE" -o jsonpath='{.status.conditions[0].type}' 2>/dev/null || echo "")
            
            if [[ "$job_status" == "Complete" ]]; then
                log_success "Database backup completed successfully"
                break
            elif [[ "$job_status" == "Failed" ]]; then
                log_error "Database backup failed"
                return 1
            fi
            
            sleep 10
            ((elapsed += 10))
        done
        
        if [[ $elapsed -ge $timeout ]]; then
            log_error "Database backup timed out"
            return 1
        fi
    else
        log_warning "Could not create database backup job (may not exist)"
    fi
    
    # Create configuration backup
    log_info "Backing up current configuration"
    kubectl get configmap,secret -n "$NAMESPACE" -o yaml > "/tmp/config-backup-$(date +%Y%m%d-%H%M%S).yaml"
    log_success "Configuration backup created"
}

run_database_migrations() {
    log_separator "RUNNING DATABASE MIGRATIONS"
    
    local migration_image="${REGISTRY}/design-parser:${VERSION}"
    local migration_job="migration-$(date +%Y%m%d-%H%M%S)"
    
    log_info "Running database migrations with image: $migration_image"
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "DRY RUN: Would run migrations with: $migration_image"
        return 0
    fi
    
    # Create migration job
    kubectl run "$migration_job" \
        --image="$migration_image" \
        --rm -i --restart=Never \
        --command -n "$NAMESPACE" \
        -- npm run db:migrate:prod
    
    local migration_status=$?
    if [[ $migration_status -eq 0 ]]; then
        log_success "Database migrations completed successfully"
    else
        log_error "Database migrations failed with status: $migration_status"
        return 1
    fi
}

health_check() {
    local service_name="$1"
    local timeout="${2:-$HEALTH_CHECK_TIMEOUT}"
    local interval="${3:-$HEALTH_CHECK_INTERVAL}"
    
    log_info "Starting health check for $service_name (timeout: ${timeout}s)"
    
    local elapsed=0
    while [[ $elapsed -lt $timeout ]]; do
        # Check pod readiness
        local ready_pods
        ready_pods=$(kubectl get pods -l "app=$service_name" -n "$NAMESPACE" -o jsonpath='{.items[?(@.status.conditions[?(@.type=="Ready")].status=="True")].metadata.name}' 2>/dev/null || echo "")
        
        if [[ -n "$ready_pods" ]]; then
            # Check HTTP health endpoint
            local health_url
            case "$service_name" in
                "design-parser") health_url="http://design-parser:8001/health" ;;
                "translation-engine") health_url="http://translation-engine:8002/health" ;;
                "export-engine") health_url="http://export-engine:8003/health" ;;
                "collaboration-hub") health_url="http://collaboration-hub:8004/health" ;;
                *) health_url="http://$service_name/health" ;;
            esac
            
            if kubectl exec -n "$NAMESPACE" $(echo "$ready_pods" | head -1) -- curl -f "$health_url" >/dev/null 2>&1; then
                log_success "Health check passed for $service_name"
                return 0
            fi
        fi
        
        sleep "$interval"
        ((elapsed += interval))
        
        if [[ $((elapsed % 60)) -eq 0 ]]; then
            log_info "Health check in progress for $service_name (${elapsed}s elapsed)"
        fi
    done
    
    log_error "Health check failed for $service_name after ${timeout}s"
    return 1
}

rolling_deployment() {
    log_separator "EXECUTING ROLLING DEPLOYMENT"
    
    local values_file="$PROJECT_ROOT/helm/values-${ENVIRONMENT}.yaml"
    
    log_info "Deploying version $VERSION with rolling update strategy"
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "DRY RUN: Would execute helm upgrade with rolling strategy"
        helm upgrade --install imagineer "$PROJECT_ROOT/helm/imagineer" \
            --namespace "$NAMESPACE" \
            --create-namespace \
            --values "$values_file" \
            --set "image.tag=$VERSION" \
            --set "deployment.type=rolling" \
            --dry-run --debug
        return 0
    fi
    
    # Execute rolling deployment
    helm upgrade --install imagineer "$PROJECT_ROOT/helm/imagineer" \
        --namespace "$NAMESPACE" \
        --create-namespace \
        --values "$values_file" \
        --set "image.tag=$VERSION" \
        --set "deployment.type=rolling" \
        --wait --timeout=600s
    
    local helm_status=$?
    if [[ $helm_status -eq 0 ]]; then
        log_success "Rolling deployment completed successfully"
    else
        log_error "Rolling deployment failed with status: $helm_status"
        return 1
    fi
}

blue_green_deployment() {
    log_separator "EXECUTING BLUE-GREEN DEPLOYMENT"
    
    local values_file="$PROJECT_ROOT/helm/values-${ENVIRONMENT}.yaml"
    local blue_values="$PROJECT_ROOT/helm/values-blue.yaml"
    
    log_info "Deploying version $VERSION with blue-green strategy"
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "DRY RUN: Would execute blue-green deployment"
        return 0
    fi
    
    # Deploy to blue environment
    log_info "Deploying to blue environment"
    helm upgrade --install imagineer-blue "$PROJECT_ROOT/helm/imagineer" \
        --namespace "$NAMESPACE" \
        --values "$values_file" \
        --values "$blue_values" \
        --set "image.tag=$VERSION" \
        --set "deployment.type=blue-green" \
        --wait --timeout=600s
    
    # Run health checks on blue environment
    log_info "Running health checks on blue environment"
    for service in "${SERVICES[@]}"; do
        if ! health_check "${service}-blue"; then
            log_error "Health check failed for blue environment service: $service"
            return 1
        fi
    done
    
    # Switch traffic to blue environment
    log_info "Switching traffic to blue environment"
    kubectl patch service imagineer-service -n "$NAMESPACE" \
        -p '{"spec":{"selector":{"deployment":"blue"}}}'
    
    # Wait and verify traffic switch
    sleep 30
    if run_smoke_tests "blue"; then
        log_success "Traffic successfully switched to blue environment"
        
        # Clean up old green deployment
        log_info "Cleaning up green environment"
        helm uninstall imagineer-green -n "$NAMESPACE" 2>/dev/null || true
        
        # Rename blue to main
        kubectl patch service imagineer-service -n "$NAMESPACE" \
            -p '{"spec":{"selector":{"deployment":"main"}}}'
    else
        log_error "Smoke tests failed on blue environment"
        return 1
    fi
}

canary_deployment() {
    log_separator "EXECUTING CANARY DEPLOYMENT"
    
    local values_file="$PROJECT_ROOT/helm/values-${ENVIRONMENT}.yaml"
    local canary_values="$PROJECT_ROOT/helm/values-canary.yaml"
    
    log_info "Deploying version $VERSION with canary strategy"
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "DRY RUN: Would execute canary deployment"
        return 0
    fi
    
    # Deploy canary with 10% traffic
    log_info "Deploying canary with 10% traffic"
    helm upgrade --install imagineer-canary "$PROJECT_ROOT/helm/imagineer" \
        --namespace "$NAMESPACE" \
        --values "$values_file" \
        --values "$canary_values" \
        --set "image.tag=$VERSION" \
        --set "deployment.type=canary" \
        --set "canary.weight=10" \
        --wait --timeout=600s
    
    # Monitor canary metrics
    log_info "Monitoring canary metrics for 5 minutes"
    if monitor_canary_metrics 300; then
        log_success "Canary metrics look healthy"
        
        # Gradually increase traffic
        for weight in 25 50 75 100; do
            log_info "Increasing canary traffic to ${weight}%"
            helm upgrade imagineer-canary "$PROJECT_ROOT/helm/imagineer" \
                --namespace "$NAMESPACE" \
                --reuse-values \
                --set "canary.weight=$weight" \
                --wait --timeout=300s
            
            sleep 60
            
            if ! monitor_canary_metrics 120; then
                log_error "Canary metrics degraded at ${weight}% traffic"
                return 1
            fi
        done
        
        log_success "Canary deployment promoted to 100%")
    else
        log_error "Canary metrics showed problems, rolling back"
        return 1
    fi
}

monitor_canary_metrics() {
    local duration="$1"
    local check_interval=30
    local elapsed=0
    
    while [[ $elapsed -lt $duration ]]; do
        # Check error rate
        local error_rate
        error_rate=$(kubectl exec -n "$NAMESPACE" deployment/prometheus -- \
            promtool query instant 'rate(http_requests_total{status=~"5.."}[5m]) / rate(http_requests_total[5m])' 2>/dev/null | grep -o '[0-9.]*' | head -1 || echo "0")
        
        # Check response time
        local response_time
        response_time=$(kubectl exec -n "$NAMESPACE" deployment/prometheus -- \
            promtool query instant 'histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))' 2>/dev/null | grep -o '[0-9.]*' | head -1 || echo "0")
        
        # Evaluate metrics
        if (( $(echo "$error_rate > 0.05" | bc -l) )); then
            log_error "Error rate too high: ${error_rate}"
            return 1
        fi
        
        if (( $(echo "$response_time > 2.0" | bc -l) )); then
            log_error "Response time too high: ${response_time}s"
            return 1
        fi
        
        sleep $check_interval
        ((elapsed += check_interval))
    done
    
    return 0
}

run_smoke_tests() {
    local environment="${1:-production}"
    log_info "Running smoke tests for $environment environment"
    
    local base_url
    case "$environment" in
        "blue") base_url="https://blue.imagineer.com" ;;
        "staging") base_url="https://staging.imagineer.com" ;;
        *) base_url="https://imagineer.com" ;;
    esac
    
    # Basic health check
    if curl -f -s "$base_url/health" >/dev/null; then
        log_success "Health endpoint responding"
    else
        log_error "Health endpoint not responding"
        return 1
    fi
    
    # API endpoints check
    local api_endpoints=("/api/v1/parser/health" "/api/v1/translation/health" "/api/v1/export/health" "/api/v1/collaboration/health")
    for endpoint in "${api_endpoints[@]}"; do
        if curl -f -s "$base_url$endpoint" >/dev/null; then
            log_success "API endpoint responding: $endpoint"
        else
            log_error "API endpoint not responding: $endpoint"
            return 1
        fi
    done
    
    # Frontend check
    if curl -f -s "$base_url/" | grep -q "Imagineer"; then
        log_success "Frontend loading correctly"
    else
        log_error "Frontend not loading correctly"
        return 1
    fi
    
    return 0
}

rollback_deployment() {
    log_separator "ROLLING BACK DEPLOYMENT"
    
    log_warning "Initiating rollback procedure"
    
    # Get previous release
    local previous_release
    previous_release=$(helm history imagineer -n "$NAMESPACE" --max 5 -o json | jq -r '.[1].revision' 2>/dev/null || echo "")
    
    if [[ -n "$previous_release" && "$previous_release" != "null" ]]; then
        log_info "Rolling back to release: $previous_release"
        
        if [[ "$DRY_RUN" == "true" ]]; then
            log_info "DRY RUN: Would rollback to release $previous_release"
            return 0
        fi
        
        helm rollback imagineer "$previous_release" -n "$NAMESPACE" --wait --timeout=300s
        
        # Verify rollback
        if kubectl wait --for=condition=ready pod -l app=imagineer --timeout=300s -n "$NAMESPACE" >/dev/null 2>&1; then
            log_success "Rollback completed successfully"
            
            # Run smoke tests to verify rollback
            if run_smoke_tests; then
                log_success "Rollback verification successful"
                return 0
            else
                log_error "Rollback verification failed"
                return 1
            fi
        else
            log_error "Rollback failed - pods not ready"
            return 1
        fi
    else
        log_error "No previous release found for rollback"
        return 1
    fi
}

cleanup_deployment() {
    log_separator "CLEANING UP DEPLOYMENT ARTIFACTS"
    
    # Clean up old replica sets
    kubectl delete replicaset -l app=imagineer -n "$NAMESPACE" --cascade=orphan 2>/dev/null || true
    
    # Clean up completed jobs
    kubectl delete jobs -l app=imagineer -n "$NAMESPACE" --field-selector status.successful=1 2>/dev/null || true
    
    # Clean up old config maps (keep last 5)
    local old_configs
    old_configs=$(kubectl get configmap -n "$NAMESPACE" -l app=imagineer --sort-by=.metadata.creationTimestamp -o name | head -n -5)
    if [[ -n "$old_configs" ]]; then
        echo "$old_configs" | xargs kubectl delete -n "$NAMESPACE" 2>/dev/null || true
    fi
    
    log_success "Cleanup completed"
}

create_deployment_record() {
    log_separator "CREATING DEPLOYMENT RECORD"
    
    local deployment_info
    deployment_info=$(cat <<EOF
{
    "version": "$VERSION",
    "deploymentType": "$DEPLOYMENT_TYPE",
    "environment": "$ENVIRONMENT",
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "deployer": "${USER:-unknown}",
    "gitCommit": "$(git rev-parse HEAD 2>/dev/null || echo 'unknown')",
    "gitBranch": "$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo 'unknown')"
}
EOF
    )
    
    kubectl create configmap "deployment-$(date +%Y%m%d-%H%M%S)" \
        --from-literal="deployment-info=$deployment_info" \
        -n "$NAMESPACE" >/dev/null 2>&1 || true
    
    log_success "Deployment record created"
}

send_notification() {
    local status="$1"
    local message="$2"
    
    if [[ -n "${SLACK_WEBHOOK_URL:-}" ]]; then
        local color
        case "$status" in
            "success") color="good" ;;
            "warning") color="warning" ;;
            "error") color="danger" ;;
            *) color="#DDDDDD" ;;
        esac
        
        local payload
        payload=$(cat <<EOF
{
    "attachments": [
        {
            "color": "$color",
            "title": "Imagineer Deployment - $ENVIRONMENT",
            "text": "$message",
            "fields": [
                {
                    "title": "Version",
                    "value": "$VERSION",
                    "short": true
                },
                {
                    "title": "Type",
                    "value": "$DEPLOYMENT_TYPE",
                    "short": true
                },
                {
                    "title": "Environment",
                    "value": "$ENVIRONMENT",
                    "short": true
                },
                {
                    "title": "Deployer",
                    "value": "${USER:-unknown}",
                    "short": true
                }
            ],
            "timestamp": $(date +%s)
        }
    ]
}
EOF
        )
        
        curl -X POST -H 'Content-type: application/json' \
            --data "$payload" \
            "$SLACK_WEBHOOK_URL" >/dev/null 2>&1 || true
    fi
}

# =============================================================================
# MAIN DEPLOYMENT FUNCTION
# =============================================================================

deploy() {
    log_separator "STARTING IMAGINEER PRODUCTION DEPLOYMENT"
    log_info "Deployment Type: $DEPLOYMENT_TYPE"
    log_info "Version: $VERSION"
    log_info "Environment: $ENVIRONMENT"
    log_info "Dry Run: $DRY_RUN"
    
    # Pre-deployment checks
    check_prerequisites || exit 1
    
    # Create backup
    if [[ "$DRY_RUN" != "true" ]]; then
        create_backup || {
            log_error "Backup creation failed"
            send_notification "error" "Deployment failed during backup creation"
            exit 1
        }
    fi
    
    # Run database migrations
    run_database_migrations || {
        log_error "Database migrations failed"
        send_notification "error" "Deployment failed during database migrations"
        exit 1
    }
    
    # Execute deployment based on strategy
    case "$DEPLOYMENT_TYPE" in
        "rolling")
            rolling_deployment || {
                log_error "Rolling deployment failed"
                if [[ "$DRY_RUN" != "true" ]]; then
                    rollback_deployment
                    send_notification "error" "Rolling deployment failed and was rolled back"
                fi
                exit 1
            }
            ;;
        "blue-green")
            blue_green_deployment || {
                log_error "Blue-green deployment failed"
                if [[ "$DRY_RUN" != "true" ]]; then
                    rollback_deployment
                    send_notification "error" "Blue-green deployment failed and was rolled back"
                fi
                exit 1
            }
            ;;
        "canary")
            canary_deployment || {
                log_error "Canary deployment failed"
                if [[ "$DRY_RUN" != "true" ]]; then
                    rollback_deployment
                    send_notification "error" "Canary deployment failed and was rolled back"
                fi
                exit 1
            }
            ;;
        *)
            log_error "Unknown deployment type: $DEPLOYMENT_TYPE"
            exit 1
            ;;
    esac
    
    # Post-deployment verification
    if [[ "$DRY_RUN" != "true" ]]; then
        log_info "Running post-deployment verification"
        
        # Health checks for all services
        for service in "${SERVICES[@]}"; do
            health_check "$service" || {
                log_error "Post-deployment health check failed for $service"
                rollback_deployment
                send_notification "error" "Deployment verification failed and was rolled back"
                exit 1
            }
        done
        
        # Run comprehensive smoke tests
        run_smoke_tests || {
            log_error "Smoke tests failed"
            rollback_deployment
            send_notification "error" "Smoke tests failed and deployment was rolled back"
            exit 1
        }
        
        # Cleanup and record keeping
        cleanup_deployment
        create_deployment_record
        
        # Success notification
        send_notification "success" "Deployment completed successfully!"
    fi
    
    log_separator "DEPLOYMENT COMPLETED SUCCESSFULLY"
    log_success "Version $VERSION deployed to $ENVIRONMENT using $DEPLOYMENT_TYPE strategy"
    log_info "Deployment log: $DEPLOYMENT_LOG"
}

# =============================================================================
# SCRIPT ENTRY POINT
# =============================================================================

# Show usage if no parameters provided
if [[ $# -eq 0 ]]; then
    cat <<EOF
Usage: $0 [DEPLOYMENT_TYPE] [VERSION] [ENVIRONMENT] [DRY_RUN]

DEPLOYMENT_TYPE: rolling, blue-green, canary (default: rolling)
VERSION:         Image tag/version to deploy (default: latest)
ENVIRONMENT:     Target environment (default: production)
DRY_RUN:         true/false - preview deployment without executing (default: false)

Examples:
  $0 rolling v1.2.3 production false
  $0 blue-green latest staging true
  $0 canary v1.2.4 production false

Environment Variables:
  SLACK_WEBHOOK_URL - Slack webhook for notifications
  KUBECONFIG - Kubernetes configuration file
EOF
    exit 1
fi

# Trap for cleanup on exit
trap 'log_info "Deployment script interrupted"' INT TERM

# Execute deployment
deploy
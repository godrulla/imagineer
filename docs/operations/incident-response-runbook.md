# 🚨 Imagineer Platform Incident Response Runbook

## Overview

This runbook provides step-by-step procedures for responding to incidents affecting the Imagineer platform. It covers incident classification, response procedures, communication protocols, and post-incident activities.

---

## 📊 Incident Severity Classification

### P0 - Critical (15 minute response)
**Complete service outage or critical security breach**
- Platform completely inaccessible
- Data breach or security compromise
- Data corruption or loss
- Payment system failure (if applicable)

### P1 - High (30 minute response)
**Major functionality impacted**
- Core features unavailable (import, translation, export)
- Significant performance degradation (> 50% slower)
- Authentication/authorization failures
- Real-time collaboration not working

### P2 - Medium (1 hour response)
**Degraded functionality**
- Minor features unavailable
- Moderate performance issues
- Intermittent errors affecting < 25% of users
- Non-critical integrations failing

### P3 - Low (4 hour response)
**Minor issues with workarounds**
- Cosmetic bugs
- Documentation issues
- Non-critical notifications failing
- Minor performance impacts

---

## 🚀 Incident Response Procedures

### Initial Response (First 5 Minutes)

#### 1. Incident Detection
**Automated Detection:**
```bash
# Check monitoring dashboard
open https://grafana.imagineer.com/dashboards

# Check alerting status
kubectl get alerts -n imagineer-prod

# Review recent deployments
helm history imagineer -n imagineer-prod --max 5
```

**Manual Detection:**
- User reports via support channels
- Team member discovers issue
- Partner/vendor notifications

#### 2. Initial Assessment
```bash
# Quick health check
curl -f https://imagineer.com/health

# Check service status
kubectl get pods -n imagineer-prod
kubectl get services -n imagineer-prod

# Review error logs
kubectl logs -n imagineer-prod -l app=imagineer --since=10m | grep ERROR
```

#### 3. Incident Declaration
**Criteria for Incident Declaration:**
- P0/P1 severity issues
- Multiple service degradation
- Security concerns
- User impact > 100 users

**Declaration Process:**
1. Create incident in PagerDuty/OpsGenie
2. Start incident response chat room
3. Page on-call engineer
4. Notify incident commander

### Incident Response Team Assembly (5-10 Minutes)

#### Core Team Roles
- **Incident Commander**: Overall coordination and decision making
- **Technical Lead**: Primary troubleshooting and technical decisions
- **Communications Lead**: Internal and external communications
- **Customer Success**: User impact assessment and customer communication

#### Team Assembly Commands
```bash
# Start incident war room
# Slack: Create #incident-YYYYMMDD-HHMMSS channel

# Page incident response team
# PagerDuty: Trigger "Incident Response Team" escalation

# Create incident tracking
# Jira/Linear: Create incident ticket with template
```

### Investigation and Diagnosis (10-30 Minutes)

#### System Health Assessment
```bash
# Check overall system health
./scripts/health-check.sh production

# Review monitoring dashboards
# - Application Performance Dashboard
# - Infrastructure Monitoring Dashboard  
# - Business Metrics Dashboard
# - Security Events Dashboard

# Check recent changes
git log --oneline --since="2 hours ago"
kubectl get events -n imagineer-prod --sort-by='.lastTimestamp'
```

#### Service-Specific Diagnostics

**Design Parser Service:**
```bash
# Check service health
kubectl exec -n imagineer-prod deployment/design-parser -- curl -f http://localhost:8001/health

# Review logs
kubectl logs -n imagineer-prod -l app=design-parser --since=30m | tail -100

# Check Figma API connectivity
kubectl exec -n imagineer-prod deployment/design-parser -- curl -f https://api.figma.com/v1/me
```

**Translation Engine Service:**
```bash
# Check AI API connectivity
kubectl exec -n imagineer-prod deployment/translation-engine -- curl -f https://api.openai.com/v1/models

# Review processing queue
kubectl exec -n imagineer-prod deployment/redis -- redis-cli LLEN translation_queue

# Check memory usage
kubectl top pods -n imagineer-prod -l app=translation-engine
```

**Database Issues:**
```bash
# Check database connectivity
kubectl exec -n imagineer-prod deployment/design-parser -- pg_isready -h postgres -p 5432

# Review active connections
kubectl exec -n imagineer-prod deployment/postgres -- psql -c "SELECT count(*) FROM pg_stat_activity;"

# Check slow queries
kubectl exec -n imagineer-prod deployment/postgres -- psql -c "SELECT query, mean_time FROM pg_stat_statements ORDER BY mean_time DESC LIMIT 10;"
```

**Cache Issues:**
```bash
# Check Redis connectivity
kubectl exec -n imagineer-prod deployment/redis -- redis-cli ping

# Review memory usage
kubectl exec -n imagineer-prod deployment/redis -- redis-cli info memory

# Check hit rate
kubectl exec -n imagineer-prod deployment/redis -- redis-cli info stats | grep hit
```

### Immediate Mitigation (As Soon As Possible)

#### Common Mitigation Strategies

**1. Service Restart:**
```bash
# Restart specific service
kubectl rollout restart deployment/design-parser -n imagineer-prod

# Wait for rollout to complete
kubectl rollout status deployment/design-parser -n imagineer-prod --timeout=300s
```

**2. Scale Up Resources:**
```bash
# Scale up replicas
kubectl scale deployment/translation-engine --replicas=5 -n imagineer-prod

# Increase resource limits
kubectl patch deployment translation-engine -n imagineer-prod -p '{"spec":{"template":{"spec":{"containers":[{"name":"translation-engine","resources":{"limits":{"memory":"4Gi","cpu":"2000m"}}}]}}}}'
```

**3. Circuit Breaker Activation:**
```bash
# Enable maintenance mode
kubectl patch configmap maintenance-config -n imagineer-prod -p '{"data":{"maintenance_mode":"true"}}'

# Disable problematic features
kubectl patch configmap feature-flags -n imagineer-prod -p '{"data":{"ai_translation_enabled":"false"}}'
```

**4. Traffic Routing:**
```bash
# Route traffic to healthy instances
kubectl patch service imagineer-service -n imagineer-prod -p '{"spec":{"selector":{"version":"stable"}}}'

# Enable CDN-only mode for static content
# Update Cloudflare settings via API or dashboard
```

**5. Database Mitigation:**
```bash
# Switch to read replica for queries
kubectl patch configmap database-config -n imagineer-prod -p '{"data":{"read_replica_enabled":"true"}}'

# Increase connection pool
kubectl patch deployment design-parser -n imagineer-prod -p '{"spec":{"template":{"spec":{"containers":[{"name":"design-parser","env":[{"name":"DB_POOL_MAX","value":"50"}]}]}}}}'
```

### Recovery Procedures

#### Rollback to Previous Version
```bash
# Get previous release
PREVIOUS_RELEASE=$(helm history imagineer -n imagineer-prod --max 5 -o json | jq -r '.[1].revision')

# Execute rollback
helm rollback imagineer $PREVIOUS_RELEASE -n imagineer-prod --wait --timeout=300s

# Verify rollback
kubectl get pods -n imagineer-prod
./scripts/smoke-tests.sh https://imagineer.com
```

#### Database Recovery
```bash
# Restore from backup (if needed)
kubectl exec -n imagineer-prod deployment/postgres -- pg_restore -h localhost -U imagineer_user -d imagineer /backups/latest.sql

# Verify data integrity
kubectl exec -n imagineer-prod deployment/postgres -- psql -c "SELECT COUNT(*) FROM users; SELECT COUNT(*) FROM projects; SELECT COUNT(*) FROM designs;"
```

#### Cache Recovery
```bash
# Clear and rebuild cache
kubectl exec -n imagineer-prod deployment/redis -- redis-cli FLUSHALL

# Restart application to rebuild cache
kubectl rollout restart deployment/design-parser -n imagineer-prod
kubectl rollout restart deployment/translation-engine -n imagineer-prod
```

---

## 📞 Communication Procedures

### Internal Communication

#### Incident Notification Template
```
🚨 INCIDENT ALERT - P{{ severity }}

Title: {{ incident_title }}
Status: INVESTIGATING
Impact: {{ impact_description }}
Start Time: {{ start_time }} UTC

Affected Services:
{{ affected_services }}

Incident Commander: {{ commander }}
War Room: #incident-{{ incident_id }}

Next Update: {{ next_update_time }}
```

#### Status Update Template
```
📊 INCIDENT UPDATE - {{ incident_title }}

Status: {{ status }}
Time: {{ update_time }} UTC

Progress:
{{ progress_description }}

Actions Taken:
{{ actions_taken }}

Next Steps:
{{ next_steps }}

ETA for Resolution: {{ eta }}
Next Update: {{ next_update_time }}
```

### External Communication

#### Customer Communication Template
```
We're currently investigating reports of {{ issue_description }} affecting our platform. 

Our team is actively working to resolve this issue and we'll provide updates as we have more information.

Status: {{ status }}
Estimated Resolution: {{ eta }}

For the latest updates, please check our status page: https://status.imagineer.com

We apologize for any inconvenience and appreciate your patience.

- Imagineer Support Team
```

#### Social Media Template
```
We're aware of an issue affecting some users' ability to {{ affected_functionality }}. Our team is investigating and working on a resolution. We'll update you as soon as we have more information. Status: https://status.imagineer.com
```

---

## 🔍 Common Issue Troubleshooting

### High Error Rates

**Symptoms:**
- 5xx error rate > 1%
- User reports of failed requests
- Monitoring alerts

**Investigation:**
```bash
# Check error patterns
kubectl logs -n imagineer-prod -l app=imagineer --since=15m | grep "ERROR\|FATAL" | head -20

# Review error distribution by service
curl -s "http://prometheus:9090/api/v1/query?query=rate(http_requests_total{status=~'5..'}[5m])" | jq '.data.result'

# Check external API status
curl -I https://api.figma.com/v1/me
curl -I https://api.openai.com/v1/models
```

**Common Causes & Solutions:**
1. **External API failures** → Enable circuit breaker, use cached data
2. **Database connection issues** → Scale connection pool, restart services
3. **Memory pressure** → Scale resources, restart affected pods
4. **Bad deployment** → Rollback to previous version

### High Response Times

**Symptoms:**
- 95th percentile > 2 seconds
- User complaints about slow loading
- Performance monitoring alerts

**Investigation:**
```bash
# Check response time distribution
curl -s "http://prometheus:9090/api/v1/query?query=histogram_quantile(0.95,rate(http_request_duration_seconds_bucket[5m]))" | jq '.data.result'

# Identify slow endpoints
kubectl logs -n imagineer-prod -l app=imagineer --since=15m | grep "duration.*[5-9][0-9][0-9][0-9]"

# Check resource utilization
kubectl top pods -n imagineer-prod
kubectl top nodes
```

**Common Solutions:**
1. **Scale up resources** → Increase CPU/memory limits
2. **Optimize database queries** → Review slow query log
3. **Enable caching** → Increase cache TTL, add new cache layers
4. **Scale horizontally** → Increase pod replicas

### Authentication Issues

**Symptoms:**
- Users cannot log in
- JWT validation errors
- 401/403 errors

**Investigation:**
```bash
# Check authentication service
kubectl logs -n imagineer-prod -l app=collaboration-hub --since=15m | grep "auth\|jwt\|login"

# Verify JWT secret
kubectl get secret jwt-secret -n imagineer-prod -o jsonpath='{.data.secret}' | base64 -d | wc -c

# Test authentication endpoint
curl -X POST https://imagineer.com/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test123"}'
```

**Common Solutions:**
1. **JWT secret rotation** → Update secret, restart services
2. **Session storage issues** → Clear Redis cache, restart Redis
3. **Load balancer issues** → Check session affinity settings

### Database Performance Issues

**Symptoms:**
- High database CPU/memory usage
- Connection timeouts
- Slow query performance

**Investigation:**
```bash
# Check database performance
kubectl exec -n imagineer-prod deployment/postgres -- psql -c "
SELECT pid, now() - pg_stat_activity.query_start AS duration, query 
FROM pg_stat_activity 
WHERE (now() - pg_stat_activity.query_start) > interval '5 minutes';"

# Review connection count
kubectl exec -n imagineer-prod deployment/postgres -- psql -c "SELECT count(*) FROM pg_stat_activity;"

# Check slow queries
kubectl exec -n imagineer-prod deployment/postgres -- psql -c "SELECT query, mean_time, calls FROM pg_stat_statements ORDER BY mean_time DESC LIMIT 10;"
```

**Common Solutions:**
1. **Scale database resources** → Increase CPU/memory
2. **Optimize queries** → Add indexes, rewrite slow queries
3. **Connection pooling** → Increase pool size, add connection pooler
4. **Read replicas** → Route read queries to replicas

---

## 📝 Post-Incident Activities

### Immediate Post-Resolution (Within 1 Hour)

#### 1. Confirm Resolution
```bash
# Verify all systems healthy
./scripts/health-check.sh production

# Run smoke tests
./scripts/smoke-tests.sh https://imagineer.com

# Check metrics are back to normal
# Review Grafana dashboards for 30 minutes post-resolution
```

#### 2. Customer Communication
```
✅ RESOLVED: {{ incident_title }}

We're happy to report that the issue affecting {{ affected_functionality }} has been resolved as of {{ resolution_time }} UTC.

All services are now operating normally. If you continue to experience issues, please contact support@imagineer.com.

Thank you for your patience.

- Imagineer Support Team
```

#### 3. Internal Notification
```
✅ INCIDENT RESOLVED - {{ incident_title }}

Resolution Time: {{ resolution_time }} UTC
Total Duration: {{ total_duration }}
Root Cause: {{ brief_root_cause }}

All systems confirmed healthy.
Post-mortem scheduled for {{ postmortem_date }}.

Incident Commander: {{ commander }}
```

### Post-Mortem Process (Within 48 Hours)

#### 1. Post-Mortem Meeting
- **Attendees**: Incident response team, stakeholders, management
- **Duration**: 60 minutes
- **Agenda**:
  - Timeline review
  - Root cause analysis
  - Response effectiveness review
  - Action items identification

#### 2. Post-Mortem Document Template
```markdown
# Post-Mortem: {{ incident_title }}

## Incident Summary
- **Date**: {{ incident_date }}
- **Duration**: {{ total_duration }}
- **Impact**: {{ impact_summary }}
- **Root Cause**: {{ root_cause }}

## Timeline
| Time | Event | Action |
|------|-------|---------|
| {{ time }} | {{ event }} | {{ action }} |

## Root Cause Analysis
### What Happened
{{ detailed_description }}

### Why It Happened
{{ root_cause_analysis }}

### Contributing Factors
{{ contributing_factors }}

## Response Evaluation
### What Went Well
{{ positive_aspects }}

### What Could Be Improved
{{ improvement_areas }}

## Action Items
| Action | Owner | Due Date | Priority |
|--------|--------|----------|----------|
| {{ action }} | {{ owner }} | {{ due_date }} | {{ priority }} |

## Lessons Learned
{{ lessons_learned }}
```

#### 3. Follow-Up Actions
- Implement action items with assigned owners
- Update runbooks and procedures
- Improve monitoring and alerting
- Conduct additional training if needed
- Schedule follow-up review in 30 days

---

## 📱 Emergency Contacts

### Internal Team (24/7 On-Call)
- **Primary On-Call**: {{ primary_oncall }}
- **Secondary On-Call**: {{ secondary_oncall }}
- **Incident Commander**: {{ incident_commander }}
- **Engineering Manager**: {{ engineering_manager }}
- **CTO**: {{ cto_contact }}

### External Support
- **AWS Enterprise Support**: 1-800-XXX-XXXX
- **Cloudflare Support**: {{ cloudflare_support }}
- **Database Consultant**: {{ db_consultant }}
- **Security Consultant**: {{ security_consultant }}

### Escalation Tree
1. **L1**: On-call engineer (0-15 minutes)
2. **L2**: Engineering manager + senior engineers (15-30 minutes)
3. **L3**: CTO + external consultants (30+ minutes)
4. **L4**: CEO + board notification (if business critical)

---

## 🔧 Tools and Resources

### Monitoring and Dashboards
- **Grafana**: https://grafana.imagineer.com
- **Prometheus**: https://prometheus.imagineer.com
- **Jaeger**: https://jaeger.imagineer.com
- **Status Page**: https://status.imagineer.com

### Communication Tools
- **Slack**: #incident-response, #alerts
- **PagerDuty**: https://imagineer.pagerduty.com
- **Video Conference**: {{ emergency_meeting_link }}

### Documentation
- **Runbooks**: `/docs/operations/`
- **Architecture Docs**: `/docs/architecture/`
- **API Documentation**: https://api.imagineer.com/docs
- **Deployment Procedures**: `/docs/deployment/`

### Quick Access Commands
```bash
# SSH to bastion host
ssh -i ~/.ssh/imagineer-prod.pem bastion.imagineer.com

# Connect to Kubernetes cluster
aws eks update-kubeconfig --name imagineer-production

# Emergency maintenance mode
kubectl patch configmap maintenance-config -p '{"data":{"enabled":"true"}}'

# Quick rollback
helm rollback imagineer -n imagineer-prod

# Emergency scaling
kubectl scale deployment --replicas=10 -n imagineer-prod --all
```

---

**Last Updated**: {{ last_updated }}  
**Version**: {{ version }}  
**Next Review**: {{ next_review_date }}
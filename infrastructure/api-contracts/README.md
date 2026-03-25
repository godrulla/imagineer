# Imagineer Platform API Contracts

## Overview

This directory contains the complete API contracts, inter-service communication patterns, and developer experience design for the Imagineer Platform. These contracts define how all microservices communicate and provide a foundation for building tomorrow's design-to-LLM translation platform.

## Architecture Philosophy

> "Every system should be a work of art that solves real problems" - ARQ

The Imagineer API architecture follows these core principles:

- **API-First Design**: Contracts defined before implementation
- **Consistency**: Shared schemas and patterns across all services
- **Developer Experience**: Intuitive, well-documented APIs with comprehensive tooling
- **Scalability**: Designed for 10x scale from day one
- **Resilience**: Circuit breakers, retries, and graceful degradation
- **Security**: Zero-trust architecture with comprehensive authentication
- **Observability**: Full tracing, metrics, and logging

## Service Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Kong API Gateway                        │
│              (Advanced Routing & Middleware)                   │
└─────────────────────────┬───────────────────────────────────────┘
                          │
         ┌────────────────┼────────────────┐
         │                │                │
    ┌────▼────┐    ┌─────▼─────┐    ┌─────▼─────┐    ┌─────────────┐
    │ Design  │    │Translation│    │  Export   │    │Collaboration│
    │ Parser  │    │  Engine   │    │  Engine   │    │    Hub      │
    │ :8001   │    │   :8002   │    │   :8003   │    │   :8004     │
    └─────────┘    └───────────┘    └───────────┘    └─────────────┘
         │                │                │                │
         └────────────────┼────────────────┼────────────────┘
                          │                │
                    ┌─────▼─────┐    ┌─────▼─────┐
                    │   Event   │    │  Storage  │
                    │    Bus    │    │   Layer   │
                    │ (Redis)   │    │    (S3)   │
                    └───────────┘    └───────────┘
```

## File Structure

```
api-contracts/
├── README.md                           # This file
├── design-parser-service.yaml          # Design Parser OpenAPI spec
├── translation-engine-service.yaml     # Translation Engine OpenAPI spec
├── export-engine-service.yaml          # Export Engine OpenAPI spec
├── collaboration-hub-service.yaml      # Collaboration Hub OpenAPI spec
├── shared-schemas.yaml                 # Common schemas and data models
├── inter-service-communication.yaml    # Event schemas and patterns
├── kong-enhanced.yml                   # Kong API Gateway configuration
└── developer-experience.md             # Developer experience design
```

## API Services

### 1. Design Parser Service (Port 8001)
**Purpose**: Processes and analyzes design files from various tools

**Key Features**:
- Multi-format design file parsing (Figma, Sketch, Adobe XD)
- Project and file management
- Real-time Figma synchronization
- Visual element extraction and categorization
- Background job processing

**OpenAPI Spec**: [design-parser-service.yaml](./design-parser-service.yaml)

**Example Usage**:
```bash
curl -X POST "https://api.imagineer.dev/v1/parser/projects" \
  -H "Authorization: Bearer YOUR_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Mobile App Redesign",
    "source_tool": "figma",
    "source_url": "https://figma.com/file/abc123"
  }'
```

### 2. Translation Engine Service (Port 8002)
**Purpose**: Converts parsed design data into LLM-ready prompts and various formats

**Key Features**:
- Multi-LLM provider support (OpenAI, Anthropic, Google)
- Template-based translation system
- Batch processing capabilities
- Quality assessment and optimization
- Cost and token tracking

**OpenAPI Spec**: [translation-engine-service.yaml](./translation-engine-service.yaml)

**Example Usage**:
```bash
curl -X POST "https://api.imagineer.dev/v1/translate/generate" \
  -H "Authorization: Bearer YOUR_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "llm_provider": "openai_gpt4",
    "user_prompt": "Convert this design to React components",
    "input_data": {...}
  }'
```

### 3. Export Engine Service (Port 8003)
**Purpose**: Generates and delivers various output formats from translated data

**Key Features**:
- Multi-format export (Markdown, JSON, HTML, PDF)
- Template-based customization
- Storage management with CDN integration
- Batch export processing
- Shareable links with access control

**OpenAPI Spec**: [export-engine-service.yaml](./export-engine-service.yaml)

**Example Usage**:
```bash
curl -X POST "https://api.imagineer.dev/v1/export/generate" \
  -H "Authorization: Bearer YOUR_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "export_format": "markdown",
    "input_data": {...},
    "filename": "components.md"
  }'
```

### 4. Collaboration Hub Service (Port 8004)
**Purpose**: Enables real-time collaboration and team features

**Key Features**:
- Real-time collaborative workspaces
- Comment and annotation system
- Live cursor tracking and presence
- WebSocket-based communication
- Permission-based access control

**OpenAPI Spec**: [collaboration-hub-service.yaml](./collaboration-hub-service.yaml)

**WebSocket Connection**:
```javascript
const socket = io('wss://api.imagineer.dev/socket.io', {
  auth: { token: 'YOUR_JWT_TOKEN' }
});

socket.emit('join_workspace', { workspace_id: 'workspace-id' });
```

## Shared Schemas

All services use common data models and error response formats defined in [shared-schemas.yaml](./shared-schemas.yaml):

- **Common Types**: UUIDs, timestamps, emails, URLs
- **Pagination**: Consistent pagination patterns
- **Error Responses**: RFC 7807 compliant error handling
- **User & Organization**: Shared entity models
- **File & Media**: Common file handling schemas

## Inter-Service Communication

The platform uses event-driven architecture for loose coupling between services:

### Event Bus (Redis Streams)
- **Design Events**: File uploads, processing completion, sync events
- **Translation Events**: Job status, completion, quality metrics
- **Export Events**: Generation completion, download tracking
- **Collaboration Events**: User activity, comments, workspace changes

### Circuit Breakers & Resilience
- **Failure Thresholds**: Service-specific failure detection
- **Fallback Strategies**: Graceful degradation patterns
- **Retry Policies**: Exponential backoff with jitter
- **Health Checks**: Comprehensive service monitoring

Full specification: [inter-service-communication.yaml](./inter-service-communication.yaml)

## API Gateway Configuration

Kong API Gateway provides:

- **Advanced Routing**: Path-based service routing with load balancing
- **Authentication**: JWT and API key validation
- **Rate Limiting**: Tiered limits based on subscription
- **Security**: CORS, security headers, IP restrictions
- **Monitoring**: Prometheus metrics, distributed tracing
- **Caching**: Response caching for performance

Configuration: [kong-enhanced.yml](./kong-enhanced.yml)

## Authentication & Security

### Authentication Methods
1. **JWT Tokens**: For user-specific operations
2. **API Keys**: For programmatic access
3. **OAuth 2.0**: For third-party integrations

### Security Features
- **Multi-tenancy**: Organization-level isolation
- **Rate Limiting**: Prevents abuse and ensures fair usage
- **Request Validation**: Input sanitization and validation
- **Audit Logging**: Comprehensive activity tracking
- **Encryption**: TLS 1.3 in transit, AES-256 at rest

### Example Authentication
```bash
# JWT Authentication
curl -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..." \
  https://api.imagineer.dev/v1/parser/projects

# API Key Authentication
curl -H "X-API-Key: your-api-key-here" \
  https://api.imagineer.dev/v1/parser/projects
```

## Rate Limiting

### Per-Organization Limits
- **Free Tier**: 1,000 requests/day, 100 translations/month
- **Starter Tier**: 10,000 requests/day, 1,000 translations/month
- **Professional Tier**: 100,000 requests/day, 10,000 translations/month
- **Enterprise Tier**: 1,000,000 requests/day, 100,000 translations/month

### Per-Service Limits
- **Design Parser**: 1,000 requests/minute, 100 file uploads/hour
- **Translation Engine**: 500 requests/minute, 1,000 LLM calls/hour
- **Export Engine**: 800 requests/minute, 200 export jobs/hour
- **Collaboration Hub**: 2,000 requests/minute, 5 WebSocket connections/user

## Error Handling

All APIs follow RFC 7807 Problem Details standard:

```json
{
  "type": "https://docs.imagineer.dev/errors/validation-error",
  "title": "Validation Error",
  "status": 400,
  "detail": "The 'name' field is required",
  "instance": "/api/v1/projects",
  "timestamp": "2024-01-09T12:00:00.000Z",
  "request_id": "123e4567-e89b-12d3-a456-426614174005",
  "error_code": "VALIDATION_ERROR",
  "validation_errors": [
    {
      "field": "name",
      "code": "REQUIRED",
      "message": "Name is required"
    }
  ]
}
```

## API Versioning

- **Strategy**: URI path versioning (`/v1/`, `/v2/`)
- **Current Version**: v1
- **Backward Compatibility**: Required for minor versions
- **Deprecation Policy**: 6 months notice, 12 months support

## Developer Experience

### SDKs Available
- **JavaScript/TypeScript**: `@imagineer/api-client`
- **Python**: `imagineer-api`
- **Go**: `github.com/imagineer/go-sdk`
- **cURL**: Command-line examples

### Documentation
- **Interactive Docs**: https://docs.imagineer.dev
- **API Explorer**: Browser-based testing tool
- **Postman Collection**: Complete API collection
- **Code Examples**: Multi-language samples

### Quick Start
```bash
# Install SDK
npm install @imagineer/api-client

# Use in your app
import { ImagineerClient } from '@imagineer/api-client';

const client = new ImagineerClient({ 
  apiKey: 'your-api-key' 
});

const project = await client.designParser.projects.create({
  name: 'My Project',
  source_tool: 'figma'
});
```

Full developer experience guide: [developer-experience.md](./developer-experience.md)

## Monitoring & Observability

### Metrics (Prometheus)
- Request rates, latencies, error rates
- Service-specific metrics (translation accuracy, export time)
- Business metrics (active users, API usage)

### Tracing (Jaeger)
- Distributed request tracing
- Service dependency mapping
- Performance bottleneck identification

### Logging (Elasticsearch)
- Structured JSON logging
- Request/response correlation
- Error tracking and alerting

### Health Checks
All services expose `/health` endpoints with:
- Service status and version
- Dependency health checks
- Performance metrics
- Environment information

## Performance Targets

- **Response Times**: Sub-100ms for read operations
- **Uptime**: 99.99% availability SLA
- **Throughput**: 10,000+ requests/second sustained
- **Translation Latency**: <30 seconds for standard designs
- **Export Generation**: <10 seconds for most formats

## Deployment

### Environment Configuration
- **Development**: http://localhost:8000
- **Staging**: https://staging-api.imagineer.dev
- **Production**: https://api.imagineer.dev

### Infrastructure
- **Orchestration**: Kubernetes with Helm charts
- **Load Balancing**: Kong API Gateway + NGINX
- **Service Discovery**: Consul
- **Configuration**: Vault for secrets management
- **Storage**: PostgreSQL + Redis + S3

## Getting Started

1. **Review the OpenAPI specifications** for each service
2. **Check the shared schemas** for common data models
3. **Understand inter-service communication** patterns
4. **Configure Kong API Gateway** for your environment
5. **Implement services** using the contracts as specification
6. **Set up monitoring** and observability stack
7. **Deploy and test** the complete platform

## Contributing

When adding new features or modifying APIs:

1. **Update OpenAPI specs** first (contract-first development)
2. **Maintain backward compatibility** for existing versions
3. **Add comprehensive examples** and documentation
4. **Update shared schemas** if creating new common types
5. **Consider inter-service impacts** and event flows
6. **Test with SDK generation** to ensure compatibility

## Support

- **Documentation**: https://docs.imagineer.dev
- **API Issues**: https://github.com/imagineer/api-issues
- **Community**: https://discord.gg/imagineer
- **Support**: api-support@imagineer.dev

---

**Built with architectural excellence by ARQ (Architectural Reasoning Quantum)**  
*Creating tomorrow's systems with today's vision* 🏗️
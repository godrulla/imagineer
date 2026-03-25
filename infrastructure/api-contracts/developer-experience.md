# Imagineer Platform API - Developer Experience Design

## Table of Contents
1. [Documentation Architecture](#documentation-architecture)
2. [Interactive API Documentation](#interactive-api-documentation)
3. [SDK Generation Strategy](#sdk-generation-strategy)
4. [Code Examples & Tutorials](#code-examples--tutorials)
5. [Developer Onboarding](#developer-onboarding)
6. [Testing & Playground](#testing--playground)
7. [Support & Community](#support--community)

## Documentation Architecture

### Site Structure
```
https://docs.imagineer.dev/
├── getting-started/
│   ├── quickstart
│   ├── authentication
│   ├── rate-limits
│   └── environments
├── api-reference/
│   ├── design-parser/
│   ├── translation-engine/
│   ├── export-engine/
│   ├── collaboration-hub/
│   └── shared-schemas/
├── guides/
│   ├── building-integrations/
│   ├── webhooks/
│   ├── real-time-collaboration/
│   └── error-handling/
├── sdks/
│   ├── javascript/
│   ├── python/
│   ├── go/
│   └── curl/
├── tutorials/
│   ├── figma-to-ai-workflow/
│   ├── custom-export-formats/
│   └── collaborative-design-review/
├── resources/
│   ├── changelog/
│   ├── status/
│   └── support/
└── playground/
    ├── api-explorer/
    └── code-generator/
```

### Documentation Stack
- **Static Site Generator**: [Docusaurus](https://docusaurus.io/) with React
- **OpenAPI Integration**: [Redoc](https://redocly.com/) for interactive API docs
- **Code Highlighting**: Prism.js with custom themes
- **Search**: Algolia DocSearch
- **Analytics**: Mixpanel for usage tracking
- **Hosting**: Vercel with global CDN

## Interactive API Documentation

### Redoc Configuration
```yaml
# redoc-config.yaml
redoc:
  theme:
    colors:
      primary:
        main: '#6366F1'      # Imagineer brand color
        light: '#818CF8'
        dark: '#4F46E5'
      success:
        main: '#10B981'
      warning:
        main: '#F59E0B'
      error:
        main: '#EF4444'
    typography:
      fontSize: '16px'
      fontWeightRegular: 400
      fontWeightBold: 600
      fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, sans-serif'
      headings:
        fontFamily: '"Inter", sans-serif'
        fontWeight: 700
    sidebar:
      backgroundColor: '#F8FAFC'
      width: '280px'
      
  options:
    scrollYOffset: 80
    hideDownloadButton: false
    disableSearch: false
    expandResponses: '200,201'
    expandSingleSchemaField: true
    hideHostname: false
    hideLoading: false
    nativeScrollbars: false
    pathInMiddlePanel: true
    requiredPropsFirst: true
    showExtensions: true
    sortPropsAlphabetically: false
    
  customization:
    logo:
      url: 'https://cdn.imagineer.dev/logo.svg'
      altText: 'Imagineer API'
      href: 'https://imagineer.dev'
    favicon: 'https://cdn.imagineer.dev/favicon.ico'
    
  security:
    showSecuritySchemes: true
    
  code_samples:
    - lang: 'curl'
      label: 'cURL'
    - lang: 'javascript'
      label: 'JavaScript'
    - lang: 'python'
      label: 'Python'
    - lang: 'go'
      label: 'Go'
```

### Code Sample Generation
Each endpoint includes auto-generated code samples:

```javascript
// Example: Create Project (JavaScript)
const response = await fetch('https://api.imagineer.dev/v1/parser/projects', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_JWT_TOKEN',
    'Content-Type': 'application/json',
    'X-API-Key': 'YOUR_API_KEY'
  },
  body: JSON.stringify({
    name: 'Mobile App Redesign',
    description: 'Complete redesign of our mobile application',
    source_tool: 'figma',
    source_url: 'https://figma.com/file/abc123',
    team_id: '123e4567-e89b-12d3-a456-426614174003'
  })
});

const project = await response.json();
console.log('Created project:', project);
```

```python
# Example: Create Project (Python)
import requests

url = "https://api.imagineer.dev/v1/parser/projects"
headers = {
    "Authorization": "Bearer YOUR_JWT_TOKEN",
    "Content-Type": "application/json",
    "X-API-Key": "YOUR_API_KEY"
}
data = {
    "name": "Mobile App Redesign",
    "description": "Complete redesign of our mobile application",
    "source_tool": "figma",
    "source_url": "https://figma.com/file/abc123",
    "team_id": "123e4567-e89b-12d3-a456-426614174003"
}

response = requests.post(url, headers=headers, json=data)
project = response.json()
print(f"Created project: {project}")
```

## SDK Generation Strategy

### Automated SDK Generation
Using OpenAPI Generator with custom templates:

```yaml
# sdk-generation.yaml
generators:
  javascript:
    generator: 'typescript-fetch'
    output_dir: 'sdks/javascript'
    package_name: '@imagineer/api-client'
    package_version: '1.0.0'
    config:
      npmName: '@imagineer/api-client'
      npmRepository: 'https://registry.npmjs.org'
      supportsES6: true
      withInterfaces: true
      typescriptThreePlus: true
      
  python:
    generator: 'python'
    output_dir: 'sdks/python'
    package_name: 'imagineer-api'
    package_version: '1.0.0'
    config:
      packageName: 'imagineer_api'
      projectName: 'imagineer-api'
      packageVersion: '1.0.0'
      packageCompany: 'Imagineer'
      packageAuthor: 'Imagineer Platform Team'
      packageEmail: 'api@imagineer.dev'
      packageUrl: 'https://github.com/imagineer/python-sdk'
      
  go:
    generator: 'go'
    output_dir: 'sdks/go'
    package_name: 'imagineer-go'
    config:
      packageName: 'imagineer'
      packageVersion: '1.0.0'
      packageUrl: 'github.com/imagineer/go-sdk'
```

### JavaScript/TypeScript SDK Structure
```typescript
// @imagineer/api-client structure
export class ImagineerClient {
  private apiKey: string;
  private baseURL: string;
  
  public designParser: DesignParserAPI;
  public translationEngine: TranslationEngineAPI;
  public exportEngine: ExportEngineAPI;
  public collaborationHub: CollaborationHubAPI;
  
  constructor(config: ClientConfig) {
    this.apiKey = config.apiKey;
    this.baseURL = config.baseURL || 'https://api.imagineer.dev';
    
    this.designParser = new DesignParserAPI(this);
    this.translationEngine = new TranslationEngineAPI(this);
    this.exportEngine = new ExportEngineAPI(this);
    this.collaborationHub = new CollaborationHubAPI(this);
  }
}

// Usage example
const client = new ImagineerClient({
  apiKey: 'your-api-key',
  baseURL: 'https://api.imagineer.dev'
});

// Create a project
const project = await client.designParser.projects.create({
  name: 'My Project',
  source_tool: 'figma'
});

// Translate design
const translation = await client.translationEngine.translate({
  project_id: project.id,
  llm_provider: 'openai_gpt4',
  user_prompt: 'Convert this design to React components'
});
```

### Python SDK Structure
```python
# imagineer_api package structure
from imagineer_api import ImagineerClient
from imagineer_api.exceptions import ImagineerAPIError

# Initialize client
client = ImagineerClient(
    api_key='your-api-key',
    base_url='https://api.imagineer.dev'
)

# Create project
try:
    project = client.design_parser.projects.create(
        name='My Project',
        source_tool='figma'
    )
    print(f"Created project: {project.id}")
    
    # Translate design
    translation = client.translation_engine.translate(
        project_id=project.id,
        llm_provider='openai_gpt4',
        user_prompt='Convert this design to React components'
    )
    print(f"Translation status: {translation.status}")
    
except ImagineerAPIError as e:
    print(f"API Error: {e.message}")
    print(f"Error Code: {e.code}")
    print(f"Request ID: {e.request_id}")
```

## Code Examples & Tutorials

### Complete Workflow Examples

#### 1. Figma to AI Workflow
```markdown
# Complete Figma to AI Workflow

This tutorial shows how to import a Figma design, translate it to AI prompts, and export in multiple formats.

## Prerequisites
- Imagineer API account
- Figma file URL
- API key

## Step 1: Import Figma Design
\`\`\`javascript
const client = new ImagineerClient({ apiKey: 'your-key' });

// Create project
const project = await client.designParser.projects.create({
  name: 'E-commerce Homepage',
  source_tool: 'figma',
  source_url: 'https://figma.com/file/abc123/homepage',
  auto_sync: true
});

// Import Figma file
const importJob = await client.designParser.figma.import({
  figma_file_key: 'abc123',
  project_id: project.id
});

// Wait for import completion
while (importJob.status === 'processing') {
  await new Promise(resolve => setTimeout(resolve, 2000));
  importJob = await client.designParser.jobs.get(importJob.id);
}
\`\`\`

## Step 2: Translate to AI Prompts
\`\`\`javascript
// Get parsed design
const parsedDesign = await client.designParser.projects.getParsedData(project.id);

// Create translation
const translation = await client.translationEngine.translate({
  project_id: project.id,
  parsed_design_id: parsedDesign.id,
  llm_provider: 'openai_gpt4',
  user_prompt: 'Convert this e-commerce homepage to React components with Tailwind CSS',
  max_tokens: 4000
});
\`\`\`

## Step 3: Export Results
\`\`\`javascript
// Export as markdown
const markdownExport = await client.exportEngine.generate({
  translation_result_id: translation.result_id,
  export_format: 'markdown',
  filename: 'homepage-components.md'
});

// Export as JSON schema
const jsonExport = await client.exportEngine.generate({
  translation_result_id: translation.result_id,
  export_format: 'json',
  filename: 'homepage-schema.json'
});

console.log('Downloads available:');
console.log('Markdown:', markdownExport.download_url);
console.log('JSON:', jsonExport.download_url);
\`\`\`
```

#### 2. Real-time Collaboration Setup
```markdown
# Setting Up Real-time Collaboration

## Step 1: Create Workspace
\`\`\`javascript
const workspace = await client.collaborationHub.workspaces.create({
  name: 'Design Review Session',
  project_id: project.id,
  max_participants: 10,
  is_public: false
});
\`\`\`

## Step 2: Connect WebSocket
\`\`\`javascript
import { io } from 'socket.io-client';

const connectionInfo = await client.collaborationHub.getConnectionInfo();
const socket = io(connectionInfo.websocket_url, {
  auth: {
    token: connectionInfo.connection_token
  }
});

// Join workspace
socket.emit('join_workspace', { workspace_id: workspace.id });

// Listen for real-time events
socket.on('user_joined', (data) => {
  console.log(\`\${data.user_name} joined the workspace\`);
});

socket.on('comment_added', (data) => {
  console.log('New comment:', data.comment);
});

socket.on('cursor_moved', (data) => {
  updateCursorPosition(data.user_id, data.position);
});
\`\`\`

## Step 3: Add Comments
\`\`\`javascript
// Add comment to design element
const comment = await client.collaborationHub.comments.create({
  project_id: project.id,
  design_file_id: file.id,
  element_id: element.id,
  content: 'This button needs more padding',
  annotation: {
    position: { x: 100, y: 200 },
    annotation_type: 'point'
  }
});
\`\`\`
```

### Error Handling Examples
```javascript
// Comprehensive error handling
import { ImagineerAPIError } from '@imagineer/api-client';

try {
  const translation = await client.translationEngine.translate({
    project_id: 'invalid-id',
    llm_provider: 'openai_gpt4',
    user_prompt: 'Convert design'
  });
} catch (error) {
  if (error instanceof ImagineerAPIError) {
    switch (error.code) {
      case 'RESOURCE_NOT_FOUND':
        console.log('Project not found:', error.detail);
        break;
      case 'RATE_LIMIT_EXCEEDED':
        console.log('Rate limit exceeded. Retry after:', error.rate_limit.reset_at);
        break;
      case 'VALIDATION_ERROR':
        console.log('Validation errors:');
        error.validation_errors.forEach(err => {
          console.log(`- ${err.field}: ${err.message}`);
        });
        break;
      default:
        console.log('API Error:', error.message);
    }
    
    // Log for debugging
    console.log('Request ID:', error.request_id);
  } else {
    console.log('Network or other error:', error.message);
  }
}
```

## Developer Onboarding

### Quick Start Guide
```markdown
# 5-Minute Quick Start

Get started with the Imagineer API in 5 minutes.

## 1. Get API Credentials
1. Sign up at [imagineer.dev](https://imagineer.dev)
2. Create an organization
3. Generate API key in Settings > API Keys

## 2. Install SDK
\`\`\`bash
# JavaScript/Node.js
npm install @imagineer/api-client

# Python
pip install imagineer-api

# Go
go get github.com/imagineer/go-sdk
\`\`\`

## 3. Make Your First API Call
\`\`\`javascript
import { ImagineerClient } from '@imagineer/api-client';

const client = new ImagineerClient({
  apiKey: 'your-api-key-here'
});

// Create your first project
const project = await client.designParser.projects.create({
  name: 'My First Project',
  source_tool: 'figma'
});

console.log('Project created:', project.id);
\`\`\`

## 4. Upload a Design File
\`\`\`javascript
const file = await client.designParser.projects.uploadFile(project.id, {
  file: fs.createReadStream('./design.fig'),
  auto_process: true
});

console.log('File uploaded:', file.id);
\`\`\`

## 5. Translate to AI Prompt
\`\`\`javascript
const translation = await client.translationEngine.translate({
  project_id: project.id,
  design_file_id: file.id,
  llm_provider: 'openai_gpt4',
  user_prompt: 'Describe this design in detail'
});

console.log('Translation result:', translation.content);
\`\`\`

**Next Steps:**
- [Explore all API endpoints](./api-reference/)
- [Learn about webhooks](./guides/webhooks/)
- [Set up real-time collaboration](./guides/real-time-collaboration/)
```

### Postman Collection
```json
{
  "info": {
    "name": "Imagineer API",
    "description": "Complete Imagineer API collection with examples",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "auth": {
    "type": "bearer",
    "bearer": [
      {
        "key": "token",
        "value": "{{jwt_token}}",
        "type": "string"
      }
    ]
  },
  "variable": [
    {
      "key": "base_url",
      "value": "https://api.imagineer.dev",
      "type": "string"
    },
    {
      "key": "api_key",
      "value": "your-api-key",
      "type": "string"
    },
    {
      "key": "organization_id",
      "value": "your-org-id",
      "type": "string"
    }
  ],
  "item": [
    {
      "name": "Design Parser",
      "item": [
        {
          "name": "Create Project",
          "request": {
            "method": "POST",
            "header": [
              {
                "key": "X-API-Key",
                "value": "{{api_key}}"
              }
            ],
            "url": "{{base_url}}/v1/parser/projects",
            "body": {
              "mode": "raw",
              "raw": "{\n  \"name\": \"Test Project\",\n  \"source_tool\": \"figma\"\n}"
            }
          }
        }
      ]
    }
  ]
}
```

## Testing & Playground

### API Explorer
Interactive API testing interface:

```html
<!-- API Explorer Component -->
<div class="api-explorer">
  <div class="endpoint-selector">
    <select id="service-select">
      <option value="design-parser">Design Parser</option>
      <option value="translation-engine">Translation Engine</option>
      <option value="export-engine">Export Engine</option>
      <option value="collaboration-hub">Collaboration Hub</option>
    </select>
    
    <select id="endpoint-select">
      <option value="POST /projects">Create Project</option>
      <option value="GET /projects">List Projects</option>
      <option value="GET /projects/{id}">Get Project</option>
    </select>
  </div>
  
  <div class="request-builder">
    <div class="auth-section">
      <label>Authentication:</label>
      <select id="auth-method">
        <option value="jwt">JWT Token</option>
        <option value="api-key">API Key</option>
      </select>
      <input type="password" id="auth-value" placeholder="Enter token/key">
    </div>
    
    <div class="parameters-section">
      <h4>Parameters</h4>
      <div id="path-params"></div>
      <div id="query-params"></div>
      <div id="body-params"></div>
    </div>
    
    <button id="send-request" class="send-btn">Send Request</button>
  </div>
  
  <div class="response-section">
    <div class="response-headers"></div>
    <div class="response-body"></div>
  </div>
</div>
```

### Code Generator
```javascript
// Interactive code generator
class CodeGenerator {
  static generateCurl(endpoint, params, auth) {
    return `curl -X ${endpoint.method} \\
  "${endpoint.url}" \\
  -H "Authorization: Bearer ${auth.token}" \\
  -H "Content-Type: application/json" \\
  -d '${JSON.stringify(params, null, 2)}'`;
  }
  
  static generateJavaScript(endpoint, params, auth) {
    return `const response = await fetch('${endpoint.url}', {
  method: '${endpoint.method}',
  headers: {
    'Authorization': 'Bearer ${auth.token}',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(${JSON.stringify(params, null, 2)})
});

const data = await response.json();
console.log(data);`;
  }
  
  static generatePython(endpoint, params, auth) {
    return `import requests

response = requests.${endpoint.method.toLowerCase()}(
    '${endpoint.url}',
    headers={
        'Authorization': 'Bearer ${auth.token}',
        'Content-Type': 'application/json'
    },
    json=${JSON.stringify(params, null, 2).replace(/"/g, "'")}
)

data = response.json()
print(data)`;
  }
}
```

## Support & Community

### Support Channels
1. **Documentation**: https://docs.imagineer.dev
2. **API Status**: https://status.imagineer.dev
3. **GitHub Issues**: https://github.com/imagineer/api-issues
4. **Discord Community**: https://discord.gg/imagineer
5. **Email Support**: api-support@imagineer.dev

### Community Resources
- **Developer Blog**: https://blog.imagineer.dev/developers
- **API Changelog**: https://docs.imagineer.dev/changelog
- **Sample Applications**: https://github.com/imagineer/examples
- **Stack Overflow**: Tag `imagineer-api`

### Feedback Collection
```javascript
// Embedded feedback widget
class FeedbackWidget {
  constructor() {
    this.feedbackData = {
      page_url: window.location.href,
      user_agent: navigator.userAgent,
      timestamp: new Date().toISOString()
    };
  }
  
  submitFeedback(rating, comment, category) {
    fetch('https://api.imagineer.dev/v1/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...this.feedbackData,
        rating,
        comment,
        category,
        documentation_section: this.getCurrentSection()
      })
    });
  }
}
```

### Success Metrics
- **Documentation Page Views**: Track popular sections
- **API Adoption Rate**: New developers completing quickstart
- **SDK Downloads**: Track SDK usage by language
- **Support Ticket Volume**: Monitor common issues
- **Developer Satisfaction**: Regular NPS surveys
- **Time to First API Call**: Onboarding efficiency metric

This comprehensive developer experience design ensures that developers can quickly understand, integrate, and successfully use the Imagineer Platform APIs while providing them with the tools and support they need to build amazing applications.
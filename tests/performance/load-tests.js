import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('error_rate');
const responseTime = new Trend('response_time');
const requestCount = new Counter('request_count');

// Test configuration
export const options = {
  stages: [
    { duration: '30s', target: 10 },  // Ramp up to 10 users
    { duration: '2m', target: 50 },   // Ramp up to 50 users
    { duration: '5m', target: 100 },  // Peak load with 100 users
    { duration: '2m', target: 50 },   // Scale down to 50 users
    { duration: '30s', target: 0 },   // Ramp down to 0 users
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'], // 95% of requests must complete within 2s
    http_req_failed: ['rate<0.05'],    // Error rate must be less than 5%
    error_rate: ['rate<0.05'],
    response_time: ['p(95)<2000'],
  },
};

// Base configuration
const BASE_URL = __ENV.BASE_URL || 'http://localhost:8090';
const API_TOKEN = __ENV.API_TOKEN || 'test-token';

// Test data
const TEST_USERS = [
  { email: 'load.test1@example.com', password: 'testpassword123' },
  { email: 'load.test2@example.com', password: 'testpassword123' },
  { email: 'load.test3@example.com', password: 'testpassword123' },
];

const FIGMA_FILES = [
  'test-file-1',
  'test-file-2', 
  'test-file-3',
];

// Utility functions
function authenticate() {
  const user = TEST_USERS[Math.floor(Math.random() * TEST_USERS.length)];
  
  const response = http.post(`${BASE_URL}/api/auth/login`, JSON.stringify({
    email: user.email,
    password: user.password
  }), {
    headers: { 'Content-Type': 'application/json' },
  });

  if (response.status === 200) {
    const body = JSON.parse(response.body);
    return body.token;
  }
  
  return null;
}

function createProject(token) {
  const response = http.post(`${BASE_URL}/api/projects`, JSON.stringify({
    name: `Load Test Project ${Date.now()}`,
    description: 'Project created during load testing',
    settings: {
      framework: 'react',
      styling: 'tailwind'
    }
  }), {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
  });

  if (response.status === 201) {
    const body = JSON.parse(response.body);
    return body.project.id;
  }
  
  return null;
}

// Main test scenario
export default function() {
  const token = authenticate();
  
  if (!token) {
    errorRate.add(1);
    return;
  }

  group('Authentication Flow', () => {
    // Test user profile endpoint
    const profileResponse = http.get(`${BASE_URL}/api/auth/me`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    
    check(profileResponse, {
      'profile fetch successful': (r) => r.status === 200,
      'profile response time OK': (r) => r.timings.duration < 500,
    });
    
    responseTime.add(profileResponse.timings.duration);
    requestCount.add(1);
    errorRate.add(profileResponse.status >= 400 ? 1 : 0);
  });

  group('Project Management', () => {
    // List projects
    const projectsResponse = http.get(`${BASE_URL}/api/projects?limit=20`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    
    check(projectsResponse, {
      'projects list successful': (r) => r.status === 200,
      'projects response time OK': (r) => r.timings.duration < 1000,
    });

    responseTime.add(projectsResponse.timings.duration);
    requestCount.add(1);
    errorRate.add(projectsResponse.status >= 400 ? 1 : 0);

    // Create new project
    const projectId = createProject(token);
    
    if (projectId) {
      // Get project details
      const projectResponse = http.get(`${BASE_URL}/api/projects/${projectId}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      
      check(projectResponse, {
        'project detail fetch successful': (r) => r.status === 200,
        'project detail response time OK': (r) => r.timings.duration < 500,
      });

      responseTime.add(projectResponse.timings.duration);
      requestCount.add(1);
      errorRate.add(projectResponse.status >= 400 ? 1 : 0);
    }
  });

  group('Design Parser Workflow', () => {
    const projectId = createProject(token);
    
    if (projectId) {
      const figmaFileId = FIGMA_FILES[Math.floor(Math.random() * FIGMA_FILES.length)];
      
      // Start design analysis
      const analysisResponse = http.post(`${BASE_URL}/api/parser/analyze`, JSON.stringify({
        fileId: figmaFileId,
        projectId: projectId,
        options: {
          includeChildren: true,
          extractStyles: true,
          analysisDepth: 'detailed'
        }
      }), {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
      });
      
      check(analysisResponse, {
        'analysis job created': (r) => r.status === 202,
        'analysis response time OK': (r) => r.timings.duration < 2000,
      });

      responseTime.add(analysisResponse.timings.duration);
      requestCount.add(1);
      errorRate.add(analysisResponse.status >= 400 ? 1 : 0);
      
      if (analysisResponse.status === 202) {
        const body = JSON.parse(analysisResponse.body);
        const jobId = body.jobId;
        
        // Poll job status (simulate realistic polling)
        for (let i = 0; i < 3; i++) {
          sleep(1);
          
          const jobResponse = http.get(`${BASE_URL}/api/parser/jobs/${jobId}`, {
            headers: { 'Authorization': `Bearer ${token}` },
          });
          
          check(jobResponse, {
            'job status fetch successful': (r) => r.status === 200,
          });

          responseTime.add(jobResponse.timings.duration);
          requestCount.add(1);
          errorRate.add(jobResponse.status >= 400 ? 1 : 0);
          
          if (jobResponse.status === 200) {
            const jobData = JSON.parse(jobResponse.body);
            if (jobData.job.status === 'completed') {
              break;
            }
          }
        }
      }
    }
  });

  group('Translation Engine Workflow', () => {
    const projectId = createProject(token);
    
    if (projectId) {
      // Start translation job
      const translationResponse = http.post(`${BASE_URL}/api/translation/translate`, JSON.stringify({
        designId: 'test-design-id',
        targetLLM: 'openai_gpt4',
        format: 'markdown',
        translationType: 'component',
        projectId: projectId,
        options: {
          verbosity: 'detailed',
          includeMetadata: true
        }
      }), {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
      });
      
      check(translationResponse, {
        'translation job created': (r) => r.status === 202,
        'translation response time OK': (r) => r.timings.duration < 3000,
      });

      responseTime.add(translationResponse.timings.duration);
      requestCount.add(1);
      errorRate.add(translationResponse.status >= 400 ? 1 : 0);
    }
  });

  group('Export Engine Workflow', () => {
    const projectId = createProject(token);
    
    if (projectId) {
      // Start export job
      const exportResponse = http.post(`${BASE_URL}/api/export/generate`, JSON.stringify({
        translationId: 'test-translation-id',
        format: 'react_typescript',
        options: {
          framework: 'react',
          styling: 'tailwind',
          includeTests: true
        },
        projectId: projectId
      }), {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
      });
      
      check(exportResponse, {
        'export job created': (r) => r.status === 202,
        'export response time OK': (r) => r.timings.duration < 2000,
      });

      responseTime.add(exportResponse.timings.duration);
      requestCount.add(1);
      errorRate.add(exportResponse.status >= 400 ? 1 : 0);
    }
  });

  group('Health Checks', () => {
    const services = ['parser', 'translation', 'export', 'collaboration'];
    
    services.forEach(service => {
      const healthResponse = http.get(`${BASE_URL}/api/${service}/health`);
      
      check(healthResponse, {
        [`${service} health check OK`]: (r) => r.status === 200,
        [`${service} health response time OK`]: (r) => r.timings.duration < 500,
      });

      responseTime.add(healthResponse.timings.duration);
      requestCount.add(1);
      errorRate.add(healthResponse.status >= 400 ? 1 : 0);
    });
  });

  // Add some realistic user behavior
  sleep(Math.random() * 2 + 1); // Sleep 1-3 seconds between iterations
}

// Setup function - runs once per VU at the start
export function setup() {
  console.log('Starting load test against:', BASE_URL);
  
  // Verify services are running
  const healthResponse = http.get(`${BASE_URL}/api/parser/health`);
  if (healthResponse.status !== 200) {
    throw new Error('Services not available for load testing');
  }
  
  return { timestamp: Date.now() };
}

// Teardown function - runs once after all VUs finish
export function teardown(data) {
  console.log('Load test completed. Started at:', new Date(data.timestamp));
  console.log('Total requests:', requestCount.count);
  console.log('Error rate:', errorRate.rate);
  console.log('Average response time:', responseTime.avg, 'ms');
}

// Handle summary
export function handleSummary(data) {
  return {
    'load-test-results.json': JSON.stringify(data, null, 2),
    'load-test-summary.txt': `
Load Test Summary
=================
Duration: ${data.state.testRunDurationMs}ms
VUs: ${data.metrics.vus.values.max}
Requests: ${data.metrics.http_reqs.values.count}
Request Rate: ${data.metrics.http_reqs.values.rate}/s
Error Rate: ${(data.metrics.http_req_failed.values.rate * 100).toFixed(2)}%
Average Response Time: ${data.metrics.http_req_duration.values.avg.toFixed(2)}ms
95th Percentile: ${data.metrics.http_req_duration.values['p(95)'].toFixed(2)}ms

Thresholds:
- 95% requests < 2000ms: ${data.metrics.http_req_duration.thresholds['p(95)<2000'].ok ? 'PASS' : 'FAIL'}
- Error rate < 5%: ${data.metrics.http_req_failed.thresholds['rate<0.05'].ok ? 'PASS' : 'FAIL'}
`,
  };
}
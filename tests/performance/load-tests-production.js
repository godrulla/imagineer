// K6 Load Testing Suite for Imagineer Platform - Production Ready
// Comprehensive performance testing with realistic user scenarios

import http from 'k6/http';
import ws from 'k6/ws';
import { check, group, sleep, fail } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';
import { randomString, randomItem } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';

// =============================================================================
// CUSTOM METRICS
// =============================================================================

const designImportRate = new Rate('design_import_success_rate');
const translationLatency = new Trend('translation_latency');
const exportLatency = new Trend('export_latency');
const collaborationLatency = new Trend('collaboration_latency');
const websocketConnections = new Counter('websocket_connections');
const apiErrors = new Counter('api_errors');

// =============================================================================
// TEST CONFIGURATION
// =============================================================================

export let options = {
  stages: [
    // Ramp-up: Gradually increase load
    { duration: '2m', target: 10 },   // Warm-up
    { duration: '5m', target: 50 },   // Normal load
    { duration: '10m', target: 100 }, // Peak load
    { duration: '15m', target: 200 }, // Stress load
    { duration: '10m', target: 300 }, // Spike load
    { duration: '5m', target: 100 },  // Recovery
    { duration: '5m', target: 0 },    // Cool down
  ],
  
  thresholds: {
    // HTTP metrics
    'http_req_duration': ['p(95)<2000', 'p(99)<5000'], // 95% < 2s, 99% < 5s
    'http_req_failed': ['rate<0.05'],                   // Error rate < 5%
    'http_reqs': ['rate>10'],                          // Min 10 RPS
    
    // Custom metrics
    'design_import_success_rate': ['rate>0.95'],       // 95% success rate
    'translation_latency': ['p(95)<30000'],            // 95% < 30s
    'export_latency': ['p(95)<10000'],                 // 95% < 10s
    'collaboration_latency': ['p(95)<1000'],           // 95% < 1s
    'websocket_connections': ['count>0'],              // WebSocket health
    'api_errors': ['count<100'],                       // Max 100 errors total
  },
  
  // Test scenarios with different user behaviors
  scenarios: {
    // Scenario 1: Design Import and Translation Pipeline
    design_workflow: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '5m', target: 20 },
        { duration: '20m', target: 20 },
        { duration: '5m', target: 0 },
      ],
      gracefulRampDown: '30s',
      exec: 'designWorkflow',
    },
    
    // Scenario 2: Real-time Collaboration
    collaboration: {
      executor: 'constant-vus',
      vus: 50,
      duration: '30m',
      exec: 'collaborationWorkflow',
    },
    
    // Scenario 3: Export Operations
    export_operations: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      stages: [
        { duration: '5m', target: 5 },
        { duration: '20m', target: 5 },
        { duration: '5m', target: 0 },
      ],
      preAllocatedVUs: 10,
      maxVUs: 50,
      exec: 'exportWorkflow',
    },
    
    // Scenario 4: API Health Monitoring
    health_checks: {
      executor: 'constant-arrival-rate',
      rate: 1,
      timeUnit: '30s',
      duration: '30m',
      preAllocatedVUs: 2,
      exec: 'healthCheck',
    },
  },
};

// =============================================================================
// TEST DATA
// =============================================================================

const BASE_URL = __ENV.BASE_URL || 'https://imagineer.com';
const API_URL = `${BASE_URL}/api/v1`;
const WS_URL = BASE_URL.replace('https://', 'wss://').replace('http://', 'ws://');

const FIGMA_URLS = [
  'https://www.figma.com/file/abc123/Sample-Design-1',
  'https://www.figma.com/file/def456/Sample-Design-2',
  'https://www.figma.com/file/ghi789/Sample-Design-3',
];

const EXPORT_FORMATS = ['markdown', 'json', 'html', 'react', 'yaml'];

const LLM_PROVIDERS = ['openai', 'anthropic', 'google'];

// =============================================================================
// AUTHENTICATION HELPER
// =============================================================================

function authenticate() {
  const loginPayload = {
    email: `loadtest_${randomString(8)}@example.com`,
    password: 'LoadTest123!',
  };
  
  const loginResponse = http.post(`${API_URL}/auth/login`, JSON.stringify(loginPayload), {
    headers: { 'Content-Type': 'application/json' },
  });
  
  if (loginResponse.status === 200) {
    const authData = JSON.parse(loginResponse.body);
    return authData.token;
  }
  
  // Fallback: create account and login
  const registerResponse = http.post(`${API_URL}/auth/register`, JSON.stringify(loginPayload), {
    headers: { 'Content-Type': 'application/json' },
  });
  
  if (registerResponse.status === 201) {
    const loginRetry = http.post(`${API_URL}/auth/login`, JSON.stringify(loginPayload), {
      headers: { 'Content-Type': 'application/json' },
    });
    
    if (loginRetry.status === 200) {
      const authData = JSON.parse(loginRetry.body);
      return authData.token;
    }
  }
  
  fail('Failed to authenticate user');
}

// =============================================================================
// SCENARIO 1: DESIGN WORKFLOW
// =============================================================================

export function designWorkflow() {
  const token = authenticate();
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
  
  group('Design Import and Translation Pipeline', () => {
    // Step 1: Import design from Figma
    group('Import Design', () => {
      const figmaUrl = randomItem(FIGMA_URLS);
      const importPayload = {
        figmaUrl: figmaUrl,
        projectName: `Load Test Project ${randomString(8)}`,
        description: 'Generated by load testing suite',
      };
      
      const importResponse = http.post(
        `${API_URL}/parser/import`,
        JSON.stringify(importPayload),
        { headers }
      );
      
      const importSuccess = check(importResponse, {
        'Design import status is 200 or 202': (r) => [200, 202].includes(r.status),
        'Import response has job ID': (r) => {
          try {
            const body = JSON.parse(r.body);
            return body.jobId !== undefined;
          } catch {
            return false;
          }
        },
      });
      
      designImportRate.add(importSuccess);
      
      if (!importSuccess) {
        apiErrors.add(1);
        return;
      }
      
      const importData = JSON.parse(importResponse.body);
      const jobId = importData.jobId;
      
      // Poll for import completion
      let importComplete = false;
      let attempts = 0;
      const maxAttempts = 30; // 30 seconds max wait
      
      while (!importComplete && attempts < maxAttempts) {
        sleep(1);
        attempts++;
        
        const statusResponse = http.get(`${API_URL}/parser/jobs/${jobId}/status`, { headers });
        
        if (statusResponse.status === 200) {
          const statusData = JSON.parse(statusResponse.body);
          importComplete = statusData.status === 'completed';
          
          if (statusData.status === 'failed') {
            apiErrors.add(1);
            return;
          }
        }
      }
      
      check(importComplete, {
        'Design import completed within timeout': (complete) => complete === true,
      });
    });
    
    sleep(1);
    
    // Step 2: Translate design to LLM prompt
    group('Translate Design', () => {
      const translationPayload = {
        designId: randomString(24), // Mock design ID
        provider: randomItem(LLM_PROVIDERS),
        outputFormat: 'markdown',
        includeAssets: true,
        optimizeForLLM: true,
      };
      
      const translationStart = new Date();
      const translationResponse = http.post(
        `${API_URL}/translation/translate`,
        JSON.stringify(translationPayload),
        { headers }
      );
      
      const translationDuration = new Date() - translationStart;
      translationLatency.add(translationDuration);
      
      check(translationResponse, {
        'Translation status is 200 or 202': (r) => [200, 202].includes(r.status),
        'Translation response has content': (r) => {
          try {
            const body = JSON.parse(r.body);
            return body.content !== undefined || body.jobId !== undefined;
          } catch {
            return false;
          }
        },
      });
      
      if (![200, 202].includes(translationResponse.status)) {
        apiErrors.add(1);
      }
    });
    
    sleep(2);
    
    // Step 3: Export translated content
    group('Export Content', () => {
      const exportPayload = {
        translationId: randomString(24), // Mock translation ID
        format: randomItem(EXPORT_FORMATS),
        includeMetadata: true,
        compressOutput: true,
      };
      
      const exportStart = new Date();
      const exportResponse = http.post(
        `${API_URL}/export/generate`,
        JSON.stringify(exportPayload),
        { headers }
      );
      
      const exportDuration = new Date() - exportStart;
      exportLatency.add(exportDuration);
      
      check(exportResponse, {
        'Export status is 200 or 202': (r) => [200, 202].includes(r.status),
        'Export response has download URL or job ID': (r) => {
          try {
            const body = JSON.parse(r.body);
            return body.downloadUrl !== undefined || body.jobId !== undefined;
          } catch {
            return false;
          }
        },
      });
      
      if (![200, 202].includes(exportResponse.status)) {
        apiErrors.add(1);
      }
    });
  });
  
  sleep(1);
}

// =============================================================================
// SCENARIO 2: COLLABORATION WORKFLOW
// =============================================================================

export function collaborationWorkflow() {
  const token = authenticate();
  
  group('Real-time Collaboration', () => {
    // WebSocket connection for real-time features
    const wsUrl = `${WS_URL}/ws/collaboration?token=${token}`;
    
    const wsResponse = ws.connect(wsUrl, {}, function (socket) {
      websocketConnections.add(1);
      
      socket.on('open', () => {
        // Join a collaboration room
        const joinMessage = {
          type: 'join_room',
          roomId: `room_${randomString(8)}`,
          userId: `user_${randomString(8)}`,
        };
        socket.send(JSON.stringify(joinMessage));
      });
      
      socket.on('message', (data) => {
        const message = JSON.parse(data);
        
        // Measure collaboration latency
        if (message.timestamp) {
          const latency = Date.now() - message.timestamp;
          collaborationLatency.add(latency);
        }
        
        // Simulate user interactions
        if (message.type === 'room_joined') {
          // Send design updates
          const updateMessage = {
            type: 'design_update',
            elementId: randomString(16),
            changes: {
              x: Math.random() * 1000,
              y: Math.random() * 1000,
              width: Math.random() * 200 + 50,
              height: Math.random() * 200 + 50,
            },
            timestamp: Date.now(),
          };
          socket.send(JSON.stringify(updateMessage));
        }
      });
      
      // Keep connection alive for testing duration
      sleep(30);
    });
    
    check(wsResponse, {
      'WebSocket connection established': (r) => r && r.status === 101,
    });
  });
  
  sleep(1);
}

// =============================================================================
// SCENARIO 3: EXPORT WORKFLOW
// =============================================================================

export function exportWorkflow() {
  const token = authenticate();
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
  
  group('Export Operations', () => {
    // Test different export formats
    const format = randomItem(EXPORT_FORMATS);
    
    const exportPayload = {
      designId: randomString(24),
      translationId: randomString(24),
      format: format,
      options: {
        includeAssets: Math.random() > 0.5,
        optimizeOutput: true,
        compressFiles: format !== 'json',
      },
    };
    
    const exportStart = new Date();
    const exportResponse = http.post(
      `${API_URL}/export/generate`,
      JSON.stringify(exportPayload),
      { headers }
    );
    
    const exportDuration = new Date() - exportStart;
    exportLatency.add(exportDuration);
    
    check(exportResponse, {
      'Export request accepted': (r) => [200, 202].includes(r.status),
      'Export response is valid': (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.jobId !== undefined || body.downloadUrl !== undefined;
        } catch {
          return false;
        }
      },
    });
    
    if (![200, 202].includes(exportResponse.status)) {
      apiErrors.add(1);
    }
    
    // If async export, check status
    if (exportResponse.status === 202) {
      const exportData = JSON.parse(exportResponse.body);
      const jobId = exportData.jobId;
      
      // Check export status after a delay
      sleep(5);
      
      const statusResponse = http.get(`${API_URL}/export/jobs/${jobId}/status`, { headers });
      
      check(statusResponse, {
        'Export status check successful': (r) => r.status === 200,
      });
    }
  });
  
  sleep(1);
}

// =============================================================================
// SCENARIO 4: HEALTH CHECK
// =============================================================================

export function healthCheck() {
  group('Health Monitoring', () => {
    // Check all service health endpoints
    const services = ['parser', 'translation', 'export', 'collaboration'];
    
    services.forEach(service => {
      const healthResponse = http.get(`${API_URL}/${service}/health`);
      
      check(healthResponse, {
        [`${service} health check passes`]: (r) => r.status === 200,
        [`${service} responds quickly`]: (r) => r.timings.duration < 1000,
      });
      
      if (healthResponse.status !== 200) {
        apiErrors.add(1);
      }
    });
    
    // Check overall system health
    const systemHealthResponse = http.get(`${API_URL}/health`);
    
    check(systemHealthResponse, {
      'System health check passes': (r) => r.status === 200,
      'System health includes all services': (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.services && Object.keys(body.services).length >= 4;
        } catch {
          return false;
        }
      },
    });
  });
}

// =============================================================================
// SETUP AND TEARDOWN
// =============================================================================

export function setup() {
  console.log('🚀 Starting Imagineer Platform Load Tests');
  console.log(`📊 Target URL: ${BASE_URL}`);
  console.log(`⏱️  Test Duration: ~52 minutes`);
  console.log(`👥 Max Concurrent Users: 300`);
  
  // Warm up the system
  const warmupResponse = http.get(`${BASE_URL}/health`);
  if (warmupResponse.status !== 200) {
    console.warn('⚠️  System health check failed during setup');
  }
  
  return { startTime: new Date() };
}

export function teardown(data) {
  const endTime = new Date();
  const duration = (endTime - data.startTime) / 1000;
  
  console.log('🏁 Load Testing Complete');
  console.log(`📈 Total Duration: ${duration} seconds`);
  console.log('📊 Check the results above for performance metrics');
}
import { beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { setup, teardown, getTestDatabase, getTestRedis } from './global-setup';
import { setupServer } from 'msw/node';
import { mockHandlers } from '../fixtures/mock-handlers';

// MSW server for mocking external APIs
export const mockServer = setupServer(...mockHandlers);

beforeAll(async () => {
  // Start MSW server
  mockServer.listen({ onUnhandledRequest: 'error' });
  
  // Setup test infrastructure
  await setup();
}, 60000);

afterAll(async () => {
  // Stop MSW server
  mockServer.close();
  
  // Teardown test infrastructure
  await teardown();
}, 30000);

beforeEach(async () => {
  // Reset MSW handlers
  mockServer.resetHandlers();
  
  // Clean test database
  await cleanTestDatabase();
  
  // Clear Redis cache
  await clearRedisCache();
});

afterEach(() => {
  // Reset any test state
  mockServer.resetHandlers();
});

async function cleanTestDatabase(): Promise<void> {
  const db = getTestDatabase();
  
  try {
    // Disable foreign key constraints temporarily
    await db.query('SET session_replication_role = replica;');
    
    // Clean all test data (preserve schema)
    const tables = [
      'analytics_events',
      'audit_logs',
      'collaboration_sessions',
      'collaboration_participants',
      'export_jobs',
      'export_templates',
      'translation_jobs', 
      'translation_templates',
      'design_elements',
      'parsed_designs',
      'design_jobs',
      'project_members',
      'projects',
      'user_sessions',
      'users'
    ];
    
    for (const table of tables) {
      await db.query(`TRUNCATE TABLE ${table} RESTART IDENTITY CASCADE;`);
    }
    
    // Re-enable foreign key constraints
    await db.query('SET session_replication_role = DEFAULT;');
    
  } catch (error) {
    console.error('Failed to clean test database:', error);
    throw error;
  }
}

async function clearRedisCache(): Promise<void> {
  const redis = getTestRedis();
  
  try {
    await redis.flushdb();
  } catch (error) {
    console.error('Failed to clear Redis cache:', error);
    throw error;
  }
}

// Test utilities for common operations
export const testUtils = {
  async createTestUser(userData: Partial<any> = {}): Promise<any> {
    const db = getTestDatabase();
    const user = {
      id: `test-user-${Date.now()}`,
      email: `test${Date.now()}@example.com`,
      name: 'Test User',
      role: 'user',
      ...userData
    };
    
    const result = await db.query(
      'INSERT INTO users (id, email, name, role, created_at, updated_at) VALUES ($1, $2, $3, $4, NOW(), NOW()) RETURNING *',
      [user.id, user.email, user.name, user.role]
    );
    
    return result.rows[0];
  },

  async createTestProject(userId: string, projectData: Partial<any> = {}): Promise<any> {
    const db = getTestDatabase();
    const project = {
      id: `test-project-${Date.now()}`,
      name: 'Test Project',
      description: 'A test project',
      owner_id: userId,
      settings: {},
      ...projectData
    };
    
    const result = await db.query(
      'INSERT INTO projects (id, name, description, owner_id, settings, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, NOW(), NOW()) RETURNING *',
      [project.id, project.name, project.description, project.owner_id, JSON.stringify(project.settings)]
    );
    
    return result.rows[0];
  },

  async createTestDesignJob(projectId: string, jobData: Partial<any> = {}): Promise<any> {
    const db = getTestDatabase();
    const job = {
      id: `test-job-${Date.now()}`,
      project_id: projectId,
      figma_file_id: 'test-figma-file',
      figma_node_id: 'test-figma-node',
      status: 'pending',
      configuration: {},
      ...jobData
    };
    
    const result = await db.query(
      'INSERT INTO design_jobs (id, project_id, figma_file_id, figma_node_id, status, configuration, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW()) RETURNING *',
      [job.id, job.project_id, job.figma_file_id, job.figma_node_id, job.status, JSON.stringify(job.configuration)]
    );
    
    return result.rows[0];
  },

  async waitForCondition(
    condition: () => Promise<boolean>,
    timeout: number = 5000,
    interval: number = 100
  ): Promise<void> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      if (await condition()) {
        return;
      }
      await new Promise(resolve => setTimeout(resolve, interval));
    }
    
    throw new Error(`Condition not met within ${timeout}ms`);
  },

  generateMockFigmaData(overrides: any = {}): any {
    return {
      name: 'Test Design',
      id: 'test-figma-id',
      type: 'FRAME',
      absoluteBoundingBox: { x: 0, y: 0, width: 800, height: 600 },
      fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }],
      children: [
        {
          id: 'test-child-1',
          name: 'Test Button',
          type: 'RECTANGLE',
          absoluteBoundingBox: { x: 50, y: 50, width: 120, height: 40 },
          fills: [{ type: 'SOLID', color: { r: 0.2, g: 0.4, b: 0.8 } }]
        }
      ],
      ...overrides
    };
  }
};
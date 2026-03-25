import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { parserRoutes } from '../../../src/routes/parser';
import { errorHandler } from '../../../src/middleware/errorHandler';
import { DatabaseOperations } from '../../../src/database/operations';
import { Pool } from 'pg';

const app = express();
app.use(express.json());
app.use('/api/parser', parserRoutes);
app.use(errorHandler);

describe('Parser API Integration Tests', () => {
  let testDb: Pool;

  beforeAll(async () => {
    // Use test database connection
    testDb = new Pool({
      connectionString: process.env.TEST_DATABASE_URL,
      max: 5,
      idleTimeoutMillis: 10000,
      connectionTimeoutMillis: 5000,
    });

    // Initialize database operations with test DB
    await DatabaseOperations.initialize(testDb);
  });

  afterAll(async () => {
    await testDb.end();
  });

  beforeEach(async () => {
    // Clean test data before each test
    await testDb.query('TRUNCATE TABLE design_jobs, parsed_designs, design_elements RESTART IDENTITY CASCADE;');
  });

  describe('POST /api/parser/analyze', () => {
    it('should successfully analyze a Figma design', async () => {
      const requestBody = {
        fileId: 'test-file-id',
        projectId: 'test-project-id',
        options: {
          includeChildren: true,
          extractStyles: true,
          analysisDepth: 'detailed'
        }
      };

      const response = await request(app)
        .post('/api/parser/analyze')
        .send(requestBody)
        .expect(202);

      expect(response.body).toMatchObject({
        success: true,
        jobId: expect.any(String),
        status: 'processing',
        message: expect.any(String)
      });

      // Verify job was created in database
      const jobResult = await testDb.query(
        'SELECT * FROM design_jobs WHERE id = $1',
        [response.body.jobId]
      );

      expect(jobResult.rows).toHaveLength(1);
      expect(jobResult.rows[0].figma_file_id).toBe(requestBody.fileId);
      expect(jobResult.rows[0].project_id).toBe(requestBody.projectId);
      expect(jobResult.rows[0].status).toBe('pending');
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/parser/analyze')
        .send({})
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: expect.stringContaining('fileId'),
        code: 'VALIDATION_ERROR'
      });
    });

    it('should handle invalid Figma file IDs', async () => {
      const requestBody = {
        fileId: 'error-file',
        projectId: 'test-project-id'
      };

      const response = await request(app)
        .post('/api/parser/analyze')
        .send(requestBody)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: expect.stringContaining('File not found'),
        code: 'FIGMA_API_ERROR'
      });
    });

    it('should handle unauthorized Figma access', async () => {
      const requestBody = {
        fileId: 'unauthorized',
        projectId: 'test-project-id'
      };

      const response = await request(app)
        .post('/api/parser/analyze')
        .send(requestBody)
        .expect(401);

      expect(response.body).toMatchObject({
        success: false,
        error: expect.stringContaining('Invalid token'),
        code: 'AUTHENTICATION_ERROR'
      });
    });

    it('should handle rate limiting from Figma API', async () => {
      const requestBody = {
        fileId: 'rate-limited',
        projectId: 'test-project-id'
      };

      const response = await request(app)
        .post('/api/parser/analyze')
        .send(requestBody)
        .expect(429);

      expect(response.body).toMatchObject({
        success: false,
        error: expect.stringContaining('Rate limit'),
        code: 'RATE_LIMIT_ERROR'
      });
    });

    it('should analyze specific node when nodeId is provided', async () => {
      const requestBody = {
        fileId: 'test-file-id',
        nodeId: 'test-node-id',
        projectId: 'test-project-id',
        options: {
          analysisDepth: 'basic'
        }
      };

      const response = await request(app)
        .post('/api/parser/analyze')
        .send(requestBody)
        .expect(202);

      expect(response.body.success).toBe(true);

      // Verify job includes node ID
      const jobResult = await testDb.query(
        'SELECT * FROM design_jobs WHERE id = $1',
        [response.body.jobId]
      );

      expect(jobResult.rows[0].figma_node_id).toBe(requestBody.nodeId);
    });
  });

  describe('GET /api/parser/jobs/:jobId', () => {
    it('should return job status for existing job', async () => {
      // Create a test job
      const jobResult = await testDb.query(
        `INSERT INTO design_jobs (id, project_id, figma_file_id, status, configuration, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, NOW(), NOW()) RETURNING id`,
        ['test-job-id', 'test-project-id', 'test-file-id', 'processing', JSON.stringify({})]
      );

      const response = await request(app)
        .get('/api/parser/jobs/test-job-id')
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        job: {
          id: 'test-job-id',
          status: 'processing',
          projectId: 'test-project-id',
          figmaFileId: 'test-file-id'
        }
      });
    });

    it('should return 404 for non-existent job', async () => {
      const response = await request(app)
        .get('/api/parser/jobs/non-existent-job')
        .expect(404);

      expect(response.body).toMatchObject({
        success: false,
        error: 'Job not found',
        code: 'JOB_NOT_FOUND'
      });
    });

    it('should return job with results when completed', async () => {
      // Create a completed job with results
      const jobId = 'completed-job-id';
      
      await testDb.query(
        `INSERT INTO design_jobs (id, project_id, figma_file_id, status, configuration, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
        [jobId, 'test-project-id', 'test-file-id', 'completed', JSON.stringify({})]
      );

      await testDb.query(
        `INSERT INTO parsed_designs (id, job_id, figma_file_id, file_name, node_name, analysis_result, metadata, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())`,
        [
          'test-design-id',
          jobId,
          'test-file-id',
          'Test Design',
          'Main Frame',
          JSON.stringify({
            elements: [{ id: 'element1', name: 'Test Element', type: 'RECTANGLE' }],
            designTokens: { colors: {}, typography: {} }
          }),
          JSON.stringify({ confidence: 0.85, processingTime: 1500 })
        ]
      );

      const response = await request(app)
        .get(`/api/parser/jobs/${jobId}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        job: {
          id: jobId,
          status: 'completed',
          result: {
            elements: expect.arrayContaining([
              expect.objectContaining({
                id: 'element1',
                name: 'Test Element'
              })
            ])
          }
        }
      });
    });
  });

  describe('GET /api/parser/jobs', () => {
    it('should return paginated list of jobs for project', async () => {
      const projectId = 'test-project-id';

      // Create multiple test jobs
      for (let i = 1; i <= 5; i++) {
        await testDb.query(
          `INSERT INTO design_jobs (id, project_id, figma_file_id, status, configuration, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
          [`job-${i}`, projectId, `file-${i}`, i % 2 === 0 ? 'completed' : 'processing', JSON.stringify({})]
        );
      }

      const response = await request(app)
        .get('/api/parser/jobs')
        .query({ projectId, limit: 3, offset: 0 })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        jobs: expect.arrayContaining([
          expect.objectContaining({
            projectId,
            status: expect.stringMatching(/^(processing|completed)$/)
          })
        ]),
        pagination: {
          total: 5,
          limit: 3,
          offset: 0,
          hasMore: true
        }
      });

      expect(response.body.jobs).toHaveLength(3);
    });

    it('should filter jobs by status', async () => {
      const projectId = 'filter-test-project';

      // Create jobs with different statuses
      await testDb.query(
        `INSERT INTO design_jobs (id, project_id, figma_file_id, status, configuration, created_at, updated_at)
         VALUES 
         ('completed-job', $1, 'file-1', 'completed', '{}', NOW(), NOW()),
         ('processing-job', $1, 'file-2', 'processing', '{}', NOW(), NOW()),
         ('failed-job', $1, 'file-3', 'failed', '{}', NOW(), NOW())`,
        [projectId]
      );

      const response = await request(app)
        .get('/api/parser/jobs')
        .query({ projectId, status: 'completed' })
        .expect(200);

      expect(response.body.jobs).toHaveLength(1);
      expect(response.body.jobs[0].status).toBe('completed');
    });
  });

  describe('DELETE /api/parser/jobs/:jobId', () => {
    it('should cancel a pending job', async () => {
      const jobId = 'cancel-test-job';

      await testDb.query(
        `INSERT INTO design_jobs (id, project_id, figma_file_id, status, configuration, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
        [jobId, 'test-project-id', 'test-file-id', 'pending', JSON.stringify({})]
      );

      const response = await request(app)
        .delete(`/api/parser/jobs/${jobId}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Job cancelled successfully'
      });

      // Verify job status was updated
      const jobResult = await testDb.query(
        'SELECT status FROM design_jobs WHERE id = $1',
        [jobId]
      );

      expect(jobResult.rows[0].status).toBe('cancelled');
    });

    it('should not cancel a completed job', async () => {
      const jobId = 'completed-cancel-test';

      await testDb.query(
        `INSERT INTO design_jobs (id, project_id, figma_file_id, status, configuration, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
        [jobId, 'test-project-id', 'test-file-id', 'completed', JSON.stringify({})]
      );

      const response = await request(app)
        .delete(`/api/parser/jobs/${jobId}`)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: expect.stringContaining('cannot be cancelled'),
        code: 'INVALID_OPERATION'
      });
    });
  });

  describe('GET /api/parser/designs/:designId', () => {
    it('should return parsed design details', async () => {
      const designId = 'test-design-details';
      const analysisResult = {
        elements: [
          {
            id: 'element1',
            name: 'Primary Button',
            type: 'RECTANGLE',
            classification: { elementType: 'button', confidence: 0.9 }
          }
        ],
        designTokens: {
          colors: { 'primary-blue': '#3366CC' },
          typography: { 'heading-large': { fontFamily: 'Inter', fontSize: 24 } }
        },
        layoutAnalysis: {
          type: 'flexbox',
          patterns: ['horizontal-layout']
        }
      };

      await testDb.query(
        `INSERT INTO design_jobs (id, project_id, figma_file_id, status, configuration, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
        ['job-for-design', 'test-project-id', 'test-file-id', 'completed', JSON.stringify({})]
      );

      await testDb.query(
        `INSERT INTO parsed_designs (id, job_id, figma_file_id, file_name, node_name, analysis_result, metadata, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())`,
        [
          designId,
          'job-for-design',
          'test-file-id',
          'Test Design File',
          'Main Frame',
          JSON.stringify(analysisResult),
          JSON.stringify({ confidence: 0.92, processingTime: 2000 })
        ]
      );

      const response = await request(app)
        .get(`/api/parser/designs/${designId}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        design: {
          id: designId,
          fileName: 'Test Design File',
          nodeName: 'Main Frame',
          analysis: analysisResult,
          metadata: {
            confidence: 0.92,
            processingTime: 2000
          }
        }
      });
    });

    it('should return 404 for non-existent design', async () => {
      const response = await request(app)
        .get('/api/parser/designs/non-existent')
        .expect(404);

      expect(response.body).toMatchObject({
        success: false,
        error: 'Design not found',
        code: 'DESIGN_NOT_FOUND'
      });
    });
  });

  describe('POST /api/parser/webhook', () => {
    it('should handle Figma webhook updates', async () => {
      const webhookPayload = {
        event_type: 'FILE_UPDATE',
        file_key: 'test-file-id',
        timestamp: '2024-01-15T10:00:00Z',
        triggered_by: {
          id: 'user123',
          handle: 'testuser'
        }
      };

      const response = await request(app)
        .post('/api/parser/webhook')
        .send(webhookPayload)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Webhook processed successfully'
      });
    });

    it('should validate webhook payload', async () => {
      const response = await request(app)
        .post('/api/parser/webhook')
        .send({})
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: expect.stringContaining('Invalid webhook payload'),
        code: 'VALIDATION_ERROR'
      });
    });
  });

  describe('GET /api/parser/health', () => {
    it('should return healthy status', async () => {
      const response = await request(app)
        .get('/api/parser/health')
        .expect(200);

      expect(response.body).toMatchObject({
        status: 'healthy',
        timestamp: expect.any(String),
        service: 'design-parser',
        version: expect.any(String),
        dependencies: {
          database: 'connected',
          redis: 'connected',
          figma_api: 'accessible'
        }
      });
    });
  });

  describe('Error handling', () => {
    it('should handle database connection errors gracefully', async () => {
      // Temporarily close the database connection to simulate an error
      await testDb.end();

      const response = await request(app)
        .post('/api/parser/analyze')
        .send({
          fileId: 'test-file-id',
          projectId: 'test-project-id'
        })
        .expect(503);

      expect(response.body).toMatchObject({
        success: false,
        error: expect.stringContaining('service temporarily unavailable'),
        code: 'SERVICE_UNAVAILABLE'
      });

      // Reconnect for cleanup
      testDb = new Pool({
        connectionString: process.env.TEST_DATABASE_URL,
        max: 5
      });
    });

    it('should handle malformed JSON requests', async () => {
      const response = await request(app)
        .post('/api/parser/analyze')
        .set('Content-Type', 'application/json')
        .send('{"invalid": json}')
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: expect.stringContaining('Invalid JSON'),
        code: 'INVALID_REQUEST'
      });
    });

    it('should handle large request payloads', async () => {
      const largePayload = {
        fileId: 'test-file-id',
        projectId: 'test-project-id',
        options: {
          metadata: 'x'.repeat(10 * 1024 * 1024) // 10MB string
        }
      };

      const response = await request(app)
        .post('/api/parser/analyze')
        .send(largePayload)
        .expect(413);

      expect(response.body).toMatchObject({
        success: false,
        error: expect.stringContaining('Payload too large'),
        code: 'PAYLOAD_TOO_LARGE'
      });
    });
  });
});
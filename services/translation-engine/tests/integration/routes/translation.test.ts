import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { translationRoutes } from '../../../src/routes/translation';
import { errorHandler } from '../../../src/middleware/errorHandler';
import { DatabaseOperations } from '../../../src/database/operations';
import { Pool } from 'pg';

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use('/api/translation', translationRoutes);
app.use(errorHandler);

describe('Translation API Integration Tests', () => {
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
    await testDb.query('TRUNCATE TABLE translation_jobs, translation_templates, parsed_designs RESTART IDENTITY CASCADE;');
  });

  describe('POST /api/translation/translate', () => {
    it('should create a translation job successfully', async () => {
      const requestBody = {
        designId: 'test-design-id',
        targetLLM: 'openai_gpt4',
        format: 'markdown',
        translationType: 'component',
        projectId: 'test-project-id',
        options: {
          verbosity: 'detailed',
          includeMetadata: true,
          optimizeForTokens: false
        }
      };

      const response = await request(app)
        .post('/api/translation/translate')
        .send(requestBody)
        .expect(202);

      expect(response.body).toMatchObject({
        success: true,
        jobId: expect.any(String),
        status: 'pending',
        message: expect.stringContaining('Translation job created')
      });

      // Verify job was created in database
      const jobResult = await testDb.query(
        'SELECT * FROM translation_jobs WHERE id = $1',
        [response.body.jobId]
      );

      expect(jobResult.rows).toHaveLength(1);
      expect(jobResult.rows[0].design_id).toBe(requestBody.designId);
      expect(jobResult.rows[0].target_llm).toBe(requestBody.targetLLM);
      expect(jobResult.rows[0].output_format).toBe(requestBody.format);
      expect(jobResult.rows[0].status).toBe('pending');
    });

    it('should validate required fields', async () => {
      const invalidRequests = [
        {}, // Empty request
        { designId: 'test' }, // Missing targetLLM
        { designId: 'test', targetLLM: 'openai_gpt4' }, // Missing format
        { designId: 'test', targetLLM: 'openai_gpt4', format: 'markdown' }, // Missing translationType
      ];

      for (const request of invalidRequests) {
        const response = await request(app)
          .post('/api/translation/translate')
          .send(request)
          .expect(400);

        expect(response.body).toMatchObject({
          success: false,
          error: expect.any(String),
          code: 'VALIDATION_ERROR'
        });
      }
    });

    it('should validate LLM provider support', async () => {
      const requestBody = {
        designId: 'test-design-id',
        targetLLM: 'invalid_provider',
        format: 'markdown',
        translationType: 'component',
        projectId: 'test-project-id'
      };

      const response = await request(app)
        .post('/api/translation/translate')
        .send(requestBody)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: expect.stringContaining('Unsupported LLM provider'),
        code: 'INVALID_PROVIDER'
      });
    });

    it('should handle custom system and user prompts', async () => {
      const requestBody = {
        designId: 'test-design-id',
        targetLLM: 'anthropic_claude',
        format: 'json',
        translationType: 'component',
        projectId: 'test-project-id',
        systemPrompt: 'You are a specialized React component generator.',
        userPrompt: 'Generate a React component from this design with TypeScript.',
        options: {
          customInstructions: 'Use styled-components for styling'
        }
      };

      const response = await request(app)
        .post('/api/translation/translate')
        .send(requestBody)
        .expect(202);

      expect(response.body.success).toBe(true);

      // Verify job configuration includes custom prompts
      const jobResult = await testDb.query(
        'SELECT configuration FROM translation_jobs WHERE id = $1',
        [response.body.jobId]
      );

      const config = jobResult.rows[0].configuration;
      expect(config.systemPrompt).toBe(requestBody.systemPrompt);
      expect(config.userPrompt).toBe(requestBody.userPrompt);
      expect(config.options.customInstructions).toBe('Use styled-components for styling');
    });

    it('should create batch translation jobs', async () => {
      const requestBody = {
        batch: [
          {
            designId: 'design-1',
            targetLLM: 'openai_gpt4',
            format: 'markdown',
            translationType: 'component'
          },
          {
            designId: 'design-2',
            targetLLM: 'anthropic_claude',
            format: 'json',
            translationType: 'full'
          },
          {
            designId: 'design-3',
            targetLLM: 'google_gemini',
            format: 'yaml',
            translationType: 'element'
          }
        ],
        projectId: 'test-project-id'
      };

      const response = await request(app)
        .post('/api/translation/translate')
        .send(requestBody)
        .expect(202);

      expect(response.body).toMatchObject({
        success: true,
        batchId: expect.any(String),
        jobs: expect.arrayContaining([
          expect.objectContaining({ jobId: expect.any(String) }),
          expect.objectContaining({ jobId: expect.any(String) }),
          expect.objectContaining({ jobId: expect.any(String) })
        ])
      });

      // Verify all jobs were created
      const jobsResult = await testDb.query(
        'SELECT * FROM translation_jobs WHERE batch_id = $1',
        [response.body.batchId]
      );

      expect(jobsResult.rows).toHaveLength(3);
    });
  });

  describe('GET /api/translation/jobs/:jobId', () => {
    it('should return job status for existing job', async () => {
      // Create a test job
      const jobResult = await testDb.query(
        `INSERT INTO translation_jobs (id, design_id, target_llm, output_format, translation_type, status, configuration, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW()) RETURNING id`,
        ['test-job-id', 'test-design-id', 'openai_gpt4', 'markdown', 'component', 'processing', JSON.stringify({})]
      );

      const response = await request(app)
        .get('/api/translation/jobs/test-job-id')
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        job: {
          id: 'test-job-id',
          status: 'processing',
          designId: 'test-design-id',
          targetLLM: 'openai_gpt4',
          format: 'markdown',
          translationType: 'component'
        }
      });
    });

    it('should return completed job with results', async () => {
      const jobId = 'completed-job-id';
      const translationResult = {
        content: '# Primary Button Component\n\nA primary action button for user interactions.',
        metadata: {
          provider: 'openai_gpt4',
          model: 'gpt-4-turbo-preview',
          usage: { totalTokens: 250 },
          cost: 0.0125,
          responseTime: 1500,
          confidence: 0.92
        }
      };

      // Create completed job
      await testDb.query(
        `INSERT INTO translation_jobs (id, design_id, target_llm, output_format, translation_type, status, configuration, result, metadata, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())`,
        [
          jobId,
          'test-design-id',
          'openai_gpt4',
          'markdown',
          'component',
          'completed',
          JSON.stringify({}),
          JSON.stringify(translationResult),
          JSON.stringify({ processingTime: 2000 })
        ]
      );

      const response = await request(app)
        .get(`/api/translation/jobs/${jobId}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        job: {
          id: jobId,
          status: 'completed',
          result: translationResult
        }
      });
    });

    it('should return 404 for non-existent job', async () => {
      const response = await request(app)
        .get('/api/translation/jobs/non-existent')
        .expect(404);

      expect(response.body).toMatchObject({
        success: false,
        error: 'Translation job not found',
        code: 'JOB_NOT_FOUND'
      });
    });

    it('should include progress information for processing jobs', async () => {
      const jobId = 'processing-job-id';

      await testDb.query(
        `INSERT INTO translation_jobs (id, design_id, target_llm, output_format, translation_type, status, configuration, progress, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())`,
        [
          jobId,
          'test-design-id',
          'anthropic_claude',
          'json',
          'full',
          'processing',
          JSON.stringify({}),
          JSON.stringify({
            stage: 'llm_generation',
            percentage: 75,
            estimatedTimeRemaining: 30000,
            stagesCompleted: ['validation', 'prompt_generation'],
            currentStage: 'llm_generation'
          })
        ]
      );

      const response = await request(app)
        .get(`/api/translation/jobs/${jobId}`)
        .expect(200);

      expect(response.body.job.progress).toMatchObject({
        stage: 'llm_generation',
        percentage: 75,
        estimatedTimeRemaining: 30000
      });
    });
  });

  describe('GET /api/translation/jobs', () => {
    it('should return paginated list of jobs for project', async () => {
      const projectId = 'test-project-id';

      // Create multiple test jobs
      for (let i = 1; i <= 5; i++) {
        await testDb.query(
          `INSERT INTO translation_jobs (id, design_id, target_llm, output_format, translation_type, status, configuration, project_id, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())`,
          [
            `job-${i}`,
            `design-${i}`,
            'openai_gpt4',
            'markdown',
            'component',
            i % 2 === 0 ? 'completed' : 'processing',
            JSON.stringify({}),
            projectId
          ]
        );
      }

      const response = await request(app)
        .get('/api/translation/jobs')
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

    it('should filter jobs by status and LLM provider', async () => {
      const projectId = 'filter-test-project';

      // Create jobs with different statuses and providers
      await testDb.query(
        `INSERT INTO translation_jobs (id, design_id, target_llm, output_format, translation_type, status, configuration, project_id, created_at, updated_at)
         VALUES 
         ('openai-completed', 'design-1', 'openai_gpt4', 'markdown', 'component', 'completed', '{}', $1, NOW(), NOW()),
         ('claude-processing', 'design-2', 'anthropic_claude', 'json', 'full', 'processing', '{}', $1, NOW(), NOW()),
         ('gemini-failed', 'design-3', 'google_gemini', 'yaml', 'element', 'failed', '{}', $1, NOW(), NOW())`,
        [projectId]
      );

      // Filter by status
      const statusResponse = await request(app)
        .get('/api/translation/jobs')
        .query({ projectId, status: 'completed' })
        .expect(200);

      expect(statusResponse.body.jobs).toHaveLength(1);
      expect(statusResponse.body.jobs[0].status).toBe('completed');

      // Filter by provider
      const providerResponse = await request(app)
        .get('/api/translation/jobs')
        .query({ projectId, targetLLM: 'anthropic_claude' })
        .expect(200);

      expect(providerResponse.body.jobs).toHaveLength(1);
      expect(providerResponse.body.jobs[0].targetLLM).toBe('anthropic_claude');
    });
  });

  describe('POST /api/translation/jobs/:jobId/retry', () => {
    it('should retry a failed job', async () => {
      const jobId = 'failed-job';

      // Create a failed job
      await testDb.query(
        `INSERT INTO translation_jobs (id, design_id, target_llm, output_format, translation_type, status, configuration, error_message, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())`,
        [
          jobId,
          'test-design-id',
          'openai_gpt4',
          'markdown',
          'component',
          'failed',
          JSON.stringify({}),
          'Rate limit exceeded'
        ]
      );

      const response = await request(app)
        .post(`/api/translation/jobs/${jobId}/retry`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Job retry initiated',
        jobId: jobId
      });

      // Verify job status was updated
      const jobResult = await testDb.query(
        'SELECT status, retry_count FROM translation_jobs WHERE id = $1',
        [jobId]
      );

      expect(jobResult.rows[0].status).toBe('pending');
      expect(jobResult.rows[0].retry_count).toBe(1);
    });

    it('should not retry a completed job', async () => {
      const jobId = 'completed-job';

      await testDb.query(
        `INSERT INTO translation_jobs (id, design_id, target_llm, output_format, translation_type, status, configuration, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())`,
        [jobId, 'test-design-id', 'openai_gpt4', 'markdown', 'component', 'completed', JSON.stringify({})]
      );

      const response = await request(app)
        .post(`/api/translation/jobs/${jobId}/retry`)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: expect.stringContaining('cannot be retried'),
        code: 'INVALID_OPERATION'
      });
    });

    it('should limit retry attempts', async () => {
      const jobId = 'max-retries-job';

      // Create a job that has already been retried maximum times
      await testDb.query(
        `INSERT INTO translation_jobs (id, design_id, target_llm, output_format, translation_type, status, configuration, retry_count, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())`,
        [jobId, 'test-design-id', 'openai_gpt4', 'markdown', 'component', 'failed', JSON.stringify({}), 3]
      );

      const response = await request(app)
        .post(`/api/translation/jobs/${jobId}/retry`)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: expect.stringContaining('Maximum retry attempts'),
        code: 'MAX_RETRIES_EXCEEDED'
      });
    });
  });

  describe('DELETE /api/translation/jobs/:jobId', () => {
    it('should cancel a pending job', async () => {
      const jobId = 'cancel-test-job';

      await testDb.query(
        `INSERT INTO translation_jobs (id, design_id, target_llm, output_format, translation_type, status, configuration, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())`,
        [jobId, 'test-design-id', 'openai_gpt4', 'markdown', 'component', 'pending', JSON.stringify({})]
      );

      const response = await request(app)
        .delete(`/api/translation/jobs/${jobId}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Translation job cancelled successfully'
      });

      // Verify job status was updated
      const jobResult = await testDb.query(
        'SELECT status FROM translation_jobs WHERE id = $1',
        [jobId]
      );

      expect(jobResult.rows[0].status).toBe('cancelled');
    });
  });

  describe('GET /api/translation/providers', () => {
    it('should return available LLM providers', async () => {
      const response = await request(app)
        .get('/api/translation/providers')
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        providers: expect.arrayContaining([
          expect.objectContaining({
            provider: 'openai_gpt4',
            name: expect.any(String),
            model: 'gpt-4-turbo-preview',
            available: expect.any(Boolean),
            capabilities: expect.objectContaining({
              maxContextLength: expect.any(Number),
              supportsSystemPrompt: expect.any(Boolean)
            }),
            pricing: expect.objectContaining({
              inputTokensPer1K: expect.any(Number),
              outputTokensPer1K: expect.any(Number)
            })
          })
        ])
      });
    });

    it('should include provider health status', async () => {
      const response = await request(app)
        .get('/api/translation/providers')
        .expect(200);

      response.body.providers.forEach((provider: any) => {
        expect(provider).toHaveProperty('available');
        expect(provider).toHaveProperty('lastHealthCheck');
        expect(provider).toHaveProperty('currentLoad');
      });
    });
  });

  describe('POST /api/translation/providers/:provider/test', () => {
    it('should test provider connectivity', async () => {
      const response = await request(app)
        .post('/api/translation/providers/openai_gpt4/test')
        .send({ prompt: 'Test message' })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        provider: 'openai_gpt4',
        responseTime: expect.any(Number),
        response: expect.any(String)
      });
    });

    it('should handle provider test failures', async () => {
      // Test with a custom error case that triggers our mock error
      const response = await request(app)
        .post('/api/translation/providers/openai_gpt4/test')
        .send({ prompt: 'error-test message' })
        .expect(500);

      expect(response.body).toMatchObject({
        success: false,
        provider: 'openai_gpt4',
        error: expect.any(String)
      });
    });
  });

  describe('GET /api/translation/templates', () => {
    it('should return available translation templates', async () => {
      // Create test templates
      await testDb.query(
        `INSERT INTO translation_templates (id, name, description, system_prompt, user_prompt_template, output_format, target_llm, variables, metadata, created_at, updated_at)
         VALUES 
         ('react-component', 'React Component Template', 'Generate React components', 'You are a React expert', 'Generate {{componentType}} component', 'markdown', 'openai_gpt4', '{"componentType": "button"}', '{}', NOW(), NOW()),
         ('vue-component', 'Vue Component Template', 'Generate Vue components', 'You are a Vue expert', 'Generate {{componentType}} component', 'json', 'anthropic_claude', '{"componentType": "card"}', '{}', NOW(), NOW())`
      );

      const response = await request(app)
        .get('/api/translation/templates')
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        templates: expect.arrayContaining([
          expect.objectContaining({
            id: 'react-component',
            name: 'React Component Template',
            description: 'Generate React components',
            outputFormat: 'markdown',
            targetLLM: 'openai_gpt4'
          }),
          expect.objectContaining({
            id: 'vue-component',
            name: 'Vue Component Template'
          })
        ])
      });
    });

    it('should filter templates by format and provider', async () => {
      // Create diverse templates
      await testDb.query(
        `INSERT INTO translation_templates (id, name, description, system_prompt, user_prompt_template, output_format, target_llm, variables, metadata, created_at, updated_at)
         VALUES 
         ('markdown-openai', 'Markdown OpenAI', 'Test template', 'System', 'User', 'markdown', 'openai_gpt4', '{}', '{}', NOW(), NOW()),
         ('json-claude', 'JSON Claude', 'Test template', 'System', 'User', 'json', 'anthropic_claude', '{}', '{}', NOW(), NOW()),
         ('yaml-gemini', 'YAML Gemini', 'Test template', 'System', 'User', 'yaml', 'google_gemini', '{}', '{}', NOW(), NOW())`
      );

      // Filter by format
      const formatResponse = await request(app)
        .get('/api/translation/templates')
        .query({ format: 'json' })
        .expect(200);

      expect(formatResponse.body.templates).toHaveLength(1);
      expect(formatResponse.body.templates[0].outputFormat).toBe('json');

      // Filter by provider
      const providerResponse = await request(app)
        .get('/api/translation/templates')
        .query({ targetLLM: 'openai_gpt4' })
        .expect(200);

      expect(providerResponse.body.templates).toHaveLength(1);
      expect(providerResponse.body.templates[0].targetLLM).toBe('openai_gpt4');
    });
  });

  describe('GET /api/translation/statistics', () => {
    it('should return translation statistics', async () => {
      // Create test jobs with various statuses
      await testDb.query(
        `INSERT INTO translation_jobs (id, design_id, target_llm, output_format, translation_type, status, configuration, metadata, created_at, updated_at)
         VALUES 
         ('stat-job-1', 'design-1', 'openai_gpt4', 'markdown', 'component', 'completed', '{}', '{"cost": 0.05, "tokens": 500}', NOW(), NOW()),
         ('stat-job-2', 'design-2', 'anthropic_claude', 'json', 'full', 'completed', '{}', '{"cost": 0.03, "tokens": 300}', NOW(), NOW()),
         ('stat-job-3', 'design-3', 'google_gemini', 'yaml', 'element', 'processing', '{}', '{}', NOW(), NOW()),
         ('stat-job-4', 'design-4', 'openai_gpt4', 'markdown', 'component', 'failed', '{}', '{}', NOW(), NOW())`
      );

      const response = await request(app)
        .get('/api/translation/statistics')
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        statistics: {
          total: {
            jobs: 4,
            completed: 2,
            processing: 1,
            failed: 1,
            totalCost: 0.08,
            totalTokens: 800
          },
          byProvider: expect.objectContaining({
            openai_gpt4: expect.objectContaining({
              jobs: 2,
              completed: 1,
              failed: 1
            }),
            anthropic_claude: expect.objectContaining({
              jobs: 1,
              completed: 1
            })
          }),
          byFormat: expect.objectContaining({
            markdown: 2,
            json: 1,
            yaml: 1
          })
        }
      });
    });
  });

  describe('GET /api/translation/health', () => {
    it('should return service health status', async () => {
      const response = await request(app)
        .get('/api/translation/health')
        .expect(200);

      expect(response.body).toMatchObject({
        status: 'healthy',
        timestamp: expect.any(String),
        service: 'translation-engine',
        version: expect.any(String),
        dependencies: {
          database: 'connected',
          redis: 'connected',
          llmProviders: expect.objectContaining({
            openai_gpt4: expect.any(String),
            anthropic_claude: expect.any(String),
            google_gemini: expect.any(String)
          })
        }
      });
    });
  });

  describe('Error handling', () => {
    it('should handle database connection errors', async () => {
      // Temporarily close the database connection
      await testDb.end();

      const response = await request(app)
        .post('/api/translation/translate')
        .send({
          designId: 'test-design-id',
          targetLLM: 'openai_gpt4',
          format: 'markdown',
          translationType: 'component'
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
        .post('/api/translation/translate')
        .set('Content-Type', 'application/json')
        .send('{"invalid": json}')
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: expect.stringContaining('Invalid JSON'),
        code: 'INVALID_REQUEST'
      });
    });

    it('should handle request payload size limits', async () => {
      const largePayload = {
        designId: 'test-design-id',
        targetLLM: 'openai_gpt4',
        format: 'markdown',
        translationType: 'component',
        context: {
          largeData: 'x'.repeat(15 * 1024 * 1024) // 15MB string
        }
      };

      const response = await request(app)
        .post('/api/translation/translate')
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
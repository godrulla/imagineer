import { http, HttpResponse } from 'msw';

export const mockHandlers = [
  // Auth endpoints
  http.post('/api/auth/login', async ({ request }) => {
    const body = await request.json() as any;
    
    if (body.email === 'test@example.com' && body.password === 'password') {
      return HttpResponse.json({
        success: true,
        user: {
          id: 'user-123',
          email: 'test@example.com',
          name: 'Test User',
          role: 'user'
        },
        token: 'mock-jwt-token',
        expiresAt: Date.now() + 3600000
      });
    }
    
    return HttpResponse.json(
      { success: false, error: 'Invalid credentials' },
      { status: 401 }
    );
  }),

  http.post('/api/auth/register', async ({ request }) => {
    const body = await request.json() as any;
    
    return HttpResponse.json({
      success: true,
      user: {
        id: 'user-new',
        email: body.email,
        name: body.name,
        role: 'user'
      },
      token: 'mock-jwt-token'
    });
  }),

  http.post('/api/auth/logout', () => {
    return HttpResponse.json({ success: true });
  }),

  http.get('/api/auth/me', ({ request }) => {
    const authHeader = request.headers.get('Authorization');
    
    if (authHeader?.includes('mock-jwt-token')) {
      return HttpResponse.json({
        success: true,
        user: {
          id: 'user-123',
          email: 'test@example.com',
          name: 'Test User',
          role: 'user'
        }
      });
    }
    
    return HttpResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }),

  // Projects endpoints
  http.get('/api/projects', ({ request }) => {
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '10');
    
    const projects = Array.from({ length: 25 }, (_, i) => ({
      id: `project-${i + 1}`,
      name: `Project ${i + 1}`,
      description: `Description for project ${i + 1}`,
      status: i % 3 === 0 ? 'active' : 'draft',
      createdAt: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(Date.now() - i * 12 * 60 * 60 * 1000).toISOString(),
      memberCount: Math.floor(Math.random() * 10) + 1,
      designCount: Math.floor(Math.random() * 20) + 1
    }));
    
    const start = (page - 1) * limit;
    const end = start + limit;
    const paginatedProjects = projects.slice(start, end);
    
    return HttpResponse.json({
      success: true,
      projects: paginatedProjects,
      pagination: {
        page,
        limit,
        total: projects.length,
        totalPages: Math.ceil(projects.length / limit),
        hasNext: end < projects.length,
        hasPrev: page > 1
      }
    });
  }),

  http.post('/api/projects', async ({ request }) => {
    const body = await request.json() as any;
    
    return HttpResponse.json({
      success: true,
      project: {
        id: `project-${Date.now()}`,
        name: body.name,
        description: body.description,
        status: 'draft',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        memberCount: 1,
        designCount: 0,
        settings: body.settings || {}
      }
    }, { status: 201 });
  }),

  http.get('/api/projects/:projectId', ({ params }) => {
    const { projectId } = params;
    
    return HttpResponse.json({
      success: true,
      project: {
        id: projectId,
        name: `Project ${projectId}`,
        description: `Detailed description for ${projectId}`,
        status: 'active',
        createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date().toISOString(),
        memberCount: 3,
        designCount: 12,
        settings: {
          framework: 'react',
          styling: 'tailwind',
          defaultLLM: 'openai_gpt4'
        }
      }
    });
  }),

  // Design Parser endpoints
  http.post('/api/parser/analyze', async ({ request }) => {
    const body = await request.json() as any;
    
    if (body.fileId === 'error-file') {
      return HttpResponse.json(
        { success: false, error: 'File not found', code: 'FIGMA_API_ERROR' },
        { status: 400 }
      );
    }
    
    return HttpResponse.json({
      success: true,
      jobId: `job-${Date.now()}`,
      status: 'processing',
      message: 'Design analysis job created successfully'
    }, { status: 202 });
  }),

  http.get('/api/parser/jobs/:jobId', ({ params }) => {
    const { jobId } = params;
    
    if (jobId === 'completed-job') {
      return HttpResponse.json({
        success: true,
        job: {
          id: jobId,
          status: 'completed',
          projectId: 'test-project',
          figmaFileId: 'test-file',
          result: {
            elements: [
              {
                id: 'element-1',
                name: 'Primary Button',
                type: 'RECTANGLE',
                classification: { elementType: 'button', confidence: 0.95 }
              }
            ],
            designTokens: {
              colors: { primary: '#3366CC' },
              typography: { button: { fontFamily: 'Inter', fontSize: 16 } }
            }
          },
          createdAt: new Date().toISOString(),
          completedAt: new Date().toISOString()
        }
      });
    }
    
    return HttpResponse.json({
      success: true,
      job: {
        id: jobId,
        status: 'processing',
        projectId: 'test-project',
        figmaFileId: 'test-file',
        progress: {
          stage: 'analysis',
          percentage: 65,
          estimatedTimeRemaining: 30000
        },
        createdAt: new Date().toISOString()
      }
    });
  }),

  // Translation Engine endpoints
  http.post('/api/translation/translate', async ({ request }) => {
    const body = await request.json() as any;
    
    return HttpResponse.json({
      success: true,
      jobId: `translation-job-${Date.now()}`,
      status: 'pending',
      message: 'Translation job created successfully'
    }, { status: 202 });
  }),

  http.get('/api/translation/jobs/:jobId', ({ params }) => {
    const { jobId } = params;
    
    if (jobId.includes('completed')) {
      return HttpResponse.json({
        success: true,
        job: {
          id: jobId,
          status: 'completed',
          designId: 'test-design',
          targetLLM: 'openai_gpt4',
          format: 'markdown',
          result: {
            content: '# Primary Button Component\n\nA modern, accessible button component.',
            metadata: {
              provider: 'openai_gpt4',
              cost: 0.025,
              tokens: 500,
              confidence: 0.92
            }
          },
          createdAt: new Date().toISOString(),
          completedAt: new Date().toISOString()
        }
      });
    }
    
    return HttpResponse.json({
      success: true,
      job: {
        id: jobId,
        status: 'processing',
        designId: 'test-design',
        targetLLM: 'openai_gpt4',
        format: 'markdown',
        progress: {
          stage: 'llm_generation',
          percentage: 80,
          estimatedTimeRemaining: 15000
        },
        createdAt: new Date().toISOString()
      }
    });
  }),

  http.get('/api/translation/providers', () => {
    return HttpResponse.json({
      success: true,
      providers: [
        {
          provider: 'openai_gpt4',
          name: 'OpenAI GPT-4 Turbo',
          model: 'gpt-4-turbo-preview',
          available: true,
          capabilities: {
            maxContextLength: 128000,
            supportsSystemPrompt: true,
            supportsStreaming: true
          },
          pricing: {
            inputTokensPer1K: 0.01,
            outputTokensPer1K: 0.03
          }
        },
        {
          provider: 'anthropic_claude',
          name: 'Anthropic Claude-3 Sonnet',
          model: 'claude-3-sonnet-20240229',
          available: true,
          capabilities: {
            maxContextLength: 200000,
            supportsSystemPrompt: true,
            supportsStreaming: true
          },
          pricing: {
            inputTokensPer1K: 0.003,
            outputTokensPer1K: 0.015
          }
        }
      ]
    });
  }),

  // Export Engine endpoints
  http.post('/api/export/generate', async ({ request }) => {
    const body = await request.json() as any;
    
    return HttpResponse.json({
      success: true,
      jobId: `export-job-${Date.now()}`,
      status: 'pending',
      message: 'Export job created successfully'
    }, { status: 202 });
  }),

  http.get('/api/export/jobs/:jobId', ({ params }) => {
    const { jobId } = params;
    
    if (jobId.includes('completed')) {
      return HttpResponse.json({
        success: true,
        job: {
          id: jobId,
          status: 'completed',
          format: 'zip',
          downloadUrl: '/api/export/download/' + jobId,
          files: [
            { name: 'components/Button.tsx', size: 1024 },
            { name: 'styles/globals.css', size: 512 },
            { name: 'README.md', size: 256 }
          ],
          createdAt: new Date().toISOString(),
          completedAt: new Date().toISOString()
        }
      });
    }
    
    return HttpResponse.json({
      success: true,
      job: {
        id: jobId,
        status: 'processing',
        format: 'zip',
        progress: {
          stage: 'generation',
          percentage: 45,
          estimatedTimeRemaining: 60000
        },
        createdAt: new Date().toISOString()
      }
    });
  }),

  // Collaboration Hub endpoints
  http.get('/api/collaboration/sessions/:projectId', ({ params }) => {
    const { projectId } = params;
    
    return HttpResponse.json({
      success: true,
      session: {
        id: `session-${projectId}`,
        projectId,
        participants: [
          {
            id: 'user-123',
            name: 'Test User',
            role: 'owner',
            cursor: { x: 100, y: 150 },
            isActive: true,
            joinedAt: new Date().toISOString()
          }
        ],
        createdAt: new Date().toISOString()
      }
    });
  }),

  // Health check endpoints
  http.get('/api/*/health', () => {
    return HttpResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: Math.floor(Math.random() * 3600)
    });
  }),

  // Error simulation
  http.get('/api/error/500', () => {
    return HttpResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }),

  http.get('/api/error/timeout', () => {
    return new Promise(() => {}); // Never resolves, simulates timeout
  }),

  // Fallback handler
  http.all('*', ({ request }) => {
    console.warn(`Unhandled ${request.method} request to ${request.url}`);
    return new HttpResponse(null, { status: 404 });
  })
];
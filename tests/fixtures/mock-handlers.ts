import { http, HttpResponse } from 'msw';

export const mockHandlers = [
  // Figma API mocks
  http.get('https://api.figma.com/v1/files/:fileId', ({ params }) => {
    const { fileId } = params;
    
    return HttpResponse.json({
      document: {
        id: fileId,
        name: 'Mock Figma File',
        type: 'DOCUMENT',
        children: [
          {
            id: 'page1',
            name: 'Page 1',
            type: 'CANVAS',
            children: [
              {
                id: 'frame1',
                name: 'Main Frame',
                type: 'FRAME',
                absoluteBoundingBox: { x: 0, y: 0, width: 800, height: 600 },
                fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }],
                children: [
                  {
                    id: 'button1',
                    name: 'Primary Button',
                    type: 'RECTANGLE',
                    absoluteBoundingBox: { x: 50, y: 50, width: 120, height: 40 },
                    fills: [{ type: 'SOLID', color: { r: 0.2, g: 0.4, b: 0.8 } }],
                    constraints: { horizontal: 'LEFT', vertical: 'TOP' }
                  },
                  {
                    id: 'text1',
                    name: 'Button Text',
                    type: 'TEXT',
                    absoluteBoundingBox: { x: 65, y: 60, width: 90, height: 20 },
                    characters: 'Click Me',
                    style: {
                      fontFamily: 'Inter',
                      fontSize: 16,
                      fontWeight: 500,
                      textAlignHorizontal: 'CENTER'
                    }
                  }
                ]
              }
            ]
          }
        ]
      },
      lastModified: new Date().toISOString(),
      version: '1.0'
    });
  }),

  http.get('https://api.figma.com/v1/files/:fileId/nodes', ({ params, request }) => {
    const { fileId } = params;
    const url = new URL(request.url);
    const nodeIds = url.searchParams.get('ids')?.split(',') || [];
    
    const nodes: Record<string, any> = {};
    
    nodeIds.forEach(nodeId => {
      nodes[nodeId] = {
        document: {
          id: nodeId,
          name: `Mock Node ${nodeId}`,
          type: 'FRAME',
          absoluteBoundingBox: { x: 0, y: 0, width: 400, height: 300 },
          fills: [{ type: 'SOLID', color: { r: 0.95, g: 0.95, b: 0.95 } }],
          children: []
        }
      };
    });
    
    return HttpResponse.json({ nodes });
  }),

  // OpenAI API mocks
  http.post('https://api.openai.com/v1/chat/completions', () => {
    return HttpResponse.json({
      id: 'chatcmpl-mock',
      object: 'chat.completion',
      created: Date.now(),
      model: 'gpt-4',
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: JSON.stringify({
              components: [
                {
                  name: 'PrimaryButton',
                  type: 'button',
                  props: {
                    variant: 'primary',
                    size: 'medium'
                  },
                  description: 'A primary call-to-action button with blue background'
                }
              ],
              layout: 'flex',
              theme: {
                primaryColor: '#3366CC',
                textColor: '#FFFFFF'
              }
            })
          },
          finish_reason: 'stop'
        }
      ],
      usage: {
        prompt_tokens: 150,
        completion_tokens: 100,
        total_tokens: 250
      }
    });
  }),

  // Anthropic API mocks
  http.post('https://api.anthropic.com/v1/messages', () => {
    return HttpResponse.json({
      id: 'msg-mock',
      type: 'message',
      role: 'assistant',
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            markdown: `# Design System Components

## Primary Button
A prominent call-to-action button designed for main user actions.

\`\`\`jsx
<Button variant="primary" size="medium">
  Click Me
</Button>
\`\`\`

### Properties
- Background: #3366CC
- Color: #FFFFFF
- Padding: 12px 24px
- Border radius: 6px`,
            metadata: {
              confidence: 0.92,
              complexity: 'simple',
              accessibility: {
                contrast: 'AA',
                keyboard: true,
                screenReader: true
              }
            }
          })
        }
      ],
      model: 'claude-3-sonnet-20240229',
      stop_reason: 'end_turn',
      usage: {
        input_tokens: 120,
        output_tokens: 80
      }
    });
  }),

  // Google Gemini API mocks
  http.post('https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent', () => {
    return HttpResponse.json({
      candidates: [
        {
          content: {
            parts: [
              {
                text: JSON.stringify({
                  yaml: `components:
  - name: PrimaryButton
    type: button
    variant: primary
    styles:
      backgroundColor: "#3366CC"
      color: "#FFFFFF"
      padding: "12px 24px"
      borderRadius: "6px"
    interactions:
      - trigger: click
        action: submit
    accessibility:
      role: button
      ariaLabel: "Submit form"`,
                  structure: {
                    hierarchy: 'flat',
                    complexity: 'simple',
                    patterns: ['button', 'form-control']
                  }
                })
              }
            ],
            role: 'model'
          },
          finishReason: 'STOP',
          safetyRatings: []
        }
      ],
      usageMetadata: {
        promptTokenCount: 100,
        candidatesTokenCount: 75,
        totalTokenCount: 175
      }
    });
  }),

  // Mock file storage (MinIO/S3)
  http.put('http://localhost:9001/imagineer-exports/:fileName', () => {
    return HttpResponse.text('', { status: 200 });
  }),

  http.get('http://localhost:9001/imagineer-exports/:fileName', () => {
    return HttpResponse.text('Mock file content', {
      headers: {
        'Content-Type': 'text/plain',
        'Content-Length': '17'
      }
    });
  }),

  // Mock webhook endpoints
  http.post('https://webhook.site/test-webhook', ({ request }) => {
    return HttpResponse.json({ 
      received: true, 
      timestamp: new Date().toISOString() 
    });
  }),

  // Health check endpoints
  http.get('http://localhost:*/health', () => {
    return HttpResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: Math.floor(Math.random() * 3600),
      version: '1.0.0'
    });
  }),

  // Error simulation handlers
  http.get('https://api.figma.com/v1/files/error-file', () => {
    return HttpResponse.json(
      { error: 'File not found' },
      { status: 404 }
    );
  }),

  http.post('https://api.openai.com/v1/chat/completions-error', () => {
    return HttpResponse.json(
      { 
        error: { 
          message: 'Rate limit exceeded',
          type: 'rate_limit_error',
          code: 'rate_limit_exceeded'
        } 
      },
      { status: 429 }
    );
  }),

  // Fallback for unhandled requests
  http.all('*', ({ request }) => {
    console.warn(`Unhandled ${request.method} request to ${request.url}`);
    return new HttpResponse(null, { status: 404 });
  })
];
import { http, HttpResponse } from 'msw';

export const mockHandlers = [
  // OpenAI API mocks
  http.post('https://api.openai.com/v1/chat/completions', async ({ request }) => {
    const body = await request.json() as any;
    const prompt = body.messages?.[body.messages.length - 1]?.content || '';
    
    if (prompt.includes('error-test')) {
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
    }

    const mockResponse = {
      id: 'chatcmpl-mock-' + Date.now(),
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: body.model || 'gpt-4',
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
                    size: 'medium',
                    children: 'Click Me'
                  },
                  description: 'A primary call-to-action button with blue background',
                  code: '<Button variant="primary" size="medium">Click Me</Button>'
                },
                {
                  name: 'ContentCard',
                  type: 'card',
                  props: {
                    title: 'Card Title',
                    content: 'Card content goes here'
                  },
                  description: 'A content card with title and body text',
                  code: '<Card title="Card Title">Card content goes here</Card>'
                }
              ],
              layout: {
                type: 'flex',
                direction: 'column',
                gap: '16px'
              },
              theme: {
                primaryColor: '#3366CC',
                backgroundColor: '#FFFFFF',
                textColor: '#333333'
              },
              accessibility: {
                contrast: 'AA',
                keyboardNavigation: true,
                screenReader: true
              }
            })
          },
          finish_reason: 'stop'
        }
      ],
      usage: {
        prompt_tokens: 150,
        completion_tokens: 200,
        total_tokens: 350
      }
    };

    return HttpResponse.json(mockResponse);
  }),

  // Anthropic API mocks
  http.post('https://api.anthropic.com/v1/messages', async ({ request }) => {
    const body = await request.json() as any;
    const content = body.messages?.[body.messages.length - 1]?.content || '';
    
    if (content.includes('error-test')) {
      return HttpResponse.json(
        { 
          error: { 
            type: 'rate_limit_error',
            message: 'Rate limit exceeded'
          } 
        },
        { status: 429 }
      );
    }

    const mockResponse = {
      id: 'msg-mock-' + Date.now(),
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
- **Background**: #3366CC
- **Color**: #FFFFFF
- **Padding**: 12px 24px
- **Border radius**: 6px

## Content Card
A flexible card component for displaying content.

\`\`\`jsx
<Card title="Card Title">
  <p>Card content goes here</p>
</Card>
\`\`\`

### Layout
- **Display**: flex
- **Direction**: column
- **Gap**: 16px`,
            metadata: {
              confidence: 0.92,
              complexity: 'moderate',
              accessibility: {
                contrast: 'AA',
                keyboard: true,
                screenReader: true
              },
              designSystemAdherence: 0.85
            }
          })
        }
      ],
      model: body.model || 'claude-3-sonnet-20240229',
      stop_reason: 'end_turn',
      usage: {
        input_tokens: 120,
        output_tokens: 180
      }
    };

    return HttpResponse.json(mockResponse);
  }),

  // Google Gemini API mocks
  http.post('https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent', async ({ request }) => {
    const body = await request.json() as any;
    const prompt = body.contents?.[0]?.parts?.[0]?.text || '';
    
    if (prompt.includes('error-test')) {
      return HttpResponse.json(
        { 
          error: { 
            code: 429,
            message: 'Quota exceeded',
            status: 'RESOURCE_EXHAUSTED'
          } 
        },
        { status: 429 }
      );
    }

    const mockResponse = {
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
      fontSize: "16px"
      fontWeight: "500"
    interactions:
      - trigger: click
        action: submit
    accessibility:
      role: button
      ariaLabel: "Primary action button"
      
  - name: ContentCard
    type: card
    styles:
      backgroundColor: "#FFFFFF"
      border: "1px solid #E5E5E5"
      borderRadius: "8px"
      padding: "24px"
      boxShadow: "0 2px 4px rgba(0,0,0,0.1)"
    layout:
      display: flex
      flexDirection: column
      gap: "16px"`,
                  structure: {
                    hierarchy: 'moderate',
                    complexity: 'simple',
                    patterns: ['button', 'card', 'flexbox']
                  },
                  tokens: {
                    colors: {
                      primary: '#3366CC',
                      background: '#FFFFFF',
                      border: '#E5E5E5'
                    },
                    spacing: {
                      small: '12px',
                      medium: '16px',
                      large: '24px'
                    }
                  }
                })
              }
            ],
            role: 'model'
          },
          finishReason: 'STOP',
          safetyRatings: [
            {
              category: 'HARM_CATEGORY_HATE_SPEECH',
              probability: 'NEGLIGIBLE'
            }
          ]
        }
      ],
      usageMetadata: {
        promptTokenCount: 100,
        candidatesTokenCount: 150,
        totalTokenCount: 250
      }
    };

    return HttpResponse.json(mockResponse);
  }),

  // OpenAI Models API
  http.get('https://api.openai.com/v1/models', () => {
    return HttpResponse.json({
      data: [
        { id: 'gpt-4', object: 'model', created: 1687882411, owned_by: 'openai' },
        { id: 'gpt-3.5-turbo', object: 'model', created: 1677610602, owned_by: 'openai' }
      ]
    });
  }),

  // Health check endpoints
  http.get('*/health', () => {
    return HttpResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'translation-engine',
      dependencies: {
        openai: 'connected',
        anthropic: 'connected',
        google: 'connected',
        database: 'connected',
        redis: 'connected'
      }
    });
  }),

  // Template management endpoints
  http.get('*/templates', () => {
    return HttpResponse.json([
      {
        id: 'react-component',
        name: 'React Component Template',
        description: 'Generate React components from design elements',
        variables: ['componentName', 'props', 'children']
      },
      {
        id: 'markdown-docs',
        name: 'Markdown Documentation Template',
        description: 'Generate markdown documentation from designs',
        variables: ['title', 'components', 'usage']
      }
    ]);
  }),

  // Mock webhook endpoints
  http.post('https://webhook.site/test-webhook', ({ request }) => {
    return HttpResponse.json({ 
      received: true, 
      timestamp: new Date().toISOString() 
    });
  }),

  // Error simulation handlers
  http.post('https://api.openai.com/v1/chat/completions-error', () => {
    return HttpResponse.json(
      { 
        error: { 
          message: 'Invalid API key',
          type: 'invalid_request_error',
          code: 'invalid_api_key'
        } 
      },
      { status: 401 }
    );
  }),

  // Mock rate limiting
  http.post('https://api.anthropic.com/v1/messages-rate-limited', () => {
    return HttpResponse.json(
      { 
        error: { 
          type: 'rate_limit_error',
          message: 'Rate limit exceeded. Please try again later.'
        } 
      },
      { status: 429, headers: { 'Retry-After': '60' } }
    );
  })
];
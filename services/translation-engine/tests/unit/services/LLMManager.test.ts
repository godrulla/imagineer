import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { LLMManager, LLMProvider, OutputFormat, TranslationType, TranslationRequest } from '../../../src/services/LLMManager';
import { LLMError } from '../../../src/middleware/errorHandler';
import nock from 'nock';

// Mock dependencies
vi.mock('../../../src/utils/logger');
vi.mock('../../../src/cache/redis');

describe('LLMManager', () => {
  let llmManager: LLMManager;

  beforeEach(async () => {
    llmManager = new LLMManager();
    vi.clearAllMocks();
    
    // Set test environment variables
    process.env.OPENAI_API_KEY = 'test_openai_key';
    process.env.ANTHROPIC_API_KEY = 'test_anthropic_key';
    process.env.GOOGLE_API_KEY = 'test_google_key';
    
    await llmManager.initialize();
  });

  afterEach(() => {
    nock.cleanAll();
  });

  describe('initialization', () => {
    it('should initialize successfully with all providers', async () => {
      const newManager = new LLMManager();
      await newManager.initialize();

      const providers = newManager.getSupportedProviders();
      expect(providers).toContain('openai_gpt4');
      expect(providers).toContain('openai_gpt35');
      expect(providers).toContain('anthropic_claude');
      expect(providers).toContain('google_gemini');
    });

    it('should initialize without errors when API keys are missing', async () => {
      delete process.env.OPENAI_API_KEY;
      delete process.env.ANTHROPIC_API_KEY;
      delete process.env.GOOGLE_API_KEY;

      const newManager = new LLMManager();
      await expect(newManager.initialize()).resolves.not.toThrow();

      const providers = newManager.getSupportedProviders();
      expect(providers).toHaveLength(0);
    });

    it('should set up correct configurations for each provider', () => {
      const gpt4Config = llmManager.getProviderConfig('openai_gpt4');
      expect(gpt4Config).toBeDefined();
      expect(gpt4Config?.model).toBe('gpt-4-turbo-preview');
      expect(gpt4Config?.capabilities.maxContextLength).toBe(128000);
      expect(gpt4Config?.capabilities.supportsSystemPrompt).toBe(true);

      const claudeConfig = llmManager.getProviderConfig('anthropic_claude');
      expect(claudeConfig).toBeDefined();
      expect(claudeConfig?.model).toBe('claude-3-sonnet-20240229');
      expect(claudeConfig?.capabilities.maxContextLength).toBe(200000);

      const geminiConfig = llmManager.getProviderConfig('google_gemini');
      expect(geminiConfig).toBeDefined();
      expect(geminiConfig?.model).toBe('gemini-pro');
    });
  });

  describe('health checks', () => {
    it('should perform health checks for all providers', async () => {
      // Mock API responses for health checks
      nock('https://api.openai.com')
        .post('/v1/chat/completions')
        .reply(200, {
          id: 'test-id',
          choices: [{ message: { content: 'OK' }, finish_reason: 'stop' }],
          usage: { prompt_tokens: 5, completion_tokens: 1, total_tokens: 6 }
        });

      nock('https://api.anthropic.com')
        .post('/v1/messages')
        .reply(200, {
          id: 'test-id',
          content: [{ type: 'text', text: 'OK' }],
          usage: { input_tokens: 5, output_tokens: 1 }
        });

      nock('https://generativelanguage.googleapis.com')
        .post('/v1beta/models/gemini-pro:generateContent')
        .reply(200, {
          candidates: [{ content: { parts: [{ text: 'OK' }] } }]
        });

      const isHealthy = await llmManager.healthCheck();
      expect(isHealthy).toBe(true);
    });

    it('should handle provider failures gracefully', async () => {
      // Mock one provider failure
      nock('https://api.openai.com')
        .post('/v1/chat/completions')
        .reply(500, { error: 'Internal server error' });

      nock('https://api.anthropic.com')
        .post('/v1/messages')
        .reply(200, {
          id: 'test-id',
          content: [{ type: 'text', text: 'OK' }],
          usage: { input_tokens: 5, output_tokens: 1 }
        });

      const isHealthy = await llmManager.healthCheck();
      expect(isHealthy).toBe(true); // Should still be healthy if at least one provider works

      const gpt4Health = await llmManager.getProviderHealth('openai_gpt4');
      expect(gpt4Health.healthy).toBe(false);

      const claudeHealth = await llmManager.getProviderHealth('anthropic_claude');
      expect(claudeHealth.healthy).toBe(true);
    });

    it('should update health status after checks', async () => {
      // Mock all providers as failing
      nock('https://api.openai.com')
        .post('/v1/chat/completions')
        .times(2)
        .reply(500, { error: 'Service unavailable' });

      nock('https://api.anthropic.com')
        .post('/v1/messages')
        .reply(500, { error: 'Service unavailable' });

      nock('https://generativelanguage.googleapis.com')
        .post('/v1beta/models/gemini-pro:generateContent')
        .reply(500, { error: 'Service unavailable' });

      const isHealthy = await llmManager.healthCheck();
      expect(isHealthy).toBe(false);

      const allProviderInfo = llmManager.getAllProviderInfo();
      const healthyProviders = allProviderInfo.filter(p => p.available);
      expect(healthyProviders).toHaveLength(0);
    });
  });

  describe('translation generation', () => {
    it('should generate translation successfully with OpenAI', async () => {
      const request: TranslationRequest = {
        designData: {
          elements: [
            {
              id: 'button1',
              name: 'Primary Button',
              type: 'RECTANGLE',
              bounds: { x: 50, y: 50, width: 120, height: 40 }
            }
          ]
        },
        targetLLM: 'openai_gpt4',
        format: 'json',
        translationType: 'component'
      };

      nock('https://api.openai.com')
        .post('/v1/chat/completions')
        .reply(200, {
          id: 'chatcmpl-test',
          object: 'chat.completion',
          created: 1234567890,
          model: 'gpt-4-turbo-preview',
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
                      props: { variant: 'primary', size: 'medium' }
                    }
                  ]
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

      const response = await llmManager.generateTranslation(request);

      expect(response).toBeDefined();
      expect(response.provider).toBe('openai_gpt4');
      expect(response.content).toContain('PrimaryButton');
      expect(response.usage.totalTokens).toBe(250);
      expect(response.cost).toBeGreaterThan(0);
      expect(response.responseTime).toBeGreaterThan(0);
    });

    it('should generate translation successfully with Anthropic', async () => {
      const request: TranslationRequest = {
        designData: {
          elements: [
            {
              id: 'card1',
              name: 'Content Card',
              type: 'FRAME'
            }
          ]
        },
        targetLLM: 'anthropic_claude',
        format: 'markdown',
        translationType: 'component'
      };

      nock('https://api.anthropic.com')
        .post('/v1/messages')
        .reply(200, {
          id: 'msg-test',
          type: 'message',
          role: 'assistant',
          content: [
            {
              type: 'text',
              text: '# Content Card Component\n\nA flexible card component for displaying content.'
            }
          ],
          model: 'claude-3-sonnet-20240229',
          stop_reason: 'end_turn',
          usage: {
            input_tokens: 120,
            output_tokens: 80
          }
        });

      const response = await llmManager.generateTranslation(request);

      expect(response).toBeDefined();
      expect(response.provider).toBe('anthropic_claude');
      expect(response.content).toContain('# Content Card Component');
      expect(response.usage.promptTokens).toBe(120);
      expect(response.usage.completionTokens).toBe(80);
    });

    it('should generate translation successfully with Google Gemini', async () => {
      const request: TranslationRequest = {
        designData: {
          elements: [
            {
              id: 'nav1',
              name: 'Navigation Bar',
              type: 'FRAME'
            }
          ]
        },
        targetLLM: 'google_gemini',
        format: 'yaml',
        translationType: 'component'
      };

      nock('https://generativelanguage.googleapis.com')
        .post('/v1beta/models/gemini-pro:generateContent')
        .reply(200, {
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: 'components:\n  - name: NavigationBar\n    type: navigation\n    layout: horizontal'
                  }
                ],
                role: 'model'
              },
              finishReason: 'STOP'
            }
          ],
          usageMetadata: {
            promptTokenCount: 100,
            candidatesTokenCount: 50,
            totalTokenCount: 150
          }
        });

      const response = await llmManager.generateTranslation(request);

      expect(response).toBeDefined();
      expect(response.provider).toBe('google_gemini');
      expect(response.content).toContain('NavigationBar');
    });

    it('should validate translation requests', async () => {
      const invalidRequests = [
        // Missing design data
        {
          targetLLM: 'openai_gpt4' as LLMProvider,
          format: 'json' as OutputFormat,
          translationType: 'component' as TranslationType
        },
        // Missing target LLM
        {
          designData: { elements: [] },
          format: 'json' as OutputFormat,
          translationType: 'component' as TranslationType
        },
        // Missing format
        {
          designData: { elements: [] },
          targetLLM: 'openai_gpt4' as LLMProvider,
          translationType: 'component' as TranslationType
        },
        // Invalid provider
        {
          designData: { elements: [] },
          targetLLM: 'invalid_provider' as LLMProvider,
          format: 'json' as OutputFormat,
          translationType: 'component' as TranslationType
        }
      ];

      for (const request of invalidRequests) {
        await expect(llmManager.generateTranslation(request as TranslationRequest))
          .rejects
          .toThrow(LLMError);
      }
    });

    it('should handle API errors gracefully', async () => {
      const request: TranslationRequest = {
        designData: { elements: [] },
        targetLLM: 'openai_gpt4',
        format: 'json',
        translationType: 'component'
      };

      // Mock API error
      nock('https://api.openai.com')
        .post('/v1/chat/completions')
        .reply(429, {
          error: {
            message: 'Rate limit exceeded',
            type: 'rate_limit_error',
            code: 'rate_limit_exceeded'
          }
        });

      await expect(llmManager.generateTranslation(request))
        .rejects
        .toThrow(LLMError);
    });

    it('should use fallback providers when primary fails', async () => {
      const request: TranslationRequest = {
        designData: { elements: [{ id: 'test', name: 'Test', type: 'RECTANGLE' }] },
        targetLLM: 'openai_gpt4',
        format: 'json',
        translationType: 'component'
      };

      // Mock primary provider failure
      nock('https://api.openai.com')
        .post('/v1/chat/completions')
        .reply(500, { error: 'Internal server error' });

      // Mock fallback provider success
      nock('https://api.anthropic.com')
        .post('/v1/messages')
        .reply(200, {
          id: 'msg-fallback',
          content: [{ type: 'text', text: '{"components": [{"name": "TestComponent"}]}' }],
          usage: { input_tokens: 100, output_tokens: 50 }
        });

      const response = await llmManager.generateTranslation(request);

      expect(response.provider).toBe('anthropic_claude'); // Should use fallback
      expect(response.content).toContain('TestComponent');
    });

    it('should fail when all providers are unavailable', async () => {
      const request: TranslationRequest = {
        designData: { elements: [] },
        targetLLM: 'openai_gpt4',
        format: 'json',
        translationType: 'component'
      };

      // Mock all providers as failing
      nock('https://api.openai.com')
        .post('/v1/chat/completions')
        .times(2)
        .reply(500, { error: 'Service unavailable' });

      nock('https://api.anthropic.com')
        .post('/v1/messages')
        .reply(500, { error: 'Service unavailable' });

      nock('https://generativelanguage.googleapis.com')
        .post('/v1beta/models/gemini-pro:generateContent')
        .reply(500, { error: 'Service unavailable' });

      await expect(llmManager.generateTranslation(request))
        .rejects
        .toThrow('All providers failed');
    });
  });

  describe('prompt generation', () => {
    it('should generate appropriate system prompts for different providers', () => {
      const providers: LLMProvider[] = ['openai_gpt4', 'openai_gpt35', 'anthropic_claude', 'google_gemini'];

      providers.forEach(provider => {
        const config = llmManager.getProviderConfig(provider);
        expect(config?.systemPrompt).toBeDefined();
        expect(config?.systemPrompt).toContain('APEX');
        expect(config?.systemPrompt).toContain('Imagineer');
        expect(config?.systemPrompt).toContain(provider);
      });
    });

    it('should build prompts with context and options', async () => {
      const request: TranslationRequest = {
        designData: {
          elements: [{ id: 'button1', name: 'Submit Button', type: 'RECTANGLE' }]
        },
        targetLLM: 'openai_gpt4',
        format: 'markdown',
        translationType: 'component',
        context: {
          projectInfo: { name: 'Test Project', framework: 'React' },
          designSystem: { primaryColor: '#007bff', fontFamily: 'Inter' }
        },
        options: {
          verbosity: 'detailed',
          includeMetadata: true,
          optimizeForTokens: false
        }
      };

      // Mock the API call to test prompt generation
      nock('https://api.openai.com')
        .post('/v1/chat/completions', (body) => {
          const messages = body.messages;
          const systemMessage = messages.find((m: any) => m.role === 'system');
          const userMessage = messages.find((m: any) => m.role === 'user');

          expect(systemMessage.content).toContain('APEX');
          expect(userMessage.content).toContain('Test Project');
          expect(userMessage.content).toContain('React');
          expect(userMessage.content).toContain('#007bff');
          expect(userMessage.content).toContain('detailed');
          expect(userMessage.content).toContain('MARKDOWN');

          return true;
        })
        .reply(200, {
          id: 'test',
          choices: [{ message: { content: 'Response' }, finish_reason: 'stop' }],
          usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 }
        });

      await llmManager.generateTranslation(request);
    });
  });

  describe('cost tracking', () => {
    it('should calculate costs correctly for different providers', () => {
      const gpt4Config = llmManager.getProviderConfig('openai_gpt4')!;
      const claudeConfig = llmManager.getProviderConfig('anthropic_claude')!;

      // Test cost calculation for GPT-4
      const gpt4Usage = { promptTokens: 1000, completionTokens: 500, totalTokens: 1500 };
      const gpt4Cost = (1000 / 1000) * gpt4Config.pricing.inputTokensPer1K + 
                       (500 / 1000) * gpt4Config.pricing.outputTokensPer1K;

      // Test cost calculation for Claude
      const claudeUsage = { promptTokens: 800, completionTokens: 400, totalTokens: 1200 };
      const claudeCost = (800 / 1000) * claudeConfig.pricing.inputTokensPer1K + 
                         (400 / 1000) * claudeConfig.pricing.outputTokensPer1K;

      expect(gpt4Cost).toBeCloseTo(0.025); // $0.01 * 1 + $0.03 * 0.5
      expect(claudeCost).toBeCloseTo(0.0084); // $0.003 * 0.8 + $0.015 * 0.4
    });

    it('should track cumulative costs and usage', async () => {
      const request: TranslationRequest = {
        designData: { elements: [] },
        targetLLM: 'openai_gpt4',
        format: 'json',
        translationType: 'component'
      };

      // Mock multiple API calls
      nock('https://api.openai.com')
        .post('/v1/chat/completions')
        .times(3)
        .reply(200, {
          id: 'test',
          choices: [{ message: { content: 'Response' }, finish_reason: 'stop' }],
          usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 }
        });

      // Make multiple translation requests
      await Promise.all([
        llmManager.generateTranslation(request),
        llmManager.generateTranslation(request),
        llmManager.generateTranslation(request)
      ]);

      const costStats = llmManager.getCostStatistics();
      expect(costStats.total.requests).toBe(3);
      expect(costStats.total.tokens).toBe(450); // 150 * 3
      expect(costStats.byProvider.openai_gpt4.requestCount).toBe(3);
    });
  });

  describe('provider management', () => {
    it('should return correct provider capabilities', () => {
      const gpt4Capabilities = llmManager.getProviderCapabilities('openai_gpt4');
      expect(gpt4Capabilities).toMatchObject({
        provider: 'openai_gpt4',
        model: 'gpt-4-turbo-preview',
        capabilities: {
          maxContextLength: 128000,
          supportsSystemPrompt: true,
          supportsStreaming: true,
          supportsFunctions: true
        }
      });

      const claudeCapabilities = llmManager.getProviderCapabilities('anthropic_claude');
      expect(claudeCapabilities).toMatchObject({
        provider: 'anthropic_claude',
        capabilities: {
          maxContextLength: 200000,
          supportsSystemPrompt: true,
          supportsStreaming: true,
          supportsFunctions: false
        }
      });
    });

    it('should return all provider information', () => {
      const allProviders = llmManager.getAllProviderInfo();
      expect(allProviders).toHaveLength(4); // GPT-4, GPT-3.5, Claude, Gemini

      const providerNames = allProviders.map(p => p.provider);
      expect(providerNames).toContain('openai_gpt4');
      expect(providerNames).toContain('openai_gpt35');
      expect(providerNames).toContain('anthropic_claude');
      expect(providerNames).toContain('google_gemini');

      // Check that each provider has required fields
      allProviders.forEach(provider => {
        expect(provider).toHaveProperty('provider');
        expect(provider).toHaveProperty('name');
        expect(provider).toHaveProperty('model');
        expect(provider).toHaveProperty('available');
        expect(provider).toHaveProperty('capabilities');
        expect(provider).toHaveProperty('pricing');
        expect(provider).toHaveProperty('rateLimits');
      });
    });

    it('should test individual providers', async () => {
      nock('https://api.openai.com')
        .post('/v1/chat/completions')
        .reply(200, {
          id: 'test',
          choices: [{ message: { content: 'Test successful' }, finish_reason: 'stop' }],
          usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 }
        });

      const testResult = await llmManager.testProvider('openai_gpt4');

      expect(testResult.success).toBe(true);
      expect(testResult.provider).toBe('openai_gpt4');
      expect(testResult.response).toBe('Test successful');
      expect(testResult.responseTime).toBeGreaterThan(0);
    });

    it('should handle provider test failures', async () => {
      nock('https://api.openai.com')
        .post('/v1/chat/completions')
        .reply(500, { error: 'Internal server error' });

      const testResult = await llmManager.testProvider('openai_gpt4');

      expect(testResult.success).toBe(false);
      expect(testResult.provider).toBe('openai_gpt4');
      expect(testResult.error).toBeDefined();
    });
  });

  describe('shutdown', () => {
    it('should shutdown gracefully', async () => {
      await expect(llmManager.shutdown()).resolves.not.toThrow();

      // Verify that tracking data is cleared
      const costStats = llmManager.getCostStatistics();
      expect(costStats.total.requests).toBe(0);
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle empty responses from LLM providers', async () => {
      const request: TranslationRequest = {
        designData: { elements: [] },
        targetLLM: 'openai_gpt4',
        format: 'json',
        translationType: 'component'
      };

      nock('https://api.openai.com')
        .post('/v1/chat/completions')
        .reply(200, {
          id: 'test',
          choices: [{ message: { content: '' }, finish_reason: 'stop' }],
          usage: { prompt_tokens: 10, completion_tokens: 0, total_tokens: 10 }
        });

      await expect(llmManager.generateTranslation(request))
        .rejects
        .toThrow('Empty response from OpenAI');
    });

    it('should handle malformed API responses', async () => {
      const request: TranslationRequest = {
        designData: { elements: [] },
        targetLLM: 'anthropic_claude',
        format: 'json',
        translationType: 'component'
      };

      nock('https://api.anthropic.com')
        .post('/v1/messages')
        .reply(200, {
          id: 'test',
          content: [{ type: 'invalid', data: 'malformed' }], // Invalid content type
          usage: { input_tokens: 10, output_tokens: 5 }
        });

      await expect(llmManager.generateTranslation(request))
        .rejects
        .toThrow('Invalid response format from Anthropic');
    });

    it('should handle network timeouts', async () => {
      const request: TranslationRequest = {
        designData: { elements: [] },
        targetLLM: 'openai_gpt4',
        format: 'json',
        translationType: 'component'
      };

      nock('https://api.openai.com')
        .post('/v1/chat/completions')
        .delayConnection(2000)
        .reply(200, {
          id: 'test',
          choices: [{ message: { content: 'Response' }, finish_reason: 'stop' }],
          usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 }
        });

      // This should succeed with a longer timeout in our mock setup
      await expect(llmManager.generateTranslation(request)).resolves.toBeDefined();
    });

    it('should handle rate limiting properly', async () => {
      const request: TranslationRequest = {
        designData: { elements: [] },
        targetLLM: 'openai_gpt4',
        format: 'json',
        translationType: 'component'
      };

      nock('https://api.openai.com')
        .post('/v1/chat/completions')
        .reply(429, {
          error: {
            message: 'Rate limit exceeded',
            type: 'rate_limit_error',
            code: 'rate_limit_exceeded'
          }
        });

      await expect(llmManager.generateTranslation(request))
        .rejects
        .toThrow(LLMError);
    });
  });
});
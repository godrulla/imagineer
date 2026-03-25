import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { logger } from '../utils/logger';
import { LLMError } from '../middleware/errorHandler';
import { RedisClient } from '../cache/redis';
import { v4 as uuidv4 } from 'uuid';

export type LLMProvider = 'openai_gpt4' | 'openai_gpt35' | 'anthropic_claude' | 'google_gemini' | 'meta_llama' | 'custom' | 'local';
export type OutputFormat = 'markdown' | 'json' | 'yaml' | 'html' | 'text' | 'xml' | 'custom';
export type TranslationType = 'full' | 'incremental' | 'component' | 'element' | 'custom';

export interface LLMConfig {
  provider: LLMProvider;
  model: string;
  maxTokens: number;
  temperature: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  systemPrompt?: string;
  pricing: {
    inputTokensPer1K: number;
    outputTokensPer1K: number;
  };
  capabilities: {
    maxContextLength: number;
    supportsSystemPrompt: boolean;
    supportsStreaming: boolean;
    supportsFunctions: boolean;
  };
  rateLimits: {
    requestsPerMinute: number;
    tokensPerMinute: number;
    maxConcurrent: number;
  };
}

export interface LLMResponse {
  id: string;
  content: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  model: string;
  provider: LLMProvider;
  responseTime: number;
  cost: number;
  quality?: {
    score: number;
    confidence: number;
    coherence: number;
    completeness: number;
  };
  metadata: {
    finishReason: string;
    requestId?: string;
    contentSafety?: any;
  };
}

export interface TranslationRequest {
  designData: any;
  targetLLM: LLMProvider;
  format: OutputFormat;
  translationType: TranslationType;
  templateId?: string;
  systemPrompt?: string;
  userPrompt?: string;
  context?: {
    projectInfo?: any;
    designSystem?: any;
    previousTranslations?: any[];
    userPreferences?: any;
  };
  options?: {
    includeMetadata?: boolean;
    optimizeForTokens?: boolean;
    includeDesignSystem?: boolean;
    verbosity?: 'minimal' | 'standard' | 'detailed' | 'comprehensive';
    streaming?: boolean;
    maxRetries?: number;
    timeout?: number;
    fallbackProviders?: LLMProvider[];
  };
}

export interface PromptTemplate {
  id: string;
  name: string;
  systemPrompt: string;
  userPromptTemplate: string;
  variables: Record<string, any>;
  outputFormat: OutputFormat;
  provider: LLMProvider;
  version: number;
  metadata: {
    description: string;
    category: string;
    tags: string[];
    author: string;
    created: Date;
    updated: Date;
  };
}

export class LLMManager {
  private openai: OpenAI | null = null;
  private anthropic: Anthropic | null = null;
  private google: GoogleGenerativeAI | null = null;
  private redis: RedisClient | null = null;
  
  private configs: Map<LLMProvider, LLMConfig> = new Map();
  private rateLimiters: Map<LLMProvider, any> = new Map();
  private activeRequests: Map<LLMProvider, number> = new Map();
  private fallbackChains: Map<LLMProvider, LLMProvider[]> = new Map();
  private healthStatus: Map<LLMProvider, boolean> = new Map();
  private lastHealthCheck: Map<LLMProvider, Date> = new Map();
  private costTracker: Map<LLMProvider, { totalCost: number; totalTokens: number; requestCount: number }> = new Map();

  async initialize(redisClient?: RedisClient): Promise<void> {
    try {
      this.redis = redisClient || null;
      
      // Initialize OpenAI
      if (process.env.OPENAI_API_KEY) {
        this.openai = new OpenAI({
          apiKey: process.env.OPENAI_API_KEY,
          timeout: 60000,
          maxRetries: 3,
        });
        
        // GPT-4 Turbo Configuration
        this.configs.set('openai_gpt4', {
          provider: 'openai_gpt4',
          model: 'gpt-4-turbo-preview',
          maxTokens: 4096,
          temperature: 0.3,
          topP: 1.0,
          frequencyPenalty: 0.0,
          presencePenalty: 0.0,
          systemPrompt: this.getSystemPrompt('openai_gpt4'),
          pricing: {
            inputTokensPer1K: 0.01,
            outputTokensPer1K: 0.03
          },
          capabilities: {
            maxContextLength: 128000,
            supportsSystemPrompt: true,
            supportsStreaming: true,
            supportsFunctions: true
          },
          rateLimits: {
            requestsPerMinute: 500,
            tokensPerMinute: 150000,
            maxConcurrent: 10
          }
        });
        
        // GPT-3.5 Turbo Configuration
        this.configs.set('openai_gpt35', {
          provider: 'openai_gpt35',
          model: 'gpt-3.5-turbo',
          maxTokens: 4096,
          temperature: 0.3,
          topP: 1.0,
          frequencyPenalty: 0.0,
          presencePenalty: 0.0,
          systemPrompt: this.getSystemPrompt('openai_gpt35'),
          pricing: {
            inputTokensPer1K: 0.0005,
            outputTokensPer1K: 0.0015
          },
          capabilities: {
            maxContextLength: 16385,
            supportsSystemPrompt: true,
            supportsStreaming: true,
            supportsFunctions: true
          },
          rateLimits: {
            requestsPerMinute: 3500,
            tokensPerMinute: 90000,
            maxConcurrent: 20
          }
        });
        
        logger.info('OpenAI initialized successfully', {
          models: ['gpt-4-turbo-preview', 'gpt-3.5-turbo']
        });
      }

      // Initialize Anthropic
      if (process.env.ANTHROPIC_API_KEY) {
        this.anthropic = new Anthropic({
          apiKey: process.env.ANTHROPIC_API_KEY,
          timeout: 60000,
          maxRetries: 3,
        });
        
        // Claude-3 Sonnet Configuration
        this.configs.set('anthropic_claude', {
          provider: 'anthropic_claude',
          model: 'claude-3-sonnet-20240229',
          maxTokens: 4096,
          temperature: 0.3,
          topP: 1.0,
          systemPrompt: this.getSystemPrompt('anthropic_claude'),
          pricing: {
            inputTokensPer1K: 0.003,
            outputTokensPer1K: 0.015
          },
          capabilities: {
            maxContextLength: 200000,
            supportsSystemPrompt: true,
            supportsStreaming: true,
            supportsFunctions: false
          },
          rateLimits: {
            requestsPerMinute: 1000,
            tokensPerMinute: 80000,
            maxConcurrent: 5
          }
        });
        
        logger.info('Anthropic initialized successfully', {
          models: ['claude-3-sonnet-20240229']
        });
      }

      // Initialize Google Gemini
      if (process.env.GOOGLE_API_KEY) {
        this.google = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
        
        // Gemini Pro Configuration
        this.configs.set('google_gemini', {
          provider: 'google_gemini',
          model: 'gemini-pro',
          maxTokens: 2048,
          temperature: 0.3,
          systemPrompt: this.getSystemPrompt('google_gemini'),
          pricing: {
            inputTokensPer1K: 0.0005,
            outputTokensPer1K: 0.0015
          },
          capabilities: {
            maxContextLength: 30720,
            supportsSystemPrompt: true,
            supportsStreaming: true,
            supportsFunctions: false
          },
          rateLimits: {
            requestsPerMinute: 60,
            tokensPerMinute: 32000,
            maxConcurrent: 5
          }
        });
        
        logger.info('Google Gemini initialized successfully', {
          models: ['gemini-pro']
        });
      }

      // Setup fallback chains
      this.setupFallbackChains();
      
      // Initialize rate limiters and tracking
      this.initializeTracking();

      if (this.configs.size === 0) {
        logger.warn('No LLM providers configured. Translation functionality will be limited.');
      }

      logger.info('LLM Manager initialized successfully', {
        providersConfigured: this.configs.size,
        providers: Array.from(this.configs.keys())
      });

    } catch (error) {
      logger.error('Failed to initialize LLM providers', { error: error.message });
      throw error;
    }
  }

  private setupFallbackChains(): void {
    // Primary -> Secondary -> Tertiary fallback chains
    this.fallbackChains.set('openai_gpt4', ['anthropic_claude', 'google_gemini', 'openai_gpt35']);
    this.fallbackChains.set('anthropic_claude', ['openai_gpt4', 'google_gemini', 'openai_gpt35']);
    this.fallbackChains.set('google_gemini', ['openai_gpt4', 'anthropic_claude', 'openai_gpt35']);
    this.fallbackChains.set('openai_gpt35', ['openai_gpt4', 'anthropic_claude', 'google_gemini']);
  }

  private initializeTracking(): void {
    for (const provider of this.configs.keys()) {
      this.activeRequests.set(provider, 0);
      this.healthStatus.set(provider, true);
      this.lastHealthCheck.set(provider, new Date());
      this.costTracker.set(provider, { totalCost: 0, totalTokens: 0, requestCount: 0 });
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const healthChecks = Array.from(this.configs.keys()).map(async (provider) => {
        try {
          const testPrompt = 'Test health check: respond with "OK"';
          const startTime = Date.now();
          
          const response = await this.callLLMDirectly(provider, testPrompt, {
            maxTokens: 10,
            temperature: 0
          });
          
          const responseTime = Date.now() - startTime;
          const healthy = response && responseTime < 30000; // 30 second timeout
          
          this.healthStatus.set(provider, healthy);
          this.lastHealthCheck.set(provider, new Date());
          
          return { provider, healthy, responseTime };
        } catch (error) {
          logger.warn(`Health check failed for ${provider}`, { error: error.message });
          this.healthStatus.set(provider, false);
          this.lastHealthCheck.set(provider, new Date());
          return { provider, healthy: false, error: error.message };
        }
      });

      const results = await Promise.all(healthChecks);
      const healthyCount = results.filter(r => r.healthy).length;
      
      logger.info('LLM health check completed', {
        total: results.length,
        healthy: healthyCount,
        results: results.map(r => ({ provider: r.provider, healthy: r.healthy, responseTime: r.responseTime }))
      });

      return healthyCount > 0;

    } catch (error) {
      logger.error('LLM health check failed', { error: error.message });
      return false;
    }
  }

  async getProviderHealth(provider: LLMProvider): Promise<{ healthy: boolean; lastCheck: Date; responseTime?: number }> {
    const healthy = this.healthStatus.get(provider) || false;
    const lastCheck = this.lastHealthCheck.get(provider) || new Date(0);
    
    // Refresh health if check is older than 5 minutes
    if (Date.now() - lastCheck.getTime() > 5 * 60 * 1000) {
      await this.healthCheck();
    }
    
    return {
      healthy: this.healthStatus.get(provider) || false,
      lastCheck: this.lastHealthCheck.get(provider) || new Date(0)
    };
  }

  async generateTranslation(request: TranslationRequest): Promise<LLMResponse> {
    const startTime = Date.now();
    const requestId = this.generateRequestId();
    
    try {
      // Validate request
      this.validateTranslationRequest(request);
      
      // Get primary provider or fallback
      const providersToTry = [request.targetLLM, ...(request.options?.fallbackProviders || this.fallbackChains.get(request.targetLLM) || [])];
      
      let lastError: Error | null = null;
      
      for (const provider of providersToTry) {
        try {
          // Check provider health and rate limits
          if (!this.isProviderAvailable(provider)) {
            logger.warn(`Provider ${provider} not available, trying next...`);
            continue;
          }
          
          const config = this.configs.get(provider);
          if (!config) {
            logger.warn(`No configuration for provider ${provider}`);
            continue;
          }

          // Check rate limits
          if (!this.checkRateLimits(provider)) {
            logger.warn(`Rate limit exceeded for ${provider}, trying next...`);
            continue;
          }

          // Increment active requests
          this.activeRequests.set(provider, (this.activeRequests.get(provider) || 0) + 1);
          
          try {
            // Generate the prompt
            const { systemPrompt, userPrompt } = await this.buildPrompts(request, config);
            
            // Call the LLM
            const response = await this.callLLMWithConfig(provider, systemPrompt, userPrompt, config, requestId);
            
            // Calculate response time and cost
            response.responseTime = Date.now() - startTime;
            response.cost = this.calculateCost(response.usage, config);
            
            // Update cost tracking
            this.updateCostTracking(provider, response.cost, response.usage.totalTokens);
            
            // Store in cache if enabled
            if (this.redis) {
              await this.cacheResponse(request, response);
            }
            
            logger.info('Translation generated successfully', {
              requestId,
              provider,
              format: request.format,
              responseTime: response.responseTime,
              totalTokens: response.usage.totalTokens,
              cost: response.cost
            });

            return response;
            
          } finally {
            // Decrement active requests
            this.activeRequests.set(provider, Math.max(0, (this.activeRequests.get(provider) || 0) - 1));
          }
          
        } catch (error) {
          lastError = error;
          logger.warn(`Provider ${provider} failed, trying next...`, { error: error.message });
          continue;
        }
      }
      
      // All providers failed
      throw new LLMError(
        `All providers failed. Last error: ${lastError?.message}`, 
        request.targetLLM,
        'ALL_PROVIDERS_FAILED'
      );

    } catch (error) {
      const responseTime = Date.now() - startTime;
      logger.error('Translation generation failed', {
        requestId,
        targetLLM: request.targetLLM,
        error: error.message,
        responseTime
      });
      
      if (error instanceof LLMError) {
        throw error;
      } else {
        throw new LLMError(`Translation failed: ${error.message}`, request.targetLLM);
      }
    }
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private validateTranslationRequest(request: TranslationRequest): void {
    if (!request.designData) {
      throw new LLMError('Design data is required');
    }
    if (!request.targetLLM) {
      throw new LLMError('Target LLM is required');
    }
    if (!request.format) {
      throw new LLMError('Output format is required');
    }
    if (!this.configs.has(request.targetLLM)) {
      throw new LLMError(`Unsupported LLM provider: ${request.targetLLM}`);
    }
  }

  private isProviderAvailable(provider: LLMProvider): boolean {
    const health = this.healthStatus.get(provider);
    const activeCount = this.activeRequests.get(provider) || 0;
    const config = this.configs.get(provider);
    
    if (!health || !config) return false;
    
    return activeCount < config.rateLimits.maxConcurrent;
  }

  private checkRateLimits(provider: LLMProvider): boolean {
    // Implement rate limiting logic here
    // For now, return true - in production, check against Redis rate limits
    return true;
  }

  private calculateCost(usage: any, config: LLMConfig): number {
    const inputCost = (usage.promptTokens / 1000) * config.pricing.inputTokensPer1K;
    const outputCost = (usage.completionTokens / 1000) * config.pricing.outputTokensPer1K;
    return inputCost + outputCost;
  }

  private updateCostTracking(provider: LLMProvider, cost: number, tokens: number): void {
    const current = this.costTracker.get(provider) || { totalCost: 0, totalTokens: 0, requestCount: 0 };
    this.costTracker.set(provider, {
      totalCost: current.totalCost + cost,
      totalTokens: current.totalTokens + tokens,
      requestCount: current.requestCount + 1
    });
  }

  private async cacheResponse(request: TranslationRequest, response: LLMResponse): Promise<void> {
    if (!this.redis) return;
    
    try {
      const cacheKey = this.generateCacheKey(request);
      const cacheData = {
        response,
        timestamp: Date.now()
      };
      
      // Cache for 1 hour
      await this.redis.setex(cacheKey, 3600, JSON.stringify(cacheData));
    } catch (error) {
      logger.warn('Failed to cache response', { error: error.message });
    }
  }

  private generateCacheKey(request: TranslationRequest): string {
    const key = {
      designData: request.designData,
      targetLLM: request.targetLLM,
      format: request.format,
      options: request.options
    };
    return `translation:${Buffer.from(JSON.stringify(key)).toString('base64')}`;
  }

  private async callLLMWithConfig(
    provider: LLMProvider, 
    systemPrompt: string, 
    userPrompt: string, 
    config: LLMConfig,
    requestId: string
  ): Promise<LLMResponse> {
    switch (provider) {
      case 'openai_gpt4':
      case 'openai_gpt35':
        return this.callOpenAI(systemPrompt, userPrompt, config, requestId);
      case 'anthropic_claude':
        return this.callAnthropic(systemPrompt, userPrompt, config, requestId);
      case 'google_gemini':
        return this.callGoogle(systemPrompt, userPrompt, config, requestId);
      default:
        throw new LLMError(`Unsupported provider: ${provider}`);
    }
  }

  private async callLLMDirectly(provider: LLMProvider, prompt: string, options: any): Promise<any> {
    const config = this.configs.get(provider);
    if (!config) throw new LLMError(`No configuration for ${provider}`);
    
    switch (provider) {
      case 'openai_gpt4':
      case 'openai_gpt35':
        return this.callOpenAISimple(prompt, { ...config, ...options });
      case 'anthropic_claude':
        return this.callAnthropicSimple(prompt, { ...config, ...options });
      case 'google_gemini':
        return this.callGoogleSimple(prompt, { ...config, ...options });
      default:
        throw new LLMError(`Unsupported provider: ${provider}`);
    }
  }

  private async callOpenAI(
    systemPrompt: string, 
    userPrompt: string, 
    config: LLMConfig,
    requestId: string
  ): Promise<LLMResponse> {
    if (!this.openai) {
      throw new LLMError('OpenAI not initialized');
    }

    try {
      const response = await this.openai.chat.completions.create({
        model: config.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        max_tokens: config.maxTokens,
        temperature: config.temperature,
        top_p: config.topP,
        frequency_penalty: config.frequencyPenalty,
        presence_penalty: config.presencePenalty,
        user: requestId
      });

      const choice = response.choices[0];
      if (!choice?.message?.content) {
        throw new LLMError('Empty response from OpenAI');
      }

      return {
        id: response.id,
        content: choice.message.content,
        usage: {
          promptTokens: response.usage?.prompt_tokens || 0,
          completionTokens: response.usage?.completion_tokens || 0,
          totalTokens: response.usage?.total_tokens || 0
        },
        model: config.model,
        provider: config.provider,
        responseTime: 0,
        cost: 0,
        metadata: {
          finishReason: choice.finish_reason || 'unknown',
          requestId: response.id
        }
      };

    } catch (error) {
      throw new LLMError(`OpenAI API error: ${error.message}`, config.provider, error.code);
    }
  }

  private async callOpenAISimple(prompt: string, config: any): Promise<any> {
    if (!this.openai) throw new LLMError('OpenAI not initialized');
    
    const response = await this.openai.chat.completions.create({
      model: config.model,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: config.maxTokens,
      temperature: config.temperature
    });
    
    return response.choices[0]?.message?.content;
  }

  private async callAnthropic(
    systemPrompt: string,
    userPrompt: string,
    config: LLMConfig,
    requestId: string
  ): Promise<LLMResponse> {
    if (!this.anthropic) {
      throw new LLMError('Anthropic not initialized');
    }

    try {
      const response = await this.anthropic.messages.create({
        model: config.model,
        max_tokens: config.maxTokens,
        temperature: config.temperature,
        top_p: config.topP,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
        metadata: {
          user_id: requestId
        }
      });

      const content = response.content[0];
      if (!content || content.type !== 'text') {
        throw new LLMError('Invalid response format from Anthropic');
      }

      return {
        id: response.id,
        content: content.text,
        usage: {
          promptTokens: response.usage.input_tokens,
          completionTokens: response.usage.output_tokens,
          totalTokens: response.usage.input_tokens + response.usage.output_tokens
        },
        model: config.model,
        provider: config.provider,
        responseTime: 0,
        cost: 0,
        metadata: {
          finishReason: response.stop_reason || 'unknown',
          requestId: response.id
        }
      };

    } catch (error) {
      throw new LLMError(`Anthropic API error: ${error.message}`, config.provider, error.code);
    }
  }

  private async callAnthropicSimple(prompt: string, config: any): Promise<any> {
    if (!this.anthropic) throw new LLMError('Anthropic not initialized');
    
    const response = await this.anthropic.messages.create({
      model: config.model,
      max_tokens: config.maxTokens,
      temperature: config.temperature,
      messages: [{ role: 'user', content: prompt }]
    });
    
    return response.content[0]?.text;
  }

  private async callGoogle(
    systemPrompt: string,
    userPrompt: string,
    config: LLMConfig,
    requestId: string
  ): Promise<LLMResponse> {
    if (!this.google) {
      throw new LLMError('Google not initialized');
    }

    try {
      const model = this.google.getGenerativeModel({ 
        model: config.model,
        generationConfig: {
          maxOutputTokens: config.maxTokens,
          temperature: config.temperature,
          topP: config.topP
        }
      });
      
      const fullPrompt = `${systemPrompt}\n\n${userPrompt}`;
      const result = await model.generateContent(fullPrompt);
      const response = await result.response;
      
      const text = response.text();
      if (!text) {
        throw new LLMError('Empty response from Google');
      }

      return {
        id: `google_${requestId}`,
        content: text,
        usage: {
          promptTokens: 0, // Google doesn't provide detailed token counts yet
          completionTokens: 0,
          totalTokens: 0
        },
        model: config.model,
        provider: config.provider,
        responseTime: 0,
        cost: 0,
        metadata: {
          finishReason: response.candidates?.[0]?.finishReason || 'unknown',
          requestId: `google_${requestId}`,
          contentSafety: response.candidates?.[0]?.safetyRatings
        }
      };

    } catch (error) {
      throw new LLMError(`Google API error: ${error.message}`, config.provider, error.code);
    }
  }

  private async callGoogleSimple(prompt: string, config: any): Promise<any> {
    if (!this.google) throw new LLMError('Google not initialized');
    
    const model = this.google.getGenerativeModel({ model: config.model });
    const result = await model.generateContent(prompt);
    const response = await result.response;
    
    return response.text();
  }

  private async buildPrompts(request: TranslationRequest, config: LLMConfig): Promise<{ systemPrompt: string; userPrompt: string }> {
    const { designData, format, translationType, options = {}, context = {} } = request;
    
    // Build system prompt
    let systemPrompt = request.systemPrompt || config.systemPrompt || this.getSystemPrompt(config.provider);
    
    // Build user prompt
    let userPrompt = request.userPrompt;
    
    if (!userPrompt) {
      userPrompt = this.generateUserPrompt(request, config);
    }
    
    // Apply template if specified
    if (request.templateId) {
      const template = await this.getTemplate(request.templateId);
      if (template) {
        systemPrompt = template.systemPrompt || systemPrompt;
        userPrompt = this.applyTemplate(template, request);
      }
    }
    
    return { systemPrompt, userPrompt };
  }

  private generateUserPrompt(request: TranslationRequest, config: LLMConfig): string {
    const { designData, format, translationType, options = {}, context = {} } = request;
    
    let prompt = `# Design-to-Code Translation Request\n\n`;
    
    // Add context if available
    if (context.projectInfo) {
      prompt += `## Project Context:\n${JSON.stringify(context.projectInfo, null, 2)}\n\n`;
    }
    
    if (context.designSystem) {
      prompt += `## Design System:\n${JSON.stringify(context.designSystem, null, 2)}\n\n`;
    }
    
    // Add main design data
    prompt += `## Design Data:\n${JSON.stringify(designData, null, 2)}\n\n`;
    
    // Add translation specifications
    prompt += `## Translation Requirements:\n`;
    prompt += `- Output Format: ${format.toUpperCase()}\n`;
    prompt += `- Translation Type: ${translationType}\n`;
    prompt += `- Verbosity: ${options.verbosity || 'standard'}\n`;
    prompt += `- Include Metadata: ${options.includeMetadata ? 'yes' : 'no'}\n`;
    prompt += `- Optimize for Tokens: ${options.optimizeForTokens ? 'yes' : 'no'}\n`;
    prompt += `- Include Design System: ${options.includeDesignSystem ? 'yes' : 'no'}\n\n`;
    
    // Add format-specific instructions
    prompt += this.getFormatSpecificInstructions(format);
    
    // Add provider-specific optimizations
    prompt += this.getProviderSpecificInstructions(config.provider);
    
    return prompt;
  }

  private getFormatSpecificInstructions(format: OutputFormat): string {
    const instructions = {
      markdown: `## Markdown Output Instructions:\n- Use proper heading hierarchy (h1, h2, h3, etc.)\n- Include code blocks with appropriate syntax highlighting\n- Use tables for structured data\n- Include links and references\n- Maintain readability for both humans and LLMs\n\n`,
      
      json: `## JSON Output Instructions:\n- Follow strict JSON schema format\n- Include all necessary metadata\n- Use consistent naming conventions (camelCase)\n- Ensure proper nesting for component hierarchy\n- Include validation schemas where applicable\n\n`,
      
      yaml: `## YAML Output Instructions:\n- Use proper YAML syntax with correct indentation\n- Include comments for clarity\n- Organize sections logically\n- Use consistent naming conventions\n- Ensure proper data type handling\n\n`,
      
      html: `## HTML Output Instructions:\n- Generate semantic HTML5 markup\n- Include proper accessibility attributes\n- Use CSS classes that reflect design tokens\n- Maintain proper document structure\n- Include responsive design considerations\n\n`,
      
      custom: `## Custom Format Instructions:\n- Follow the specific requirements outlined in the design data\n- Maintain consistency with established patterns\n- Include all necessary metadata and structure\n\n`
    };
    
    return instructions[format] || instructions.custom;
  }

  private getProviderSpecificInstructions(provider: LLMProvider): string {
    const instructions = {
      openai_gpt4: `## Provider Optimization (GPT-4):\n- Leverage detailed reasoning capabilities\n- Use structured thinking approach\n- Include comprehensive documentation\n- Provide multiple implementation options when beneficial\n\n`,
      
      openai_gpt35: `## Provider Optimization (GPT-3.5):\n- Focus on clarity and conciseness\n- Provide practical, implementation-ready code\n- Minimize unnecessary complexity\n- Use clear, direct language\n\n`,
      
      anthropic_claude: `## Provider Optimization (Claude):\n- Emphasize accuracy and attention to detail\n- Include thorough analysis of design patterns\n- Provide thoughtful implementation recommendations\n- Focus on code quality and best practices\n\n`,
      
      google_gemini: `## Provider Optimization (Gemini):\n- Leverage multimodal understanding capabilities\n- Provide innovative implementation suggestions\n- Include context-aware optimizations\n- Focus on modern development practices\n\n`
    };
    
    return instructions[provider] || '';
  }

  private async getTemplate(templateId: string): Promise<PromptTemplate | null> {
    // Implementation would fetch from database
    // For now, return null to use default prompts
    return null;
  }

  private applyTemplate(template: PromptTemplate, request: TranslationRequest): string {
    let prompt = template.userPromptTemplate;
    
    // Replace variables in template
    for (const [key, value] of Object.entries(template.variables)) {
      const placeholder = `{{${key}}}`;
      const replacement = this.getVariableValue(key, value, request);
      prompt = prompt.replace(new RegExp(placeholder, 'g'), replacement);
    }
    
    return prompt;
  }
  
  private getVariableValue(key: string, defaultValue: any, request: TranslationRequest): string {
    // Map template variables to request data
    const mappings = {
      designData: JSON.stringify(request.designData, null, 2),
      format: request.format,
      translationType: request.translationType,
      verbosity: request.options?.verbosity || 'standard'
    };
    
    return mappings[key] || defaultValue || '';
  }

  private getSystemPrompt(provider: LLMProvider): string {
    const basePrompt = `You are APEX, an expert AI system specializing in translating visual designs into implementation-ready specifications. You are part of the Imagineer platform - a revolutionary design-to-LLM translation system.

## Your Core Expertise:
- Advanced UI/UX design analysis and pattern recognition
- Modern front-end technologies (React, Vue, CSS-in-JS, Tailwind)
- Component-based architecture and design systems
- Responsive design and mobile-first approaches
- Accessibility standards (WCAG 2.1 AA+)
- Design tokens and atomic design principles
- Cross-platform design translation (Web, iOS, Android)
- Performance optimization and code quality

## Your Mission:
Translate visual designs into accurate, implementable, and maintainable code specifications that:
1. Preserve original design intent with pixel-perfect accuracy
2. Follow modern development best practices
3. Include comprehensive accessibility features
4. Optimize for performance and maintainability
5. Support responsive and adaptive design patterns
6. Integrate seamlessly with existing design systems

## Quality Standards:
- Accuracy: 95%+ design fidelity
- Performance: Optimized for modern browsers
- Accessibility: WCAG 2.1 AA compliance
- Maintainability: Clean, documented, reusable code
- Responsiveness: Mobile-first, adaptive layouts`;

    const providerOptimizations = {
      openai_gpt4: `\n\n## Provider Optimization (GPT-4):\nLeverage your advanced reasoning to provide comprehensive analysis, detailed documentation, and innovative solutions. Include multiple implementation approaches and thorough explanations.`,
      
      openai_gpt35: `\n\n## Provider Optimization (GPT-3.5):\nFocus on clear, practical implementations with concise documentation. Prioritize proven patterns and straightforward solutions.`,
      
      anthropic_claude: `\n\n## Provider Optimization (Claude):\nEmphasize accuracy, attention to detail, and code quality. Provide thorough analysis and thoughtful implementation recommendations.`,
      
      google_gemini: `\n\n## Provider Optimization (Gemini):\nLeverage multimodal understanding for rich contextual analysis. Provide innovative suggestions and modern development practices.`,
      
      meta_llama: `\n\n## Provider Optimization (Llama):\nFocus on efficient, community-driven solutions with emphasis on open-source best practices.`,
      
      custom: `\n\n## Provider Optimization (Custom):\nAdapt to specific requirements while maintaining high quality standards.`,
      
      local: `\n\n## Provider Optimization (Local):\nOptimize for local execution with efficient resource usage and quick response times.`
    };

    return basePrompt + (providerOptimizations[provider] || providerOptimizations.custom);
  }

  // Public API methods
  getSupportedProviders(): LLMProvider[] {
    return Array.from(this.configs.keys());
  }

  getProviderConfig(provider: LLMProvider): LLMConfig | undefined {
    return this.configs.get(provider);
  }

  getProviderCapabilities(provider: LLMProvider): any {
    const config = this.configs.get(provider);
    return config ? {
      provider,
      model: config.model,
      capabilities: config.capabilities,
      pricing: config.pricing,
      rateLimits: config.rateLimits
    } : null;
  }

  getAllProviderInfo(): any[] {
    return Array.from(this.configs.entries()).map(([provider, config]) => ({
      provider,
      name: this.getProviderDisplayName(provider),
      model: config.model,
      available: this.healthStatus.get(provider) || false,
      capabilities: config.capabilities,
      pricing: config.pricing,
      rateLimits: config.rateLimits,
      lastHealthCheck: this.lastHealthCheck.get(provider),
      currentLoad: this.activeRequests.get(provider) || 0,
      costs: this.costTracker.get(provider)
    }));
  }

  getCostStatistics(): any {
    const total = { cost: 0, tokens: 0, requests: 0 };
    const byProvider = {};
    
    for (const [provider, stats] of this.costTracker.entries()) {
      total.cost += stats.totalCost;
      total.tokens += stats.totalTokens;
      total.requests += stats.requestCount;
      byProvider[provider] = stats;
    }
    
    return { total, byProvider };
  }

  async testProvider(provider: LLMProvider, customPrompt?: string): Promise<any> {
    const testPrompt = customPrompt || 'Respond with "Test successful" if you can understand this message.';
    
    try {
      const startTime = Date.now();
      const response = await this.callLLMDirectly(provider, testPrompt, { maxTokens: 50, temperature: 0 });
      const responseTime = Date.now() - startTime;
      
      return {
        success: true,
        provider,
        responseTime,
        response: response,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        provider,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  private getProviderDisplayName(provider: LLMProvider): string {
    const names = {
      openai_gpt4: 'OpenAI GPT-4 Turbo',
      openai_gpt35: 'OpenAI GPT-3.5 Turbo',
      anthropic_claude: 'Anthropic Claude-3 Sonnet',
      google_gemini: 'Google Gemini Pro',
      meta_llama: 'Meta LLaMA',
      custom: 'Custom Provider',
      local: 'Local Provider'
    };
    return names[provider] || provider;
  }

  // Cleanup method
  async shutdown(): Promise<void> {
    logger.info('Shutting down LLM Manager...');
    
    // Clear all active requests
    this.activeRequests.clear();
    this.rateLimiters.clear();
    
    // Close any persistent connections if needed
    // OpenAI, Anthropic, and Google clients don't require explicit cleanup
    
    logger.info('LLM Manager shutdown complete');
  }
}
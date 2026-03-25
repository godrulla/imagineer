import { apiClient } from '../client';
import {
  TranslationRequest,
  TranslationResult,
  Job,
  JobDetail,
  PaginatedResponse,
  ApiResponse,
} from '../types';

export class TranslationEngineService {
  private readonly basePath = '/v1';

  // ============================================================================
  // TRANSLATION MANAGEMENT
  // ============================================================================

  async createTranslation(data: TranslationRequest): Promise<Job> {
    const response = await apiClient.post<Job>(
      `${this.basePath}/translations`,
      data
    );
    return response.data;
  }

  async getTranslations(params?: {
    page?: number;
    limit?: number;
    design_file_id?: string;
    status?: string;
    llm_provider?: string;
    target_format?: string;
  }): Promise<PaginatedResponse<TranslationResult>> {
    const queryString = params ? `?${apiClient.buildQueryParams(params)}` : '';
    const response = await apiClient.get<PaginatedResponse<TranslationResult>>(
      `${this.basePath}/translations${queryString}`
    );
    return response.data;
  }

  async getTranslation(translationId: string): Promise<TranslationResult> {
    const response = await apiClient.get<TranslationResult>(
      `${this.basePath}/translations/${translationId}`
    );
    return response.data;
  }

  async updateTranslation(
    translationId: string,
    data: Partial<TranslationRequest>
  ): Promise<TranslationResult> {
    const response = await apiClient.put<TranslationResult>(
      `${this.basePath}/translations/${translationId}`,
      data
    );
    return response.data;
  }

  async deleteTranslation(translationId: string): Promise<void> {
    await apiClient.delete(`${this.basePath}/translations/${translationId}`);
  }

  async retryTranslation(translationId: string): Promise<Job> {
    const response = await apiClient.post<Job>(
      `${this.basePath}/translations/${translationId}/retry`
    );
    return response.data;
  }

  // ============================================================================
  // PROMPT GENERATION
  // ============================================================================

  async generatePrompt(data: {
    design_file_id: string;
    context_strategy: 'minimal' | 'comprehensive' | 'custom';
    include_assets: boolean;
    custom_instructions?: string;
    template_id?: string;
  }): Promise<{ prompt: string; metadata: Record<string, any> }> {
    const response = await apiClient.post<{ prompt: string; metadata: Record<string, any> }>(
      `${this.basePath}/prompts/generate`,
      data
    );
    return response.data;
  }

  async validatePrompt(prompt: string): Promise<{
    valid: boolean;
    token_count: number;
    warnings: string[];
    suggestions: string[];
  }> {
    const response = await apiClient.post<{
      valid: boolean;
      token_count: number;
      warnings: string[];
      suggestions: string[];
    }>(`${this.basePath}/prompts/validate`, { prompt });
    return response.data;
  }

  async optimizePrompt(prompt: string, target_length?: number): Promise<{
    optimized_prompt: string;
    original_token_count: number;
    optimized_token_count: number;
    changes_made: string[];
  }> {
    const response = await apiClient.post<{
      optimized_prompt: string;
      original_token_count: number;
      optimized_token_count: number;
      changes_made: string[];
    }>(`${this.basePath}/prompts/optimize`, { prompt, target_length });
    return response.data;
  }

  // ============================================================================
  // TEMPLATE MANAGEMENT
  // ============================================================================

  async getTemplates(params?: {
    page?: number;
    limit?: number;
    category?: string;
    llm_provider?: string;
    search?: string;
  }): Promise<PaginatedResponse<{
    id: string;
    name: string;
    description: string;
    category: string;
    llm_provider: string[];
    template_content: string;
    variables: Record<string, any>;
    created_at: string;
    updated_at: string;
  }>> {
    const queryString = params ? `?${apiClient.buildQueryParams(params)}` : '';
    const response = await apiClient.get<PaginatedResponse<{
      id: string;
      name: string;
      description: string;
      category: string;
      llm_provider: string[];
      template_content: string;
      variables: Record<string, any>;
      created_at: string;
      updated_at: string;
    }>>(`${this.basePath}/templates${queryString}`);
    return response.data;
  }

  async getTemplate(templateId: string): Promise<{
    id: string;
    name: string;
    description: string;
    category: string;
    llm_provider: string[];
    template_content: string;
    variables: Record<string, any>;
    usage_count: number;
    created_at: string;
    updated_at: string;
  }> {
    const response = await apiClient.get<{
      id: string;
      name: string;
      description: string;
      category: string;
      llm_provider: string[];
      template_content: string;
      variables: Record<string, any>;
      usage_count: number;
      created_at: string;
      updated_at: string;
    }>(`${this.basePath}/templates/${templateId}`);
    return response.data;
  }

  async createTemplate(data: {
    name: string;
    description: string;
    category: string;
    llm_provider: string[];
    template_content: string;
    variables?: Record<string, any>;
  }): Promise<{
    id: string;
    name: string;
    description: string;
    category: string;
    llm_provider: string[];
    template_content: string;
    variables: Record<string, any>;
    created_at: string;
    updated_at: string;
  }> {
    const response = await apiClient.post<{
      id: string;
      name: string;
      description: string;
      category: string;
      llm_provider: string[];
      template_content: string;
      variables: Record<string, any>;
      created_at: string;
      updated_at: string;
    }>(`${this.basePath}/templates`, data);
    return response.data;
  }

  // ============================================================================
  // LLM PROVIDER MANAGEMENT
  // ============================================================================

  async getLLMProviders(): Promise<{
    providers: Array<{
      id: string;
      name: string;
      type: 'openai' | 'anthropic' | 'google' | 'custom';
      models: Array<{
        id: string;
        name: string;
        max_tokens: number;
        cost_per_1k_tokens: {
          input: number;
          output: number;
        };
        capabilities: string[];
      }>;
      status: 'active' | 'inactive' | 'error';
      last_check: string;
    }>;
  }> {
    const response = await apiClient.get<{
      providers: Array<{
        id: string;
        name: string;
        type: 'openai' | 'anthropic' | 'google' | 'custom';
        models: Array<{
          id: string;
          name: string;
          max_tokens: number;
          cost_per_1k_tokens: {
            input: number;
            output: number;
          };
          capabilities: string[];
        }>;
        status: 'active' | 'inactive' | 'error';
        last_check: string;
      }>;
    }>(`${this.basePath}/llm/providers`);
    return response.data;
  }

  async testLLMProvider(providerId: string, modelId: string): Promise<{
    success: boolean;
    response_time_ms: number;
    token_usage: {
      input_tokens: number;
      output_tokens: number;
    };
    error?: string;
  }> {
    const response = await apiClient.post<{
      success: boolean;
      response_time_ms: number;
      token_usage: {
        input_tokens: number;
        output_tokens: number;
      };
      error?: string;
    }>(`${this.basePath}/llm/providers/${providerId}/test`, { model_id: modelId });
    return response.data;
  }

  // ============================================================================
  // ANALYTICS & MONITORING
  // ============================================================================

  async getTranslationAnalytics(params?: {
    start_date?: string;
    end_date?: string;
    group_by?: 'day' | 'week' | 'month';
  }): Promise<{
    total_translations: number;
    successful_translations: number;
    failed_translations: number;
    average_confidence_score: number;
    total_token_usage: {
      input_tokens: number;
      output_tokens: number;
      total_cost: number;
    };
    popular_templates: Array<{
      template_id: string;
      template_name: string;
      usage_count: number;
    }>;
    llm_provider_usage: Array<{
      provider: string;
      model: string;
      usage_count: number;
      success_rate: number;
    }>;
    timeline: Array<{
      date: string;
      translations: number;
      success_rate: number;
      average_confidence: number;
    }>;
  }> {
    const queryString = params ? `?${apiClient.buildQueryParams(params)}` : '';
    const response = await apiClient.get<{
      total_translations: number;
      successful_translations: number;
      failed_translations: number;
      average_confidence_score: number;
      total_token_usage: {
        input_tokens: number;
        output_tokens: number;
        total_cost: number;
      };
      popular_templates: Array<{
        template_id: string;
        template_name: string;
        usage_count: number;
      }>;
      llm_provider_usage: Array<{
        provider: string;
        model: string;
        usage_count: number;
        success_rate: number;
      }>;
      timeline: Array<{
        date: string;
        translations: number;
        success_rate: number;
        average_confidence: number;
      }>;
    }>(`${this.basePath}/analytics/translations${queryString}`);
    return response.data;
  }

  // ============================================================================
  // HEALTH & STATUS
  // ============================================================================

  async getHealth(): Promise<{ status: string; version: string; timestamp: string; uptime_seconds: number }> {
    const response = await apiClient.get<{ status: string; version: string; timestamp: string; uptime_seconds: number }>(
      `${this.basePath}/health`
    );
    return response.data;
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /**
   * Get confidence score color for UI
   */
  getConfidenceScoreColor(score: number): string {
    if (score >= 0.8) return 'green';
    if (score >= 0.6) return 'yellow';
    return 'red';
  }

  /**
   * Format confidence score as percentage
   */
  formatConfidenceScore(score: number): string {
    return `${Math.round(score * 100)}%`;
  }

  /**
   * Calculate estimated cost for translation
   */
  estimateTranslationCost(
    inputTokens: number,
    outputTokens: number,
    provider: string,
    model: string
  ): number {
    // This would typically use real pricing data from the provider info
    const baseCostPer1K = {
      'openai-gpt-4': { input: 0.01, output: 0.03 },
      'openai-gpt-3.5-turbo': { input: 0.001, output: 0.002 },
      'anthropic-claude-3': { input: 0.008, output: 0.024 },
      'google-gemini-pro': { input: 0.0005, output: 0.0015 },
    };

    const key = `${provider}-${model}` as keyof typeof baseCostPer1K;
    const costs = baseCostPer1K[key] || { input: 0.001, output: 0.002 };

    return (inputTokens / 1000 * costs.input) + (outputTokens / 1000 * costs.output);
  }

  /**
   * Get supported translation formats
   */
  getSupportedFormats(): Array<{
    id: string;
    name: string;
    description: string;
    extensions: string[];
  }> {
    return [
      {
        id: 'markdown',
        name: 'Markdown',
        description: 'Clean, readable markdown format perfect for documentation',
        extensions: ['.md'],
      },
      {
        id: 'json',
        name: 'JSON Schema',
        description: 'Structured JSON format for programmatic consumption',
        extensions: ['.json'],
      },
      {
        id: 'yaml',
        name: 'YAML Configuration',
        description: 'Human-readable YAML format for configuration files',
        extensions: ['.yaml', '.yml'],
      },
      {
        id: 'custom',
        name: 'Custom Format',
        description: 'Custom format using your own template',
        extensions: [],
      },
    ];
  }

  /**
   * Get translation status color for UI
   */
  getTranslationStatusColor(status: string): string {
    switch (status) {
      case 'completed':
        return 'green';
      case 'processing':
        return 'blue';
      case 'failed':
        return 'red';
      case 'pending':
        return 'yellow';
      default:
        return 'gray';
    }
  }

  /**
   * Format token usage for display
   */
  formatTokenUsage(tokens: number): string {
    if (tokens < 1000) return `${tokens} tokens`;
    if (tokens < 1000000) return `${(tokens / 1000).toFixed(1)}K tokens`;
    return `${(tokens / 1000000).toFixed(1)}M tokens`;
  }
}

export const translationEngineService = new TranslationEngineService();
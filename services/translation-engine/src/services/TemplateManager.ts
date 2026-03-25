import { logger } from '../utils/logger';
import { LLMProvider, OutputFormat, TranslationType, PromptTemplate } from './LLMManager';
import { RedisClient } from '../cache/redis';
import { v4 as uuidv4 } from 'uuid';

export interface TemplateVariable {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description: string;
  defaultValue?: any;
  required: boolean;
  validation?: {
    pattern?: string;
    min?: number;
    max?: number;
    options?: string[];
  };
}

export interface TemplateMetrics {
  usageCount: number;
  successRate: number;
  averageRating: number;
  averageResponseTime: number;
  totalCost: number;
  lastUsed: Date;
  popularProjects: string[];
}

export interface TemplateValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  score: number;
  suggestions: string[];
}

export interface TemplateOptimization {
  originalTokens: number;
  optimizedTokens: number;
  optimizationMethods: string[];
  preservedQuality: number;
  recommendations: string[];
}

export interface TemplateTestResult {
  success: boolean;
  output: string;
  metrics: {
    responseTime: number;
    tokenCount: number;
    cost: number;
    qualityScore: number;
  };
  errors?: string[];
  warnings?: string[];
}

export class TemplateManager {
  private templates: Map<string, PromptTemplate> = new Map();
  private templateMetrics: Map<string, TemplateMetrics> = new Map();
  private templateCache: Map<string, any> = new Map();
  private redis: RedisClient | null = null;

  // Pre-built system templates for different use cases
  private systemTemplates: Map<string, Partial<PromptTemplate>> = new Map();

  async initialize(redisClient?: RedisClient): Promise<void> {
    try {
      this.redis = redisClient || null;
      
      // Initialize system templates
      await this.initializeSystemTemplates();
      
      // Load user templates from cache or database
      await this.loadTemplatesFromStorage();
      
      logger.info('Template Manager initialized successfully', {
        systemTemplates: this.systemTemplates.size,
        userTemplates: this.templates.size,
        totalTemplates: this.systemTemplates.size + this.templates.size
      });

    } catch (error) {
      logger.error('Failed to initialize Template Manager', { error: error.message });
      throw error;
    }
  }

  private async initializeSystemTemplates(): Promise<void> {
    // Component-focused template
    this.systemTemplates.set('component-translation', {
      name: 'Component Translation',
      systemPrompt: `You are a specialist in translating individual UI components into implementation-ready specifications. Focus on:
- Component props and state management
- Styling and theme integration
- Accessibility and semantic markup
- Reusability and composition patterns
- Performance optimizations`,
      userPromptTemplate: `# Component Translation Request

## Component Details:
{{componentData}}

## Design System Context:
{{designSystem}}

## Requirements:
- Output Format: {{format}}
- Target Framework: {{framework}}
- Accessibility Level: {{accessibilityLevel}}
- Performance Target: {{performanceTarget}}

## Instructions:
1. Analyze the component structure and behavior
2. Extract reusable patterns and props
3. Generate clean, typed component specifications
4. Include accessibility attributes and ARIA patterns
5. Optimize for performance and reusability

Please provide a complete component specification ready for implementation.`,
      variables: {
        componentData: { type: 'object', required: true },
        designSystem: { type: 'object', required: false },
        format: { type: 'string', defaultValue: 'markdown' },
        framework: { type: 'string', defaultValue: 'react' },
        accessibilityLevel: { type: 'string', defaultValue: 'AA' },
        performanceTarget: { type: 'string', defaultValue: 'modern' }
      },
      outputFormat: 'markdown' as OutputFormat,
      metadata: {
        category: 'component',
        tags: ['component', 'reusable', 'accessibility', 'performance'],
        description: 'Optimized for translating individual UI components'
      }
    });

    // Full page/screen template
    this.systemTemplates.set('page-translation', {
      name: 'Page Translation',
      systemPrompt: `You are a specialist in translating complete pages or screens into implementation-ready specifications. Focus on:
- Page layout and grid systems
- Navigation and routing patterns
- Data flow and state management
- Responsive design breakpoints
- SEO and meta information`,
      userPromptTemplate: `# Page Translation Request

## Page Structure:
{{pageData}}

## Layout System:
{{layoutSystem}}

## Navigation Context:
{{navigationContext}}

## Requirements:
- Output Format: {{format}}
- Device Targets: {{deviceTargets}}
- SEO Requirements: {{seoRequirements}}
- Performance Budget: {{performanceBudget}}

## Instructions:
1. Analyze the page structure and information architecture
2. Design responsive layout systems
3. Plan component composition and data flow
4. Include SEO optimization and meta data
5. Ensure cross-device compatibility

Please provide a complete page specification ready for implementation.`,
      variables: {
        pageData: { type: 'object', required: true },
        layoutSystem: { type: 'object', required: false },
        navigationContext: { type: 'object', required: false },
        format: { type: 'string', defaultValue: 'markdown' },
        deviceTargets: { type: 'array', defaultValue: ['desktop', 'tablet', 'mobile'] },
        seoRequirements: { type: 'object', defaultValue: {} },
        performanceBudget: { type: 'string', defaultValue: 'standard' }
      },
      outputFormat: 'markdown' as OutputFormat,
      metadata: {
        category: 'page',
        tags: ['page', 'layout', 'responsive', 'seo', 'navigation'],
        description: 'Optimized for translating complete pages and screens'
      }
    });

    // Design system template
    this.systemTemplates.set('design-system-translation', {
      name: 'Design System Translation',
      systemPrompt: `You are a specialist in translating design systems and style guides into implementation-ready token systems. Focus on:
- Design token hierarchies and naming conventions
- Component libraries and pattern documentation
- Theme systems and customization
- Cross-platform token mapping
- Design system governance`,
      userPromptTemplate: `# Design System Translation Request

## Design System Data:
{{designSystemData}}

## Token Categories:
{{tokenCategories}}

## Platform Targets:
{{platformTargets}}

## Requirements:
- Output Format: {{format}}
- Token Naming: {{tokenNaming}}
- Theme Support: {{themeSupport}}
- Documentation Level: {{documentationLevel}}

## Instructions:
1. Analyze design tokens and component patterns
2. Create hierarchical token systems
3. Document component specifications and usage
4. Plan theme and customization systems
5. Generate cross-platform compatible tokens

Please provide a complete design system specification ready for implementation.`,
      variables: {
        designSystemData: { type: 'object', required: true },
        tokenCategories: { type: 'array', defaultValue: ['colors', 'typography', 'spacing', 'shadows'] },
        platformTargets: { type: 'array', defaultValue: ['web', 'ios', 'android'] },
        format: { type: 'string', defaultValue: 'json' },
        tokenNaming: { type: 'string', defaultValue: 'semantic' },
        themeSupport: { type: 'boolean', defaultValue: true },
        documentationLevel: { type: 'string', defaultValue: 'comprehensive' }
      },
      outputFormat: 'json' as OutputFormat,
      metadata: {
        category: 'design-system',
        tags: ['design-system', 'tokens', 'themes', 'documentation', 'cross-platform'],
        description: 'Optimized for translating design systems and token hierarchies'
      }
    });

    // Accessibility-focused template
    this.systemTemplates.set('accessibility-translation', {
      name: 'Accessibility Translation',
      systemPrompt: `You are a specialist in translating designs with a focus on accessibility and inclusive design. Focus on:
- WCAG 2.1 AA/AAA compliance
- Screen reader compatibility
- Keyboard navigation patterns
- Color contrast and visual accessibility
- Cognitive and motor accessibility`,
      userPromptTemplate: `# Accessibility-Focused Translation Request

## Design Data:
{{designData}}

## Accessibility Requirements:
{{accessibilityRequirements}}

## User Personas:
{{userPersonas}}

## Requirements:
- Output Format: {{format}}
- WCAG Level: {{wcagLevel}}
- Assistive Technologies: {{assistiveTechnologies}}
- Testing Requirements: {{testingRequirements}}

## Instructions:
1. Analyze design for accessibility barriers
2. Add appropriate ARIA labels and roles
3. Ensure keyboard navigation support
4. Verify color contrast compliance
5. Include accessibility testing recommendations

Please provide an accessibility-compliant implementation specification.`,
      variables: {
        designData: { type: 'object', required: true },
        accessibilityRequirements: { type: 'object', defaultValue: { wcag: 'AA', screenReader: true } },
        userPersonas: { type: 'array', defaultValue: [] },
        format: { type: 'string', defaultValue: 'markdown' },
        wcagLevel: { type: 'string', defaultValue: 'AA' },
        assistiveTechnologies: { type: 'array', defaultValue: ['screen-reader', 'keyboard', 'voice'] },
        testingRequirements: { type: 'array', defaultValue: ['automated', 'manual'] }
      },
      outputFormat: 'markdown' as OutputFormat,
      metadata: {
        category: 'accessibility',
        tags: ['accessibility', 'wcag', 'inclusive-design', 'aria', 'keyboard-navigation'],
        description: 'Optimized for accessibility-compliant implementations'
      }
    });

    // Animation and interaction template
    this.systemTemplates.set('interaction-translation', {
      name: 'Interaction Translation',
      systemPrompt: `You are a specialist in translating interactive designs and animations into implementation-ready specifications. Focus on:
- Animation timing and easing functions
- Micro-interactions and feedback systems
- State transitions and loading states
- Gesture recognition and touch interactions
- Performance-optimized animations`,
      userPromptTemplate: `# Interaction Translation Request

## Interaction Data:
{{interactionData}}

## Animation Specifications:
{{animationSpecs}}

## Performance Constraints:
{{performanceConstraints}}

## Requirements:
- Output Format: {{format}}
- Animation Library: {{animationLibrary}}
- Performance Target: {{performanceTarget}}
- Accessibility Considerations: {{a11yConsiderations}}

## Instructions:
1. Analyze interaction patterns and timing
2. Define animation curves and duration
3. Plan state management for interactions
4. Ensure accessibility compliance for animations
5. Optimize for performance across devices

Please provide complete interaction and animation specifications.`,
      variables: {
        interactionData: { type: 'object', required: true },
        animationSpecs: { type: 'object', defaultValue: {} },
        performanceConstraints: { type: 'object', defaultValue: { fps: 60, budget: '16ms' } },
        format: { type: 'string', defaultValue: 'markdown' },
        animationLibrary: { type: 'string', defaultValue: 'css' },
        performanceTarget: { type: 'string', defaultValue: 'mobile-first' },
        a11yConsiderations: { type: 'boolean', defaultValue: true }
      },
      outputFormat: 'markdown' as OutputFormat,
      metadata: {
        category: 'interaction',
        tags: ['animation', 'interaction', 'micro-interactions', 'performance', 'accessibility'],
        description: 'Optimized for translating interactions and animations'
      }
    });

    logger.info('System templates initialized', {
      templateCount: this.systemTemplates.size,
      categories: Array.from(new Set(Array.from(this.systemTemplates.values()).map(t => t.metadata?.category)))
    });
  }

  private async loadTemplatesFromStorage(): Promise<void> {
    // In production, this would load from database
    // For now, we'll start with empty user templates
    logger.info('Template storage loaded', {
      userTemplatesLoaded: 0
    });
  }

  async createTemplate(templateData: Partial<PromptTemplate>, createdBy: string): Promise<PromptTemplate> {
    try {
      const template: PromptTemplate = {
        id: uuidv4(),
        name: templateData.name || 'Untitled Template',
        systemPrompt: templateData.systemPrompt || '',
        userPromptTemplate: templateData.userPromptTemplate || '',
        variables: templateData.variables || {},
        outputFormat: templateData.outputFormat || 'markdown',
        provider: templateData.provider || 'openai_gpt4',
        version: 1,
        metadata: {
          description: templateData.metadata?.description || '',
          category: templateData.metadata?.category || 'general',
          tags: templateData.metadata?.tags || [],
          author: createdBy,
          created: new Date(),
          updated: new Date()
        }
      };

      // Validate template
      const validation = await this.validateTemplate(template);
      if (!validation.valid) {
        throw new Error(`Template validation failed: ${validation.errors.join(', ')}`);
      }

      // Store template
      this.templates.set(template.id, template);
      
      // Initialize metrics
      this.templateMetrics.set(template.id, {
        usageCount: 0,
        successRate: 1.0,
        averageRating: 0,
        averageResponseTime: 0,
        totalCost: 0,
        lastUsed: new Date(),
        popularProjects: []
      });

      // Cache template if Redis available
      if (this.redis) {
        await this.cacheTemplate(template);
      }

      logger.info('Template created successfully', {
        templateId: template.id,
        name: template.name,
        category: template.metadata.category
      });

      return template;

    } catch (error) {
      logger.error('Failed to create template', { error: error.message });
      throw error;
    }
  }

  async getTemplate(templateId: string): Promise<PromptTemplate | null> {
    try {
      // Check user templates first
      const userTemplate = this.templates.get(templateId);
      if (userTemplate) {
        return userTemplate;
      }

      // Check system templates
      const systemTemplate = this.systemTemplates.get(templateId);
      if (systemTemplate) {
        return this.convertSystemTemplate(templateId, systemTemplate);
      }

      // Try cache if Redis available
      if (this.redis) {
        const cached = await this.getCachedTemplate(templateId);
        if (cached) {
          return cached;
        }
      }

      return null;

    } catch (error) {
      logger.error('Failed to get template', { templateId, error: error.message });
      return null;
    }
  }

  async updateTemplate(templateId: string, updates: Partial<PromptTemplate>, updatedBy: string): Promise<PromptTemplate | null> {
    try {
      const existingTemplate = await this.getTemplate(templateId);
      if (!existingTemplate) {
        throw new Error('Template not found');
      }

      const updatedTemplate: PromptTemplate = {
        ...existingTemplate,
        ...updates,
        id: templateId, // Preserve ID
        version: existingTemplate.version + 1,
        metadata: {
          ...existingTemplate.metadata,
          ...updates.metadata,
          updated: new Date()
        }
      };

      // Validate updated template
      const validation = await this.validateTemplate(updatedTemplate);
      if (!validation.valid) {
        throw new Error(`Template validation failed: ${validation.errors.join(', ')}`);
      }

      // Store updated template
      this.templates.set(templateId, updatedTemplate);

      // Update cache
      if (this.redis) {
        await this.cacheTemplate(updatedTemplate);
      }

      logger.info('Template updated successfully', {
        templateId,
        version: updatedTemplate.version,
        updatedBy
      });

      return updatedTemplate;

    } catch (error) {
      logger.error('Failed to update template', { templateId, error: error.message });
      throw error;
    }
  }

  async deleteTemplate(templateId: string): Promise<boolean> {
    try {
      const template = this.templates.get(templateId);
      if (!template) {
        return false;
      }

      // Remove from memory
      this.templates.delete(templateId);
      this.templateMetrics.delete(templateId);

      // Remove from cache
      if (this.redis) {
        await this.redis.del(`template:${templateId}`);
      }

      logger.info('Template deleted successfully', { templateId });
      return true;

    } catch (error) {
      logger.error('Failed to delete template', { templateId, error: error.message });
      return false;
    }
  }

  async listTemplates(options: {
    category?: string;
    provider?: LLMProvider;
    outputFormat?: OutputFormat;
    tags?: string[];
    search?: string;
    includeSystem?: boolean;
    limit?: number;
    offset?: number;
  } = {}): Promise<{ templates: PromptTemplate[]; total: number }> {
    try {
      let allTemplates: PromptTemplate[] = [];

      // Add user templates
      allTemplates.push(...Array.from(this.templates.values()));

      // Add system templates if requested
      if (options.includeSystem !== false) {
        for (const [id, systemTemplate] of this.systemTemplates.entries()) {
          allTemplates.push(this.convertSystemTemplate(id, systemTemplate));
        }
      }

      // Apply filters
      let filteredTemplates = allTemplates;

      if (options.category) {
        filteredTemplates = filteredTemplates.filter(t => 
          t.metadata.category === options.category
        );
      }

      if (options.provider) {
        filteredTemplates = filteredTemplates.filter(t => 
          t.provider === options.provider
        );
      }

      if (options.outputFormat) {
        filteredTemplates = filteredTemplates.filter(t => 
          t.outputFormat === options.outputFormat
        );
      }

      if (options.tags && options.tags.length > 0) {
        filteredTemplates = filteredTemplates.filter(t => 
          options.tags!.some(tag => t.metadata.tags.includes(tag))
        );
      }

      if (options.search) {
        const searchLower = options.search.toLowerCase();
        filteredTemplates = filteredTemplates.filter(t => 
          t.name.toLowerCase().includes(searchLower) ||
          t.metadata.description.toLowerCase().includes(searchLower) ||
          t.metadata.tags.some(tag => tag.toLowerCase().includes(searchLower))
        );
      }

      const total = filteredTemplates.length;

      // Apply pagination
      const offset = options.offset || 0;
      const limit = options.limit || 50;
      const paginatedTemplates = filteredTemplates.slice(offset, offset + limit);

      return {
        templates: paginatedTemplates,
        total
      };

    } catch (error) {
      logger.error('Failed to list templates', { error: error.message });
      return { templates: [], total: 0 };
    }
  }

  async validateTemplate(template: PromptTemplate): Promise<TemplateValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    try {
      // Basic validation
      if (!template.name || template.name.trim().length === 0) {
        errors.push('Template name is required');
      }

      if (!template.systemPrompt || template.systemPrompt.trim().length === 0) {
        warnings.push('System prompt is empty - consider adding context');
      }

      if (!template.userPromptTemplate || template.userPromptTemplate.trim().length === 0) {
        errors.push('User prompt template is required');
      }

      // Variable validation
      if (template.variables) {
        for (const [varName, varDef] of Object.entries(template.variables)) {
          if (!varName.match(/^[a-zA-Z][a-zA-Z0-9_]*$/)) {
            errors.push(`Invalid variable name: ${varName}`);
          }

          // Check if variables are used in template
          const placeholder = `{{${varName}}}`;
          if (!template.userPromptTemplate.includes(placeholder)) {
            warnings.push(`Variable ${varName} is defined but not used in template`);
          }
        }
      }

      // Check for undefined variables in template
      const variableMatches = template.userPromptTemplate.match(/\{\{(\w+)\}\}/g);
      if (variableMatches) {
        for (const match of variableMatches) {
          const varName = match.slice(2, -2);
          if (!template.variables || !template.variables[varName]) {
            errors.push(`Undefined variable in template: ${varName}`);
          }
        }
      }

      // Template quality suggestions
      if (template.systemPrompt.length < 100) {
        suggestions.push('Consider adding more context to the system prompt for better results');
      }

      if (template.userPromptTemplate.length < 200) {
        suggestions.push('Consider adding more detailed instructions to the user prompt template');
      }

      if (!template.metadata.tags || template.metadata.tags.length === 0) {
        suggestions.push('Add tags to improve template discoverability');
      }

      const score = Math.max(0, 100 - (errors.length * 25) - (warnings.length * 10));

      return {
        valid: errors.length === 0,
        errors,
        warnings,
        score,
        suggestions
      };

    } catch (error) {
      logger.error('Template validation failed', { error: error.message });
      return {
        valid: false,
        errors: ['Validation process failed'],
        warnings: [],
        score: 0,
        suggestions: []
      };
    }
  }

  async optimizeTemplate(template: PromptTemplate, targetProvider: LLMProvider): Promise<TemplateOptimization> {
    try {
      const originalTokens = this.estimateTokens(template.systemPrompt + template.userPromptTemplate);
      
      let optimizedSystemPrompt = template.systemPrompt;
      let optimizedUserPrompt = template.userPromptTemplate;
      const optimizationMethods: string[] = [];

      // Provider-specific optimizations
      switch (targetProvider) {
        case 'openai_gpt35':
          // Optimize for GPT-3.5's shorter context window
          if (originalTokens > 3000) {
            optimizedSystemPrompt = this.compressPrompt(optimizedSystemPrompt, 0.7);
            optimizedUserPrompt = this.compressPrompt(optimizedUserPrompt, 0.8);
            optimizationMethods.push('prompt_compression');
          }
          break;

        case 'anthropic_claude':
          // Optimize for Claude's structured approach
          optimizedSystemPrompt = this.structurePromptForClaude(optimizedSystemPrompt);
          optimizationMethods.push('claude_structuring');
          break;

        case 'google_gemini':
          // Optimize for Gemini's multimodal capabilities
          optimizedUserPrompt = this.enhanceForMultimodal(optimizedUserPrompt);
          optimizationMethods.push('multimodal_enhancement');
          break;
      }

      // General optimizations
      if (this.hasRedundantInstructions(template.userPromptTemplate)) {
        optimizedUserPrompt = this.removeRedundancy(optimizedUserPrompt);
        optimizationMethods.push('redundancy_removal');
      }

      if (this.canImproveClarity(template.userPromptTemplate)) {
        optimizedUserPrompt = this.improveClarity(optimizedUserPrompt);
        optimizationMethods.push('clarity_improvement');
      }

      const optimizedTokens = this.estimateTokens(optimizedSystemPrompt + optimizedUserPrompt);
      const preservedQuality = this.calculateQualityPreservation(template, {
        systemPrompt: optimizedSystemPrompt,
        userPromptTemplate: optimizedUserPrompt
      });

      return {
        originalTokens,
        optimizedTokens,
        optimizationMethods,
        preservedQuality,
        recommendations: this.generateOptimizationRecommendations(template, targetProvider)
      };

    } catch (error) {
      logger.error('Template optimization failed', { error: error.message });
      throw error;
    }
  }

  async testTemplate(template: PromptTemplate, testData: any, provider: LLMProvider): Promise<TemplateTestResult> {
    try {
      const startTime = Date.now();
      
      // Apply variables to template
      const processedPrompt = this.applyVariables(template.userPromptTemplate, template.variables, testData);
      
      // Simulate LLM call (in production, this would call the actual LLM)
      const mockResponse = this.generateMockResponse(template, testData);
      
      const responseTime = Date.now() - startTime;
      const tokenCount = this.estimateTokens(processedPrompt + mockResponse);
      const cost = this.estimateCost(tokenCount, provider);
      const qualityScore = this.calculateQualityScore(mockResponse);

      return {
        success: true,
        output: mockResponse,
        metrics: {
          responseTime,
          tokenCount,
          cost,
          qualityScore
        }
      };

    } catch (error) {
      logger.error('Template test failed', { error: error.message });
      return {
        success: false,
        output: '',
        metrics: {
          responseTime: 0,
          tokenCount: 0,
          cost: 0,
          qualityScore: 0
        },
        errors: [error.message]
      };
    }
  }

  async getTemplateMetrics(templateId: string): Promise<TemplateMetrics | null> {
    return this.templateMetrics.get(templateId) || null;
  }

  async updateTemplateMetrics(templateId: string, usage: {
    success: boolean;
    responseTime: number;
    cost: number;
    rating?: number;
    projectId?: string;
  }): Promise<void> {
    try {
      const metrics = this.templateMetrics.get(templateId) || {
        usageCount: 0,
        successRate: 1.0,
        averageRating: 0,
        averageResponseTime: 0,
        totalCost: 0,
        lastUsed: new Date(),
        popularProjects: []
      };

      // Update metrics
      metrics.usageCount += 1;
      metrics.successRate = (metrics.successRate * (metrics.usageCount - 1) + (usage.success ? 1 : 0)) / metrics.usageCount;
      metrics.averageResponseTime = (metrics.averageResponseTime * (metrics.usageCount - 1) + usage.responseTime) / metrics.usageCount;
      metrics.totalCost += usage.cost;
      metrics.lastUsed = new Date();

      if (usage.rating) {
        metrics.averageRating = (metrics.averageRating * (metrics.usageCount - 1) + usage.rating) / metrics.usageCount;
      }

      if (usage.projectId && !metrics.popularProjects.includes(usage.projectId)) {
        metrics.popularProjects.push(usage.projectId);
        if (metrics.popularProjects.length > 10) {
          metrics.popularProjects = metrics.popularProjects.slice(-10);
        }
      }

      this.templateMetrics.set(templateId, metrics);

    } catch (error) {
      logger.error('Failed to update template metrics', { templateId, error: error.message });
    }
  }

  // Helper methods
  private convertSystemTemplate(id: string, systemTemplate: Partial<PromptTemplate>): PromptTemplate {
    return {
      id,
      name: systemTemplate.name || 'System Template',
      systemPrompt: systemTemplate.systemPrompt || '',
      userPromptTemplate: systemTemplate.userPromptTemplate || '',
      variables: systemTemplate.variables || {},
      outputFormat: systemTemplate.outputFormat || 'markdown',
      provider: systemTemplate.provider || 'openai_gpt4',
      version: 1,
      metadata: {
        description: systemTemplate.metadata?.description || '',
        category: systemTemplate.metadata?.category || 'system',
        tags: systemTemplate.metadata?.tags || [],
        author: 'System',
        created: new Date(),
        updated: new Date()
      }
    };
  }

  private async cacheTemplate(template: PromptTemplate): Promise<void> {
    if (!this.redis) return;
    
    try {
      await this.redis.setex(
        `template:${template.id}`,
        3600, // 1 hour
        JSON.stringify(template)
      );
    } catch (error) {
      logger.warn('Failed to cache template', { templateId: template.id, error: error.message });
    }
  }

  private async getCachedTemplate(templateId: string): Promise<PromptTemplate | null> {
    if (!this.redis) return null;
    
    try {
      const cached = await this.redis.get(`template:${templateId}`);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      logger.warn('Failed to get cached template', { templateId, error: error.message });
      return null;
    }
  }

  private applyVariables(template: string, variables: Record<string, any>, data: any): string {
    let result = template;
    
    for (const [varName, varConfig] of Object.entries(variables)) {
      const placeholder = `{{${varName}}}`;
      const value = data[varName] !== undefined ? data[varName] : varConfig.defaultValue;
      
      if (value !== undefined) {
        const stringValue = typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value);
        result = result.replace(new RegExp(placeholder, 'g'), stringValue);
      }
    }
    
    return result;
  }

  private estimateTokens(text: string): number {
    // Rough estimation: ~4 characters per token
    return Math.ceil(text.length / 4);
  }

  private estimateCost(tokens: number, provider: LLMProvider): number {
    const pricing = {
      openai_gpt4: 0.03,
      openai_gpt35: 0.002,
      anthropic_claude: 0.015,
      google_gemini: 0.001
    };
    
    return (tokens / 1000) * (pricing[provider] || 0.01);
  }

  private compressPrompt(prompt: string, ratio: number): string {
    // Simple compression by removing redundant words and phrases
    return prompt
      .replace(/\s+/g, ' ')
      .replace(/,\s*and\s+/g, ', ')
      .replace(/\s*(please|kindly)\s+/gi, ' ')
      .trim();
  }

  private structurePromptForClaude(prompt: string): string {
    // Add clear structure for Claude
    if (!prompt.includes('##')) {
      return `## Task Overview\n${prompt}\n\n## Instructions\nPlease provide a detailed, structured response.`;
    }
    return prompt;
  }

  private enhanceForMultimodal(prompt: string): string {
    // Add multimodal considerations for Gemini
    if (!prompt.includes('visual') && !prompt.includes('image')) {
      return prompt + '\n\nNote: Consider visual elements and spatial relationships in your analysis.';
    }
    return prompt;
  }

  private hasRedundantInstructions(prompt: string): boolean {
    const instructions = prompt.toLowerCase();
    return instructions.includes('please') && instructions.includes('kindly');
  }

  private removeRedundancy(prompt: string): string {
    return prompt.replace(/please\s+kindly\s+/gi, 'please ');
  }

  private canImproveClarity(prompt: string): boolean {
    return prompt.length > 1000 && !prompt.includes('##') && !prompt.includes('1.');
  }

  private improveClarity(prompt: string): string {
    // Add structure to improve clarity
    const parts = prompt.split('\n\n');
    if (parts.length > 1) {
      return parts.map((part, index) => `${index + 1}. ${part}`).join('\n\n');
    }
    return prompt;
  }

  private calculateQualityPreservation(original: PromptTemplate, optimized: { systemPrompt: string; userPromptTemplate: string }): number {
    // Simple quality preservation calculation based on content similarity
    const originalContent = original.systemPrompt + original.userPromptTemplate;
    const optimizedContent = optimized.systemPrompt + optimized.userPromptTemplate;
    
    const originalWords = originalContent.toLowerCase().split(/\s+/);
    const optimizedWords = optimizedContent.toLowerCase().split(/\s+/);
    
    const commonWords = originalWords.filter(word => optimizedWords.includes(word));
    
    return Math.min(0.95, commonWords.length / originalWords.length);
  }

  private generateOptimizationRecommendations(template: PromptTemplate, provider: LLMProvider): string[] {
    const recommendations: string[] = [];
    
    if (this.estimateTokens(template.systemPrompt + template.userPromptTemplate) > 4000) {
      recommendations.push('Consider breaking down the template into smaller, more focused templates');
    }
    
    if (provider === 'openai_gpt35' && template.systemPrompt.length > 1000) {
      recommendations.push('For GPT-3.5, consider using a more concise system prompt');
    }
    
    if (Object.keys(template.variables).length > 10) {
      recommendations.push('Consider reducing the number of variables for simpler template management');
    }
    
    return recommendations;
  }

  private generateMockResponse(template: PromptTemplate, testData: any): string {
    // Generate a mock response based on template and test data
    return `Mock response for template "${template.name}" with ${template.outputFormat} format. Test data processed successfully.`;
  }

  private calculateQualityScore(response: string): number {
    // Simple quality scoring based on response characteristics
    let score = 0.5;
    
    if (response.length > 100) score += 0.2;
    if (response.includes('```')) score += 0.1; // Has code blocks
    if (response.includes('#')) score += 0.1; // Has headers
    if (response.length > 500) score += 0.1;
    
    return Math.min(1.0, score);
  }

  // Public API methods
  getSupportedCategories(): string[] {
    const categories = new Set<string>();
    
    // Add system template categories
    for (const template of this.systemTemplates.values()) {
      if (template.metadata?.category) {
        categories.add(template.metadata.category);
      }
    }
    
    // Add user template categories
    for (const template of this.templates.values()) {
      categories.add(template.metadata.category);
    }
    
    return Array.from(categories);
  }

  getPopularTemplates(limit = 10): PromptTemplate[] {
    const templatesWithMetrics = Array.from(this.templates.values())
      .map(template => ({
        template,
        metrics: this.templateMetrics.get(template.id)
      }))
      .filter(item => item.metrics)
      .sort((a, b) => (b.metrics!.usageCount * b.metrics!.successRate) - (a.metrics!.usageCount * a.metrics!.successRate))
      .slice(0, limit);
    
    return templatesWithMetrics.map(item => item.template);
  }

  async shutdown(): Promise<void> {
    logger.info('Shutting down Template Manager...');
    
    // Clear caches
    this.templateCache.clear();
    
    // Close Redis connection if needed
    // Redis connection is managed externally
    
    logger.info('Template Manager shutdown complete');
  }
}
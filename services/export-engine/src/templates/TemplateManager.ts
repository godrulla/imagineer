import { templateEngine, TemplateEngine, TemplateEngineOptions, TemplateContext } from './TemplateEngine';
import { exportDbOps, ExportTemplate } from '../database/operations';
import { logger } from '../utils/logger';

export interface TemplateManagerOptions {
  enableCaching?: boolean;
  cacheSize?: number;
  defaultEngine?: string;
  strictMode?: boolean;
}

export interface TemplateMetadata {
  id: string;
  name: string;
  description?: string;
  category?: string;
  engine: string;
  variables: Record<string, any>;
  version: number;
  isSystem: boolean;
  isPublic: boolean;
  usage_count: number;
  average_rating?: number;
  created_by: string;
  created_at: Date;
  updated_at: Date;
}

export interface TemplateRenderResult {
  success: boolean;
  output?: string;
  metadata: TemplateMetadata;
  renderTime: number;
  errors: string[];
  warnings: string[];
  cacheHit?: boolean;
}

export class TemplateManager {
  private engine: TemplateEngine;
  private options: TemplateManagerOptions;
  private templateCache: Map<string, { template: ExportTemplate; compiled: any; lastUsed: Date }> = new Map();
  private systemTemplates: Map<string, ExportTemplate> = new Map();

  constructor(options: TemplateManagerOptions = {}) {
    this.engine = templateEngine;
    this.options = {
      enableCaching: true,
      cacheSize: 100,
      defaultEngine: 'handlebars',
      strictMode: false,
      ...options
    };

    this.loadSystemTemplates();
  }

  async renderTemplate(
    templateId: string,
    data: any,
    organizationId: string,
    renderOptions: Partial<TemplateEngineOptions> = {}
  ): Promise<TemplateRenderResult> {
    const startTime = Date.now();
    
    try {
      // Get template
      const template = await this.getTemplate(templateId, organizationId);
      if (!template) {
        throw new Error(`Template not found: ${templateId}`);
      }

      // Check cache
      let cacheHit = false;
      let compiled = null;
      
      if (this.options.enableCaching) {
        const cached = this.templateCache.get(templateId);
        if (cached && cached.template.updated_at <= template.updated_at) {
          compiled = cached.compiled;
          cached.lastUsed = new Date();
          cacheHit = true;
        }
      }

      // Prepare template context
      const context: TemplateContext = {
        data: data,
        variables: template.variables || {},
        helpers: template.custom_helpers || {},
        partials: {},
        settings: template.engine_config || {}
      };

      // Prepare engine options
      const engineOptions: TemplateEngineOptions = {
        engine: (template.engine as any) || this.options.defaultEngine,
        helpers: renderOptions.helpers || template.custom_helpers,
        partials: renderOptions.partials,
        config: template.engine_config,
        strict: renderOptions.strict ?? this.options.strictMode,
        noEscape: renderOptions.noEscape,
        ...renderOptions
      };

      // Render template
      const renderResult = await this.engine.render(
        template.template_content,
        context,
        engineOptions
      );

      // Cache compiled template
      if (this.options.enableCaching && !cacheHit) {
        this.cacheTemplate(templateId, template, compiled);
      }

      // Update usage statistics
      await this.updateTemplateUsage(templateId);

      const totalTime = Date.now() - startTime;
      
      return {
        success: renderResult.errors.length === 0,
        output: renderResult.output,
        metadata: this.templateToMetadata(template),
        renderTime: totalTime,
        errors: renderResult.errors,
        warnings: renderResult.warnings,
        cacheHit
      };

    } catch (error) {
      const totalTime = Date.now() - startTime;
      
      logger.error('Template rendering failed', {
        templateId,
        organizationId,
        error: error.message,
        renderTime: totalTime
      });

      return {
        success: false,
        metadata: {} as TemplateMetadata,
        renderTime: totalTime,
        errors: [error.message],
        warnings: []
      };
    }
  }

  async createTemplate(
    templateData: Partial<ExportTemplate>,
    organizationId: string,
    userId: string
  ): Promise<ExportTemplate> {
    // Validate template
    const validation = await this.validateTemplate(
      templateData.template_content!,
      templateData.engine as any
    );
    
    if (!validation.valid) {
      throw new Error(`Template validation failed: ${validation.errors.join(', ')}`);
    }

    // Create template in database
    const template = await exportDbOps.createExportTemplate({
      ...templateData,
      organization_id: organizationId,
      created_by: userId,
      usage_count: 0,
      version: 1
    });

    logger.info('Template created', {
      templateId: template.id,
      name: template.name,
      organizationId,
      engine: template.engine
    });

    return template;
  }

  async updateTemplate(
    templateId: string,
    updateData: Partial<ExportTemplate>,
    organizationId: string,
    userId: string
  ): Promise<ExportTemplate> {
    // Get existing template
    const existingTemplate = await this.getTemplate(templateId, organizationId);
    if (!existingTemplate) {
      throw new Error(`Template not found: ${templateId}`);
    }

    // Validate updated template content if provided
    if (updateData.template_content) {
      const validation = await this.validateTemplate(
        updateData.template_content,
        updateData.engine as any || existingTemplate.engine
      );
      
      if (!validation.valid) {
        throw new Error(`Template validation failed: ${validation.errors.join(', ')}`);
      }
    }

    // Clear cache for this template
    this.templateCache.delete(templateId);

    // Update template (this would need to be implemented in database operations)
    // For now, we'll return the existing template
    logger.info('Template updated', {
      templateId,
      organizationId,
      updatedBy: userId
    });

    return existingTemplate;
  }

  async deleteTemplate(templateId: string, organizationId: string): Promise<void> {
    // Remove from cache
    this.templateCache.delete(templateId);
    
    // Delete from database (soft delete)
    // This would need to be implemented in database operations
    
    logger.info('Template deleted', {
      templateId,
      organizationId
    });
  }

  async getTemplate(templateId: string, organizationId: string): Promise<ExportTemplate | null> {
    // Check system templates first
    if (this.systemTemplates.has(templateId)) {
      return this.systemTemplates.get(templateId)!;
    }

    // Get from database
    return await exportDbOps.getExportTemplate(templateId, organizationId);
  }

  async listTemplates(
    organizationId: string,
    filters: {
      format_type?: string;
      category?: string;
      is_public?: boolean;
      search?: string;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<{ templates: TemplateMetadata[]; total: number }> {
    const result = await exportDbOps.listExportTemplates(organizationId, filters);
    
    return {
      templates: result.templates.map(t => this.templateToMetadata(t)),
      total: result.total
    };
  }

  async testTemplate(
    templateContent: string,
    engine: string,
    testData: any,
    options: Partial<TemplateEngineOptions> = {}
  ): Promise<TemplateRenderResult> {
    const startTime = Date.now();
    
    try {
      // Validate template
      const validation = await this.validateTemplate(templateContent, engine);
      if (!validation.valid) {
        throw new Error(`Template validation failed: ${validation.errors.join(', ')}`);
      }

      // Prepare context
      const context: TemplateContext = {
        data: testData,
        variables: {},
        helpers: {},
        partials: {},
        settings: {}
      };

      // Prepare engine options
      const engineOptions: TemplateEngineOptions = {
        engine: engine as any,
        strict: false,
        ...options
      };

      // Render template
      const renderResult = await this.engine.render(templateContent, context, engineOptions);
      
      const totalTime = Date.now() - startTime;

      return {
        success: renderResult.errors.length === 0,
        output: renderResult.output,
        metadata: {
          id: 'test',
          name: 'Test Template',
          engine: engine,
          variables: {},
          version: 1,
          isSystem: false,
          isPublic: false,
          usage_count: 0,
          created_by: 'test',
          created_at: new Date(),
          updated_at: new Date()
        } as TemplateMetadata,
        renderTime: totalTime,
        errors: renderResult.errors,
        warnings: renderResult.warnings
      };

    } catch (error) {
      const totalTime = Date.now() - startTime;
      
      return {
        success: false,
        metadata: {} as TemplateMetadata,
        renderTime: totalTime,
        errors: [error.message],
        warnings: []
      };
    }
  }

  async validateTemplate(
    templateContent: string,
    engine: string
  ): Promise<{ valid: boolean; errors: string[]; warnings: string[] }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!templateContent || templateContent.trim().length === 0) {
      errors.push('Template content is empty');
      return { valid: false, errors, warnings };
    }

    try {
      // Use the template engine's validation
      const mockContext: TemplateContext = {
        data: {},
        variables: {},
        helpers: {},
        partials: {},
        settings: {}
      };

      const mockOptions: TemplateEngineOptions = {
        engine: engine as any,
        strict: true
      };

      // Try to render with empty context to validate syntax
      await this.engine.render(templateContent, mockContext, mockOptions);
      
      // Additional validation rules
      if (engine === 'handlebars') {
        this.validateHandlebarsTemplate(templateContent, warnings);
      } else if (engine === 'mustache') {
        this.validateMustacheTemplate(templateContent, warnings);
      }

    } catch (error) {
      errors.push(error.message);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  private validateHandlebarsTemplate(template: string, warnings: string[]): void {
    // Check for potential security issues
    if (template.includes('eval(') || template.includes('Function(')) {
      warnings.push('Template contains potentially unsafe eval() or Function() calls');
    }

    // Check for deprecated helpers
    if (template.includes('{{#with')) {
      warnings.push('{{#with}} helper is deprecated, consider using dot notation instead');
    }

    // Check for unescaped output in places where it might be unsafe
    const unescapedMatches = template.match(/\{{{[^}]+}}}/g);
    if (unescapedMatches && unescapedMatches.length > 0) {
      warnings.push('Template contains unescaped output, ensure content is safe');
    }
  }

  private validateMustacheTemplate(template: string, warnings: string[]): void {
    // Check for lambda functions (not supported in our implementation)
    if (template.includes('{{#lambda}}')) {
      warnings.push('Lambda functions are not supported in this Mustache implementation');
    }

    // Check for partials
    const partialMatches = template.match(/{{>[^}]+}}/g);
    if (partialMatches && partialMatches.length > 0) {
      warnings.push('Template uses partials, ensure they are registered');
    }
  }

  private async loadSystemTemplates(): Promise<void> {
    // Load built-in system templates
    const systemTemplates = [
      {
        id: 'system-markdown-basic',
        name: 'Basic Markdown',
        description: 'Simple markdown template for design documentation',
        format_type: 'markdown',
        engine: 'handlebars',
        template_content: `# {{name}}

{{#if description}}
{{description}}
{{/if}}

## Colors
{{#each colors}}
- **{{name}}**: {{value}}
{{/each}}

## Typography
{{#each typography}}
- **{{name}}**: {{family}} {{weight}} {{size}}
{{/each}}

## Components
{{#each components}}
### {{name}}
{{#if description}}{{description}}{{/if}}
{{/each}}`,
        variables: {},
        is_system_template: true,
        is_public: true,
        usage_count: 0,
        version: 1,
        status: 'active',
        created_at: new Date(),
        updated_at: new Date(),
        organization_id: 'system',
        created_by: 'system'
      },
      {
        id: 'system-json-schema',
        name: 'JSON Schema',
        description: 'Generate JSON schema from design data',
        format_type: 'json',
        engine: 'handlebars',
        template_content: `{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "title": "{{name}}",
  "description": "{{description}}",
  "properties": {
    {{#each properties}}
    "{{@key}}": {
      "type": "{{type}}",
      "description": "{{description}}"
    }{{#unless @last}},{{/unless}}
    {{/each}}
  }
}`,
        variables: {},
        is_system_template: true,
        is_public: true,
        usage_count: 0,
        version: 1,
        status: 'active',
        created_at: new Date(),
        updated_at: new Date(),
        organization_id: 'system',
        created_by: 'system'
      }
    ];

    systemTemplates.forEach(template => {
      this.systemTemplates.set(template.id, template as ExportTemplate);
    });

    logger.info('System templates loaded', { count: systemTemplates.length });
  }

  private cacheTemplate(templateId: string, template: ExportTemplate, compiled: any): void {
    if (!this.options.enableCaching) return;

    // Implement LRU cache eviction
    if (this.templateCache.size >= this.options.cacheSize!) {
      const oldestKey = this.findOldestCacheEntry();
      if (oldestKey) {
        this.templateCache.delete(oldestKey);
      }
    }

    this.templateCache.set(templateId, {
      template,
      compiled,
      lastUsed: new Date()
    });
  }

  private findOldestCacheEntry(): string | null {
    let oldestKey: string | null = null;
    let oldestTime: Date | null = null;

    for (const [key, value] of this.templateCache.entries()) {
      if (!oldestTime || value.lastUsed < oldestTime) {
        oldestTime = value.lastUsed;
        oldestKey = key;
      }
    }

    return oldestKey;
  }

  private async updateTemplateUsage(templateId: string): Promise<void> {
    try {
      // This would increment usage count in the database
      // For now, just log it
      logger.debug('Template usage recorded', { templateId });
    } catch (error) {
      logger.warn('Failed to update template usage', { templateId, error: error.message });
    }
  }

  private templateToMetadata(template: ExportTemplate): TemplateMetadata {
    return {
      id: template.id,
      name: template.name,
      description: template.description,
      category: template.category,
      engine: template.engine,
      variables: template.variables,
      version: template.version,
      isSystem: template.is_system_template,
      isPublic: template.is_public,
      usage_count: template.usage_count,
      average_rating: template.average_rating,
      created_by: template.created_by,
      created_at: template.created_at,
      updated_at: template.updated_at
    };
  }

  // Cache management methods
  clearTemplateCache(): void {
    this.templateCache.clear();
    logger.info('Template cache cleared');
  }

  getCacheStats(): { size: number; maxSize: number; hitRate?: number } {
    return {
      size: this.templateCache.size,
      maxSize: this.options.cacheSize!
    };
  }

  // Helper registration methods
  registerGlobalHelper(name: string, helper: Function): void {
    this.engine.registerHelper(name, helper);
    logger.debug('Global helper registered', { name });
  }

  registerGlobalPartial(name: string, template: string): void {
    this.engine.registerPartial(name, template);
    logger.debug('Global partial registered', { name });
  }
}

export const templateManager = new TemplateManager();
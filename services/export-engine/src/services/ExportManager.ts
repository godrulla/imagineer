import { v4 as uuidv4 } from 'uuid';
import { marked } from 'marked';
import TurndownService from 'turndown';
import * as yaml from 'js-yaml';
import Mustache from 'mustache';
import Handlebars from 'handlebars';
import { logger } from '../utils/logger';
import { ExportError } from '../middleware/errorHandler';
import { StorageManager } from './StorageManager';
import { ExportCache } from '../cache/redis';

export interface ExportRequest {
  designData: any;
  translationData?: any;
  format: ExportFormat;
  options: ExportOptions;
  customTemplate?: string;
}

export interface ExportOptions {
  includeMetadata?: boolean;
  includeAssets?: boolean;
  includeComments?: boolean;
  optimizeSize?: boolean;
  prettyPrint?: boolean;
  minify?: boolean;
  templateId?: string;
  customSettings?: { [key: string]: any };
}

export type ExportFormat = 
  | 'markdown'
  | 'json' 
  | 'yaml'
  | 'html'
  | 'css'
  | 'jsx'
  | 'vue'
  | 'angular'
  | 'figma-plugin'
  | 'sketch-plugin'
  | 'pdf'
  | 'zip'
  | 'custom';

export interface ExportResult {
  id: string;
  format: ExportFormat;
  content?: string;
  fileUrl?: string;
  metadata: {
    size: number;
    generatedAt: string;
    processingTime: number;
    format: ExportFormat;
    options: ExportOptions;
  };
  assets?: string[];
}

export interface ExportTemplate {
  id: string;
  name: string;
  description: string;
  format: ExportFormat;
  template: string;
  variables: string[];
  category: 'ui-framework' | 'documentation' | 'handoff' | 'custom';
  tags: string[];
}

export class ExportManager {
  private templates: Map<string, ExportTemplate> = new Map();
  private turndown: TurndownService;

  constructor(private storageManager: StorageManager) {
    this.turndown = new TurndownService({
      headingStyle: 'atx',
      bulletListMarker: '-',
      codeBlockStyle: 'fenced'
    });
  }

  async initialize(): Promise<void> {
    try {
      // Load built-in templates
      await this.loadBuiltInTemplates();
      
      // Load custom templates from database
      await this.loadCustomTemplates();
      
      // Setup Handlebars helpers
      this.setupHandlebarsHelpers();
      
      logger.info('Export Manager initialized successfully', {
        templatesLoaded: this.templates.size
      });
    } catch (error) {
      logger.error('Failed to initialize Export Manager', { error: error.message });
      throw error;
    }
  }

  async generateExport(request: ExportRequest): Promise<ExportResult> {
    const startTime = Date.now();
    const exportId = uuidv4();

    try {
      logger.info('Starting export generation', {
        exportId,
        format: request.format,
        options: request.options
      });

      // Check cache first
      const cacheKey = ExportCache.generateExportKey(request);
      const cached = await ExportCache.getExport(cacheKey);
      if (cached) {
        logger.info('Returning cached export', { exportId, cacheHit: true });
        return cached;
      }

      // Generate export based on format
      let result: ExportResult;

      switch (request.format) {
        case 'markdown':
          result = await this.generateMarkdown(exportId, request);
          break;
        case 'json':
          result = await this.generateJSON(exportId, request);
          break;
        case 'yaml':
          result = await this.generateYAML(exportId, request);
          break;
        case 'html':
          result = await this.generateHTML(exportId, request);
          break;
        case 'css':
          result = await this.generateCSS(exportId, request);
          break;
        case 'jsx':
          result = await this.generateJSX(exportId, request);
          break;
        case 'vue':
          result = await this.generateVue(exportId, request);
          break;
        case 'angular':
          result = await this.generateAngular(exportId, request);
          break;
        case 'pdf':
          result = await this.generatePDF(exportId, request);
          break;
        case 'zip':
          result = await this.generateZip(exportId, request);
          break;
        case 'custom':
          result = await this.generateCustom(exportId, request);
          break;
        default:
          throw new ExportError(`Unsupported export format: ${request.format}`);
      }

      result.metadata.processingTime = Date.now() - startTime;
      
      // Cache the result
      await ExportCache.cacheExport(cacheKey, result);

      logger.info('Export generation completed', {
        exportId,
        format: request.format,
        size: result.metadata.size,
        processingTime: result.metadata.processingTime
      });

      return result;

    } catch (error) {
      logger.error('Export generation failed', {
        exportId,
        format: request.format,
        error: error.message,
        processingTime: Date.now() - startTime
      });
      
      throw new ExportError(`Export failed: ${error.message}`);
    }
  }

  private async generateMarkdown(id: string, request: ExportRequest): Promise<ExportResult> {
    const { designData, translationData, options } = request;
    
    let content = '';
    
    // Add header
    content += `# Design Specification\n\n`;
    
    if (options.includeMetadata) {
      content += `## Metadata\n`;
      content += `- Generated: ${new Date().toISOString()}\n`;
      content += `- Format: Markdown\n`;
      content += `- Elements: ${designData.elements?.length || 0}\n\n`;
    }

    // Add design overview
    if (designData.name || designData.title) {
      content += `## ${designData.name || designData.title}\n\n`;
    }

    // Add elements section
    if (designData.elements) {
      content += `## Design Elements\n\n`;
      
      designData.elements.forEach((element: any, index: number) => {
        content += `### ${index + 1}. ${element.name || element.type}\n\n`;
        content += `- **Type**: ${element.type}\n`;
        
        if (element.bounds) {
          content += `- **Position**: (${element.bounds.x}, ${element.bounds.y})\n`;
          content += `- **Size**: ${element.bounds.width}×${element.bounds.height}px\n`;
        }
        
        if (element.styles) {
          content += `- **Styles**:\n`;
          Object.entries(element.styles).forEach(([key, value]) => {
            if (value && typeof value === 'object') {
              content += `  - ${key}: ${JSON.stringify(value)}\n`;
            } else {
              content += `  - ${key}: ${value}\n`;
            }
          });
        }
        
        content += `\n`;
      });
    }

    // Add translation data if available
    if (translationData) {
      content += `## Implementation Notes\n\n`;
      content += `${translationData}\n\n`;
    }

    // Add footer
    content += `---\n\n`;
    content += `*Generated by Imagineer Export Engine*\n`;

    const result: ExportResult = {
      id,
      format: 'markdown',
      content,
      metadata: {
        size: Buffer.byteLength(content, 'utf8'),
        generatedAt: new Date().toISOString(),
        processingTime: 0,
        format: 'markdown',
        options
      }
    };

    return result;
  }

  private async generateJSON(id: string, request: ExportRequest): Promise<ExportResult> {
    const { designData, translationData, options } = request;

    const jsonData = {
      metadata: options.includeMetadata ? {
        id,
        generatedAt: new Date().toISOString(),
        format: 'json',
        version: '1.0.0'
      } : undefined,
      design: designData,
      translation: translationData,
      ...(options.customSettings || {})
    };

    const content = options.prettyPrint 
      ? JSON.stringify(jsonData, null, 2)
      : JSON.stringify(jsonData);

    return {
      id,
      format: 'json',
      content,
      metadata: {
        size: Buffer.byteLength(content, 'utf8'),
        generatedAt: new Date().toISOString(),
        processingTime: 0,
        format: 'json',
        options
      }
    };
  }

  private async generateYAML(id: string, request: ExportRequest): Promise<ExportResult> {
    const { designData, translationData, options } = request;

    const yamlData = {
      metadata: options.includeMetadata ? {
        id,
        generatedAt: new Date().toISOString(),
        format: 'yaml',
        version: '1.0.0'
      } : undefined,
      design: designData,
      translation: translationData,
      ...(options.customSettings || {})
    };

    const content = yaml.dump(yamlData, {
      indent: 2,
      lineWidth: 120,
      sortKeys: true
    });

    return {
      id,
      format: 'yaml',
      content,
      metadata: {
        size: Buffer.byteLength(content, 'utf8'),
        generatedAt: new Date().toISOString(),
        processingTime: 0,
        format: 'yaml',
        options
      }
    };
  }

  private async generateHTML(id: string, request: ExportRequest): Promise<ExportResult> {
    const { designData, translationData, options } = request;

    // Get template
    const template = this.getTemplate(options.templateId || 'html-basic');
    if (!template) {
      throw new ExportError('HTML template not found');
    }

    // Prepare template data
    const templateData = {
      title: designData.name || 'Design Export',
      elements: designData.elements || [],
      styles: this.generateCSSFromDesign(designData),
      metadata: options.includeMetadata ? {
        generatedAt: new Date().toISOString(),
        exportId: id
      } : null
    };

    // Render template
    const content = Mustache.render(template.template, templateData);

    return {
      id,
      format: 'html',
      content,
      metadata: {
        size: Buffer.byteLength(content, 'utf8'),
        generatedAt: new Date().toISOString(),
        processingTime: 0,
        format: 'html',
        options
      }
    };
  }

  private async generateCSS(id: string, request: ExportRequest): Promise<ExportResult> {
    const { designData, options } = request;

    let content = `/* Generated CSS - ${new Date().toISOString()} */\n\n`;
    
    // Extract design tokens
    const tokens = this.extractDesignTokens(designData);
    
    // Generate CSS variables
    content += `:root {\n`;
    Object.entries(tokens.colors || {}).forEach(([name, value]) => {
      content += `  --color-${name}: ${value};\n`;
    });
    Object.entries(tokens.typography || {}).forEach(([name, value]: [string, any]) => {
      content += `  --font-${name}: ${value.fontFamily};\n`;
      content += `  --font-size-${name}: ${value.fontSize}px;\n`;
    });
    content += `}\n\n`;

    // Generate component styles
    if (designData.elements) {
      designData.elements.forEach((element: any) => {
        content += this.generateElementCSS(element);
      });
    }

    return {
      id,
      format: 'css',
      content,
      metadata: {
        size: Buffer.byteLength(content, 'utf8'),
        generatedAt: new Date().toISOString(),
        processingTime: 0,
        format: 'css',
        options
      }
    };
  }

  private async generateJSX(id: string, request: ExportRequest): Promise<ExportResult> {
    const template = this.getTemplate(options.templateId || 'jsx-component');
    // Implementation for JSX generation
    throw new ExportError('JSX export not yet implemented');
  }

  private async generateVue(id: string, request: ExportRequest): Promise<ExportResult> {
    throw new ExportError('Vue export not yet implemented');
  }

  private async generateAngular(id: string, request: ExportRequest): Promise<ExportResult> {
    throw new ExportError('Angular export not yet implemented');
  }

  private async generatePDF(id: string, request: ExportRequest): Promise<ExportResult> {
    throw new ExportError('PDF export not yet implemented');
  }

  private async generateZip(id: string, request: ExportRequest): Promise<ExportResult> {
    throw new ExportError('ZIP export not yet implemented');
  }

  private async generateCustom(id: string, request: ExportRequest): Promise<ExportResult> {
    if (!request.customTemplate) {
      throw new ExportError('Custom template required for custom format');
    }

    const templateData = {
      design: request.designData,
      translation: request.translationData,
      metadata: {
        id,
        generatedAt: new Date().toISOString()
      }
    };

    const content = Mustache.render(request.customTemplate, templateData);

    return {
      id,
      format: 'custom',
      content,
      metadata: {
        size: Buffer.byteLength(content, 'utf8'),
        generatedAt: new Date().toISOString(),
        processingTime: 0,
        format: 'custom',
        options: request.options
      }
    };
  }

  private generateCSSFromDesign(designData: any): string {
    // Generate CSS from design data
    return '/* CSS generated from design */';
  }

  private extractDesignTokens(designData: any): any {
    return {
      colors: {},
      typography: {},
      spacing: [],
      effects: []
    };
  }

  private generateElementCSS(element: any): string {
    const className = element.name?.toLowerCase().replace(/\s+/g, '-') || element.type;
    return `.${className} {\n  /* Styles for ${element.name || element.type} */\n}\n\n`;
  }

  private async loadBuiltInTemplates(): Promise<void> {
    // Load built-in templates
    const htmlTemplate: ExportTemplate = {
      id: 'html-basic',
      name: 'Basic HTML Template',
      description: 'Simple HTML page with embedded CSS',
      format: 'html',
      template: `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{title}}</title>
    <style>{{styles}}</style>
</head>
<body>
    <div class="design-container">
        {{#elements}}
        <div class="element element-{{type}}" data-name="{{name}}">
            {{#text}}{{text}}{{/text}}
        </div>
        {{/elements}}
    </div>
</body>
</html>`,
      variables: ['title', 'elements', 'styles'],
      category: 'documentation',
      tags: ['html', 'basic', 'web']
    };

    this.templates.set(htmlTemplate.id, htmlTemplate);
  }

  private async loadCustomTemplates(): Promise<void> {
    // Load custom templates from database
    // Implementation would query database for user templates
  }

  private setupHandlebarsHelpers(): void {
    // Register custom Handlebars helpers
    Handlebars.registerHelper('json', (context) => {
      return JSON.stringify(context, null, 2);
    });

    Handlebars.registerHelper('cssProperty', (property, value) => {
      return `${property}: ${value};`;
    });
  }

  getTemplate(templateId: string): ExportTemplate | undefined {
    return this.templates.get(templateId);
  }

  getSupportedFormats(): ExportFormat[] {
    return [
      'markdown', 'json', 'yaml', 'html', 'css', 
      'jsx', 'vue', 'angular', 'pdf', 'zip', 'custom'
    ];
  }

  getAvailableTemplates(format?: ExportFormat): ExportTemplate[] {
    const templates = Array.from(this.templates.values());
    return format ? templates.filter(t => t.format === format) : templates;
  }
}
import Handlebars from 'handlebars';
import Mustache from 'mustache';
import { marked } from 'marked';
import * as yaml from 'js-yaml';
import { logger } from '../utils/logger';

export interface TemplateEngineOptions {
  engine: 'handlebars' | 'mustache' | 'jinja2' | 'liquid' | 'custom';
  helpers?: Record<string, Function>;
  partials?: Record<string, string>;
  config?: Record<string, any>;
  strict?: boolean;
  noEscape?: boolean;
}

export interface TemplateContext {
  data: any;
  variables: Record<string, any>;
  helpers: Record<string, any>;
  partials: Record<string, string>;
  settings: Record<string, any>;
}

export interface RenderResult {
  output: string;
  engine: string;
  renderTime: number;
  errors: string[];
  warnings: string[];
}

export class TemplateEngine {
  private handlebarsInstance: typeof Handlebars;
  private registeredHelpers: Map<string, Function> = new Map();
  private registeredPartials: Map<string, string> = new Map();

  constructor() {
    this.handlebarsInstance = Handlebars.create();
    this.registerBuiltinHelpers();
  }

  async render(
    template: string,
    context: TemplateContext,
    options: TemplateEngineOptions
  ): Promise<RenderResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Validate template
      const validationResult = this.validateTemplate(template, options.engine);
      if (!validationResult.valid) {
        errors.push(...validationResult.errors);
        if (options.strict) {
          throw new Error(`Template validation failed: ${validationResult.errors.join(', ')}`);
        }
      }

      // Prepare context
      const preparedContext = await this.prepareContext(context, options);

      // Render based on engine
      let output: string;
      switch (options.engine) {
        case 'handlebars':
          output = await this.renderHandlebars(template, preparedContext, options);
          break;
        case 'mustache':
          output = await this.renderMustache(template, preparedContext, options);
          break;
        case 'jinja2':
          output = await this.renderJinja2(template, preparedContext, options);
          break;
        case 'liquid':
          output = await this.renderLiquid(template, preparedContext, options);
          break;
        case 'custom':
          output = await this.renderCustom(template, preparedContext, options);
          break;
        default:
          throw new Error(`Unsupported template engine: ${options.engine}`);
      }

      const renderTime = Date.now() - startTime;

      logger.debug('Template rendered successfully', {
        engine: options.engine,
        renderTime,
        outputLength: output.length
      });

      return {
        output,
        engine: options.engine,
        renderTime,
        errors,
        warnings
      };
    } catch (error) {
      const renderTime = Date.now() - startTime;
      errors.push(error.message);
      
      logger.error('Template rendering failed', {
        engine: options.engine,
        error: error.message,
        renderTime
      });

      return {
        output: '',
        engine: options.engine,
        renderTime,
        errors,
        warnings
      };
    }
  }

  private async renderHandlebars(
    template: string,
    context: TemplateContext,
    options: TemplateEngineOptions
  ): Promise<string> {
    // Register helpers
    if (options.helpers) {
      Object.entries(options.helpers).forEach(([name, helper]) => {
        this.handlebarsInstance.registerHelper(name, helper);
      });
    }

    // Register partials
    if (options.partials) {
      Object.entries(options.partials).forEach(([name, partial]) => {
        this.handlebarsInstance.registerPartial(name, partial);
      });
    }

    // Compile template
    const compiledTemplate = this.handlebarsInstance.compile(template, {
      noEscape: options.noEscape || false,
      strict: options.strict || false
    });

    // Render with context
    return compiledTemplate({
      ...context.data,
      ...context.variables,
      $helpers: context.helpers,
      $settings: context.settings
    });
  }

  private async renderMustache(
    template: string,
    context: TemplateContext,
    options: TemplateEngineOptions
  ): Promise<string> {
    const renderContext = {
      ...context.data,
      ...context.variables,
      $helpers: context.helpers,
      $settings: context.settings
    };

    const partials = options.partials || {};

    return Mustache.render(template, renderContext, partials);
  }

  private async renderJinja2(
    template: string,
    context: TemplateContext,
    options: TemplateEngineOptions
  ): Promise<string> {
    // For Jinja2 support, we'll implement a basic parser
    // In a real implementation, you might use a Node.js Jinja2 port
    // For now, we'll convert Jinja2 syntax to Handlebars and render
    const convertedTemplate = this.convertJinja2ToHandlebars(template);
    return this.renderHandlebars(convertedTemplate, context, {
      ...options,
      engine: 'handlebars'
    });
  }

  private async renderLiquid(
    template: string,
    context: TemplateContext,
    options: TemplateEngineOptions
  ): Promise<string> {
    // For Liquid support, we'll implement a basic parser
    // In a real implementation, you might use a Node.js Liquid library
    // For now, we'll convert Liquid syntax to Handlebars and render
    const convertedTemplate = this.convertLiquidToHandlebars(template);
    return this.renderHandlebars(convertedTemplate, context, {
      ...options,
      engine: 'handlebars'
    });
  }

  private async renderCustom(
    template: string,
    context: TemplateContext,
    options: TemplateEngineOptions
  ): Promise<string> {
    // Custom template engine - simple variable substitution
    let output = template;

    // Replace variables {{variable}}
    const variableRegex = /\{\{([^}]+)\}\}/g;
    output = output.replace(variableRegex, (match, varName) => {
      const trimmedVarName = varName.trim();
      const value = this.getNestedValue(context.data, trimmedVarName) ||
                   this.getNestedValue(context.variables, trimmedVarName) ||
                   match;
      return String(value);
    });

    // Replace loops {{#each items}}...{{/each}}
    const loopRegex = /\{\{#each\s+([^}]+)\}\}([\s\S]*?)\{\{\/each\}\}/g;
    output = output.replace(loopRegex, (match, arrayName, loopContent) => {
      const array = this.getNestedValue(context.data, arrayName.trim());
      if (!Array.isArray(array)) return '';
      
      return array.map((item, index) => {
        let itemContent = loopContent;
        itemContent = itemContent.replace(/\{\{this\}\}/g, String(item));
        itemContent = itemContent.replace(/\{\{@index\}\}/g, String(index));
        if (typeof item === 'object') {
          Object.entries(item).forEach(([key, value]) => {
            itemContent = itemContent.replace(
              new RegExp(`\\{\\{${key}\\}\\}`, 'g'), 
              String(value)
            );
          });
        }
        return itemContent;
      }).join('');
    });

    // Replace conditionals {{#if condition}}...{{/if}}
    const ifRegex = /\{\{#if\s+([^}]+)\}\}([\s\S]*?)(?:\{\{else\}\}([\s\S]*?))?\{\{\/if\}\}/g;
    output = output.replace(ifRegex, (match, condition, truePart, falsePart = '') => {
      const conditionValue = this.evaluateCondition(condition.trim(), context);
      return conditionValue ? truePart : falsePart;
    });

    return output;
  }

  private convertJinja2ToHandlebars(template: string): string {
    let converted = template;
    
    // Convert variable syntax: {{ var }} (same as Handlebars)
    // Convert loops: {% for item in items %} -> {{#each items}}
    converted = converted.replace(/\{% for\s+(\w+)\s+in\s+(\w+)\s+%\}([\s\S]*?)\{% endfor %\}/g, 
      '{{#each $2}}$3{{/each}}');
    
    // Convert conditionals: {% if condition %} -> {{#if condition}}
    converted = converted.replace(/\{% if\s+([^%]+)\s+%\}([\s\S]*?)(?:\{% else %\}([\s\S]*?))?\{% endif %\}/g,
      '{{#if $1}}$2{{#if $3}}{{else}}$3{{/if}}{{/if}}');
    
    // Convert comments: {# comment #} -> {{!-- comment --}}
    converted = converted.replace(/\{#([\s\S]*?)#\}/g, '{{!--$1--}}');
    
    return converted;
  }

  private convertLiquidToHandlebars(template: string): string {
    let converted = template;
    
    // Convert variable syntax: {{ var }} (same as Handlebars)
    // Convert loops: {% for item in items %} -> {{#each items}}
    converted = converted.replace(/\{% for\s+(\w+)\s+in\s+(\w+)\s+%\}([\s\S]*?)\{% endfor %\}/g, 
      '{{#each $2}}$3{{/each}}');
    
    // Convert conditionals: {% if condition %} -> {{#if condition}}
    converted = converted.replace(/\{% if\s+([^%]+)\s+%\}([\s\S]*?)(?:\{% else %\}([\s\S]*?))?\{% endif %\}/g,
      '{{#if $1}}$2{{#if $3}}{{else}}$3{{/if}}{{/if}}');
    
    // Convert assignments: {% assign var = value %} -> remove (Handlebars doesn't support)
    converted = converted.replace(/\{% assign\s+\w+\s*=\s*[^%]+\s+%\}/g, '');
    
    return converted;
  }

  private async prepareContext(
    context: TemplateContext,
    options: TemplateEngineOptions
  ): Promise<TemplateContext> {
    const prepared: TemplateContext = {
      data: context.data || {},
      variables: { ...context.variables },
      helpers: { ...context.helpers },
      partials: { ...context.partials },
      settings: { ...context.settings }
    };

    // Add built-in variables
    prepared.variables.$timestamp = new Date().toISOString();
    prepared.variables.$date = new Date().toLocaleDateString();
    prepared.variables.$time = new Date().toLocaleTimeString();
    prepared.variables.$engine = options.engine;

    // Add configuration variables
    if (options.config) {
      prepared.variables.$config = options.config;
    }

    return prepared;
  }

  private validateTemplate(
    template: string,
    engine: string
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!template || template.trim().length === 0) {
      errors.push('Template is empty');
      return { valid: false, errors };
    }

    try {
      switch (engine) {
        case 'handlebars':
          this.handlebarsInstance.compile(template);
          break;
        case 'mustache':
          Mustache.parse(template);
          break;
        case 'jinja2':
        case 'liquid':
        case 'custom':
          // Basic syntax validation for custom engines
          if (!this.validateCustomSyntax(template)) {
            errors.push('Invalid template syntax');
          }
          break;
      }
    } catch (error) {
      errors.push(`Template compilation error: ${error.message}`);
    }

    return { valid: errors.length === 0, errors };
  }

  private validateCustomSyntax(template: string): boolean {
    // Check for balanced braces
    const openBraces = (template.match(/\{\{/g) || []).length;
    const closeBraces = (template.match(/\}\}/g) || []).length;
    
    if (openBraces !== closeBraces) {
      return false;
    }

    // Check for valid block helpers
    const blockHelpers = template.match(/\{\{#(\w+)[^}]*\}\}/g) || [];
    const endHelpers = template.match(/\{\{\/(\w+)\}\}/g) || [];
    
    if (blockHelpers.length !== endHelpers.length) {
      return false;
    }

    return true;
  }

  private registerBuiltinHelpers(): void {
    // String helpers
    this.handlebarsInstance.registerHelper('uppercase', (str: string) => {
      return str ? str.toUpperCase() : '';
    });

    this.handlebarsInstance.registerHelper('lowercase', (str: string) => {
      return str ? str.toLowerCase() : '';
    });

    this.handlebarsInstance.registerHelper('capitalize', (str: string) => {
      if (!str) return '';
      return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
    });

    this.handlebarsInstance.registerHelper('truncate', (str: string, length: number) => {
      if (!str) return '';
      return str.length > length ? str.substring(0, length) + '...' : str;
    });

    // Date helpers
    this.handlebarsInstance.registerHelper('formatDate', (date: string | Date, format: string) => {
      const d = new Date(date);
      if (isNaN(d.getTime())) return '';
      
      switch (format) {
        case 'iso':
          return d.toISOString();
        case 'short':
          return d.toLocaleDateString();
        case 'long':
          return d.toLocaleDateString('en-US', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          });
        default:
          return d.toLocaleDateString();
      }
    });

    // Math helpers
    this.handlebarsInstance.registerHelper('add', (a: number, b: number) => a + b);
    this.handlebarsInstance.registerHelper('subtract', (a: number, b: number) => a - b);
    this.handlebarsInstance.registerHelper('multiply', (a: number, b: number) => a * b);
    this.handlebarsInstance.registerHelper('divide', (a: number, b: number) => b !== 0 ? a / b : 0);

    // Array helpers
    this.handlebarsInstance.registerHelper('length', (arr: any[]) => {
      return Array.isArray(arr) ? arr.length : 0;
    });

    this.handlebarsInstance.registerHelper('join', (arr: any[], separator: string = ',') => {
      return Array.isArray(arr) ? arr.join(separator) : '';
    });

    this.handlebarsInstance.registerHelper('first', (arr: any[]) => {
      return Array.isArray(arr) && arr.length > 0 ? arr[0] : null;
    });

    this.handlebarsInstance.registerHelper('last', (arr: any[]) => {
      return Array.isArray(arr) && arr.length > 0 ? arr[arr.length - 1] : null;
    });

    // Conditional helpers
    this.handlebarsInstance.registerHelper('eq', (a: any, b: any) => a === b);
    this.handlebarsInstance.registerHelper('ne', (a: any, b: any) => a !== b);
    this.handlebarsInstance.registerHelper('gt', (a: any, b: any) => a > b);
    this.handlebarsInstance.registerHelper('gte', (a: any, b: any) => a >= b);
    this.handlebarsInstance.registerHelper('lt', (a: any, b: any) => a < b);
    this.handlebarsInstance.registerHelper('lte', (a: any, b: any) => a <= b);

    // Format helpers
    this.handlebarsInstance.registerHelper('json', (obj: any, pretty: boolean = false) => {
      try {
        return pretty ? JSON.stringify(obj, null, 2) : JSON.stringify(obj);
      } catch {
        return '';
      }
    });

    this.handlebarsInstance.registerHelper('yaml', (obj: any) => {
      try {
        return yaml.dump(obj);
      } catch {
        return '';
      }
    });

    this.handlebarsInstance.registerHelper('markdown', (str: string) => {
      try {
        return marked.parse(str);
      } catch {
        return str;
      }
    });

    // Design-specific helpers
    this.handlebarsInstance.registerHelper('cssColor', (color: any) => {
      if (typeof color === 'string') return color;
      if (color && typeof color === 'object') {
        return color.value || color.hex || color.rgb || '';
      }
      return '';
    });

    this.handlebarsInstance.registerHelper('cssUnit', (value: any, unit: string = 'px') => {
      if (typeof value === 'number') return `${value}${unit}`;
      if (typeof value === 'string' && /^\d+$/.test(value)) return `${value}${unit}`;
      return value;
    });

    this.handlebarsInstance.registerHelper('responsiveClass', (breakpoint: string, className: string) => {
      const prefixes: Record<string, string> = {
        'sm': 'sm:',
        'md': 'md:',
        'lg': 'lg:',
        'xl': 'xl:',
        '2xl': '2xl:'
      };
      return `${prefixes[breakpoint] || ''}${className}`;
    });
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => {
      return current && current[key] !== undefined ? current[key] : undefined;
    }, obj);
  }

  private evaluateCondition(condition: string, context: TemplateContext): boolean {
    try {
      // Simple condition evaluation - in production, use a safer evaluator
      const value = this.getNestedValue(context.data, condition) ||
                   this.getNestedValue(context.variables, condition);
      
      return Boolean(value);
    } catch {
      return false;
    }
  }

  // Public methods for registering custom helpers and partials
  registerHelper(name: string, helper: Function): void {
    this.registeredHelpers.set(name, helper);
    this.handlebarsInstance.registerHelper(name, helper);
  }

  registerPartial(name: string, template: string): void {
    this.registeredPartials.set(name, template);
    this.handlebarsInstance.registerPartial(name, template);
  }

  getRegisteredHelpers(): Map<string, Function> {
    return new Map(this.registeredHelpers);
  }

  getRegisteredPartials(): Map<string, string> {
    return new Map(this.registeredPartials);
  }

  // Template caching
  private templateCache: Map<string, any> = new Map();

  compileAndCache(template: string, engine: string, cacheKey?: string): any {
    const key = cacheKey || this.generateCacheKey(template, engine);
    
    if (this.templateCache.has(key)) {
      return this.templateCache.get(key);
    }

    let compiled: any;
    switch (engine) {
      case 'handlebars':
        compiled = this.handlebarsInstance.compile(template);
        break;
      case 'mustache':
        compiled = { template, parsed: Mustache.parse(template) };
        break;
      default:
        compiled = { template, engine };
    }

    this.templateCache.set(key, compiled);
    return compiled;
  }

  clearCache(): void {
    this.templateCache.clear();
  }

  private generateCacheKey(template: string, engine: string): string {
    const hash = this.simpleHash(template);
    return `${engine}_${hash}`;
  }

  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36);
  }
}

export const templateEngine = new TemplateEngine();
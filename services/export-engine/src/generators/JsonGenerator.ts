import { BaseGenerator, ExportOptions } from './BaseGenerator';

export class JsonGenerator extends BaseGenerator {
  constructor() {
    super('json', 'application/json', '.json');
  }

  protected async generateContent(data: any, options: ExportOptions): Promise<string> {
    // Process the data based on export options
    const processedData = this.processDataForJson(data, options);
    
    // Add metadata if requested
    const finalData = options.includeMetadata !== false 
      ? this.addJsonMetadata(processedData, options)
      : processedData;
    
    // Format JSON output
    return this.formatJSON(finalData, options);
  }

  private processDataForJson(data: any, options: ExportOptions): any {
    const { customSettings = {} } = options;
    const { schema = 'standard', includeEmpty = false } = customSettings;

    switch (schema) {
      case 'schema':
        return this.generateJsonSchema(data);
      case 'openapi':
        return this.generateOpenApiSchema(data);
      case 'design-tokens':
        return this.generateDesignTokens(data);
      case 'component-spec':
        return this.generateComponentSpec(data);
      default:
        return this.generateStandardJson(data, includeEmpty);
    }
  }

  private generateStandardJson(data: any, includeEmpty: boolean): any {
    if (!includeEmpty) {
      return this.removeEmptyValues(data);
    }
    return data;
  }

  private generateJsonSchema(data: any): any {
    return {
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      title: data.name || 'Generated Schema',
      description: data.description || 'Schema generated from design data',
      properties: this.generateSchemaProperties(data),
      required: this.extractRequiredFields(data),
      additionalProperties: false
    };
  }

  private generateSchemaProperties(data: any): any {
    const properties: any = {};

    if (data.type === 'design') {
      properties.name = { type: 'string', description: 'Design name' };
      properties.dimensions = {
        type: 'object',
        properties: {
          width: { type: 'number' },
          height: { type: 'number' }
        }
      };
      properties.colors = {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            value: { type: 'string', pattern: '^#[0-9A-Fa-f]{6}$' },
            usage: { type: 'string' }
          }
        }
      };
      properties.typography = {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            family: { type: 'string' },
            weight: { type: 'string' },
            size: { type: 'string' }
          }
        }
      };
      properties.elements = {
        type: 'array',
        items: { $ref: '#/definitions/Element' }
      };
    }

    return properties;
  }

  private generateOpenApiSchema(data: any): any {
    return {
      openapi: '3.0.3',
      info: {
        title: data.name || 'Generated API',
        description: data.description || 'API generated from design data',
        version: data.version || '1.0.0'
      },
      paths: this.generateApiPaths(data),
      components: {
        schemas: this.generateApiSchemas(data)
      }
    };
  }

  private generateApiPaths(data: any): any {
    const paths: any = {};
    
    if (data.screens) {
      data.screens.forEach((screen: any) => {
        const pathName = `/${screen.name.toLowerCase().replace(/\s+/g, '-')}`;
        paths[pathName] = {
          get: {
            summary: `Get ${screen.name} screen data`,
            description: screen.description || `Retrieve data for ${screen.name} screen`,
            responses: {
              '200': {
                description: 'Successful response',
                content: {
                  'application/json': {
                    schema: { $ref: `#/components/schemas/${screen.name}` }
                  }
                }
              }
            }
          }
        };
      });
    }

    return paths;
  }

  private generateApiSchemas(data: any): any {
    const schemas: any = {};
    
    if (data.screens) {
      data.screens.forEach((screen: any) => {
        schemas[screen.name] = {
          type: 'object',
          properties: {
            name: { type: 'string' },
            elements: {
              type: 'array',
              items: { $ref: '#/components/schemas/Element' }
            }
          }
        };
      });
    }

    schemas.Element = {
      type: 'object',
      properties: {
        type: { type: 'string' },
        name: { type: 'string' },
        properties: { type: 'object' },
        styles: { type: 'object' },
        children: {
          type: 'array',
          items: { $ref: '#/components/schemas/Element' }
        }
      }
    };

    return schemas;
  }

  private generateDesignTokens(data: any): any {
    const tokens: any = {};

    // Colors
    if (data.colors) {
      tokens.color = {};
      data.colors.forEach((color: any) => {
        const tokenName = color.name.toLowerCase().replace(/\s+/g, '-');
        tokens.color[tokenName] = {
          value: color.value,
          type: 'color',
          description: color.usage || `${color.name} color token`
        };
      });
    }

    // Typography
    if (data.typography) {
      tokens.typography = {};
      data.typography.forEach((font: any) => {
        const tokenName = font.name.toLowerCase().replace(/\s+/g, '-');
        tokens.typography[tokenName] = {
          value: {
            fontFamily: font.family,
            fontWeight: font.weight,
            fontSize: font.size,
            lineHeight: font.lineHeight
          },
          type: 'typography',
          description: `${font.name} typography token`
        };
      });
    }

    // Spacing
    if (data.spacing) {
      tokens.spacing = {};
      Object.entries(data.spacing).forEach(([key, value]) => {
        tokens.spacing[key] = {
          value: value,
          type: 'dimension',
          description: `${key} spacing token`
        };
      });
    }

    // Border radius
    if (data.borderRadius) {
      tokens.borderRadius = {};
      Object.entries(data.borderRadius).forEach(([key, value]) => {
        tokens.borderRadius[key] = {
          value: value,
          type: 'dimension',
          description: `${key} border radius token`
        };
      });
    }

    return tokens;
  }

  private generateComponentSpec(data: any): any {
    const spec: any = {
      version: '1.0.0',
      components: {}
    };

    if (data.components) {
      data.components.forEach((component: any) => {
        spec.components[component.name] = {
          name: component.name,
          description: component.description,
          category: component.category || 'general',
          properties: component.properties || {},
          variants: component.variants || [],
          states: component.states || [],
          slots: component.slots || [],
          examples: component.examples || [],
          metadata: {
            figmaNodeId: component.figmaNodeId,
            tags: component.tags || [],
            status: component.status || 'stable'
          }
        };
      });
    }

    return spec;
  }

  private addJsonMetadata(data: any, options: ExportOptions): any {
    const metadata = {
      $schema: 'https://imagineer.dev/schemas/export/v1',
      $generated: {
        timestamp: new Date().toISOString(),
        generator: 'Imagineer Export Engine',
        version: '1.0.0',
        format: 'json',
        options: {
          schema: options.customSettings?.schema || 'standard',
          includeMetadata: options.includeMetadata,
          minify: options.minify
        }
      },
      $source: {
        type: data.type || 'unknown',
        name: data.name || 'unnamed',
        id: data.id || null
      }
    };

    return {
      ...metadata,
      data: data
    };
  }

  private removeEmptyValues(obj: any): any {
    if (Array.isArray(obj)) {
      return obj
        .map(item => this.removeEmptyValues(item))
        .filter(item => item !== null && item !== undefined && item !== '');
    }
    
    if (obj && typeof obj === 'object') {
      const result: any = {};
      Object.entries(obj).forEach(([key, value]) => {
        const cleanValue = this.removeEmptyValues(value);
        if (cleanValue !== null && cleanValue !== undefined && cleanValue !== '') {
          if (typeof cleanValue === 'object') {
            if (Array.isArray(cleanValue) && cleanValue.length > 0) {
              result[key] = cleanValue;
            } else if (!Array.isArray(cleanValue) && Object.keys(cleanValue).length > 0) {
              result[key] = cleanValue;
            }
          } else {
            result[key] = cleanValue;
          }
        }
      });
      return result;
    }
    
    return obj;
  }

  private extractRequiredFields(data: any): string[] {
    const required: string[] = [];
    
    // Common required fields
    if (data.name) required.push('name');
    if (data.type) required.push('type');
    if (data.id) required.push('id');
    
    return required;
  }

  protected canMinify(): boolean {
    return true;
  }

  protected minifyContent(content: string): string {
    try {
      // Parse and re-stringify to remove all unnecessary whitespace
      const parsed = JSON.parse(content);
      return JSON.stringify(parsed);
    } catch (error) {
      // Fallback to basic minification
      return super.minifyContent(content);
    }
  }

  // Utility method to validate JSON structure
  validateJsonStructure(content: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    try {
      JSON.parse(content);
      return { valid: true, errors: [] };
    } catch (error) {
      errors.push(`Invalid JSON: ${error.message}`);
      return { valid: false, errors };
    }
  }

  // Convert to JSON Lines format
  generateJsonLines(dataArray: any[]): string {
    return dataArray
      .map(item => JSON.stringify(item))
      .join('\n');
  }

  // Generate JSON with custom formatting
  generateFormattedJson(data: any, options: {
    indent?: number;
    sortKeys?: boolean;
    replacer?: (key: string, value: any) => any;
  } = {}): string {
    const { indent = 2, sortKeys = false, replacer } = options;
    
    if (sortKeys) {
      const sortedData = this.sortObjectKeys(data);
      return JSON.stringify(sortedData, replacer, indent);
    }
    
    return JSON.stringify(data, replacer, indent);
  }

  private sortObjectKeys(obj: any): any {
    if (Array.isArray(obj)) {
      return obj.map(item => this.sortObjectKeys(item));
    }
    
    if (obj && typeof obj === 'object') {
      const sorted: any = {};
      Object.keys(obj)
        .sort()
        .forEach(key => {
          sorted[key] = this.sortObjectKeys(obj[key]);
        });
      return sorted;
    }
    
    return obj;
  }
}
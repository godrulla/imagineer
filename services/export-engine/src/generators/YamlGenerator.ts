import { BaseGenerator, ExportOptions } from './BaseGenerator';
import * as yaml from 'js-yaml';

export class YamlGenerator extends BaseGenerator {
  constructor() {
    super('yaml', 'application/x-yaml', '.yml');
  }

  protected async generateContent(data: any, options: ExportOptions): Promise<string> {
    // Process the data based on export options
    const processedData = this.processDataForYaml(data, options);
    
    // Add metadata if requested
    const finalData = options.includeMetadata !== false 
      ? this.addYamlMetadata(processedData, options)
      : processedData;
    
    // Configure YAML dump options
    const yamlOptions = this.getYamlOptions(options);
    
    // Generate YAML content
    let content = yaml.dump(finalData, yamlOptions);
    
    // Add header comment if metadata is included
    if (options.includeMetadata !== false && options.includeComments !== false) {
      content = this.addYamlHeader(content, data, options);
    }
    
    return content;
  }

  private processDataForYaml(data: any, options: ExportOptions): any {
    const { customSettings = {} } = options;
    const { format = 'standard', configStyle = 'nested' } = customSettings;

    switch (format) {
      case 'kubernetes':
        return this.generateKubernetesConfig(data);
      case 'docker-compose':
        return this.generateDockerComposeConfig(data);
      case 'github-actions':
        return this.generateGitHubActionsConfig(data);
      case 'design-tokens':
        return this.generateDesignTokensYaml(data);
      case 'config':
        return this.generateApplicationConfig(data, configStyle);
      default:
        return this.generateStandardYaml(data);
    }
  }

  private generateStandardYaml(data: any): any {
    // Clean and structure data for YAML
    return this.cleanDataForYaml(data);
  }

  private generateKubernetesConfig(data: any): any {
    const config: any = {
      apiVersion: 'v1',
      kind: 'ConfigMap',
      metadata: {
        name: this.sanitizeKubernetesName(data.name || 'imagineer-config'),
        namespace: data.namespace || 'default',
        labels: {
          app: 'imagineer',
          component: 'design-config',
          version: data.version || 'v1'
        }
      },
      data: {}
    };

    // Convert design data to configuration
    if (data.colors) {
      config.data['colors.yaml'] = yaml.dump(data.colors);
    }
    
    if (data.typography) {
      config.data['typography.yaml'] = yaml.dump(data.typography);
    }
    
    if (data.components) {
      config.data['components.yaml'] = yaml.dump(data.components);
    }

    return config;
  }

  private generateDockerComposeConfig(data: any): any {
    return {
      version: '3.8',
      services: {
        [this.sanitizeServiceName(data.name || 'imagineer-app')]: {
          image: data.image || 'nginx:alpine',
          ports: data.ports || ['80:80'],
          environment: this.convertToEnvironmentVars(data),
          volumes: data.volumes || [],
          networks: data.networks || ['default']
        }
      },
      networks: {
        default: {
          driver: 'bridge'
        }
      }
    };
  }

  private generateGitHubActionsConfig(data: any): any {
    return {
      name: data.name || 'Imagineer Build',
      on: {
        push: {
          branches: ['main', 'develop']
        },
        pull_request: {
          branches: ['main']
        }
      },
      jobs: {
        build: {
          'runs-on': 'ubuntu-latest',
          steps: [
            {
              name: 'Checkout code',
              uses: 'actions/checkout@v3'
            },
            {
              name: 'Setup Node.js',
              uses: 'actions/setup-node@v3',
              with: {
                'node-version': '18'
              }
            },
            {
              name: 'Install dependencies',
              run: 'npm install'
            },
            {
              name: 'Build project',
              run: 'npm run build'
            },
            {
              name: 'Run tests',
              run: 'npm test'
            }
          ]
        }
      }
    };
  }

  private generateDesignTokensYaml(data: any): any {
    const tokens: any = {
      tokens: {}
    };

    // Colors
    if (data.colors) {
      tokens.tokens.color = {};
      data.colors.forEach((color: any) => {
        const path = this.createTokenPath(color.name);
        this.setNestedValue(tokens.tokens.color, path, {
          value: color.value,
          type: 'color',
          description: color.usage || color.description
        });
      });
    }

    // Typography
    if (data.typography) {
      tokens.tokens.typography = {};
      data.typography.forEach((font: any) => {
        const path = this.createTokenPath(font.name);
        this.setNestedValue(tokens.tokens.typography, path, {
          value: {
            fontFamily: font.family,
            fontWeight: font.weight,
            fontSize: font.size,
            lineHeight: font.lineHeight
          },
          type: 'typography',
          description: font.description
        });
      });
    }

    // Spacing
    if (data.spacing) {
      tokens.tokens.spacing = {};
      Object.entries(data.spacing).forEach(([key, value]) => {
        const path = this.createTokenPath(key);
        this.setNestedValue(tokens.tokens.spacing, path, {
          value: value,
          type: 'dimension',
          description: `${key} spacing value`
        });
      });
    }

    return tokens;
  }

  private generateApplicationConfig(data: any, style: string): any {
    const config: any = {};

    if (style === 'flat') {
      // Flat configuration style
      config.app_name = data.name;
      config.app_version = data.version || '1.0.0';
      config.app_description = data.description;
      
      if (data.colors) {
        data.colors.forEach((color: any, index: number) => {
          config[`color_${index}_name`] = color.name;
          config[`color_${index}_value`] = color.value;
        });
      }
    } else {
      // Nested configuration style
      config.application = {
        name: data.name,
        version: data.version || '1.0.0',
        description: data.description
      };

      if (data.colors) {
        config.design = config.design || {};
        config.design.colors = data.colors.reduce((acc: any, color: any) => {
          acc[this.sanitizeConfigKey(color.name)] = color.value;
          return acc;
        }, {});
      }

      if (data.typography) {
        config.design = config.design || {};
        config.design.typography = data.typography.reduce((acc: any, font: any) => {
          acc[this.sanitizeConfigKey(font.name)] = {
            family: font.family,
            weight: font.weight,
            size: font.size
          };
          return acc;
        }, {});
      }
    }

    return config;
  }

  private addYamlMetadata(data: any, options: ExportOptions): any {
    const metadata = {
      _metadata: {
        generated_at: new Date().toISOString(),
        generator: 'Imagineer Export Engine',
        version: '1.0.0',
        format: 'yaml',
        options: {
          format: options.customSettings?.format || 'standard',
          include_metadata: options.includeMetadata,
          minify: options.minify
        }
      },
      _source: {
        type: data.type || 'unknown',
        name: data.name || 'unnamed',
        id: data.id || null
      }
    };

    return {
      ...metadata,
      ...data
    };
  }

  private addYamlHeader(content: string, data: any, options: ExportOptions): string {
    const header = [
      '# Generated by Imagineer Export Engine',
      `# Timestamp: ${new Date().toISOString()}`,
      `# Source: ${data.name || 'Unknown'}`,
      `# Format: YAML`,
      '#',
      ''
    ].join('\n');

    return header + content;
  }

  private getYamlOptions(options: ExportOptions): yaml.DumpOptions {
    const yamlOptions: yaml.DumpOptions = {
      indent: options.minify ? 1 : 2,
      lineWidth: options.minify ? -1 : 80,
      noRefs: true,
      skipInvalid: true,
      flowLevel: options.minify ? 0 : -1,
      sortKeys: options.customSettings?.sortKeys || false
    };

    // Custom schema support
    if (options.customSettings?.schema) {
      yamlOptions.schema = yaml.JSON_SCHEMA;
    }

    return yamlOptions;
  }

  private cleanDataForYaml(data: any): any {
    if (Array.isArray(data)) {
      return data.map(item => this.cleanDataForYaml(item));
    }
    
    if (data && typeof data === 'object') {
      const cleaned: any = {};
      Object.entries(data).forEach(([key, value]) => {
        // Skip functions and undefined values
        if (typeof value !== 'function' && value !== undefined) {
          // Convert dates to ISO strings
          if (value instanceof Date) {
            cleaned[key] = value.toISOString();
          } else {
            cleaned[key] = this.cleanDataForYaml(value);
          }
        }
      });
      return cleaned;
    }
    
    return data;
  }

  private sanitizeKubernetesName(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/^-+|-+$/g, '')
      .substring(0, 63);
  }

  private sanitizeServiceName(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '_')
      .replace(/^_+|_+$/g, '');
  }

  private sanitizeConfigKey(key: string): string {
    return key
      .toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_]/g, '')
      .replace(/^_+|_+$/g, '');
  }

  private convertToEnvironmentVars(data: any): string[] {
    const vars: string[] = [];
    
    if (data.name) vars.push(`APP_NAME=${data.name}`);
    if (data.version) vars.push(`APP_VERSION=${data.version}`);
    if (data.environment) vars.push(`NODE_ENV=${data.environment}`);
    
    return vars;
  }

  private createTokenPath(name: string): string[] {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter(part => part.length > 0);
  }

  private setNestedValue(obj: any, path: string[], value: any): void {
    let current = obj;
    for (let i = 0; i < path.length - 1; i++) {
      if (!current[path[i]]) {
        current[path[i]] = {};
      }
      current = current[path[i]];
    }
    current[path[path.length - 1]] = value;
  }

  protected canMinify(): boolean {
    return true;
  }

  protected minifyContent(content: string): string {
    try {
      // Parse and re-dump with minimal formatting
      const data = yaml.load(content);
      return yaml.dump(data, {
        indent: 1,
        lineWidth: -1,
        flowLevel: 0
      });
    } catch (error) {
      // Fallback to basic minification
      return content
        .replace(/\n\s*\n/g, '\n') // Remove empty lines
        .replace(/^[ \t]+/gm, match => match.replace(/  /g, ' ')) // Reduce indentation
        .trim();
    }
  }

  // Validate YAML structure
  validateYamlStructure(content: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    try {
      yaml.load(content);
      return { valid: true, errors: [] };
    } catch (error) {
      errors.push(`Invalid YAML: ${error.message}`);
      return { valid: false, errors };
    }
  }

  // Convert JSON to YAML
  jsonToYaml(jsonData: any, options: ExportOptions = {}): string {
    const yamlOptions = this.getYamlOptions(options);
    return yaml.dump(jsonData, yamlOptions);
  }

  // Convert YAML to JSON
  yamlToJson(yamlContent: string): any {
    return yaml.load(yamlContent);
  }

  protected getFileExtension(options: ExportOptions): string {
    const format = options.customSettings?.format;
    
    // Use .yaml for Kubernetes and other specialized formats
    if (['kubernetes', 'docker-compose', 'github-actions'].includes(format)) {
      return '.yaml';
    }
    
    return options.customSettings?.fileExtension || this.defaultExtension;
  }
}
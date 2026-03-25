import { logger } from '../utils/logger';
import { marked } from 'marked';
import * as yaml from 'js-yaml';

export interface ValidationRule {
  id: string;
  name: string;
  description: string;
  severity: 'error' | 'warning' | 'info';
  category: string;
  validate: (content: string, metadata?: any) => ValidationIssue[];
}

export interface ValidationIssue {
  ruleId: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  line?: number;
  column?: number;
  context?: string;
  suggestion?: string;
}

export interface ValidationResult {
  passed: boolean;
  score: number; // 0-100
  issues: ValidationIssue[];
  summary: {
    errors: number;
    warnings: number;
    info: number;
  };
  metadata: {
    validatedAt: string;
    format: string;
    contentSize: number;
    validationTime: number;
  };
}

export interface ValidationConfig {
  format: string;
  rules: string[]; // Rule IDs to apply
  customRules?: ValidationRule[];
  accessibility?: boolean;
  performance?: boolean;
  codeQuality?: boolean;
  strictMode?: boolean;
}

export class ValidationEngine {
  private rules: Map<string, ValidationRule> = new Map();
  private formatValidators: Map<string, (content: string) => ValidationIssue[]> = new Map();

  constructor() {
    this.initializeDefaultRules();
    this.initializeFormatValidators();
  }

  private initializeDefaultRules(): void {
    // Markdown validation rules
    this.registerRule({
      id: 'md-heading-structure',
      name: 'Heading Structure',
      description: 'Ensures proper heading hierarchy',
      severity: 'warning',
      category: 'structure',
      validate: (content: string) => {
        const issues: ValidationIssue[] = [];
        const lines = content.split('\n');
        let lastHeadingLevel = 0;

        lines.forEach((line, index) => {
          const headingMatch = line.match(/^(#{1,6})\s/);
          if (headingMatch) {
            const currentLevel = headingMatch[1].length;
            
            if (currentLevel > lastHeadingLevel + 1) {
              issues.push({
                ruleId: 'md-heading-structure',
                severity: 'warning',
                message: `Heading level skipped (from h${lastHeadingLevel} to h${currentLevel})`,
                line: index + 1,
                context: line,
                suggestion: `Use h${lastHeadingLevel + 1} instead of h${currentLevel}`
              });
            }
            
            lastHeadingLevel = currentLevel;
          }
        });

        return issues;
      }
    });

    this.registerRule({
      id: 'md-link-validation',
      name: 'Link Validation',
      description: 'Validates markdown links',
      severity: 'error',
      category: 'links',
      validate: (content: string) => {
        const issues: ValidationIssue[] = [];
        const linkRegex = /\[([^\]]*)\]\(([^)]+)\)/g;
        const lines = content.split('\n');
        
        lines.forEach((line, lineIndex) => {
          let match;
          while ((match = linkRegex.exec(line)) !== null) {
            const [fullMatch, text, url] = match;
            
            // Check for empty link text
            if (!text.trim()) {
              issues.push({
                ruleId: 'md-link-validation',
                severity: 'warning',
                message: 'Link has empty text',
                line: lineIndex + 1,
                column: match.index,
                context: fullMatch,
                suggestion: 'Provide descriptive link text'
              });
            }
            
            // Check for invalid URLs
            if (!url.trim() || url === '#') {
              issues.push({
                ruleId: 'md-link-validation',
                severity: 'error',
                message: 'Link has invalid or empty URL',
                line: lineIndex + 1,
                column: match.index,
                context: fullMatch,
                suggestion: 'Provide a valid URL'
              });
            }
          }
        });

        return issues;
      }
    });

    // JSON validation rules
    this.registerRule({
      id: 'json-schema-compliance',
      name: 'JSON Schema Compliance',
      description: 'Validates JSON against schema',
      severity: 'error',
      category: 'schema',
      validate: (content: string) => {
        const issues: ValidationIssue[] = [];
        
        try {
          const parsed = JSON.parse(content);
          
          // Check for required schema properties if it's a schema
          if (parsed.$schema) {
            if (!parsed.type) {
              issues.push({
                ruleId: 'json-schema-compliance',
                severity: 'error',
                message: 'Schema missing required "type" property',
                suggestion: 'Add a "type" property to the schema'
              });
            }
          }
          
          // Check for circular references
          this.checkCircularReferences(parsed, [], issues);
          
        } catch (error) {
          // JSON parsing error already handled by format validator
        }

        return issues;
      }
    });

    // HTML validation rules
    this.registerRule({
      id: 'html-accessibility',
      name: 'HTML Accessibility',
      description: 'Checks for accessibility issues in HTML',
      severity: 'warning',
      category: 'accessibility',
      validate: (content: string) => {
        const issues: ValidationIssue[] = [];
        
        // Check for images without alt text
        const imgRegex = /<img[^>]*>/gi;
        let match;
        while ((match = imgRegex.exec(content)) !== null) {
          if (!match[0].includes('alt=')) {
            issues.push({
              ruleId: 'html-accessibility',
              severity: 'warning',
              message: 'Image missing alt attribute',
              context: match[0],
              suggestion: 'Add alt attribute for screen readers'
            });
          }
        }
        
        // Check for heading structure
        const headingRegex = /<h([1-6])[^>]*>/gi;
        const headingLevels: number[] = [];
        while ((match = headingRegex.exec(content)) !== null) {
          headingLevels.push(parseInt(match[1]));
        }
        
        for (let i = 1; i < headingLevels.length; i++) {
          if (headingLevels[i] > headingLevels[i - 1] + 1) {
            issues.push({
              ruleId: 'html-accessibility',
              severity: 'warning',
              message: `Heading level skipped (h${headingLevels[i - 1]} to h${headingLevels[i]})`,
              suggestion: 'Use sequential heading levels'
            });
          }
        }

        return issues;
      }
    });

    // React/JSX validation rules
    this.registerRule({
      id: 'react-best-practices',
      name: 'React Best Practices',
      description: 'Checks React code for best practices',
      severity: 'warning',
      category: 'react',
      validate: (content: string) => {
        const issues: ValidationIssue[] = [];
        const lines = content.split('\n');
        
        lines.forEach((line, index) => {
          // Check for inline styles
          if (line.includes('style={{')) {
            issues.push({
              ruleId: 'react-best-practices',
              severity: 'info',
              message: 'Consider using CSS classes instead of inline styles',
              line: index + 1,
              context: line.trim(),
              suggestion: 'Move styles to CSS files or styled-components'
            });
          }
          
          // Check for missing keys in lists
          if (line.includes('.map(') && !line.includes('key=')) {
            issues.push({
              ruleId: 'react-best-practices',
              severity: 'warning',
              message: 'List items should have unique keys',
              line: index + 1,
              context: line.trim(),
              suggestion: 'Add key prop to list items'
            });
          }
          
          // Check for console.log statements
          if (line.includes('console.log')) {
            issues.push({
              ruleId: 'react-best-practices',
              severity: 'warning',
              message: 'Remove console.log statements from production code',
              line: index + 1,
              context: line.trim(),
              suggestion: 'Use proper logging or remove console statements'
            });
          }
        });

        return issues;
      }
    });

    // Performance rules
    this.registerRule({
      id: 'performance-check',
      name: 'Performance Check',
      description: 'Checks for performance issues',
      severity: 'info',
      category: 'performance',
      validate: (content: string) => {
        const issues: ValidationIssue[] = [];
        
        // Check file size
        if (content.length > 100000) { // 100KB
          issues.push({
            ruleId: 'performance-check',
            severity: 'warning',
            message: 'Large file size may impact performance',
            suggestion: 'Consider breaking into smaller files or optimizing content'
          });
        }
        
        // Check for large inline data
        const dataUrlRegex = /data:[^;]+;base64,[A-Za-z0-9+/]+=*/g;
        const dataUrls = content.match(dataUrlRegex);
        if (dataUrls) {
          dataUrls.forEach(dataUrl => {
            if (dataUrl.length > 10000) { // 10KB
              issues.push({
                ruleId: 'performance-check',
                severity: 'info',
                message: 'Large inline data URL detected',
                context: dataUrl.substring(0, 50) + '...',
                suggestion: 'Consider using external file references'
              });
            }
          });
        }

        return issues;
      }
    });

    // Code quality rules
    this.registerRule({
      id: 'code-quality',
      name: 'Code Quality',
      description: 'General code quality checks',
      severity: 'info',
      category: 'quality',
      validate: (content: string) => {
        const issues: ValidationIssue[] = [];
        const lines = content.split('\n');
        
        lines.forEach((line, index) => {
          // Check for very long lines
          if (line.length > 120) {
            issues.push({
              ruleId: 'code-quality',
              severity: 'info',
              message: 'Line exceeds 120 characters',
              line: index + 1,
              suggestion: 'Break long lines for better readability'
            });
          }
          
          // Check for trailing whitespace
          if (line.endsWith(' ') || line.endsWith('\t')) {
            issues.push({
              ruleId: 'code-quality',
              severity: 'info',
              message: 'Trailing whitespace detected',
              line: index + 1,
              suggestion: 'Remove trailing whitespace'
            });
          }
        });

        return issues;
      }
    });
  }

  private initializeFormatValidators(): void {
    // JSON format validator
    this.formatValidators.set('json', (content: string) => {
      const issues: ValidationIssue[] = [];
      
      try {
        JSON.parse(content);
      } catch (error) {
        issues.push({
          ruleId: 'json-syntax',
          severity: 'error',
          message: `Invalid JSON syntax: ${error.message}`,
          suggestion: 'Fix JSON syntax errors'
        });
      }
      
      return issues;
    });

    // YAML format validator
    this.formatValidators.set('yaml', (content: string) => {
      const issues: ValidationIssue[] = [];
      
      try {
        yaml.load(content);
      } catch (error) {
        issues.push({
          ruleId: 'yaml-syntax',
          severity: 'error',
          message: `Invalid YAML syntax: ${error.message}`,
          suggestion: 'Fix YAML syntax errors'
        });
      }
      
      return issues;
    });

    // Markdown format validator
    this.formatValidators.set('markdown', (content: string) => {
      const issues: ValidationIssue[] = [];
      
      try {
        marked.parse(content);
      } catch (error) {
        issues.push({
          ruleId: 'markdown-syntax',
          severity: 'error',
          message: `Markdown parsing error: ${error.message}`,
          suggestion: 'Fix Markdown syntax issues'
        });
      }
      
      return issues;
    });

    // HTML format validator
    this.formatValidators.set('html', (content: string) => {
      const issues: ValidationIssue[] = [];
      
      // Basic HTML validation
      const openTags = content.match(/<[^/][^>]*>/g) || [];
      const closeTags = content.match(/<\/[^>]+>/g) || [];
      
      if (openTags.length !== closeTags.length) {
        issues.push({
          ruleId: 'html-structure',
          severity: 'warning',
          message: 'Mismatched HTML tags detected',
          suggestion: 'Ensure all HTML tags are properly closed'
        });
      }
      
      return issues;
    });

    // React/JSX format validator
    this.formatValidators.set('react', (content: string) => {
      const issues: ValidationIssue[] = [];
      
      // Check for JSX syntax issues
      const jsxElements = content.match(/<[A-Z][^>]*>/g) || [];
      jsxElements.forEach(element => {
        // Check for self-closing tags
        if (!element.endsWith('/>') && !element.endsWith('>')) {
          issues.push({
            ruleId: 'jsx-syntax',
            severity: 'error',
            message: 'Invalid JSX element syntax',
            context: element,
            suggestion: 'Ensure JSX elements are properly formatted'
          });
        }
      });
      
      return issues;
    });
  }

  registerRule(rule: ValidationRule): void {
    this.rules.set(rule.id, rule);
    logger.debug('Validation rule registered', { ruleId: rule.id, category: rule.category });
  }

  unregisterRule(ruleId: string): void {
    this.rules.delete(ruleId);
    logger.debug('Validation rule unregistered', { ruleId });
  }

  async validate(
    content: string,
    config: ValidationConfig
  ): Promise<ValidationResult> {
    const startTime = Date.now();
    
    logger.debug('Starting validation', {
      format: config.format,
      contentSize: content.length,
      rules: config.rules
    });

    const issues: ValidationIssue[] = [];

    try {
      // 1. Format-specific validation
      const formatValidator = this.formatValidators.get(config.format);
      if (formatValidator) {
        const formatIssues = formatValidator(content);
        issues.push(...formatIssues);
      }

      // 2. Apply specified rules
      for (const ruleId of config.rules) {
        const rule = this.rules.get(ruleId);
        if (rule) {
          try {
            const ruleIssues = rule.validate(content);
            issues.push(...ruleIssues);
          } catch (error) {
            logger.warn('Rule validation failed', {
              ruleId,
              error: error.message
            });
            
            if (config.strictMode) {
              issues.push({
                ruleId: 'validation-error',
                severity: 'error',
                message: `Validation rule "${ruleId}" failed: ${error.message}`,
                suggestion: 'Check rule configuration'
              });
            }
          }
        } else {
          logger.warn('Unknown validation rule', { ruleId });
          
          if (config.strictMode) {
            issues.push({
              ruleId: 'unknown-rule',
              severity: 'warning',
              message: `Unknown validation rule: ${ruleId}`,
              suggestion: 'Check rule ID spelling'
            });
          }
        }
      }

      // 3. Apply custom rules
      if (config.customRules) {
        for (const rule of config.customRules) {
          try {
            const ruleIssues = rule.validate(content);
            issues.push(...ruleIssues);
          } catch (error) {
            logger.warn('Custom rule validation failed', {
              ruleId: rule.id,
              error: error.message
            });
          }
        }
      }

      // 4. Category-based validation
      if (config.accessibility) {
        const accessibilityRules = Array.from(this.rules.values())
          .filter(rule => rule.category === 'accessibility');
        
        for (const rule of accessibilityRules) {
          const ruleIssues = rule.validate(content);
          issues.push(...ruleIssues);
        }
      }

      if (config.performance) {
        const performanceRules = Array.from(this.rules.values())
          .filter(rule => rule.category === 'performance');
        
        for (const rule of performanceRules) {
          const ruleIssues = rule.validate(content);
          issues.push(...ruleIssues);
        }
      }

      if (config.codeQuality) {
        const qualityRules = Array.from(this.rules.values())
          .filter(rule => rule.category === 'quality');
        
        for (const rule of qualityRules) {
          const ruleIssues = rule.validate(content);
          issues.push(...ruleIssues);
        }
      }

      // Calculate summary
      const summary = {
        errors: issues.filter(i => i.severity === 'error').length,
        warnings: issues.filter(i => i.severity === 'warning').length,
        info: issues.filter(i => i.severity === 'info').length
      };

      // Calculate score (0-100)
      const totalIssues = summary.errors + summary.warnings + summary.info;
      const errorWeight = 10;
      const warningWeight = 5;
      const infoWeight = 1;
      
      const weightedIssues = (summary.errors * errorWeight) + 
                           (summary.warnings * warningWeight) + 
                           (summary.info * infoWeight);
      
      const maxPossibleIssues = Math.max(content.split('\n').length, 10); // Assume max 1 issue per line
      const score = Math.max(0, Math.min(100, 
        100 - (weightedIssues / (maxPossibleIssues * errorWeight)) * 100
      ));

      const validationTime = Date.now() - startTime;
      const passed = summary.errors === 0;

      const result: ValidationResult = {
        passed,
        score: Math.round(score),
        issues,
        summary,
        metadata: {
          validatedAt: new Date().toISOString(),
          format: config.format,
          contentSize: content.length,
          validationTime
        }
      };

      logger.info('Validation completed', {
        format: config.format,
        passed,
        score: result.score,
        issues: totalIssues,
        validationTime
      });

      return result;

    } catch (error) {
      logger.error('Validation failed', {
        format: config.format,
        error: error.message
      });

      return {
        passed: false,
        score: 0,
        issues: [{
          ruleId: 'validation-error',
          severity: 'error',
          message: `Validation failed: ${error.message}`,
          suggestion: 'Check content and validation configuration'
        }],
        summary: { errors: 1, warnings: 0, info: 0 },
        metadata: {
          validatedAt: new Date().toISOString(),
          format: config.format,
          contentSize: content.length,
          validationTime: Date.now() - startTime
        }
      };
    }
  }

  // Helper methods
  private checkCircularReferences(
    obj: any, 
    path: string[], 
    issues: ValidationIssue[]
  ): void {
    if (typeof obj !== 'object' || obj === null) return;
    
    // Simple circular reference detection
    try {
      JSON.stringify(obj);
    } catch (error) {
      if (error.message.includes('circular')) {
        issues.push({
          ruleId: 'json-schema-compliance',
          severity: 'error',
          message: 'Circular reference detected in JSON',
          context: path.join('.'),
          suggestion: 'Remove circular references'
        });
      }
    }
  }

  getAvailableRules(): ValidationRule[] {
    return Array.from(this.rules.values());
  }

  getRulesByCategory(category: string): ValidationRule[] {
    return Array.from(this.rules.values()).filter(rule => rule.category === category);
  }

  getRule(ruleId: string): ValidationRule | undefined {
    return this.rules.get(ruleId);
  }

  getSupportedFormats(): string[] {
    return Array.from(this.formatValidators.keys());
  }

  // Preset configurations
  getPresetConfig(preset: 'strict' | 'standard' | 'minimal', format: string): ValidationConfig {
    const baseRules = this.getRulesForFormat(format);
    
    switch (preset) {
      case 'strict':
        return {
          format,
          rules: baseRules,
          accessibility: true,
          performance: true,
          codeQuality: true,
          strictMode: true
        };
      
      case 'standard':
        return {
          format,
          rules: baseRules.filter(rule => {
            const r = this.rules.get(rule);
            return r && r.severity !== 'info';
          }),
          accessibility: true,
          performance: false,
          codeQuality: false,
          strictMode: false
        };
      
      case 'minimal':
        return {
          format,
          rules: baseRules.filter(rule => {
            const r = this.rules.get(rule);
            return r && r.severity === 'error';
          }),
          accessibility: false,
          performance: false,
          codeQuality: false,
          strictMode: false
        };
      
      default:
        return {
          format,
          rules: baseRules,
          strictMode: false
        };
    }
  }

  private getRulesForFormat(format: string): string[] {
    const formatRuleMap: Record<string, string[]> = {
      'markdown': ['md-heading-structure', 'md-link-validation'],
      'json': ['json-schema-compliance'],
      'html': ['html-accessibility'],
      'react': ['react-best-practices', 'code-quality'],
      'yaml': []
    };
    
    return formatRuleMap[format] || [];
  }
}

export const validationEngine = new ValidationEngine();
import { BaseGenerator, ExportOptions } from './BaseGenerator';
import { marked } from 'marked';
import TurndownService from 'turndown';

export class MarkdownGenerator extends BaseGenerator {
  private turndownService: TurndownService;

  constructor() {
    super('markdown', 'text/markdown', '.md');
    this.turndownService = new TurndownService({
      headingStyle: 'atx',
      codeBlockStyle: 'fenced',
      fence: '```',
      emDelimiter: '*',
      strongDelimiter: '**',
      linkStyle: 'inlined'
    });
  }

  protected async generateContent(data: any, options: ExportOptions): Promise<string> {
    let content = '';

    // Add title and metadata header
    if (options.includeMetadata !== false) {
      content += this.generateHeader(data, options);
    }

    // Generate main content based on data structure
    if (data.type === 'design') {
      content += this.generateDesignMarkdown(data, options);
    } else if (data.type === 'component') {
      content += this.generateComponentMarkdown(data, options);
    } else if (data.type === 'project') {
      content += this.generateProjectMarkdown(data, options);
    } else {
      content += this.generateGenericMarkdown(data, options);
    }

    return content;
  }

  private generateHeader(data: any, options: ExportOptions): string {
    const title = data.name || data.title || 'Export';
    const description = data.description || '';
    const timestamp = new Date().toISOString();

    let header = `# ${title}\n\n`;
    
    if (description) {
      header += `${description}\n\n`;
    }

    if (options.includeMetadata !== false) {
      header += `---\n`;
      header += `**Generated:** ${timestamp}  \n`;
      header += `**Source:** ${data.source || 'Imagineer Design Parser'}  \n`;
      header += `**Format:** Enhanced Markdown  \n`;
      if (data.version) {
        header += `**Version:** ${data.version}  \n`;
      }
      header += `---\n\n`;
    }

    return header;
  }

  private generateDesignMarkdown(data: any, options: ExportOptions): string {
    let content = '';

    // Design Overview
    content += `## Design Overview\n\n`;
    
    if (data.dimensions) {
      content += `**Dimensions:** ${data.dimensions.width} × ${data.dimensions.height}px\n\n`;
    }

    if (data.background) {
      content += `**Background:** ${data.background}\n\n`;
    }

    // Color Palette
    if (data.colors && data.colors.length > 0) {
      content += `## Color Palette\n\n`;
      data.colors.forEach((color: any) => {
        content += `- **${color.name || 'Color'}:** \`${color.value}\``;
        if (color.usage) {
          content += ` (${color.usage})`;
        }
        content += `\n`;
      });
      content += `\n`;
    }

    // Typography
    if (data.typography && data.typography.length > 0) {
      content += `## Typography\n\n`;
      data.typography.forEach((font: any) => {
        content += `### ${font.name || 'Font'}\n\n`;
        content += `- **Family:** ${font.family}\n`;
        if (font.weight) content += `- **Weight:** ${font.weight}\n`;
        if (font.size) content += `- **Size:** ${font.size}\n`;
        if (font.lineHeight) content += `- **Line Height:** ${font.lineHeight}\n`;
        content += `\n`;
      });
    }

    // Layout Structure
    if (data.layout || data.elements) {
      content += `## Layout Structure\n\n`;
      content += this.generateLayoutMarkdown(data.layout || data.elements, 0);
    }

    // Components
    if (data.components && data.components.length > 0) {
      content += `## Components\n\n`;
      data.components.forEach((component: any) => {
        content += this.generateComponentMarkdown(component, options);
      });
    }

    // Interactions
    if (data.interactions && data.interactions.length > 0) {
      content += `## Interactions\n\n`;
      data.interactions.forEach((interaction: any) => {
        content += `### ${interaction.trigger || 'Interaction'}\n\n`;
        content += `**Action:** ${interaction.action}\n`;
        if (interaction.target) {
          content += `**Target:** ${interaction.target}\n`;
        }
        if (interaction.animation) {
          content += `**Animation:** ${interaction.animation}\n`;
        }
        content += `\n`;
      });
    }

    return content;
  }

  private generateLayoutMarkdown(elements: any[], depth: number = 0): string {
    if (!elements || !Array.isArray(elements)) return '';
    
    let content = '';
    const indent = '  '.repeat(depth);

    elements.forEach((element: any) => {
      const elementType = element.type || 'Element';
      const elementName = element.name || elementType;
      
      content += `${indent}- **${elementName}** (${elementType})\n`;
      
      if (element.properties) {
        Object.entries(element.properties).forEach(([key, value]) => {
          content += `${indent}  - ${key}: ${value}\n`;
        });
      }

      if (element.styles) {
        content += `${indent}  - **Styles:**\n`;
        Object.entries(element.styles).forEach(([key, value]) => {
          content += `${indent}    - ${key}: ${value}\n`;
        });
      }

      if (element.children && element.children.length > 0) {
        content += this.generateLayoutMarkdown(element.children, depth + 1);
      }
      
      content += `\n`;
    });

    return content;
  }

  private generateComponentMarkdown(component: any, options: ExportOptions): string {
    let content = '';
    
    const componentName = component.name || 'Component';
    content += `### ${componentName}\n\n`;
    
    if (component.description) {
      content += `${component.description}\n\n`;
    }

    // Properties
    if (component.properties && Object.keys(component.properties).length > 0) {
      content += `**Properties:**\n`;
      Object.entries(component.properties).forEach(([key, value]) => {
        content += `- ${key}: \`${value}\`\n`;
      });
      content += `\n`;
    }

    // Variants
    if (component.variants && component.variants.length > 0) {
      content += `**Variants:**\n`;
      component.variants.forEach((variant: any) => {
        content += `- **${variant.name}:** ${variant.description || 'No description'}\n`;
      });
      content += `\n`;
    }

    // Usage
    if (component.usage) {
      content += `**Usage:**\n`;
      content += `\`\`\`${component.usage.language || 'jsx'}\n`;
      content += `${component.usage.code}\n`;
      content += `\`\`\`\n\n`;
    }

    return content;
  }

  private generateProjectMarkdown(data: any, options: ExportOptions): string {
    let content = '';

    // Project Overview
    content += `## Project Information\n\n`;
    
    if (data.team) {
      content += `**Team:** ${data.team}\n`;
    }
    
    if (data.platform) {
      content += `**Platform:** ${data.platform}\n`;
    }
    
    if (data.status) {
      content += `**Status:** ${data.status}\n`;
    }
    
    content += `\n`;

    // Design System
    if (data.designSystem) {
      content += `## Design System\n\n`;
      content += this.generateDesignSystemMarkdown(data.designSystem);
    }

    // Screens/Pages
    if (data.screens && data.screens.length > 0) {
      content += `## Screens\n\n`;
      data.screens.forEach((screen: any, index: number) => {
        content += `### ${screen.name || `Screen ${index + 1}`}\n\n`;
        if (screen.description) {
          content += `${screen.description}\n\n`;
        }
        if (screen.elements) {
          content += this.generateLayoutMarkdown(screen.elements);
        }
      });
    }

    return content;
  }

  private generateDesignSystemMarkdown(designSystem: any): string {
    let content = '';

    // Colors
    if (designSystem.colors) {
      content += `### Colors\n\n`;
      Object.entries(designSystem.colors).forEach(([category, colors]) => {
        content += `**${category}:**\n`;
        if (Array.isArray(colors)) {
          (colors as any[]).forEach((color: any) => {
            content += `- ${color.name}: \`${color.value}\`\n`;
          });
        }
        content += `\n`;
      });
    }

    // Typography
    if (designSystem.typography) {
      content += `### Typography\n\n`;
      Object.entries(designSystem.typography).forEach(([style, props]) => {
        content += `**${style}:**\n`;
        Object.entries(props as any).forEach(([prop, value]) => {
          content += `- ${prop}: ${value}\n`;
        });
        content += `\n`;
      });
    }

    // Spacing
    if (designSystem.spacing) {
      content += `### Spacing\n\n`;
      Object.entries(designSystem.spacing).forEach(([size, value]) => {
        content += `- **${size}:** ${value}\n`;
      });
      content += `\n`;
    }

    return content;
  }

  private generateGenericMarkdown(data: any, options: ExportOptions): string {
    let content = '';

    // Try to convert any structured data to markdown
    if (typeof data === 'object') {
      content += this.objectToMarkdown(data, 0);
    } else {
      content += `${data}\n\n`;
    }

    return content;
  }

  private objectToMarkdown(obj: any, depth: number = 0): string {
    let content = '';
    const indent = '  '.repeat(depth);

    if (Array.isArray(obj)) {
      obj.forEach((item, index) => {
        content += `${indent}- `;
        if (typeof item === 'object') {
          content += `\n${this.objectToMarkdown(item, depth + 1)}`;
        } else {
          content += `${item}\n`;
        }
      });
    } else if (typeof obj === 'object' && obj !== null) {
      Object.entries(obj).forEach(([key, value]) => {
        if (typeof value === 'object' && value !== null) {
          content += `${indent}**${key}:**\n`;
          content += this.objectToMarkdown(value, depth + 1);
        } else {
          content += `${indent}**${key}:** ${value}\n`;
        }
      });
    } else {
      content += `${indent}${obj}\n`;
    }

    return content;
  }

  protected formatMetadataHeader(metadata: Record<string, any>): string {
    return `<!-- \n${JSON.stringify(metadata, null, 2)}\n-->\n\n`;
  }

  // Convert HTML to Markdown if needed
  htmlToMarkdown(html: string): string {
    return this.turndownService.turndown(html);
  }

  // Convert Markdown to HTML if needed  
  markdownToHtml(markdown: string): string {
    return marked.parse(markdown);
  }

  protected canMinify(): boolean {
    return true;
  }

  protected minifyContent(content: string): string {
    return content
      .replace(/\n{3,}/g, '\n\n') // Reduce multiple newlines
      .replace(/[ \t]+$/gm, '') // Remove trailing whitespace
      .trim();
  }
}
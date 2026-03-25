import { BaseGenerator, ExportOptions } from './BaseGenerator';

export class HtmlGenerator extends BaseGenerator {
  constructor() {
    super('html', 'text/html', '.html');
  }

  protected async generateContent(data: any, options: ExportOptions): Promise<string> {
    const { customSettings = {} } = options;
    const { template = 'preview', includeStyles = true, responsive = true } = customSettings;

    switch (template) {
      case 'preview':
        return this.generatePreviewHtml(data, options);
      case 'prototype':
        return this.generatePrototypeHtml(data, options);
      case 'documentation':
        return this.generateDocumentationHtml(data, options);
      case 'style-guide':
        return this.generateStyleGuideHtml(data, options);
      case 'embed':
        return this.generateEmbedHtml(data, options);
      default:
        return this.generatePreviewHtml(data, options);
    }
  }

  private generatePreviewHtml(data: any, options: ExportOptions): string {
    const { includeStyles = true, responsive = true } = options.customSettings || {};
    
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${this.escapeHtml(data.name || 'Design Preview')}</title>
    ${includeStyles ? this.generateStyleSheet(data, responsive) : ''}
    ${this.generateMetaTags(data)}
</head>
<body>
    ${this.generateHeader(data)}
    <main class="design-preview">
        ${this.generatePreviewContent(data, options)}
    </main>
    ${this.generateFooter(data)}
    ${this.generateJavaScript(data, options)}
</body>
</html>`.trim();

    return html;
  }

  private generatePrototypeHtml(data: any, options: ExportOptions): string {
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${this.escapeHtml(data.name || 'Interactive Prototype')}</title>
    ${this.generateStyleSheet(data, true)}
    ${this.generatePrototypeStyles()}
</head>
<body class="prototype-mode">
    <div class="prototype-container">
        ${this.generatePrototypeNavigation(data)}
        <div class="prototype-viewport">
            ${this.generatePrototypeScreens(data)}
        </div>
    </div>
    ${this.generatePrototypeJavaScript(data)}
</body>
</html>`.trim();

    return html;
  }

  private generateDocumentationHtml(data: any, options: ExportOptions): string {
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${this.escapeHtml(data.name || 'Design Documentation')}</title>
    ${this.generateDocumentationStyles()}
</head>
<body>
    <div class="documentation-container">
        <nav class="sidebar">
            ${this.generateDocumentationNav(data)}
        </nav>
        <main class="content">
            ${this.generateDocumentationContent(data)}
        </main>
    </div>
    ${this.generateDocumentationJavaScript()}
</body>
</html>`.trim();

    return html;
  }

  private generateStyleGuideHtml(data: any, options: ExportOptions): string {
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${this.escapeHtml(data.name || 'Style Guide')}</title>
    ${this.generateStyleGuideStyles()}
</head>
<body>
    <div class="style-guide">
        <header class="style-guide-header">
            <h1>${this.escapeHtml(data.name || 'Style Guide')}</h1>
            ${data.description ? `<p class="description">${this.escapeHtml(data.description)}</p>` : ''}
        </header>
        
        ${this.generateColorPalette(data)}
        ${this.generateTypographySection(data)}
        ${this.generateComponentsSection(data)}
        ${this.generateSpacingSection(data)}
        ${this.generateIconsSection(data)}
    </div>
</body>
</html>`.trim();

    return html;
  }

  private generateEmbedHtml(data: any, options: ExportOptions): string {
    // Generate embeddable HTML fragment
    return `
<div class="imagineer-embed" data-design="${data.id || 'unknown'}">
    <style scoped>
        ${this.generateInlineStyles(data)}
    </style>
    ${this.generateEmbedContent(data)}
</div>`.trim();
  }

  private generateStyleSheet(data: any, responsive: boolean): string {
    return `
    <style>
        /* Reset and Base Styles */
        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }
        
        body {
            font-family: ${this.getDefaultFont(data)};
            line-height: 1.6;
            color: ${this.getDefaultTextColor(data)};
            background-color: ${this.getDefaultBackgroundColor(data)};
        }
        
        /* Design System Colors */
        ${this.generateColorVariables(data)}
        
        /* Typography */
        ${this.generateTypographyStyles(data)}
        
        /* Layout */
        ${this.generateLayoutStyles(data)}
        
        /* Components */
        ${this.generateComponentStyles(data)}
        
        ${responsive ? this.generateResponsiveStyles(data) : ''}
        
        /* Preview specific styles */
        .design-preview {
            max-width: ${data.dimensions?.width || 1200}px;
            margin: 0 auto;
            padding: 20px;
        }
        
        .element {
            position: relative;
            border: 1px dashed #ddd;
            margin: 10px 0;
            padding: 10px;
        }
        
        .element-label {
            position: absolute;
            top: -15px;
            left: 5px;
            background: #333;
            color: white;
            padding: 2px 8px;
            font-size: 12px;
            border-radius: 3px;
        }
    </style>`;
  }

  private generatePreviewContent(data: any, options: ExportOptions): string {
    let content = '';
    
    if (data.elements) {
      content += this.renderElements(data.elements, 0);
    } else if (data.screens) {
      content += this.renderScreens(data.screens);
    } else {
      content += `<div class="placeholder">No design elements to preview</div>`;
    }
    
    return content;
  }

  private renderElements(elements: any[], depth: number = 0): string {
    return elements.map(element => {
      const elementClass = `element element-${element.type || 'unknown'}`;
      const style = this.generateElementStyle(element);
      const children = element.children ? this.renderElements(element.children, depth + 1) : '';
      
      return `
        <div class="${elementClass}" style="${style}" data-type="${element.type}">
            <span class="element-label">${element.name || element.type}</span>
            ${element.text ? `<span class="element-text">${this.escapeHtml(element.text)}</span>` : ''}
            ${children}
        </div>
      `;
    }).join('');
  }

  private renderScreens(screens: any[]): string {
    return screens.map((screen, index) => `
      <section class="screen" id="screen-${index}">
        <h2>${this.escapeHtml(screen.name)}</h2>
        ${screen.description ? `<p class="screen-description">${this.escapeHtml(screen.description)}</p>` : ''}
        ${screen.elements ? this.renderElements(screen.elements) : ''}
      </section>
    `).join('');
  }

  private generateElementStyle(element: any): string {
    const styles: string[] = [];
    
    if (element.styles) {
      Object.entries(element.styles).forEach(([property, value]) => {
        styles.push(`${this.camelToKebab(property)}: ${value}`);
      });
    }
    
    if (element.position) {
      styles.push(`left: ${element.position.x}px`);
      styles.push(`top: ${element.position.y}px`);
    }
    
    if (element.dimensions) {
      styles.push(`width: ${element.dimensions.width}px`);
      styles.push(`height: ${element.dimensions.height}px`);
    }
    
    return styles.join('; ');
  }

  private generateColorPalette(data: any): string {
    if (!data.colors || data.colors.length === 0) return '';
    
    return `
    <section class="color-palette">
        <h2>Color Palette</h2>
        <div class="color-grid">
            ${data.colors.map((color: any) => `
                <div class="color-swatch">
                    <div class="color-sample" style="background-color: ${color.value}"></div>
                    <div class="color-info">
                        <h4>${this.escapeHtml(color.name)}</h4>
                        <code>${color.value}</code>
                        ${color.usage ? `<p class="usage">${this.escapeHtml(color.usage)}</p>` : ''}
                    </div>
                </div>
            `).join('')}
        </div>
    </section>`;
  }

  private generateTypographySection(data: any): string {
    if (!data.typography || data.typography.length === 0) return '';
    
    return `
    <section class="typography">
        <h2>Typography</h2>
        ${data.typography.map((font: any) => `
            <div class="type-specimen">
                <h3>${this.escapeHtml(font.name)}</h3>
                <div class="type-sample" style="font-family: ${font.family}; font-weight: ${font.weight}; font-size: ${font.size};">
                    The quick brown fox jumps over the lazy dog
                </div>
                <div class="type-specs">
                    <span>Font: ${font.family}</span>
                    <span>Weight: ${font.weight}</span>
                    <span>Size: ${font.size}</span>
                </div>
            </div>
        `).join('')}
    </section>`;
  }

  private generateComponentsSection(data: any): string {
    if (!data.components || data.components.length === 0) return '';
    
    return `
    <section class="components">
        <h2>Components</h2>
        ${data.components.map((component: any) => `
            <div class="component-showcase">
                <h3>${this.escapeHtml(component.name)}</h3>
                ${component.description ? `<p>${this.escapeHtml(component.description)}</p>` : ''}
                <div class="component-preview">
                    ${component.html || `<div class="placeholder">Component preview not available</div>`}
                </div>
            </div>
        `).join('')}
    </section>`;
  }

  private generateSpacingSection(data: any): string {
    if (!data.spacing) return '';
    
    return `
    <section class="spacing">
        <h2>Spacing</h2>
        <div class="spacing-scale">
            ${Object.entries(data.spacing).map(([name, value]) => `
                <div class="spacing-item">
                    <div class="spacing-visual" style="width: ${value}; height: 20px; background: #007bff;"></div>
                    <div class="spacing-label">
                        <strong>${name}</strong>: ${value}
                    </div>
                </div>
            `).join('')}
        </div>
    </section>`;
  }

  private generateIconsSection(data: any): string {
    if (!data.icons || data.icons.length === 0) return '';
    
    return `
    <section class="icons">
        <h2>Icons</h2>
        <div class="icon-grid">
            ${data.icons.map((icon: any) => `
                <div class="icon-item">
                    <div class="icon-preview">
                        ${icon.svg || icon.html || '📦'}
                    </div>
                    <div class="icon-name">${this.escapeHtml(icon.name)}</div>
                </div>
            `).join('')}
        </div>
    </section>`;
  }

  private generateMetaTags(data: any): string {
    return `
    <meta name="description" content="${this.escapeHtml(data.description || 'Design preview generated by Imagineer')}">
    <meta name="author" content="Imagineer Export Engine">
    <meta name="generator" content="Imagineer Export Engine v1.0.0">
    <meta property="og:title" content="${this.escapeHtml(data.name || 'Design Preview')}">
    <meta property="og:description" content="${this.escapeHtml(data.description || 'Design preview generated by Imagineer')}">
    <meta property="og:type" content="website">
    `;
  }

  private generateHeader(data: any): string {
    return `
    <header class="preview-header">
        <h1>${this.escapeHtml(data.name || 'Design Preview')}</h1>
        ${data.description ? `<p class="description">${this.escapeHtml(data.description)}</p>` : ''}
        <div class="metadata">
            <span>Generated: ${new Date().toLocaleDateString()}</span>
            ${data.version ? `<span>Version: ${this.escapeHtml(data.version)}</span>` : ''}
        </div>
    </header>`;
  }

  private generateFooter(data: any): string {
    return `
    <footer class="preview-footer">
        <p>Generated by <a href="https://imagineer.dev" target="_blank">Imagineer Export Engine</a></p>
    </footer>`;
  }

  private generateJavaScript(data: any, options: ExportOptions): string {
    if (options.customSettings?.includeInteractivity === false) return '';
    
    return `
    <script>
        // Basic interactivity for design preview
        document.addEventListener('DOMContentLoaded', function() {
            // Add click handlers for elements
            document.querySelectorAll('.element').forEach(function(element) {
                element.addEventListener('click', function(e) {
                    e.stopPropagation();
                    this.classList.toggle('selected');
                });
            });
            
            // Add hover effects
            document.querySelectorAll('.element').forEach(function(element) {
                element.addEventListener('mouseenter', function() {
                    this.style.borderColor = '#007bff';
                });
                
                element.addEventListener('mouseleave', function() {
                    this.style.borderColor = '#ddd';
                });
            });
        });
    </script>`;
  }

  // Helper methods
  private getDefaultFont(data: any): string {
    return data.typography?.[0]?.family || 'system-ui, -apple-system, sans-serif';
  }

  private getDefaultTextColor(data: any): string {
    const textColor = data.colors?.find((c: any) => c.usage?.includes('text') || c.name?.includes('text'));
    return textColor?.value || '#333333';
  }

  private getDefaultBackgroundColor(data: any): string {
    return data.background || '#ffffff';
  }

  private generateColorVariables(data: any): string {
    if (!data.colors) return '';
    
    const cssVars = data.colors.map((color: any) => {
      const varName = `--color-${color.name.toLowerCase().replace(/\s+/g, '-')}`;
      return `${varName}: ${color.value};`;
    }).join('\n        ');
    
    return `:root {\n        ${cssVars}\n    }`;
  }

  private generateTypographyStyles(data: any): string {
    if (!data.typography) return '';
    
    return data.typography.map((font: any, index: number) => `
        .typography-${index} {
            font-family: ${font.family};
            font-weight: ${font.weight};
            font-size: ${font.size};
            line-height: ${font.lineHeight || '1.6'};
        }
    `).join('');
  }

  private generateLayoutStyles(data: any): string {
    return `
        .container { max-width: 1200px; margin: 0 auto; padding: 0 20px; }
        .grid { display: grid; gap: 20px; }
        .flex { display: flex; gap: 20px; }
        .flex-column { flex-direction: column; }
        .flex-center { align-items: center; justify-content: center; }
    `;
  }

  private generateComponentStyles(data: any): string {
    if (!data.components) return '';
    
    return data.components.map((component: any) => {
      return component.css || '';
    }).join('\n');
  }

  private generateResponsiveStyles(data: any): string {
    return `
        @media (max-width: 768px) {
            .design-preview { padding: 10px; }
            .element { margin: 5px 0; padding: 5px; }
            .preview-header h1 { font-size: 1.5rem; }
        }
        
        @media (max-width: 480px) {
            .design-preview { padding: 5px; }
            .grid { grid-template-columns: 1fr; }
            .flex { flex-direction: column; }
        }
    `;
  }

  private camelToKebab(str: string): string {
    return str.replace(/([A-Z])/g, '-$1').toLowerCase();
  }

  private generatePrototypeNavigation(data: any): string {
    if (!data.screens) return '';
    
    return `
    <nav class="prototype-nav">
        <ul>
            ${data.screens.map((screen: any, index: number) => `
                <li><a href="#screen-${index}" data-screen="${index}">${this.escapeHtml(screen.name)}</a></li>
            `).join('')}
        </ul>
    </nav>`;
  }

  private generatePrototypeScreens(data: any): string {
    if (!data.screens) return '';
    
    return data.screens.map((screen: any, index: number) => `
        <div class="prototype-screen" id="prototype-screen-${index}" ${index === 0 ? 'style="display: block;"' : 'style="display: none;"'}>
            ${this.renderElements(screen.elements || [])}
        </div>
    `).join('');
  }

  private generatePrototypeStyles(): string {
    return `
    <style>
        .prototype-container { display: flex; height: 100vh; }
        .prototype-nav { width: 250px; background: #f8f9fa; padding: 20px; }
        .prototype-viewport { flex: 1; padding: 20px; overflow: auto; }
        .prototype-screen { display: none; }
        .prototype-screen.active { display: block; }
        .prototype-nav ul { list-style: none; }
        .prototype-nav li { margin: 10px 0; }
        .prototype-nav a { 
            display: block; 
            padding: 10px; 
            text-decoration: none; 
            color: #333;
            border-radius: 5px;
        }
        .prototype-nav a:hover,
        .prototype-nav a.active { 
            background: #007bff; 
            color: white; 
        }
    </style>`;
  }

  private generatePrototypeJavaScript(data: any): string {
    return `
    <script>
        document.addEventListener('DOMContentLoaded', function() {
            const navLinks = document.querySelectorAll('.prototype-nav a');
            const screens = document.querySelectorAll('.prototype-screen');
            
            navLinks.forEach(function(link) {
                link.addEventListener('click', function(e) {
                    e.preventDefault();
                    const screenIndex = this.dataset.screen;
                    
                    // Hide all screens
                    screens.forEach(function(screen) {
                        screen.style.display = 'none';
                    });
                    
                    // Remove active class from all nav links
                    navLinks.forEach(function(navLink) {
                        navLink.classList.remove('active');
                    });
                    
                    // Show selected screen
                    document.getElementById('prototype-screen-' + screenIndex).style.display = 'block';
                    
                    // Add active class to clicked nav link
                    this.classList.add('active');
                });
            });
            
            // Set first screen as active
            if (navLinks.length > 0) {
                navLinks[0].classList.add('active');
            }
        });
    </script>`;
  }

  private generateDocumentationStyles(): string {
    return `
    <style>
        body { font-family: system-ui, sans-serif; margin: 0; }
        .documentation-container { display: flex; min-height: 100vh; }
        .sidebar { width: 300px; background: #f8f9fa; padding: 20px; border-right: 1px solid #ddd; }
        .content { flex: 1; padding: 40px; max-width: 800px; }
        .sidebar ul { list-style: none; padding: 0; }
        .sidebar li { margin: 5px 0; }
        .sidebar a { text-decoration: none; color: #333; padding: 5px 10px; display: block; border-radius: 3px; }
        .sidebar a:hover { background: #e9ecef; }
        h1, h2, h3 { color: #333; }
        code { background: #f8f9fa; padding: 2px 6px; border-radius: 3px; }
        pre { background: #f8f9fa; padding: 15px; border-radius: 5px; overflow-x: auto; }
    </style>`;
  }

  private generateDocumentationNav(data: any): string {
    return `
    <ul>
        <li><a href="#overview">Overview</a></li>
        ${data.colors ? '<li><a href="#colors">Colors</a></li>' : ''}
        ${data.typography ? '<li><a href="#typography">Typography</a></li>' : ''}
        ${data.components ? '<li><a href="#components">Components</a></li>' : ''}
        ${data.layout ? '<li><a href="#layout">Layout</a></li>' : ''}
    </ul>`;
  }

  private generateDocumentationContent(data: any): string {
    return `
    <section id="overview">
        <h1>${this.escapeHtml(data.name || 'Design Documentation')}</h1>
        ${data.description ? `<p>${this.escapeHtml(data.description)}</p>` : ''}
    </section>
    
    ${this.generateColorPalette(data)}
    ${this.generateTypographySection(data)}
    ${this.generateComponentsSection(data)}
    `;
  }

  private generateDocumentationJavaScript(): string {
    return `
    <script>
        // Smooth scrolling for navigation links
        document.querySelectorAll('.sidebar a').forEach(function(link) {
            link.addEventListener('click', function(e) {
                e.preventDefault();
                const target = document.querySelector(this.getAttribute('href'));
                if (target) {
                    target.scrollIntoView({ behavior: 'smooth' });
                }
            });
        });
    </script>`;
  }

  private generateStyleGuideStyles(): string {
    return `
    <style>
        body { font-family: system-ui, sans-serif; margin: 0; background: #fff; }
        .style-guide { max-width: 1200px; margin: 0 auto; padding: 40px 20px; }
        .style-guide-header { text-align: center; margin-bottom: 60px; }
        .style-guide h1 { font-size: 2.5rem; margin-bottom: 20px; color: #333; }
        .description { font-size: 1.2rem; color: #666; max-width: 600px; margin: 0 auto; }
        
        section { margin: 60px 0; }
        h2 { font-size: 2rem; margin-bottom: 30px; color: #333; border-bottom: 3px solid #007bff; padding-bottom: 10px; }
        
        .color-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; }
        .color-swatch { background: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); overflow: hidden; }
        .color-sample { height: 100px; }
        .color-info { padding: 20px; }
        .color-info h4 { margin: 0 0 10px 0; }
        .color-info code { background: #f8f9fa; padding: 4px 8px; border-radius: 4px; }
        .usage { color: #666; margin: 10px 0 0 0; font-size: 0.9rem; }
        
        .type-specimen { margin: 30px 0; padding: 30px; border: 1px solid #eee; border-radius: 8px; }
        .type-sample { font-size: 2rem; margin: 20px 0; line-height: 1.2; }
        .type-specs { display: flex; gap: 20px; font-size: 0.9rem; color: #666; }
        
        .component-showcase { margin: 40px 0; padding: 30px; border: 1px solid #eee; border-radius: 8px; }
        .component-preview { margin: 20px 0; padding: 20px; background: #f8f9fa; border-radius: 4px; }
        
        .spacing-scale { display: flex; flex-direction: column; gap: 15px; }
        .spacing-item { display: flex; align-items: center; gap: 20px; }
        .spacing-visual { background: #007bff; border-radius: 2px; }
        
        .icon-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 20px; }
        .icon-item { text-align: center; padding: 20px; border: 1px solid #eee; border-radius: 8px; }
        .icon-preview { font-size: 2rem; margin-bottom: 10px; }
        .icon-name { font-size: 0.9rem; color: #666; }
    </style>`;
  }

  private generateInlineStyles(data: any): string {
    return `
        .imagineer-embed { 
            max-width: 100%; 
            font-family: system-ui, sans-serif; 
            ${data.background ? `background: ${data.background};` : ''}
        }
        .imagineer-embed .element { 
            border: 1px solid #ddd; 
            padding: 10px; 
            margin: 5px 0; 
        }
    `;
  }

  private generateEmbedContent(data: any): string {
    if (data.elements) {
      return this.renderElements(data.elements);
    }
    return `<div>Design preview not available</div>`;
  }

  protected canMinify(): boolean {
    return true;
  }

  protected minifyContent(content: string): string {
    return content
      .replace(/>\s+</g, '><') // Remove whitespace between tags
      .replace(/\s{2,}/g, ' ') // Replace multiple spaces with single space
      .replace(/\n\s*\n/g, '\n') // Remove empty lines
      .trim();
  }
}
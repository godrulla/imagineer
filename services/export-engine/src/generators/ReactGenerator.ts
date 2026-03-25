import { BaseGenerator, ExportOptions } from './BaseGenerator';

export class ReactGenerator extends BaseGenerator {
  constructor() {
    super('react', 'text/jsx', '.jsx');
  }

  protected async generateContent(data: any, options: ExportOptions): Promise<string> {
    const { customSettings = {} } = options;
    const { 
      typescript = false, 
      styled = 'css-modules', 
      storybook = false,
      testing = false 
    } = customSettings;

    // Generate main component
    let content = this.generateReactComponent(data, options);

    // Generate TypeScript types if needed
    if (typescript) {
      content = this.addTypeScriptTypes(content, data);
    }

    // Generate styles
    if (styled !== 'inline') {
      content += '\n\n' + this.generateStylesFile(data, styled);
    }

    // Generate Storybook stories if requested
    if (storybook) {
      content += '\n\n' + this.generateStorybookStory(data, typescript);
    }

    // Generate test file if requested
    if (testing) {
      content += '\n\n' + this.generateTestFile(data, typescript);
    }

    return content;
  }

  private generateReactComponent(data: any, options: ExportOptions): string {
    const { customSettings = {} } = options;
    const { typescript = false, styled = 'css-modules', hooks = true } = customSettings;
    
    const componentName = this.getComponentName(data);
    const fileExtension = typescript ? '.tsx' : '.jsx';
    
    // Generate imports
    const imports = this.generateImports(data, styled, hooks);
    
    // Generate component props interface (if TypeScript)
    const propsInterface = typescript ? this.generatePropsInterface(data) : '';
    
    // Generate component
    const component = hooks 
      ? this.generateFunctionalComponent(data, componentName, typescript, styled)
      : this.generateClassComponent(data, componentName, typescript, styled);
    
    // Generate exports
    const exports = this.generateExports(data, componentName);

    return `${this.generateFileHeader(data, fileExtension)}

${imports}

${propsInterface}

${component}

${exports}`;
  }

  private generateImports(data: any, styled: string, hooks: boolean): string {
    const imports = ['React'];
    
    if (hooks && this.needsHooks(data)) {
      const hooksList = this.getRequiredHooks(data);
      imports.push(...hooksList);
    }
    
    let importString = `import ${imports.join(', ')} from 'react';`;
    
    // Add style imports
    if (styled === 'css-modules') {
      importString += `\nimport styles from './${this.getComponentName(data)}.module.css';`;
    } else if (styled === 'styled-components') {
      importString += `\nimport styled from 'styled-components';`;
    }
    
    // Add component-specific imports
    const componentImports = this.getComponentImports(data);
    if (componentImports.length > 0) {
      importString += '\n' + componentImports.join('\n');
    }
    
    return importString;
  }

  private generatePropsInterface(data: any): string {
    const componentName = this.getComponentName(data);
    const props = this.extractComponentProps(data);
    
    let interfaceContent = `interface ${componentName}Props {\n`;
    
    Object.entries(props).forEach(([name, type]) => {
      interfaceContent += `  ${name}?: ${type};\n`;
    });
    
    // Add common props
    interfaceContent += `  className?: string;\n`;
    interfaceContent += `  children?: React.ReactNode;\n`;
    interfaceContent += `}\n`;
    
    return interfaceContent;
  }

  private generateFunctionalComponent(data: any, componentName: string, typescript: boolean, styled: string): string {
    const propsType = typescript ? `: ${componentName}Props` : '';
    const defaultProps = this.generateDefaultProps(data);
    
    let component = `const ${componentName} = ({ ${this.getPropsDestructuring(data)} }${propsType}) => {\n`;
    
    // Add state hooks if needed
    if (this.needsState(data)) {
      component += this.generateStateHooks(data);
    }
    
    // Add effect hooks if needed
    if (this.needsEffects(data)) {
      component += this.generateEffectHooks(data);
    }
    
    // Add event handlers
    if (this.hasInteractions(data)) {
      component += this.generateEventHandlers(data);
    }
    
    // Generate JSX
    component += `\n  return (\n`;
    component += this.generateJSX(data, styled, 2);
    component += `\n  );\n`;
    component += `};`;
    
    // Add default props if needed
    if (defaultProps) {
      component += `\n\n${componentName}.defaultProps = ${defaultProps};`;
    }
    
    return component;
  }

  private generateClassComponent(data: any, componentName: string, typescript: boolean, styled: string): string {
    const propsType = typescript ? `<${componentName}Props>` : '';
    
    let component = `class ${componentName} extends React.Component${propsType} {\n`;
    
    // Add constructor if needed
    if (this.needsState(data)) {
      component += this.generateConstructor(data, typescript);
    }
    
    // Add lifecycle methods
    component += this.generateLifecycleMethods(data);
    
    // Add event handlers
    if (this.hasInteractions(data)) {
      component += this.generateClassEventHandlers(data);
    }
    
    // Add render method
    component += `\n  render() {\n`;
    component += this.generateJSX(data, styled, 2);
    component += `\n  }\n`;
    component += `}`;
    
    return component;
  }

  private generateJSX(data: any, styled: string, indentLevel: number): string {
    const indent = '  '.repeat(indentLevel);
    
    if (data.type === 'component') {
      return this.generateComponentJSX(data, styled, indentLevel);
    } else if (data.elements) {
      return this.generateElementsJSX(data.elements, styled, indentLevel);
    } else {
      return `${indent}<div className={${this.getClassName('container', styled)}}>\n${indent}  <p>Component content</p>\n${indent}</div>`;
    }
  }

  private generateElementsJSX(elements: any[], styled: string, indentLevel: number): string {
    const indent = '  '.repeat(indentLevel);
    
    return elements.map(element => {
      const elementJSX = this.generateElementJSX(element, styled, indentLevel);
      return elementJSX;
    }).join('\n');
  }

  private generateElementJSX(element: any, styled: string, indentLevel: number): string {
    const indent = '  '.repeat(indentLevel);
    const tag = this.getReactTag(element.type);
    const className = this.getElementClassName(element, styled);
    const props = this.generateElementProps(element);
    const children = element.children ? this.generateElementsJSX(element.children, styled, indentLevel + 1) : '';
    const text = element.text ? this.escapeJSX(element.text) : '';
    
    let jsx = `${indent}<${tag}`;
    
    if (className) {
      jsx += ` className={${className}}`;
    }
    
    if (props) {
      jsx += ` ${props}`;
    }
    
    if (children || text) {
      jsx += `>\n`;
      if (text) {
        jsx += `${indent}  ${text}\n`;
      }
      if (children) {
        jsx += children + '\n';
      }
      jsx += `${indent}</${tag}>`;
    } else {
      jsx += ' />';
    }
    
    return jsx;
  }

  private generateComponentJSX(data: any, styled: string, indentLevel: number): string {
    const indent = '  '.repeat(indentLevel);
    const componentName = this.getComponentName(data);
    const className = this.getClassName('root', styled);
    
    let jsx = `${indent}<div className={${className}}>\n`;
    
    // Add header if exists
    if (data.header) {
      jsx += `${indent}  <header className={${this.getClassName('header', styled)}}>\n`;
      jsx += `${indent}    <h1>{title || '${data.name || 'Component'}'}</h1>\n`;
      jsx += `${indent}  </header>\n`;
    }
    
    // Add main content
    jsx += `${indent}  <main className={${this.getClassName('content', styled)}}>\n`;
    if (data.elements) {
      jsx += this.generateElementsJSX(data.elements, styled, indentLevel + 2) + '\n';
    } else {
      jsx += `${indent}    {children}\n`;
    }
    jsx += `${indent}  </main>\n`;
    
    // Add footer if exists
    if (data.footer) {
      jsx += `${indent}  <footer className={${this.getClassName('footer', styled)}}>\n`;
      jsx += `${indent}    <p>Footer content</p>\n`;
      jsx += `${indent}  </footer>\n`;
    }
    
    jsx += `${indent}</div>`;
    
    return jsx;
  }

  private generateStateHooks(data: any): string {
    let hooks = '';
    
    // Generate state for interactive elements
    if (this.hasInteractions(data)) {
      hooks += `  const [isActive, setIsActive] = useState(false);\n`;
      hooks += `  const [value, setValue] = useState('');\n`;
    }
    
    // Generate state for dynamic content
    if (this.hasDynamicContent(data)) {
      hooks += `  const [data, setData] = useState(null);\n`;
      hooks += `  const [loading, setLoading] = useState(false);\n`;
    }
    
    return hooks;
  }

  private generateEffectHooks(data: any): string {
    let effects = '';
    
    if (this.hasDynamicContent(data)) {
      effects += `\n  useEffect(() => {\n`;
      effects += `    // Component mount logic\n`;
      effects += `  }, []);\n`;
    }
    
    return effects;
  }

  private generateEventHandlers(data: any): string {
    let handlers = '';
    
    if (this.hasInteractions(data)) {
      handlers += `\n  const handleClick = useCallback(() => {\n`;
      handlers += `    setIsActive(!isActive);\n`;
      handlers += `  }, [isActive]);\n`;
      
      handlers += `\n  const handleChange = useCallback((event) => {\n`;
      handlers += `    setValue(event.target.value);\n`;
      handlers += `  }, []);\n`;
    }
    
    return handlers;
  }

  private generateStylesFile(data: any, styled: string): string {
    let stylesContent = '';
    
    if (styled === 'css-modules') {
      stylesContent = this.generateCSSModules(data);
    } else if (styled === 'styled-components') {
      stylesContent = this.generateStyledComponents(data);
    } else if (styled === 'css') {
      stylesContent = this.generateRegularCSS(data);
    }
    
    return `/* ${this.getComponentName(data)} Styles */\n${stylesContent}`;
  }

  private generateCSSModules(data: any): string {
    let css = `.root {\n`;
    css += `  /* Container styles */\n`;
    if (data.styles) {
      css += this.convertStylesToCss(data.styles, 1);
    }
    css += `}\n\n`;
    
    // Generate styles for elements
    if (data.elements) {
      css += this.generateElementStyles(data.elements, 'css-modules');
    }
    
    return css;
  }

  private generateStyledComponents(data: any): string {
    const componentName = this.getComponentName(data);
    
    let styled = `export const Styled${componentName} = styled.div\`\n`;
    if (data.styles) {
      styled += this.convertStylesToStyledComponents(data.styles, 1);
    }
    styled += `\`;\n\n`;
    
    // Generate styled components for elements
    if (data.elements) {
      styled += this.generateStyledElementComponents(data.elements);
    }
    
    return styled;
  }

  private generateStorybookStory(data: any, typescript: boolean): string {
    const componentName = this.getComponentName(data);
    const fileExtension = typescript ? '.stories.tsx' : '.stories.js';
    
    let story = `// ${componentName}${fileExtension}\n`;
    story += `import type { Meta, StoryObj } from '@storybook/react';\n`;
    story += `import { ${componentName} } from './${componentName}';\n\n`;
    
    story += `const meta: Meta<typeof ${componentName}> = {\n`;
    story += `  title: 'Components/${componentName}',\n`;
    story += `  component: ${componentName},\n`;
    story += `  parameters: {\n`;
    story += `    layout: 'centered',\n`;
    story += `  },\n`;
    story += `  tags: ['autodocs'],\n`;
    story += `};\n\n`;
    
    story += `export default meta;\n`;
    story += `type Story = StoryObj<typeof meta>;\n\n`;
    
    // Generate default story
    story += `export const Default: Story = {\n`;
    story += `  args: {\n`;
    const props = this.extractComponentProps(data);
    Object.entries(props).forEach(([name, value]) => {
      story += `    ${name}: ${this.getDefaultValue(value)},\n`;
    });
    story += `  },\n`;
    story += `};\n\n`;
    
    // Generate variant stories
    if (data.variants) {
      data.variants.forEach((variant: any) => {
        story += `export const ${variant.name}: Story = {\n`;
        story += `  args: {\n`;
        story += `    ...Default.args,\n`;
        story += `    variant: '${variant.name.toLowerCase()}',\n`;
        story += `  },\n`;
        story += `};\n\n`;
      });
    }
    
    return story;
  }

  private generateTestFile(data: any, typescript: boolean): string {
    const componentName = this.getComponentName(data);
    const fileExtension = typescript ? '.test.tsx' : '.test.js';
    
    let test = `// ${componentName}${fileExtension}\n`;
    test += `import { render, screen } from '@testing-library/react';\n`;
    test += `import userEvent from '@testing-library/user-event';\n`;
    test += `import { ${componentName} } from './${componentName}';\n\n`;
    
    test += `describe('${componentName}', () => {\n`;
    test += `  it('renders without crashing', () => {\n`;
    test += `    render(<${componentName} />);\n`;
    test += `  });\n\n`;
    
    // Generate tests for props
    const props = this.extractComponentProps(data);
    Object.keys(props).forEach(propName => {
      test += `  it('renders with ${propName} prop', () => {\n`;
      test += `    const testValue = 'test-${propName}';\n`;
      test += `    render(<${componentName} ${propName}={testValue} />);\n`;
      test += `    // Add assertions here\n`;
      test += `  });\n\n`;
    });
    
    // Generate tests for interactions
    if (this.hasInteractions(data)) {
      test += `  it('handles user interactions', async () => {\n`;
      test += `    const user = userEvent.setup();\n`;
      test += `    render(<${componentName} />);\n`;
      test += `    \n`;
      test += `    // Add interaction tests here\n`;
      test += `  });\n\n`;
    }
    
    test += `});\n`;
    
    return test;
  }

  // Helper methods
  private getComponentName(data: any): string {
    const name = data.name || 'Component';
    return name.charAt(0).toUpperCase() + name.slice(1).replace(/[^a-zA-Z0-9]/g, '');
  }

  private getReactTag(elementType: string): string {
    const tagMap: Record<string, string> = {
      'text': 'span',
      'heading': 'h2',
      'paragraph': 'p',
      'button': 'button',
      'input': 'input',
      'image': 'img',
      'container': 'div',
      'list': 'ul',
      'listItem': 'li',
      'link': 'a'
    };
    
    return tagMap[elementType] || 'div';
  }

  private getClassName(className: string, styled: string): string {
    if (styled === 'css-modules') {
      return `styles.${className}`;
    } else if (styled === 'styled-components') {
      return `"${className}"`;
    } else {
      return `"${className}"`;
    }
  }

  private getElementClassName(element: any, styled: string): string {
    const className = element.className || element.type || 'element';
    return this.getClassName(className, styled);
  }

  private generateElementProps(element: any): string {
    const props: string[] = [];
    
    if (element.properties) {
      Object.entries(element.properties).forEach(([key, value]) => {
        if (key === 'href' || key === 'src' || key === 'alt' || key === 'title') {
          props.push(`${key}="${value}"`);
        } else if (key === 'onClick' || key === 'onChange') {
          props.push(`${key}={${this.getHandlerName(key)}}`);
        }
      });
    }
    
    return props.join(' ');
  }

  private getHandlerName(eventProp: string): string {
    const handlerMap: Record<string, string> = {
      'onClick': 'handleClick',
      'onChange': 'handleChange',
      'onSubmit': 'handleSubmit',
      'onFocus': 'handleFocus',
      'onBlur': 'handleBlur'
    };
    
    return handlerMap[eventProp] || 'handleEvent';
  }

  private extractComponentProps(data: any): Record<string, string> {
    const props: Record<string, string> = {};
    
    // Extract from component properties
    if (data.properties) {
      Object.entries(data.properties).forEach(([key, value]) => {
        props[key] = this.inferTypeScriptType(value);
      });
    }
    
    // Add common props
    props.title = 'string';
    props.variant = 'string';
    props.size = 'string';
    props.disabled = 'boolean';
    
    return props;
  }

  private inferTypeScriptType(value: any): string {
    if (typeof value === 'string') return 'string';
    if (typeof value === 'number') return 'number';
    if (typeof value === 'boolean') return 'boolean';
    if (Array.isArray(value)) return 'string[]';
    if (typeof value === 'object') return 'object';
    return 'any';
  }

  private getPropsDestructuring(data: any): string {
    const props = Object.keys(this.extractComponentProps(data));
    props.push('className', 'children');
    return props.join(', ');
  }

  private generateDefaultProps(data: any): string | null {
    const props = this.extractComponentProps(data);
    const defaults: string[] = [];
    
    Object.entries(props).forEach(([key, type]) => {
      if (type === 'string') defaults.push(`${key}: ''`);
      if (type === 'boolean') defaults.push(`${key}: false`);
    });
    
    return defaults.length > 0 ? `{\n  ${defaults.join(',\n  ')}\n}` : null;
  }

  private getDefaultValue(type: string): string {
    switch (type) {
      case 'string': return "'Default text'";
      case 'number': return '0';
      case 'boolean': return 'false';
      case 'string[]': return "['item1', 'item2']";
      default: return 'null';
    }
  }

  private needsHooks(data: any): boolean {
    return this.needsState(data) || this.needsEffects(data);
  }

  private needsState(data: any): boolean {
    return this.hasInteractions(data) || this.hasDynamicContent(data);
  }

  private needsEffects(data: any): boolean {
    return this.hasDynamicContent(data);
  }

  private hasInteractions(data: any): boolean {
    return !!(data.interactions && data.interactions.length > 0);
  }

  private hasDynamicContent(data: any): boolean {
    return !!(data.dynamic || data.api || data.dataSource);
  }

  private getRequiredHooks(data: any): string[] {
    const hooks: string[] = [];
    
    if (this.needsState(data)) hooks.push('useState');
    if (this.needsEffects(data)) hooks.push('useEffect');
    if (this.hasInteractions(data)) hooks.push('useCallback');
    
    return hooks;
  }

  private escapeJSX(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .replace(/\{/g, '&#123;')
      .replace(/\}/g, '&#125;');
  }

  private generateFileHeader(data: any, extension: string): string {
    return `/**
 * ${this.getComponentName(data)} Component
 * Generated by Imagineer Export Engine
 * 
 * @description ${data.description || 'Auto-generated React component'}
 * @version 1.0.0
 * @generated ${new Date().toISOString()}
 */`;
  }

  private generateExports(data: any, componentName: string): string {
    return `export { ${componentName} };\nexport default ${componentName};`;
  }

  private getComponentImports(data: any): string[] {
    const imports: string[] = [];
    
    // Add icon imports if needed
    if (data.icons && data.icons.length > 0) {
      imports.push("import { Icon } from './Icon';");
    }
    
    // Add utility imports
    if (this.needsUtils(data)) {
      imports.push("import { cn } from '../utils/classNames';");
    }
    
    return imports;
  }

  private needsUtils(data: any): boolean {
    return !!(data.conditional || data.dynamic);
  }

  private convertStylesToCss(styles: any, indentLevel: number): string {
    const indent = '  '.repeat(indentLevel);
    let css = '';
    
    Object.entries(styles).forEach(([property, value]) => {
      const cssProperty = this.camelToKebab(property);
      css += `${indent}${cssProperty}: ${value};\n`;
    });
    
    return css;
  }

  private convertStylesToStyledComponents(styles: any, indentLevel: number): string {
    const indent = '  '.repeat(indentLevel);
    let styled = '';
    
    Object.entries(styles).forEach(([property, value]) => {
      const cssProperty = this.camelToKebab(property);
      styled += `${indent}${cssProperty}: ${value};\n`;
    });
    
    return styled;
  }

  private generateElementStyles(elements: any[], styled: string): string {
    let styles = '';
    
    elements.forEach(element => {
      const className = element.className || element.type || 'element';
      
      if (styled === 'css-modules') {
        styles += `.${className} {\n`;
        if (element.styles) {
          styles += this.convertStylesToCss(element.styles, 1);
        }
        styles += `}\n\n`;
      }
      
      if (element.children) {
        styles += this.generateElementStyles(element.children, styled);
      }
    });
    
    return styles;
  }

  private generateStyledElementComponents(elements: any[]): string {
    let styled = '';
    
    elements.forEach(element => {
      const componentName = this.pascalCase(element.type || 'Element');
      
      styled += `export const Styled${componentName} = styled.${this.getReactTag(element.type)}\`\n`;
      if (element.styles) {
        styled += this.convertStylesToStyledComponents(element.styles, 1);
      }
      styled += `\`;\n\n`;
      
      if (element.children) {
        styled += this.generateStyledElementComponents(element.children);
      }
    });
    
    return styled;
  }

  private pascalCase(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
  }

  private camelToKebab(str: string): string {
    return str.replace(/([A-Z])/g, '-$1').toLowerCase();
  }

  private generateConstructor(data: any, typescript: boolean): string {
    const propsType = typescript ? ': any' : '';
    
    let constructor = `\n  constructor(props${propsType}) {\n`;
    constructor += `    super(props);\n`;
    constructor += `    this.state = {\n`;
    
    if (this.hasInteractions(data)) {
      constructor += `      isActive: false,\n`;
      constructor += `      value: '',\n`;
    }
    
    if (this.hasDynamicContent(data)) {
      constructor += `      data: null,\n`;
      constructor += `      loading: false,\n`;
    }
    
    constructor += `    };\n`;
    constructor += `  }\n`;
    
    return constructor;
  }

  private generateLifecycleMethods(data: any): string {
    let methods = '';
    
    if (this.hasDynamicContent(data)) {
      methods += `\n  componentDidMount() {\n`;
      methods += `    // Component mount logic\n`;
      methods += `  }\n`;
    }
    
    return methods;
  }

  private generateClassEventHandlers(data: any): string {
    let handlers = '';
    
    if (this.hasInteractions(data)) {
      handlers += `\n  handleClick = () => {\n`;
      handlers += `    this.setState({ isActive: !this.state.isActive });\n`;
      handlers += `  }\n`;
      
      handlers += `\n  handleChange = (event) => {\n`;
      handlers += `    this.setState({ value: event.target.value });\n`;
      handlers += `  }\n`;
    }
    
    return handlers;
  }

  private generateRegularCSS(data: any): string {
    const componentName = this.getComponentName(data).toLowerCase();
    
    let css = `.${componentName} {\n`;
    if (data.styles) {
      css += this.convertStylesToCss(data.styles, 1);
    }
    css += `}\n\n`;
    
    // Generate styles for elements
    if (data.elements) {
      css += this.generateElementStyles(data.elements, 'css');
    }
    
    return css;
  }

  protected getFileExtension(options: ExportOptions): string {
    const typescript = options.customSettings?.typescript;
    return typescript ? '.tsx' : '.jsx';
  }

  protected getMimeType(options: ExportOptions): string {
    const typescript = options.customSettings?.typescript;
    return typescript ? 'text/tsx' : 'text/jsx';
  }
}
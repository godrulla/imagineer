import { logger } from '../utils/logger';
import { ProcessingError } from '../middleware/errorHandler';

export interface ExtractionOptions {
  elementTypes?: string[];
  minConfidence?: number;
  includeHidden?: boolean;
}

export interface ExtractedElement {
  id: string;
  name: string;
  type: string;
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  styles: any;
  confidence: number;
  semanticRole?: string;
  children?: ExtractedElement[];
}

export interface ExtractionResult {
  elements: ExtractedElement[];
  averageConfidence: number;
  processingTime: number;
}

export class ElementExtractor {
  private supportedTypes = [
    'FRAME', 'COMPONENT', 'INSTANCE', 'RECTANGLE', 'ELLIPSE', 
    'TEXT', 'LINE', 'POLYGON', 'STAR', 'VECTOR'
  ];

  async extractElements(
    designData: any, 
    options: ExtractionOptions = {}
  ): Promise<ExtractionResult> {
    const startTime = Date.now();
    
    try {
      logger.info('Starting element extraction', {
        documentId: designData.document?.id,
        options
      });

      const elements = await this.processNode(
        designData.document, 
        options,
        0 // depth
      );

      const filteredElements = this.filterElements(elements, options);
      const averageConfidence = this.calculateAverageConfidence(filteredElements);

      const result: ExtractionResult = {
        elements: filteredElements,
        averageConfidence,
        processingTime: Date.now() - startTime
      };

      logger.info('Element extraction completed', {
        totalElements: result.elements.length,
        averageConfidence: result.averageConfidence,
        processingTime: result.processingTime
      });

      return result;

    } catch (error) {
      logger.error('Element extraction failed', {
        error: error.message,
        processingTime: Date.now() - startTime
      });
      throw new ProcessingError(`Element extraction failed: ${error.message}`);
    }
  }

  private async processNode(
    node: any, 
    options: ExtractionOptions,
    depth: number = 0
  ): Promise<ExtractedElement[]> {
    if (!node) return [];

    const elements: ExtractedElement[] = [];
    const maxDepth = 10; // Prevent infinite recursion

    if (depth > maxDepth) {
      logger.warn('Maximum processing depth reached', { nodeId: node.id, depth });
      return elements;
    }

    // Skip hidden elements unless explicitly requested
    if (!options.includeHidden && node.visible === false) {
      return elements;
    }

    // Process current node if it's a supported type
    if (this.isSupportedType(node.type)) {
      const element = await this.extractSingleElement(node, options);
      if (element && this.meetsConfidenceThreshold(element, options)) {
        
        // Process children recursively
        if (node.children && Array.isArray(node.children)) {
          const childElements: ExtractedElement[] = [];
          
          for (const child of node.children) {
            const extracted = await this.processNode(child, options, depth + 1);
            childElements.push(...extracted);
          }
          
          if (childElements.length > 0) {
            element.children = childElements;
          }
        }
        
        elements.push(element);
      }
    }

    // Also process children if current node is not supported but has children
    if (node.children && Array.isArray(node.children)) {
      for (const child of node.children) {
        const extracted = await this.processNode(child, options, depth + 1);
        elements.push(...extracted);
      }
    }

    return elements;
  }

  private async extractSingleElement(
    node: any, 
    options: ExtractionOptions
  ): Promise<ExtractedElement | null> {
    try {
      const element: ExtractedElement = {
        id: node.id,
        name: node.name || `Unnamed ${node.type}`,
        type: node.type,
        bounds: this.extractBounds(node),
        styles: this.extractStyles(node),
        confidence: await this.calculateElementConfidence(node),
        semanticRole: this.determineSemanticRole(node)
      };

      return element;

    } catch (error) {
      logger.warn('Failed to extract element', {
        nodeId: node.id,
        nodeType: node.type,
        error: error.message
      });
      return null;
    }
  }

  private extractBounds(node: any): ExtractedElement['bounds'] {
    const bounds = node.absoluteBoundingBox || node.relativeTransform || {};
    
    return {
      x: bounds.x || 0,
      y: bounds.y || 0,
      width: bounds.width || 0,
      height: bounds.height || 0
    };
  }

  private extractStyles(node: any): any {
    const styles: any = {};

    // Extract fills (colors, gradients)
    if (node.fills && Array.isArray(node.fills)) {
      styles.fills = node.fills.map(fill => ({
        type: fill.type,
        color: fill.color,
        gradientHandlePositions: fill.gradientHandlePositions,
        opacity: fill.opacity || 1
      }));
    }

    // Extract strokes (borders)
    if (node.strokes && Array.isArray(node.strokes)) {
      styles.strokes = node.strokes;
      styles.strokeWeight = node.strokeWeight;
      styles.strokeAlign = node.strokeAlign;
    }

    // Extract effects (shadows, blurs)
    if (node.effects && Array.isArray(node.effects)) {
      styles.effects = node.effects;
    }

    // Extract corner radius
    if (node.cornerRadius !== undefined) {
      styles.cornerRadius = node.cornerRadius;
    }
    if (node.rectangleCornerRadii) {
      styles.cornerRadii = node.rectangleCornerRadii;
    }

    // Extract text styles
    if (node.type === 'TEXT' && node.style) {
      styles.typography = {
        fontFamily: node.style.fontFamily,
        fontSize: node.style.fontSize,
        fontWeight: node.style.fontWeight,
        textAlignHorizontal: node.style.textAlignHorizontal,
        textAlignVertical: node.style.textAlignVertical,
        lineHeightPx: node.style.lineHeightPx,
        letterSpacing: node.style.letterSpacing,
        textDecoration: node.style.textDecoration,
        textCase: node.style.textCase
      };
    }

    // Extract layout properties
    if (node.layoutMode) {
      styles.layout = {
        mode: node.layoutMode,
        padding: node.paddingLeft || node.paddingTop || node.paddingRight || node.paddingBottom ? {
          left: node.paddingLeft,
          top: node.paddingTop,
          right: node.paddingRight,
          bottom: node.paddingBottom
        } : undefined,
        itemSpacing: node.itemSpacing,
        counterAxisSizingMode: node.counterAxisSizingMode,
        primaryAxisSizingMode: node.primaryAxisSizingMode,
        primaryAxisAlignItems: node.primaryAxisAlignItems,
        counterAxisAlignItems: node.counterAxisAlignItems
      };
    }

    // Extract constraints
    if (node.constraints) {
      styles.constraints = node.constraints;
    }

    return styles;
  }

  private async calculateElementConfidence(node: any): Promise<number> {
    let confidence = 0.5; // Base confidence

    // Increase confidence based on completeness of data
    if (node.name && node.name.trim() !== '') confidence += 0.1;
    if (node.absoluteBoundingBox) confidence += 0.1;
    if (node.fills && node.fills.length > 0) confidence += 0.1;
    
    // Type-specific confidence adjustments
    switch (node.type) {
      case 'FRAME':
      case 'COMPONENT':
      case 'INSTANCE':
        confidence += 0.2;
        break;
      case 'TEXT':
        if (node.characters && node.style) confidence += 0.2;
        break;
      case 'RECTANGLE':
      case 'ELLIPSE':
        confidence += 0.1;
        break;
    }

    // Semantic role confidence
    const semanticRole = this.determineSemanticRole(node);
    if (semanticRole !== 'unknown') {
      confidence += 0.1;
    }

    return Math.min(confidence, 1.0);
  }

  private determineSemanticRole(node: any): string {
    const name = node.name?.toLowerCase() || '';
    const type = node.type?.toLowerCase() || '';

    // Button patterns
    if (name.includes('button') || name.includes('btn')) return 'button';
    if (name.includes('cta') || name.includes('call-to-action')) return 'button';

    // Input patterns
    if (name.includes('input') || name.includes('field')) return 'input';
    if (name.includes('textbox') || name.includes('textarea')) return 'input';

    // Navigation patterns
    if (name.includes('nav') || name.includes('menu')) return 'navigation';
    if (name.includes('tab') || name.includes('breadcrumb')) return 'navigation';

    // Content patterns
    if (name.includes('card') || name.includes('tile')) return 'card';
    if (name.includes('modal') || name.includes('dialog')) return 'modal';
    if (name.includes('header') || name.includes('footer')) return 'landmark';

    // Text patterns
    if (type === 'text') {
      if (name.includes('title') || name.includes('heading')) return 'heading';
      if (name.includes('label')) return 'label';
      if (name.includes('caption') || name.includes('description')) return 'caption';
      return 'text';
    }

    // Image patterns
    if (name.includes('image') || name.includes('img') || name.includes('photo')) return 'image';
    if (name.includes('icon')) return 'icon';

    return 'unknown';
  }

  private isSupportedType(type: string): boolean {
    return this.supportedTypes.includes(type);
  }

  private meetsConfidenceThreshold(
    element: ExtractedElement, 
    options: ExtractionOptions
  ): boolean {
    const threshold = options.minConfidence || 0.5;
    return element.confidence >= threshold;
  }

  private filterElements(
    elements: ExtractedElement[], 
    options: ExtractionOptions
  ): ExtractedElement[] {
    let filtered = elements;

    // Filter by element types if specified
    if (options.elementTypes && options.elementTypes.length > 0) {
      filtered = filtered.filter(element => 
        options.elementTypes!.includes(element.type)
      );
    }

    // Filter by confidence threshold
    if (options.minConfidence !== undefined) {
      filtered = filtered.filter(element => 
        element.confidence >= options.minConfidence!
      );
    }

    return filtered;
  }

  private calculateAverageConfidence(elements: ExtractedElement[]): number {
    if (elements.length === 0) return 0;
    
    const totalConfidence = elements.reduce((sum, element) => {
      let elementSum = element.confidence;
      
      // Include children confidence
      if (element.children && element.children.length > 0) {
        const childrenConfidence = this.calculateAverageConfidence(element.children);
        elementSum = (elementSum + childrenConfidence) / 2;
      }
      
      return sum + elementSum;
    }, 0);
    
    return Math.round((totalConfidence / elements.length) * 100) / 100;
  }
}
import { logger } from '../utils/logger';
import { CacheManager } from '../cache/redis';
import { ProcessingError } from '../middleware/errorHandler';
import { FigmaClient, FigmaFile, FigmaNode } from './FigmaClient';
import { DatabaseOperations, DatabaseParsedDesign, DatabaseDesignElement } from '../database/operations';
import * as tf from '@tensorflow/tfjs-node';
import { createHash } from 'crypto';

export interface AnalysisOptions {
  includeChildren?: boolean;
  extractStyles?: boolean;
  generateThumbnail?: boolean;
  analysisDepth?: 'basic' | 'detailed' | 'comprehensive';
  extractDesignTokens?: boolean;
  analyzeInteractions?: boolean;
  detectComponents?: boolean;
  generateThumbnails?: boolean;
  includeAssets?: boolean;
  maxDepth?: number;
  includeMeasurements?: boolean;
  analyzeResponsive?: boolean;
}

export interface DesignElement {
  id: string;
  name: string;
  type: string;
  figmaType: string;
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  styles: {
    fills?: any[];
    strokes?: any[];
    effects?: any[];
    typography?: {
      fontFamily?: string;
      fontSize?: number;
      fontWeight?: number;
      lineHeight?: number;
      letterSpacing?: number;
      textAlign?: string;
      textCase?: string;
      textDecoration?: string;
    };
    layout?: {
      mode?: string;
      direction?: string;
      wrap?: string;
      gap?: number;
      padding?: { top: number; right: number; bottom: number; left: number };
      alignItems?: string;
      justifyContent?: string;
    };
    borderRadius?: number | number[];
    opacity?: number;
    blendMode?: string;
    rotation?: number;
  };
  constraints: {
    horizontal: string;
    vertical: string;
  };
  content?: {
    text?: string;
    imageUrl?: string;
    characters?: string;
  };
  interactions?: {
    triggers?: any[];
    actions?: any[];
    transitions?: any[];
  };
  component?: {
    id?: string;
    name?: string;
    description?: string;
    isMainComponent?: boolean;
    variantProperties?: any;
  };
  children?: DesignElement[];
  classification: {
    elementType: string;
    confidence: number;
    semanticRole?: string;
    interactionType?: string;
    uiCategory?: 'navigation' | 'content' | 'form' | 'media' | 'layout' | 'decoration' | 'unknown';
    complexity?: 'simple' | 'moderate' | 'complex';
  };
  measurements?: {
    area: number;
    aspectRatio: number;
    centerPoint: { x: number; y: number };
  };
  hierarchy: {
    level: number;
    path: string;
    parentId?: string;
    childrenCount: number;
  };
}

export interface AnalysisResult {
  fileId: string;
  fileName: string;
  nodeName: string;
  elements: DesignElement[];
  designTokens: {
    colors: { [key: string]: { value: string; usage: number; contexts: string[] } };
    typography: { [key: string]: { 
      fontFamily: string; 
      fontSize: number; 
      fontWeight: number; 
      lineHeight?: number; 
      letterSpacing?: number;
      usage: number;
      contexts: string[];
    } };
    spacing: { [key: string]: { value: number; usage: number; contexts: string[] } };
    effects: { [key: string]: { effect: any; usage: number; contexts: string[] } };
    borderRadius: { [key: string]: { value: number | number[]; usage: number; contexts: string[] } };
    opacity: { [key: string]: { value: number; usage: number; contexts: string[] } };
  };
  layoutAnalysis: {
    type: 'grid' | 'flexbox' | 'absolute' | 'mixed';
    patterns: string[];
    responsiveBreakpoints: any[];
    gridSystems: any[];
    flexboxUsage: any[];
    layoutComplexity: 'simple' | 'moderate' | 'complex';
  };
  componentAnalysis: {
    detectedComponents: any[];
    componentInstances: any[];
    designSystemUsage: any;
    componentComplexity: any;
  };
  interactionAnalysis: {
    hasInteractions: boolean;
    interactionTypes: string[];
    hotspots: any[];
    userFlows: any[];
  };
  assetAnalysis?: {
    images: any[];
    icons: any[];
    totalAssets: number;
    assetOptimization: any;
  };
  qualityMetrics: {
    accessibilityScore: number;
    consistencyScore: number;
    complexityScore: number;
    designSystemAdherence: number;
  };
  metadata: {
    analysisDepth: string;
    processingTime: number;
    confidence: number;
    version: string;
    parserEngine: string;
    figmaVersion?: string;
    nodeCount: number;
    layerDepth: number;
    fileSize?: number;
    lastModified?: string;
  };
}

export class DesignAnalyzer {
  private figmaToken: string;
  private baseUrl = 'https://api.figma.com/v1';

  constructor() {
    this.figmaToken = process.env.FIGMA_ACCESS_TOKEN || '';
    if (!this.figmaToken) {
      logger.warn('Figma access token not provided. Analysis will be limited to mock data.');
    }
  }

  async analyzeDesign(
    fileId: string, 
    nodeId?: string, 
    options: AnalysisOptions = {}
  ): Promise<AnalysisResult> {
    const startTime = Date.now();
    const cacheKey = `analysis:${fileId}:${nodeId || 'root'}:${JSON.stringify(options)}`;

    try {
      // Check cache first
      const cached = await CacheManager.getParseResult(cacheKey);
      if (cached) {
        logger.info('Returning cached analysis result', { fileId, nodeId, cacheHit: true });
        return cached;
      }

      logger.info('Starting design analysis', { fileId, nodeId, options });

      // Fetch design data from Figma
      const designData = await this.fetchFigmaData(fileId, nodeId);
      
      // Analyze the design structure
      const elements = await this.analyzeElements(designData, options);
      
      // Extract design tokens
      const designTokens = await this.extractDesignTokens(elements);
      
      // Perform layout analysis
      const layoutAnalysis = await this.analyzeLayout(elements);

      const result: AnalysisResult = {
        fileId,
        nodeName: designData.name || 'Unknown',
        elements,
        designTokens,
        layoutAnalysis,
        metadata: {
          analysisDepth: options.analysisDepth || 'detailed',
          processingTime: Date.now() - startTime,
          confidence: this.calculateOverallConfidence(elements),
          version: '1.0.0'
        }
      };

      // Cache the result
      await CacheManager.cacheParseResult(cacheKey, result);

      logger.info('Design analysis completed', {
        fileId,
        nodeId,
        elementsFound: elements.length,
        confidence: result.metadata.confidence,
        processingTime: result.metadata.processingTime
      });

      return result;

    } catch (error) {
      logger.error('Design analysis failed', {
        fileId,
        nodeId,
        error: error.message,
        duration: Date.now() - startTime
      });
      throw new ProcessingError(`Design analysis failed: ${error.message}`);
    }
  }

  private async fetchFigmaData(fileId: string, nodeId?: string): Promise<any> {
    if (!this.figmaToken) {
      // Return mock data for development
      return this.generateMockDesignData(fileId, nodeId);
    }

    try {
      const url = nodeId 
        ? `${this.baseUrl}/files/${fileId}/nodes?ids=${nodeId}`
        : `${this.baseUrl}/files/${fileId}`;

      const response = await axios.get(url, {
        headers: {
          'X-FIGMA-TOKEN': this.figmaToken
        },
        timeout: 30000
      });

      return nodeId ? response.data.nodes[nodeId] : response.data.document;

    } catch (error) {
      if (error.response?.status === 401) {
        throw new Error('Invalid Figma access token');
      } else if (error.response?.status === 404) {
        throw new Error('Figma file or node not found');
      } else {
        throw new Error(`Failed to fetch Figma data: ${error.message}`);
      }
    }
  }

  private async analyzeElements(
    designData: any, 
    options: AnalysisOptions
  ): Promise<DesignElement[]> {
    const elements: DesignElement[] = [];

    const processNode = async (node: any): Promise<DesignElement | null> => {
      if (!node || node.visible === false) return null;

      const element: DesignElement = {
        id: node.id,
        name: node.name,
        type: node.type,
        bounds: {
          x: node.absoluteBoundingBox?.x || 0,
          y: node.absoluteBoundingBox?.y || 0,
          width: node.absoluteBoundingBox?.width || 0,
          height: node.absoluteBoundingBox?.height || 0
        },
        styles: this.extractStyles(node),
        constraints: {
          horizontal: node.constraints?.horizontal || 'LEFT',
          vertical: node.constraints?.vertical || 'TOP'
        },
        classification: await this.classifyElement(node)
      };

      // Process children if requested
      if (options.includeChildren && node.children) {
        const childElements = await Promise.all(
          node.children.map((child: any) => processNode(child))
        );
        element.children = childElements.filter(Boolean) as DesignElement[];
      }

      return element;
    };

    // Process all nodes
    if (designData.children) {
      for (const child of designData.children) {
        const element = await processNode(child);
        if (element) elements.push(element);
      }
    } else {
      const element = await processNode(designData);
      if (element) elements.push(element);
    }

    return elements;
  }

  private extractStyles(node: any): DesignElement['styles'] {
    const styles: DesignElement['styles'] = {};

    if (node.fills) styles.fills = node.fills;
    if (node.strokes) styles.strokes = node.strokes;
    if (node.effects) styles.effects = node.effects;

    // Extract typography for text nodes
    if (node.type === 'TEXT' && node.style) {
      styles.typography = {
        fontFamily: node.style.fontFamily,
        fontSize: node.style.fontSize,
        fontWeight: node.style.fontWeight,
        lineHeight: node.style.lineHeightPx || node.style.lineHeightPercentFontSize,
        letterSpacing: node.style.letterSpacing
      };
    }

    return styles;
  }

  private async classifyElement(node: any): Promise<DesignElement['classification']> {
    // Advanced element classification logic would go here
    // For now, use basic rules-based classification
    
    let elementType = node.type.toLowerCase();
    let confidence = 0.8;
    let semanticRole: string | undefined;
    let interactionType: string | undefined;

    // Classify common UI elements
    if (node.type === 'RECTANGLE' || node.type === 'FRAME') {
      if (node.name.toLowerCase().includes('button')) {
        elementType = 'button';
        semanticRole = 'button';
        interactionType = 'click';
        confidence = 0.9;
      } else if (node.name.toLowerCase().includes('card')) {
        elementType = 'card';
        semanticRole = 'article';
        confidence = 0.85;
      } else if (node.name.toLowerCase().includes('input')) {
        elementType = 'input';
        semanticRole = 'textbox';
        interactionType = 'input';
        confidence = 0.9;
      }
    } else if (node.type === 'TEXT') {
      if (node.style?.fontSize > 24) {
        semanticRole = 'heading';
      } else if (node.style?.fontSize < 14) {
        semanticRole = 'caption';
      } else {
        semanticRole = 'text';
      }
    }

    return {
      elementType,
      confidence,
      semanticRole,
      interactionType
    };
  }

  private async extractDesignTokens(elements: DesignElement[]): Promise<AnalysisResult['designTokens']> {
    const colors: { [key: string]: string } = {};
    const typography: { [key: string]: any } = {};
    const spacing: number[] = [];
    const effects: any[] = [];

    // Extract color tokens
    elements.forEach(element => {
      if (element.styles.fills) {
        element.styles.fills.forEach(fill => {
          if (fill.type === 'SOLID') {
            const color = this.rgbToHex(fill.color);
            colors[`color-${Object.keys(colors).length + 1}`] = color;
          }
        });
      }

      // Extract typography tokens
      if (element.styles.typography) {
        const typoKey = `${element.styles.typography.fontFamily}-${element.styles.typography.fontSize}`;
        if (!typography[typoKey]) {
          typography[typoKey] = element.styles.typography;
        }
      }

      // Extract spacing patterns
      spacing.push(element.bounds.width, element.bounds.height);
    });

    return {
      colors,
      typography,
      spacing: [...new Set(spacing)].sort((a, b) => a - b),
      effects
    };
  }

  private async analyzeLayout(elements: DesignElement[]): Promise<AnalysisResult['layoutAnalysis']> {
    // Analyze layout patterns
    const patterns: string[] = [];
    let layoutType: 'grid' | 'flexbox' | 'absolute' | 'mixed' = 'absolute';

    // Detect grid patterns
    const gridPattern = this.detectGridPattern(elements);
    if (gridPattern) {
      patterns.push('grid-layout');
      layoutType = 'grid';
    }

    // Detect flexbox patterns  
    const flexPattern = this.detectFlexboxPattern(elements);
    if (flexPattern) {
      patterns.push('flexbox-layout');
      layoutType = layoutType === 'grid' ? 'mixed' : 'flexbox';
    }

    return {
      type: layoutType,
      patterns,
      responsiveBreakpoints: []
    };
  }

  private detectGridPattern(elements: DesignElement[]): boolean {
    // Simple grid detection logic
    return elements.length > 4 && this.hasRegularSpacing(elements);
  }

  private detectFlexboxPattern(elements: DesignElement[]): boolean {
    // Simple flexbox detection logic
    return this.hasAlignedElements(elements);
  }

  private hasRegularSpacing(elements: DesignElement[]): boolean {
    // Check for regular spacing patterns
    return elements.length > 2; // Simplified check
  }

  private hasAlignedElements(elements: DesignElement[]): boolean {
    // Check for aligned elements
    return elements.length > 1; // Simplified check
  }

  private calculateOverallConfidence(elements: DesignElement[]): number {
    if (elements.length === 0) return 0;
    
    const totalConfidence = elements.reduce(
      (sum, element) => sum + element.classification.confidence, 
      0
    );
    
    return Math.round((totalConfidence / elements.length) * 100) / 100;
  }

  private rgbToHex(rgb: { r: number; g: number; b: number }): string {
    const r = Math.round(rgb.r * 255);
    const g = Math.round(rgb.g * 255);
    const b = Math.round(rgb.b * 255);
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  }

  private generateMockDesignData(fileId: string, nodeId?: string): any {
    // Generate mock data for development
    return {
      name: 'Mock Design',
      children: [
        {
          id: 'mock-1',
          name: 'Header',
          type: 'FRAME',
          absoluteBoundingBox: { x: 0, y: 0, width: 800, height: 80 },
          fills: [{ type: 'SOLID', color: { r: 0.2, g: 0.4, b: 0.8 } }],
          children: [
            {
              id: 'mock-1-text',
              name: 'Title',
              type: 'TEXT',
              absoluteBoundingBox: { x: 20, y: 20, width: 200, height: 40 },
              style: {
                fontFamily: 'Inter',
                fontSize: 24,
                fontWeight: 600
              }
            }
          ]
        }
      ]
    };
  }
}
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DesignAnalyzer, AnalysisOptions, AnalysisResult } from '../../../src/services/DesignAnalyzer';
import { CacheManager } from '../../../src/cache/redis';
import nock from 'nock';

// Mock dependencies
vi.mock('../../../src/cache/redis');
vi.mock('../../../src/utils/logger');

describe('DesignAnalyzer', () => {
  let designAnalyzer: DesignAnalyzer;
  
  beforeEach(() => {
    designAnalyzer = new DesignAnalyzer();
    vi.clearAllMocks();
    
    // Mock CacheManager
    vi.mocked(CacheManager.getParseResult).mockResolvedValue(null);
    vi.mocked(CacheManager.cacheParseResult).mockResolvedValue();
  });

  afterEach(() => {
    nock.cleanAll();
  });

  describe('analyzeDesign', () => {
    it('should analyze a Figma design successfully', async () => {
      const fileId = 'test-file-id';
      const options: AnalysisOptions = {
        includeChildren: true,
        extractStyles: true,
        analysisDepth: 'detailed'
      };

      // Mock Figma API response
      nock('https://api.figma.com')
        .get(`/v1/files/${fileId}`)
        .reply(200, {
          document: {
            id: fileId,
            name: 'Test Design',
            children: [
              {
                id: 'frame1',
                name: 'Main Frame',
                type: 'FRAME',
                absoluteBoundingBox: { x: 0, y: 0, width: 800, height: 600 },
                fills: [{ type: 'SOLID', color: { r: 0.2, g: 0.4, b: 0.8 } }],
                constraints: { horizontal: 'LEFT', vertical: 'TOP' },
                children: [
                  {
                    id: 'button1',
                    name: 'Primary Button',
                    type: 'RECTANGLE',
                    absoluteBoundingBox: { x: 50, y: 50, width: 120, height: 40 },
                    fills: [{ type: 'SOLID', color: { r: 0.2, g: 0.4, b: 0.8 } }],
                    constraints: { horizontal: 'LEFT', vertical: 'TOP' }
                  }
                ]
              }
            ]
          }
        });

      const result = await designAnalyzer.analyzeDesign(fileId, undefined, options);

      expect(result).toBeDefined();
      expect(result.fileId).toBe(fileId);
      expect(result.elements).toHaveLength(1);
      expect(result.elements[0].name).toBe('Main Frame');
      expect(result.elements[0].children).toHaveLength(1);
      expect(result.elements[0].children![0].name).toBe('Primary Button');
      expect(result.metadata.analysisDepth).toBe('detailed');
    });

    it('should return cached result when available', async () => {
      const fileId = 'cached-file-id';
      const cachedResult: AnalysisResult = {
        fileId,
        fileName: 'Cached Design',
        nodeName: 'Cached Node',
        elements: [],
        designTokens: {
          colors: {},
          typography: {},
          spacing: {},
          effects: {},
          borderRadius: {},
          opacity: {}
        },
        layoutAnalysis: {
          type: 'absolute',
          patterns: [],
          responsiveBreakpoints: [],
          gridSystems: [],
          flexboxUsage: [],
          layoutComplexity: 'simple'
        },
        componentAnalysis: {
          detectedComponents: [],
          componentInstances: [],
          designSystemUsage: {},
          componentComplexity: {}
        },
        interactionAnalysis: {
          hasInteractions: false,
          interactionTypes: [],
          hotspots: [],
          userFlows: []
        },
        qualityMetrics: {
          accessibilityScore: 0.8,
          consistencyScore: 0.9,
          complexityScore: 0.5,
          designSystemAdherence: 0.7
        },
        metadata: {
          analysisDepth: 'basic',
          processingTime: 100,
          confidence: 0.85,
          version: '1.0.0',
          parserEngine: 'figma',
          nodeCount: 5,
          layerDepth: 2
        }
      };

      vi.mocked(CacheManager.getParseResult).mockResolvedValue(cachedResult);

      const result = await designAnalyzer.analyzeDesign(fileId);

      expect(result).toEqual(cachedResult);
      expect(CacheManager.getParseResult).toHaveBeenCalledOnce();
      // Should not call the Figma API
      expect(nock.isDone()).toBe(true);
    });

    it('should handle Figma API errors gracefully', async () => {
      const fileId = 'error-file-id';

      nock('https://api.figma.com')
        .get(`/v1/files/${fileId}`)
        .reply(404, { error: 'File not found' });

      await expect(designAnalyzer.analyzeDesign(fileId))
        .rejects
        .toThrow('Design analysis failed: Failed to fetch Figma data: Figma file or node not found');
    });

    it('should handle unauthorized Figma API requests', async () => {
      const fileId = 'unauthorized-file-id';

      nock('https://api.figma.com')
        .get(`/v1/files/${fileId}`)
        .reply(401, { error: 'Invalid token' });

      await expect(designAnalyzer.analyzeDesign(fileId))
        .rejects
        .toThrow('Design analysis failed: Failed to fetch Figma data: Invalid Figma access token');
    });

    it('should analyze specific node when nodeId is provided', async () => {
      const fileId = 'test-file-id';
      const nodeId = 'test-node-id';

      nock('https://api.figma.com')
        .get(`/v1/files/${fileId}/nodes`)
        .query({ ids: nodeId })
        .reply(200, {
          nodes: {
            [nodeId]: {
              document: {
                id: nodeId,
                name: 'Specific Node',
                type: 'FRAME',
                absoluteBoundingBox: { x: 0, y: 0, width: 400, height: 300 },
                fills: [{ type: 'SOLID', color: { r: 0.95, g: 0.95, b: 0.95 } }],
                children: []
              }
            }
          }
        });

      const result = await designAnalyzer.analyzeDesign(fileId, nodeId);

      expect(result.fileId).toBe(fileId);
      expect(result.elements).toHaveLength(1);
      expect(result.elements[0].name).toBe('Specific Node');
    });

    it('should use mock data when Figma token is not provided', async () => {
      // Create analyzer without token
      const analyzerWithoutToken = new DesignAnalyzer();
      // Mock the private property
      (analyzerWithoutToken as any).figmaToken = '';

      const result = await analyzerWithoutToken.analyzeDesign('mock-file-id');

      expect(result.fileId).toBe('mock-file-id');
      expect(result.nodeName).toBe('Mock Design');
      expect(result.elements).toHaveLength(1);
      expect(result.elements[0].name).toBe('Header');
    });
  });

  describe('element classification', () => {
    it('should classify button elements correctly', async () => {
      const fileId = 'button-test-file';

      nock('https://api.figma.com')
        .get(`/v1/files/${fileId}`)
        .reply(200, {
          document: {
            id: fileId,
            name: 'Button Test',
            children: [
              {
                id: 'button1',
                name: 'Submit Button',
                type: 'RECTANGLE',
                absoluteBoundingBox: { x: 0, y: 0, width: 120, height: 40 },
                fills: [{ type: 'SOLID', color: { r: 0.2, g: 0.4, b: 0.8 } }],
                constraints: { horizontal: 'LEFT', vertical: 'TOP' }
              }
            ]
          }
        });

      const result = await designAnalyzer.analyzeDesign(fileId);

      expect(result.elements).toHaveLength(1);
      expect(result.elements[0].classification.elementType).toBe('button');
      expect(result.elements[0].classification.semanticRole).toBe('button');
      expect(result.elements[0].classification.interactionType).toBe('click');
      expect(result.elements[0].classification.confidence).toBeGreaterThan(0.8);
    });

    it('should classify text elements with appropriate semantic roles', async () => {
      const fileId = 'text-test-file';

      nock('https://api.figma.com')
        .get(`/v1/files/${fileId}`)
        .reply(200, {
          document: {
            id: fileId,
            name: 'Text Test',
            children: [
              {
                id: 'heading1',
                name: 'Main Heading',
                type: 'TEXT',
                absoluteBoundingBox: { x: 0, y: 0, width: 300, height: 40 },
                characters: 'Welcome to Our App',
                style: {
                  fontFamily: 'Inter',
                  fontSize: 32,
                  fontWeight: 700
                }
              },
              {
                id: 'caption1',
                name: 'Small Caption',
                type: 'TEXT',
                absoluteBoundingBox: { x: 0, y: 50, width: 200, height: 16 },
                characters: 'Last updated 2 hours ago',
                style: {
                  fontFamily: 'Inter',
                  fontSize: 12,
                  fontWeight: 400
                }
              }
            ]
          }
        });

      const result = await designAnalyzer.analyzeDesign(fileId);

      expect(result.elements).toHaveLength(2);
      
      // Large text should be classified as heading
      expect(result.elements[0].classification.semanticRole).toBe('heading');
      
      // Small text should be classified as caption
      expect(result.elements[1].classification.semanticRole).toBe('caption');
    });

    it('should classify card elements correctly', async () => {
      const fileId = 'card-test-file';

      nock('https://api.figma.com')
        .get(`/v1/files/${fileId}`)
        .reply(200, {
          document: {
            id: fileId,
            name: 'Card Test',
            children: [
              {
                id: 'card1',
                name: 'Product Card',
                type: 'FRAME',
                absoluteBoundingBox: { x: 0, y: 0, width: 300, height: 200 },
                fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }],
                constraints: { horizontal: 'LEFT', vertical: 'TOP' },
                children: []
              }
            ]
          }
        });

      const result = await designAnalyzer.analyzeDesign(fileId);

      expect(result.elements).toHaveLength(1);
      expect(result.elements[0].classification.elementType).toBe('card');
      expect(result.elements[0].classification.semanticRole).toBe('article');
      expect(result.elements[0].classification.confidence).toBeGreaterThan(0.8);
    });
  });

  describe('design token extraction', () => {
    it('should extract color tokens from design elements', async () => {
      const fileId = 'color-test-file';

      nock('https://api.figma.com')
        .get(`/v1/files/${fileId}`)
        .reply(200, {
          document: {
            id: fileId,
            name: 'Color Test',
            children: [
              {
                id: 'element1',
                name: 'Blue Element',
                type: 'RECTANGLE',
                absoluteBoundingBox: { x: 0, y: 0, width: 100, height: 100 },
                fills: [{ type: 'SOLID', color: { r: 0.2, g: 0.4, b: 0.8 } }],
                constraints: { horizontal: 'LEFT', vertical: 'TOP' }
              },
              {
                id: 'element2',
                name: 'Red Element',
                type: 'RECTANGLE',
                absoluteBoundingBox: { x: 150, y: 0, width: 100, height: 100 },
                fills: [{ type: 'SOLID', color: { r: 0.8, g: 0.2, b: 0.2 } }],
                constraints: { horizontal: 'LEFT', vertical: 'TOP' }
              }
            ]
          }
        });

      const result = await designAnalyzer.analyzeDesign(fileId);

      expect(result.designTokens.colors).toBeDefined();
      expect(Object.keys(result.designTokens.colors)).toHaveLength(2);
      
      const colorValues = Object.values(result.designTokens.colors);
      expect(colorValues).toContain('#3366cc'); // Blue
      expect(colorValues).toContain('#cc3333'); // Red
    });

    it('should extract typography tokens from text elements', async () => {
      const fileId = 'typography-test-file';

      nock('https://api.figma.com')
        .get(`/v1/files/${fileId}`)
        .reply(200, {
          document: {
            id: fileId,
            name: 'Typography Test',
            children: [
              {
                id: 'text1',
                name: 'Heading Text',
                type: 'TEXT',
                absoluteBoundingBox: { x: 0, y: 0, width: 300, height: 40 },
                characters: 'Main Heading',
                style: {
                  fontFamily: 'Inter',
                  fontSize: 24,
                  fontWeight: 600,
                  lineHeightPx: 32,
                  letterSpacing: -0.5
                }
              },
              {
                id: 'text2',
                name: 'Body Text',
                type: 'TEXT',
                absoluteBoundingBox: { x: 0, y: 50, width: 400, height: 60 },
                characters: 'Lorem ipsum dolor sit amet...',
                style: {
                  fontFamily: 'Inter',
                  fontSize: 16,
                  fontWeight: 400,
                  lineHeightPx: 24,
                  letterSpacing: 0
                }
              }
            ]
          }
        });

      const result = await designAnalyzer.analyzeDesign(fileId);

      expect(result.designTokens.typography).toBeDefined();
      expect(Object.keys(result.designTokens.typography)).toHaveLength(2);
      
      const typographyTokens = Object.values(result.designTokens.typography);
      expect(typographyTokens.some(token => token.fontSize === 24)).toBe(true);
      expect(typographyTokens.some(token => token.fontSize === 16)).toBe(true);
    });
  });

  describe('layout analysis', () => {
    it('should detect grid layout patterns', async () => {
      const fileId = 'grid-test-file';

      // Create a grid-like layout with multiple regularly spaced elements
      const gridElements = [];
      for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 4; col++) {
          gridElements.push({
            id: `grid-item-${row}-${col}`,
            name: `Grid Item ${row}-${col}`,
            type: 'RECTANGLE',
            absoluteBoundingBox: {
              x: col * 120 + 20,
              y: row * 100 + 20,
              width: 100,
              height: 80
            },
            fills: [{ type: 'SOLID', color: { r: 0.9, g: 0.9, b: 0.9 } }],
            constraints: { horizontal: 'LEFT', vertical: 'TOP' }
          });
        }
      }

      nock('https://api.figma.com')
        .get(`/v1/files/${fileId}`)
        .reply(200, {
          document: {
            id: fileId,
            name: 'Grid Layout Test',
            children: gridElements
          }
        });

      const result = await designAnalyzer.analyzeDesign(fileId);

      expect(result.layoutAnalysis.type).toBe('grid');
      expect(result.layoutAnalysis.patterns).toContain('grid-layout');
    });

    it('should detect flexbox layout patterns', async () => {
      const fileId = 'flex-test-file';

      // Create horizontally aligned elements (flexbox-like)
      const flexElements = [
        {
          id: 'flex-item-1',
          name: 'Flex Item 1',
          type: 'RECTANGLE',
          absoluteBoundingBox: { x: 20, y: 100, width: 80, height: 40 },
          fills: [{ type: 'SOLID', color: { r: 0.8, g: 0.8, b: 0.8 } }],
          constraints: { horizontal: 'LEFT', vertical: 'TOP' }
        },
        {
          id: 'flex-item-2',
          name: 'Flex Item 2',
          type: 'RECTANGLE',
          absoluteBoundingBox: { x: 120, y: 100, width: 80, height: 40 },
          fills: [{ type: 'SOLID', color: { r: 0.8, g: 0.8, b: 0.8 } }],
          constraints: { horizontal: 'LEFT', vertical: 'TOP' }
        },
        {
          id: 'flex-item-3',
          name: 'Flex Item 3',
          type: 'RECTANGLE',
          absoluteBoundingBox: { x: 220, y: 100, width: 80, height: 40 },
          fills: [{ type: 'SOLID', color: { r: 0.8, g: 0.8, b: 0.8 } }],
          constraints: { horizontal: 'LEFT', vertical: 'TOP' }
        }
      ];

      nock('https://api.figma.com')
        .get(`/v1/files/${fileId}`)
        .reply(200, {
          document: {
            id: fileId,
            name: 'Flexbox Layout Test',
            children: flexElements
          }
        });

      const result = await designAnalyzer.analyzeDesign(fileId);

      expect(result.layoutAnalysis.patterns).toContain('flexbox-layout');
      expect(['flexbox', 'mixed']).toContain(result.layoutAnalysis.type);
    });
  });

  describe('confidence calculation', () => {
    it('should calculate overall confidence correctly', async () => {
      const fileId = 'confidence-test-file';

      nock('https://api.figma.com')
        .get(`/v1/files/${fileId}`)
        .reply(200, {
          document: {
            id: fileId,
            name: 'Confidence Test',
            children: [
              {
                id: 'high-confidence',
                name: 'Submit Button',
                type: 'RECTANGLE',
                absoluteBoundingBox: { x: 0, y: 0, width: 120, height: 40 },
                fills: [{ type: 'SOLID', color: { r: 0.2, g: 0.4, b: 0.8 } }],
                constraints: { horizontal: 'LEFT', vertical: 'TOP' }
              },
              {
                id: 'medium-confidence',
                name: 'Some Element',
                type: 'ELLIPSE',
                absoluteBoundingBox: { x: 150, y: 0, width: 50, height: 50 },
                fills: [{ type: 'SOLID', color: { r: 0.5, g: 0.5, b: 0.5 } }],
                constraints: { horizontal: 'LEFT', vertical: 'TOP' }
              }
            ]
          }
        });

      const result = await designAnalyzer.analyzeDesign(fileId);

      expect(result.metadata.confidence).toBeGreaterThan(0);
      expect(result.metadata.confidence).toBeLessThanOrEqual(1);
      
      // Should be average of element confidences
      const avgConfidence = result.elements.reduce(
        (sum, element) => sum + element.classification.confidence, 
        0
      ) / result.elements.length;
      
      expect(result.metadata.confidence).toBeCloseTo(avgConfidence, 2);
    });
  });

  describe('caching behavior', () => {
    it('should cache analysis results', async () => {
      const fileId = 'cache-test-file';

      nock('https://api.figma.com')
        .get(`/v1/files/${fileId}`)
        .reply(200, {
          document: {
            id: fileId,
            name: 'Cache Test',
            children: []
          }
        });

      await designAnalyzer.analyzeDesign(fileId);

      expect(CacheManager.cacheParseResult).toHaveBeenCalledOnce();
      
      const cacheCall = vi.mocked(CacheManager.cacheParseResult).mock.calls[0];
      expect(cacheCall[0]).toContain(`analysis:${fileId}:root:`);
      expect(cacheCall[1]).toMatchObject({
        fileId,
        nodeName: 'Cache Test'
      });
    });

    it('should use different cache keys for different options', async () => {
      const fileId = 'cache-key-test-file';
      const options1: AnalysisOptions = { analysisDepth: 'basic' };
      const options2: AnalysisOptions = { analysisDepth: 'detailed' };

      // Mock both API calls
      nock('https://api.figma.com')
        .get(`/v1/files/${fileId}`)
        .times(2)
        .reply(200, {
          document: {
            id: fileId,
            name: 'Cache Key Test',
            children: []
          }
        });

      await designAnalyzer.analyzeDesign(fileId, undefined, options1);
      await designAnalyzer.analyzeDesign(fileId, undefined, options2);

      expect(CacheManager.getParseResult).toHaveBeenCalledTimes(2);
      
      const getCalls = vi.mocked(CacheManager.getParseResult).mock.calls;
      expect(getCalls[0][0]).not.toBe(getCalls[1][0]); // Different cache keys
    });
  });
});
import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { RateLimiterRedis } from 'rate-limiter-flexible';
import { logger } from '../utils/logger';
import { CacheManager } from '../cache/redis';

export interface FigmaFile {
  document: FigmaNode;
  name: string;
  lastModified: string;
  thumbnailUrl?: string;
  version: string;
  role: string;
  editorType: string;
  linkAccess: string;
  components: { [key: string]: Component };
  componentSets: { [key: string]: ComponentSet };
  schemaVersion: number;
  styles: { [key: string]: Style };
}

export interface FigmaNode {
  id: string;
  name: string;
  type: string;
  visible?: boolean;
  locked?: boolean;
  children?: FigmaNode[];
  absoluteBoundingBox?: Rectangle;
  relativeTransform?: Transform;
  fills?: Paint[];
  strokes?: Paint[];
  strokeWeight?: number;
  strokeAlign?: string;
  effects?: Effect[];
  cornerRadius?: number;
  rectangleCornerRadii?: number[];
  style?: TypeStyle;
  characters?: string;
  characterStyleOverrides?: number[];
  styleOverrideTable?: { [key: string]: TypeStyle };
  layoutMode?: string;
  constraints?: LayoutConstraint;
  layoutAlign?: string;
  layoutGrow?: number;
  paddingLeft?: number;
  paddingRight?: number;
  paddingTop?: number;
  paddingBottom?: number;
  itemSpacing?: number;
  counterAxisSizingMode?: string;
  primaryAxisSizingMode?: string;
  primaryAxisAlignItems?: string;
  counterAxisAlignItems?: string;
  blendMode?: string;
  opacity?: number;
  isMask?: boolean;
  exportSettings?: ExportSetting[];
  componentId?: string;
  componentSetId?: string;
  mainComponent?: Component;
  overrides?: any;
}

export interface Rectangle {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Transform {
  [0]: [number, number, number];
  [1]: [number, number, number];
}

export interface Paint {
  type: string;
  visible?: boolean;
  opacity?: number;
  color?: Color;
  gradientHandlePositions?: Vector[];
  gradientStops?: ColorStop[];
  scaleMode?: string;
  imageTransform?: Transform;
  scalingFactor?: number;
  rotation?: number;
  imageRef?: string;
  filters?: ImageFilters;
  gifRef?: string;
}

export interface Color {
  r: number;
  g: number;
  b: number;
  a?: number;
}

export interface Vector {
  x: number;
  y: number;
}

export interface ColorStop {
  position: number;
  color: Color;
}

export interface ImageFilters {
  exposure?: number;
  contrast?: number;
  saturation?: number;
  temperature?: number;
  tint?: number;
  highlights?: number;
  shadows?: number;
}

export interface Effect {
  type: string;
  visible?: boolean;
  radius?: number;
  color?: Color;
  blendMode?: string;
  offset?: Vector;
  spread?: number;
  showShadowBehindNode?: boolean;
}

export interface TypeStyle {
  fontFamily?: string;
  fontPostScriptName?: string;
  paragraphSpacing?: number;
  paragraphIndent?: number;
  listSpacing?: number;
  hangingPunctuation?: boolean;
  hangingList?: boolean;
  fontSize?: number;
  fontWeight?: number;
  textAlignHorizontal?: string;
  textAlignVertical?: string;
  letterSpacing?: number;
  fills?: Paint[];
  hyperlink?: Hyperlink;
  opentypeFlags?: { [key: string]: number };
  lineHeightPx?: number;
  lineHeightPercent?: number;
  lineHeightPercentFontSize?: number;
  lineHeightUnit?: string;
  textCase?: string;
  textDecoration?: string;
  textAutoResize?: string;
  textStyleId?: string;
  fillStyleId?: string;
}

export interface Hyperlink {
  type: string;
  url?: string;
  nodeID?: string;
}

export interface LayoutConstraint {
  vertical: string;
  horizontal: string;
}

export interface ExportSetting {
  suffix: string;
  format: string;
  constraint: Constraint;
}

export interface Constraint {
  type: string;
  value?: number;
}

export interface Component {
  key: string;
  name: string;
  description: string;
  componentSetId?: string;
  documentationLinks?: DocumentationLink[];
  remote: boolean;
}

export interface ComponentSet {
  key: string;
  name: string;
  description: string;
  documentationLinks?: DocumentationLink[];
  remote: boolean;
}

export interface DocumentationLink {
  uri: string;
}

export interface Style {
  key: string;
  name: string;
  description: string;
  remote: boolean;
  styleType: string;
}

export interface FigmaUser {
  id: string;
  handle: string;
  img_url: string;
  email?: string;
}

export interface FigmaTeam {
  id: string;
  name: string;
}

export interface FigmaProject {
  id: string;
  name: string;
}

export interface FigmaFileVersion {
  id: string;
  created_at: string;
  label: string;
  description: string;
  user: FigmaUser;
  thumbnail_url?: string;
}

export interface FigmaComment {
  id: string;
  file_key: string;
  parent_id?: string;
  user: FigmaUser;
  created_at: string;
  resolved_at?: string;
  message: string;
  client_meta: Vector | Rectangle;
  order_id?: string;
}

export interface FigmaWebhookEvent {
  event_type: 'FILE_UPDATE' | 'FILE_DELETE' | 'FILE_COMMENT' | 'LIBRARY_PUBLISH';
  file_key: string;
  timestamp: string;
  passcode?: string;
  webhook_id?: string;
  user_id?: string;
  created_components?: string[];
  created_styles?: string[];
  created_component_sets?: string[];
  modified_components?: string[];
  modified_styles?: string[];
  modified_component_sets?: string[];
  deleted_components?: string[];
  deleted_styles?: string[];
  deleted_component_sets?: string[];
}

export class FigmaClient {
  private client: AxiosInstance;
  private rateLimiter: RateLimiterRedis;
  private baseUrl = 'https://api.figma.com/v1';
  private accessToken: string;

  constructor(accessToken: string, redisClient?: any) {
    this.accessToken = accessToken;
    
    // Initialize HTTP client
    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: 30000,
      headers: {
        'X-Figma-Token': this.accessToken,
        'Content-Type': 'application/json',
        'User-Agent': 'Imagineer Design Parser v1.0.0'
      }
    });

    // Add request/response interceptors
    this.setupInterceptors();

    // Initialize rate limiter (Figma allows 1000 requests per hour per token)
    this.rateLimiter = new RateLimiterRedis({
      storeClient: redisClient,
      keyPrefix: 'figma_rate_limit',
      points: 1000, // Number of requests
      duration: 3600, // Per 1 hour
      blockDuration: 3600, // Block for 1 hour if limit exceeded
    });
  }

  private setupInterceptors(): void {
    // Request interceptor for rate limiting
    this.client.interceptors.request.use(async (config) => {
      try {
        await this.rateLimiter.consume('figma_api');
        return config;
      } catch (rateLimiterRes) {
        const remainingPoints = rateLimiterRes.remainingPoints || 0;
        const msBeforeNext = rateLimiterRes.msBeforeNext || 0;
        
        logger.warn('Figma API rate limit reached', {
          remainingPoints,
          msBeforeNext,
          retryAfter: new Date(Date.now() + msBeforeNext)
        });

        throw new Error(`Rate limit exceeded. Retry after ${Math.ceil(msBeforeNext / 1000)} seconds`);
      }
    });

    // Response interceptor for error handling
    this.client.interceptors.response.use(
      (response: AxiosResponse) => {
        logger.debug('Figma API request successful', {
          url: response.config.url,
          status: response.status,
          responseSize: JSON.stringify(response.data).length
        });
        return response;
      },
      (error) => {
        logger.error('Figma API request failed', {
          url: error.config?.url,
          status: error.response?.status,
          statusText: error.response?.statusText,
          message: error.message,
          data: error.response?.data
        });

        // Handle specific Figma API errors
        if (error.response) {
          switch (error.response.status) {
            case 400:
              throw new Error(`Bad Request: ${error.response.data?.message || 'Invalid request parameters'}`);
            case 401:
              throw new Error('Unauthorized: Invalid or missing Figma access token');
            case 403:
              throw new Error('Forbidden: Insufficient permissions to access this resource');
            case 404:
              throw new Error('Not Found: File, node, or resource does not exist');
            case 429:
              throw new Error('Rate limit exceeded. Please try again later');
            case 500:
              throw new Error('Figma API internal server error');
            default:
              throw new Error(`Figma API error: ${error.response.status} ${error.response.statusText}`);
          }
        }

        throw error;
      }
    );
  }

  /**
   * Get file information and document tree
   */
  async getFile(fileKey: string, options: {
    version?: string;
    ids?: string[];
    depth?: number;
    geometry?: 'paths' | 'bounds';
    plugin_data?: string;
    branch_data?: boolean;
  } = {}): Promise<FigmaFile> {
    const cacheKey = `figma:file:${fileKey}:${JSON.stringify(options)}`;
    
    try {
      // Check cache first
      const cached = await CacheManager.get(cacheKey);
      if (cached) {
        logger.debug('Returning cached Figma file', { fileKey, cacheHit: true });
        return JSON.parse(cached);
      }

      logger.info('Fetching Figma file', { fileKey, options });

      const params = new URLSearchParams();
      if (options.version) params.append('version', options.version);
      if (options.ids) params.append('ids', options.ids.join(','));
      if (options.depth) params.append('depth', options.depth.toString());
      if (options.geometry) params.append('geometry', options.geometry);
      if (options.plugin_data) params.append('plugin_data', options.plugin_data);
      if (options.branch_data) params.append('branch_data', 'true');

      const response = await this.client.get(`/files/${fileKey}?${params.toString()}`);
      const fileData: FigmaFile = response.data;

      // Cache for 5 minutes
      await CacheManager.set(cacheKey, JSON.stringify(fileData), 300);

      logger.info('Figma file fetched successfully', {
        fileKey,
        fileName: fileData.name,
        lastModified: fileData.lastModified,
        version: fileData.version,
        componentCount: Object.keys(fileData.components || {}).length,
        styleCount: Object.keys(fileData.styles || {}).length
      });

      return fileData;

    } catch (error) {
      logger.error('Failed to fetch Figma file', { fileKey, error: error.message });
      throw error;
    }
  }

  /**
   * Get specific nodes from a file
   */
  async getFileNodes(fileKey: string, nodeIds: string[], options: {
    version?: string;
    depth?: number;
    geometry?: 'paths' | 'bounds';
    plugin_data?: string;
  } = {}): Promise<{ nodes: { [key: string]: FigmaNode } }> {
    const cacheKey = `figma:nodes:${fileKey}:${nodeIds.join(',')}:${JSON.stringify(options)}`;
    
    try {
      // Check cache first
      const cached = await CacheManager.get(cacheKey);
      if (cached) {
        logger.debug('Returning cached Figma nodes', { fileKey, nodeIds, cacheHit: true });
        return JSON.parse(cached);
      }

      logger.info('Fetching Figma file nodes', { fileKey, nodeIds, options });

      const params = new URLSearchParams();
      params.append('ids', nodeIds.join(','));
      if (options.version) params.append('version', options.version);
      if (options.depth) params.append('depth', options.depth.toString());
      if (options.geometry) params.append('geometry', options.geometry);
      if (options.plugin_data) params.append('plugin_data', options.plugin_data);

      const response = await this.client.get(`/files/${fileKey}/nodes?${params.toString()}`);
      const nodesData = response.data;

      // Cache for 2 minutes
      await CacheManager.set(cacheKey, JSON.stringify(nodesData), 120);

      logger.info('Figma file nodes fetched successfully', {
        fileKey,
        nodeCount: Object.keys(nodesData.nodes).length
      });

      return nodesData;

    } catch (error) {
      logger.error('Failed to fetch Figma file nodes', { fileKey, nodeIds, error: error.message });
      throw error;
    }
  }

  /**
   * Get image URLs for nodes
   */
  async getImages(fileKey: string, nodeIds: string[], options: {
    scale?: number;
    format?: 'jpg' | 'png' | 'svg' | 'pdf';
    svg_include_id?: boolean;
    svg_include_node_id?: boolean;
    svg_simplify_stroke?: boolean;
    use_absolute_bounds?: boolean;
    version?: string;
  } = {}): Promise<{ images: { [key: string]: string } }> {
    try {
      logger.info('Fetching Figma node images', { fileKey, nodeIds, options });

      const params = new URLSearchParams();
      params.append('ids', nodeIds.join(','));
      if (options.scale) params.append('scale', options.scale.toString());
      if (options.format) params.append('format', options.format);
      if (options.svg_include_id) params.append('svg_include_id', 'true');
      if (options.svg_include_node_id) params.append('svg_include_node_id', 'true');
      if (options.svg_simplify_stroke) params.append('svg_simplify_stroke', 'true');
      if (options.use_absolute_bounds) params.append('use_absolute_bounds', 'true');
      if (options.version) params.append('version', options.version);

      const response = await this.client.get(`/images/${fileKey}?${params.toString()}`);
      const imagesData = response.data;

      logger.info('Figma node images fetched successfully', {
        fileKey,
        imageCount: Object.keys(imagesData.images).length
      });

      return imagesData;

    } catch (error) {
      logger.error('Failed to fetch Figma node images', { fileKey, nodeIds, error: error.message });
      throw error;
    }
  }

  /**
   * Get file versions
   */
  async getFileVersions(fileKey: string): Promise<{ versions: FigmaFileVersion[] }> {
    try {
      logger.info('Fetching Figma file versions', { fileKey });

      const response = await this.client.get(`/files/${fileKey}/versions`);
      const versionsData = response.data;

      logger.info('Figma file versions fetched successfully', {
        fileKey,
        versionCount: versionsData.versions.length
      });

      return versionsData;

    } catch (error) {
      logger.error('Failed to fetch Figma file versions', { fileKey, error: error.message });
      throw error;
    }
  }

  /**
   * Get user information
   */
  async getMe(): Promise<FigmaUser> {
    const cacheKey = 'figma:user:me';
    
    try {
      // Check cache first
      const cached = await CacheManager.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      logger.info('Fetching Figma user information');

      const response = await this.client.get('/me');
      const userData: FigmaUser = response.data;

      // Cache for 1 hour
      await CacheManager.set(cacheKey, JSON.stringify(userData), 3600);

      logger.info('Figma user information fetched successfully', {
        userId: userData.id,
        handle: userData.handle
      });

      return userData;

    } catch (error) {
      logger.error('Failed to fetch Figma user information', { error: error.message });
      throw error;
    }
  }

  /**
   * Get team projects
   */
  async getTeamProjects(teamId: string): Promise<{ projects: FigmaProject[] }> {
    try {
      logger.info('Fetching Figma team projects', { teamId });

      const response = await this.client.get(`/teams/${teamId}/projects`);
      const projectsData = response.data;

      logger.info('Figma team projects fetched successfully', {
        teamId,
        projectCount: projectsData.projects.length
      });

      return projectsData;

    } catch (error) {
      logger.error('Failed to fetch Figma team projects', { teamId, error: error.message });
      throw error;
    }
  }

  /**
   * Get project files
   */
  async getProjectFiles(projectId: string): Promise<{ files: Array<{ key: string; name: string; thumbnail_url?: string; last_modified: string }> }> {
    try {
      logger.info('Fetching Figma project files', { projectId });

      const response = await this.client.get(`/projects/${projectId}/files`);
      const filesData = response.data;

      logger.info('Figma project files fetched successfully', {
        projectId,
        fileCount: filesData.files.length
      });

      return filesData;

    } catch (error) {
      logger.error('Failed to fetch Figma project files', { projectId, error: error.message });
      throw error;
    }
  }

  /**
   * Get file comments
   */
  async getComments(fileKey: string): Promise<{ comments: FigmaComment[] }> {
    try {
      logger.info('Fetching Figma file comments', { fileKey });

      const response = await this.client.get(`/files/${fileKey}/comments`);
      const commentsData = response.data;

      logger.info('Figma file comments fetched successfully', {
        fileKey,
        commentCount: commentsData.comments.length
      });

      return commentsData;

    } catch (error) {
      logger.error('Failed to fetch Figma file comments', { fileKey, error: error.message });
      throw error;
    }
  }

  /**
   * Post a comment to a file
   */
  async postComment(fileKey: string, message: string, client_meta: Vector | Rectangle): Promise<FigmaComment> {
    try {
      logger.info('Posting Figma comment', { fileKey, messageLength: message.length });

      const response = await this.client.post(`/files/${fileKey}/comments`, {
        message,
        client_meta
      });
      const comment: FigmaComment = response.data;

      logger.info('Figma comment posted successfully', {
        fileKey,
        commentId: comment.id
      });

      return comment;

    } catch (error) {
      logger.error('Failed to post Figma comment', { fileKey, error: error.message });
      throw error;
    }
  }

  /**
   * Get component information
   */
  async getComponent(componentKey: string): Promise<Component> {
    const cacheKey = `figma:component:${componentKey}`;
    
    try {
      // Check cache first
      const cached = await CacheManager.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      logger.info('Fetching Figma component', { componentKey });

      const response = await this.client.get(`/components/${componentKey}`);
      const componentData: Component = response.data.meta;

      // Cache for 30 minutes
      await CacheManager.set(cacheKey, JSON.stringify(componentData), 1800);

      logger.info('Figma component fetched successfully', {
        componentKey,
        componentName: componentData.name
      });

      return componentData;

    } catch (error) {
      logger.error('Failed to fetch Figma component', { componentKey, error: error.message });
      throw error;
    }
  }

  /**
   * Get component set information
   */
  async getComponentSet(componentSetKey: string): Promise<ComponentSet> {
    const cacheKey = `figma:componentSet:${componentSetKey}`;
    
    try {
      // Check cache first
      const cached = await CacheManager.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      logger.info('Fetching Figma component set', { componentSetKey });

      const response = await this.client.get(`/component_sets/${componentSetKey}`);
      const componentSetData: ComponentSet = response.data.meta;

      // Cache for 30 minutes
      await CacheManager.set(cacheKey, JSON.stringify(componentSetData), 1800);

      logger.info('Figma component set fetched successfully', {
        componentSetKey,
        componentSetName: componentSetData.name
      });

      return componentSetData;

    } catch (error) {
      logger.error('Failed to fetch Figma component set', { componentSetKey, error: error.message });
      throw error;
    }
  }

  /**
   * Get style information
   */
  async getStyle(styleKey: string): Promise<Style> {
    const cacheKey = `figma:style:${styleKey}`;
    
    try {
      // Check cache first
      const cached = await CacheManager.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      logger.info('Fetching Figma style', { styleKey });

      const response = await this.client.get(`/styles/${styleKey}`);
      const styleData: Style = response.data.meta;

      // Cache for 30 minutes
      await CacheManager.set(cacheKey, JSON.stringify(styleData), 1800);

      logger.info('Figma style fetched successfully', {
        styleKey,
        styleName: styleData.name
      });

      return styleData;

    } catch (error) {
      logger.error('Failed to fetch Figma style', { styleKey, error: error.message });
      throw error;
    }
  }

  /**
   * Check if file key is valid
   */
  static isValidFileKey(fileKey: string): boolean {
    // Figma file keys are alphanumeric with specific length
    const fileKeyRegex = /^[a-zA-Z0-9]{22,}$/;
    return fileKeyRegex.test(fileKey);
  }

  /**
   * Extract file key from Figma URL
   */
  static extractFileKeyFromUrl(url: string): string | null {
    const urlPatterns = [
      /figma\.com\/file\/([a-zA-Z0-9]+)/,
      /figma\.com\/proto\/([a-zA-Z0-9]+)/,
      /figma\.com\/design\/([a-zA-Z0-9]+)/
    ];

    for (const pattern of urlPatterns) {
      const match = url.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }

    return null;
  }

  /**
   * Extract node ID from Figma URL
   */
  static extractNodeIdFromUrl(url: string): string | null {
    const match = url.match(/node-id=([^&]+)/);
    return match ? decodeURIComponent(match[1]) : null;
  }

  /**
   * Validate access token format
   */
  static isValidAccessToken(token: string): boolean {
    // Figma personal access tokens are typically 40+ characters long
    return typeof token === 'string' && token.length >= 40;
  }

  /**
   * Parse webhook event
   */
  static parseWebhookEvent(payload: any): FigmaWebhookEvent {
    return {
      event_type: payload.event_type,
      file_key: payload.file_key,
      timestamp: payload.timestamp,
      passcode: payload.passcode,
      webhook_id: payload.webhook_id,
      user_id: payload.user_id,
      created_components: payload.created_components,
      created_styles: payload.created_styles,
      created_component_sets: payload.created_component_sets,
      modified_components: payload.modified_components,
      modified_styles: payload.modified_styles,
      modified_component_sets: payload.modified_component_sets,
      deleted_components: payload.deleted_components,
      deleted_styles: payload.deleted_styles,
      deleted_component_sets: payload.deleted_component_sets
    };
  }

  /**
   * Get rate limit status
   */
  async getRateLimitStatus(): Promise<{ remaining: number; resetTime: Date }> {
    try {
      const res = await this.rateLimiter.get('figma_api');
      return {
        remaining: res ? res.remainingPoints || 0 : 1000,
        resetTime: res ? new Date(Date.now() + (res.msBeforeNext || 0)) : new Date()
      };
    } catch (error) {
      return { remaining: 0, resetTime: new Date() };
    }
  }
}
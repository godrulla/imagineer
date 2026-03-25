import { Request, Response, NextFunction } from 'express';
import { z, ZodSchema, ZodError } from 'zod';
import { ValidationError } from './errorHandler';
import { logger } from '../utils/logger';

export interface ValidationOptions {
  allowUnknown?: boolean;
  stripUnknown?: boolean;
  abortEarly?: boolean;
}

export function validateRequest(
  schema: {
    body?: ZodSchema;
    query?: ZodSchema;
    params?: ZodSchema;
    headers?: ZodSchema;
  },
  options: ValidationOptions = {}
) {
  return (req: Request, res: Response, next: NextFunction) => {
    const validationErrors: any[] = [];
    
    try {
      // Validate headers
      if (schema.headers) {
        try {
          req.headers = schema.headers.parse(req.headers);
        } catch (error) {
          if (error instanceof ZodError) {
            validationErrors.push(...formatZodErrors(error, 'headers'));
          }
        }
      }

      // Validate params
      if (schema.params) {
        try {
          req.params = schema.params.parse(req.params);
        } catch (error) {
          if (error instanceof ZodError) {
            validationErrors.push(...formatZodErrors(error, 'params'));
          }
        }
      }

      // Validate query
      if (schema.query) {
        try {
          req.query = schema.query.parse(req.query);
        } catch (error) {
          if (error instanceof ZodError) {
            validationErrors.push(...formatZodErrors(error, 'query'));
          }
        }
      }

      // Validate body
      if (schema.body) {
        try {
          req.body = schema.body.parse(req.body);
        } catch (error) {
          if (error instanceof ZodError) {
            validationErrors.push(...formatZodErrors(error, 'body'));
          }
        }
      }

      if (validationErrors.length > 0) {
        logger.warn('Request validation failed', {
          url: req.url,
          method: req.method,
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          errors: validationErrors
        });

        const error = new ValidationError('Request validation failed');
        error.validationErrors = validationErrors;
        return next(error);
      }

      next();

    } catch (error) {
      logger.error('Unexpected validation error', {
        error: error.message,
        stack: error.stack,
        url: req.url,
        method: req.method
      });
      next(error);
    }
  };
}

function formatZodErrors(error: ZodError, location: string): any[] {
  return error.errors.map(err => ({
    field: `${location}.${err.path.join('.')}`,
    message: err.message,
    code: err.code,
    value: err.received || undefined,
    expected: getExpectedType(err)
  }));
}

function getExpectedType(error: any): string {
  switch (error.code) {
    case 'invalid_type':
      return `Expected ${error.expected}, received ${error.received}`;
    case 'invalid_string':
      return `Expected valid ${error.validation}`;
    case 'too_small':
      return `Minimum ${error.minimum} ${error.type}`;
    case 'too_big':
      return `Maximum ${error.maximum} ${error.type}`;
    case 'invalid_enum_value':
      return `Expected one of: ${error.options?.join(', ')}`;
    default:
      return error.message;
  }
}

// Common schemas
const uuidSchema = z.string().uuid('Must be a valid UUID');
const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20)
});
const sortSchema = z.string().regex(/^[a-zA-Z_][a-zA-Z0-9_]*:(asc|desc)$/, 'Sort format must be field:direction').default('created_at:desc');

// Design tool enum schema
const designToolSchema = z.enum([
  'figma', 'sketch', 'adobe_xd', 'photoshop', 'illustrator', 
  'invision', 'marvel', 'principle', 'framer', 'other'
]);

// Project status enum schema
const projectStatusSchema = z.enum(['active', 'archived', 'deleted']);

// Processing status enum schema
const processingStatusSchema = z.enum(['pending', 'processing', 'completed', 'failed', 'skipped']);

// Element type enum schema
const elementTypeSchema = z.enum([
  'frame', 'group', 'text', 'image', 'vector', 'component', 
  'instance', 'slice', 'line', 'rectangle', 'ellipse', 
  'polygon', 'star', 'boolean_operation'
]);

// Job type enum schema
const jobTypeSchema = z.enum([
  'file_upload', 'file_processing', 'figma_import', 
  'project_sync', 'element_extraction'
]);

// Job status enum schema
const jobStatusSchema = z.enum([
  'queued', 'processing', 'completed', 'failed', 'cancelled', 'timeout'
]);

// Common headers schema
const commonHeadersSchema = z.object({
  'content-type': z.string().optional(),
  'authorization': z.string().optional(),
  'x-api-key': z.string().optional(),
  'user-agent': z.string().optional()
}).passthrough();

// Request validation schemas following OpenAPI specification
export const schemas = {
  // Health endpoints
  health: {
    headers: commonHeadersSchema
  },

  // Projects endpoints
  listProjects: {
    headers: commonHeadersSchema,
    query: paginationSchema.extend({
      sort: sortSchema,
      team_id: uuidSchema.optional(),
      source_tool: designToolSchema.optional(),
      status: projectStatusSchema.optional(),
      search: z.string().max(100).optional()
    })
  },

  createProject: {
    headers: commonHeadersSchema,
    body: z.object({
      name: z.string().min(1).max(255),
      description: z.string().optional(),
      team_id: uuidSchema.optional(),
      source_tool: designToolSchema,
      source_url: z.string().url().optional(),
      source_file_id: z.string().optional(),
      settings: z.record(z.any()).default({}),
      auto_sync: z.boolean().default(true),
      sync_frequency_minutes: z.number().int().min(5).max(10080).default(60),
      tags: z.array(z.string()).max(20).default([]),
      category: z.string().max(100).optional(),
      visibility: z.enum(['private', 'team', 'organization']).default('team')
    })
  },

  getProject: {
    headers: commonHeadersSchema,
    params: z.object({
      projectId: uuidSchema
    })
  },

  updateProject: {
    headers: commonHeadersSchema,
    params: z.object({
      projectId: uuidSchema
    }),
    body: z.object({
      name: z.string().min(1).max(255).optional(),
      description: z.string().optional(),
      team_id: uuidSchema.optional(),
      source_url: z.string().url().optional(),
      source_file_id: z.string().optional(),
      settings: z.record(z.any()).optional(),
      auto_sync: z.boolean().optional(),
      sync_frequency_minutes: z.number().int().min(5).max(10080).optional(),
      tags: z.array(z.string()).max(20).optional(),
      category: z.string().max(100).optional(),
      visibility: z.enum(['private', 'team', 'organization']).optional()
    })
  },

  deleteProject: {
    headers: commonHeadersSchema,
    params: z.object({
      projectId: uuidSchema
    })
  },

  syncProject: {
    headers: commonHeadersSchema,
    params: z.object({
      projectId: uuidSchema
    }),
    body: z.object({
      force: z.boolean().default(false)
    }).optional()
  },

  // Design Files endpoints
  listDesignFiles: {
    headers: commonHeadersSchema,
    params: z.object({
      projectId: uuidSchema
    }),
    query: paginationSchema.extend({
      file_type: z.string().optional(),
      processing_status: processingStatusSchema.optional()
    })
  },

  uploadDesignFile: {
    headers: commonHeadersSchema,
    params: z.object({
      projectId: uuidSchema
    }),
    body: z.object({
      name: z.string().max(255).optional(),
      metadata: z.record(z.any()).default({}),
      auto_process: z.boolean().default(true)
    })
  },

  getDesignFile: {
    headers: commonHeadersSchema,
    params: z.object({
      projectId: uuidSchema,
      fileId: uuidSchema
    })
  },

  deleteDesignFile: {
    headers: commonHeadersSchema,
    params: z.object({
      projectId: uuidSchema,
      fileId: uuidSchema
    })
  },

  processDesignFile: {
    headers: commonHeadersSchema,
    params: z.object({
      projectId: uuidSchema,
      fileId: uuidSchema
    }),
    body: z.object({
      force_reprocess: z.boolean().default(false),
      processing_options: z.record(z.any()).default({}),
      priority: z.number().int().min(0).max(10).default(5)
    }).optional()
  },

  // Parsed Designs endpoints
  getParsedDesign: {
    headers: commonHeadersSchema,
    params: z.object({
      projectId: uuidSchema,
      fileId: uuidSchema
    })
  },

  // Design Elements endpoints
  getDesignElements: {
    headers: commonHeadersSchema,
    params: z.object({
      projectId: uuidSchema,
      fileId: uuidSchema
    }),
    query: paginationSchema.extend({
      element_type: elementTypeSchema.optional(),
      layer_name: z.string().optional()
    })
  },

  // Figma Integration endpoints
  importFigmaFile: {
    headers: commonHeadersSchema,
    body: z.object({
      figma_file_key: z.string().min(1),
      project_id: uuidSchema,
      access_token: z.string().optional(),
      pages: z.array(z.string()).default([]),
      auto_sync: z.boolean().default(true)
    })
  },

  figmaWebhook: {
    body: z.object({
      event_type: z.enum(['FILE_UPDATE', 'FILE_DELETE', 'FILE_COMMENT']),
      file_key: z.string(),
      timestamp: z.string().datetime(),
      user_id: z.string().optional(),
      webhook_id: z.string().optional()
    })
  },

  // Jobs endpoints
  listJobs: {
    headers: commonHeadersSchema,
    query: paginationSchema.extend({
      job_type: jobTypeSchema.optional(),
      status: jobStatusSchema.optional()
    })
  },

  getJob: {
    headers: commonHeadersSchema,
    params: z.object({
      jobId: uuidSchema
    })
  },

  cancelJob: {
    headers: commonHeadersSchema,
    params: z.object({
      jobId: uuidSchema
    })
  },

  // Legacy endpoints (keeping for backward compatibility)
  analyzeDesign: {
    headers: commonHeadersSchema,
    body: z.object({
      figmaFileId: z.string().min(1, 'Figma file ID is required'),
      nodeId: z.string().optional(),
      options: z.object({
        includeChildren: z.boolean().default(true),
        extractStyles: z.boolean().default(true),
        generateThumbnail: z.boolean().default(false),
        analysisDepth: z.enum(['basic', 'detailed', 'comprehensive']).default('detailed'),
        extractDesignTokens: z.boolean().default(true),
        analyzeInteractions: z.boolean().default(false),
        detectComponents: z.boolean().default(true),
        generateThumbnails: z.boolean().default(false),
        includeAssets: z.boolean().default(false),
        maxDepth: z.number().int().min(1).max(20).default(10),
        includeMeasurements: z.boolean().default(true),
        analyzeResponsive: z.boolean().default(false)
      }).optional().default({})
    })
  },

  extractElements: {
    headers: commonHeadersSchema,
    body: z.object({
      designData: z.object({
        document: z.object({
          id: z.string(),
          name: z.string(),
          children: z.array(z.any())
        }),
        components: z.record(z.any()).optional(),
        styles: z.record(z.any()).optional()
      }),
      options: z.object({
        elementTypes: z.array(z.string()).optional(),
        minConfidence: z.number().min(0).max(1).default(0.8),
        includeHidden: z.boolean().default(false)
      }).optional().default({})
    })
  },

  getJobStatus: {
    headers: commonHeadersSchema,
    params: z.object({
      jobId: uuidSchema
    })
  }
};

// Utility functions for validation
export function validateFigmaFileKey(fileKey: string): boolean {
  // Figma file keys are typically 22+ characters, alphanumeric
  const figmaFileKeyRegex = /^[a-zA-Z0-9]{22,}$/;
  return figmaFileKeyRegex.test(fileKey);
}

export function validateFigmaAccessToken(token: string): boolean {
  // Figma personal access tokens are typically 40+ characters
  return typeof token === 'string' && token.length >= 40;
}

export function sanitizeFilename(filename: string): string {
  // Remove or replace dangerous characters
  return filename
    .replace(/[^a-zA-Z0-9.-]/g, '_')
    .replace(/_{2,}/g, '_')
    .slice(0, 255);
}

export function validateFileSize(size: number, maxSize: number = 50 * 1024 * 1024): boolean {
  // Default max size: 50MB
  return size > 0 && size <= maxSize;
}

export function validateImageDimensions(width: number, height: number, maxDimension: number = 10000): boolean {
  return width > 0 && height > 0 && width <= maxDimension && height <= maxDimension;
}

// Rate limiting validation
export function validateRateLimit(identifier: string, limit: number, window: number): boolean {
  // This would integrate with a rate limiting system
  // For now, return true (no rate limiting)
  return true;
}

// Security validation helpers
export function validateOrigin(origin: string, allowedOrigins: string[]): boolean {
  return allowedOrigins.includes(origin) || allowedOrigins.includes('*');
}

export function validateApiKey(apiKey: string, validKeys: string[]): boolean {
  return validKeys.includes(apiKey);
}

export function sanitizeInput(input: string): string {
  // Basic XSS prevention
  return input
    .replace(/[<>"']/g, '')
    .trim()
    .slice(0, 1000);
}

// Error response helpers
export function createValidationErrorResponse(errors: any[]) {
  return {
    error: {
      code: 'VALIDATION_ERROR',
      message: 'Request validation failed',
      details: {
        validation_errors: errors
      },
      request_id: generateRequestId()
    }
  };
}

export function createRateLimitErrorResponse(limit: number, reset: number) {
  return {
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Rate limit exceeded',
      details: {
        limit,
        reset_time: new Date(reset).toISOString()
      },
      request_id: generateRequestId()
    }
  };
}

function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
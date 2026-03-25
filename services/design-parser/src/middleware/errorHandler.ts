import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export interface AppError extends Error {
  statusCode?: number;
  status?: string;
  isOperational?: boolean;
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class ProcessingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProcessingError';
  }
}

export function errorHandler(
  err: AppError,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  let statusCode = 500;
  let message = 'Internal server error';
  let errorType = 'INTERNAL_ERROR';

  // Log error details
  logger.error('Error occurred', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  // Handle specific error types
  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = err.message;
    errorType = 'VALIDATION_ERROR';
  } else if (err.name === 'ProcessingError') {
    statusCode = 422;
    message = err.message;
    errorType = 'PROCESSING_ERROR';
  } else if (err.statusCode) {
    statusCode = err.statusCode;
    message = err.message;
    errorType = 'HTTP_ERROR';
  }

  // Send error response
  res.status(statusCode).json({
    error: {
      type: errorType,
      message,
      statusCode,
      timestamp: new Date().toISOString(),
      service: 'design-parser',
      requestId: req.headers['x-request-id'] || generateRequestId(),
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    }
  });
}

export function asyncHandler(fn: Function) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

function generateRequestId(): string {
  return Math.random().toString(36).substring(2, 15);
}
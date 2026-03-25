import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { logger } from './utils/logger';
import { connectDatabase } from './database/connection';
import { connectRedis } from './cache/redis';
import parserRoutes from './routes/parser';
import { errorHandler } from './middleware/errorHandler';
import { initializeHealthChecker, getHealthChecker, trackRequests, gracefulShutdown } from './utils/health';
import { Pool } from 'pg';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8001;
const SERVICE_NAME = 'design-parser';

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:5173'],
  credentials: true
}));
app.use(morgan('combined'));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Request tracking middleware
app.use(trackRequests());

// Enhanced health check endpoints
app.get('/health', async (req, res) => {
  try {
    const healthChecker = getHealthChecker();
    const health = await healthChecker.checkHealth();
    
    const statusCode = health.status === 'healthy' ? 200 : 
                      health.status === 'degraded' ? 200 : 503;
    
    res.status(statusCode).json(health);
  } catch (error) {
    logger.error('Health check failed', { error: error.message });
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      service: SERVICE_NAME,
      error: error.message
    });
  }
});

// Service readiness check
app.get('/ready', async (req, res) => {
  try {
    const healthChecker = getHealthChecker();
    const isReady = await healthChecker.checkServiceReadiness();
    
    if (isReady) {
      res.status(200).json({
        status: 'ready',
        service: SERVICE_NAME,
        timestamp: new Date().toISOString()
      });
    } else {
      throw new Error('Service not ready');
    }
  } catch (error) {
    logger.error('Service readiness check failed', { error: error.message });
    res.status(503).json({
      status: 'not ready',
      service: SERVICE_NAME,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Service liveness check
app.get('/live', async (req, res) => {
  try {
    const healthChecker = getHealthChecker();
    const isAlive = await healthChecker.checkServiceLiveness();
    
    if (isAlive) {
      res.status(200).json({
        status: 'alive',
        service: SERVICE_NAME,
        timestamp: new Date().toISOString()
      });
    } else {
      throw new Error('Service not responding');
    }
  } catch (error) {
    logger.error('Service liveness check failed', { error: error.message });
    res.status(503).json({
      status: 'dead',
      service: SERVICE_NAME,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Metrics endpoint
app.get('/metrics', async (req, res) => {
  try {
    const healthChecker = getHealthChecker();
    const health = await healthChecker.checkHealth();
    
    res.status(200).json({
      service: SERVICE_NAME,
      version: '2.0.0',
      metrics: health.metrics,
      cache: await import('./cache/redis').then(m => m.CacheManager.getStats()),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Metrics collection failed', { error: error.message });
    res.status(500).json({
      error: 'Failed to collect metrics',
      timestamp: new Date().toISOString()
    });
  }
});

// API routes
app.use('/api/v1/parser', parserRoutes);

// Error handling
app.use(errorHandler);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: {
      message: 'Route not found',
      service: SERVICE_NAME,
      path: req.originalUrl,
      availableEndpoints: [
        'GET /health',
        'GET /ready',
        'POST /api/v1/parser/analyze',
        'POST /api/v1/parser/elements',
        'GET /api/v1/parser/status/:jobId'
      ]
    }
  });
});

async function startServer() {
  try {
    logger.info('Starting Design Parser service...', {
      service: SERVICE_NAME,
      port: PORT,
      environment: process.env.NODE_ENV || 'development',
      nodeVersion: process.version
    });

    // Initialize database connection
    const dbPool = await connectDatabase();
    logger.info('Database connected successfully');

    // Initialize Redis connection
    await connectRedis();
    logger.info('Redis connected successfully');

    // Initialize health checker
    initializeHealthChecker(dbPool);
    logger.info('Health checker initialized');

    // Start server
    const server = app.listen(PORT, () => {
      logger.info(`🚀 ${SERVICE_NAME} service running on port ${PORT}`, {
        service: SERVICE_NAME,
        port: PORT,
        environment: process.env.NODE_ENV || 'development',
        nodeVersion: process.version
      });
    });

    // Graceful shutdown handling
    const shutdownHandler = (signal: string) => {
      logger.info(`Received ${signal}, starting graceful shutdown...`);
      
      server.close(async (error) => {
        if (error) {
          logger.error('Error during server close', { error: error.message });
          process.exit(1);
        }
        
        try {
          // Close database connections
          await dbPool.end();
          logger.info('Database connections closed');
          
          // Close Redis connections
          const { disconnectRedis } = await import('./cache/redis');
          await disconnectRedis();
          logger.info('Redis connections closed');
          
          logger.info('Graceful shutdown completed');
          process.exit(0);
        } catch (shutdownError) {
          logger.error('Error during graceful shutdown', { 
            error: shutdownError.message 
          });
          process.exit(1);
        }
      });
    };

    // Register shutdown handlers
    process.on('SIGTERM', () => shutdownHandler('SIGTERM'));
    process.on('SIGINT', () => shutdownHandler('SIGINT'));
    process.on('SIGUSR2', () => shutdownHandler('SIGUSR2')); // nodemon restart

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception', {
        error: error.message,
        stack: error.stack
      });
      process.exit(1);
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Rejection', {
        reason: reason,
        promise: promise
      });
      process.exit(1);
    });

  } catch (error) {
    logger.error('Failed to start server', { 
      error: error.message,
      stack: error.stack,
      service: SERVICE_NAME 
    });
    process.exit(1);
  }
}

startServer();
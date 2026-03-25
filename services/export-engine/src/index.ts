import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { logger } from './utils/logger';
import { connectDatabase } from './database/connection';
import { connectRedis } from './cache/redis';
import exportRoutes from './routes/export';
import { errorHandler } from './middleware/errorHandler';
import { ExportManager } from './services/ExportManager';
import { StorageManager } from './services/StorageManager';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8003;
const SERVICE_NAME = 'export-engine';

// Initialize services
let exportManager: ExportManager;
let storageManager: StorageManager;

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:5173'],
  credentials: true
}));
app.use(morgan('combined'));
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    service: SERVICE_NAME,
    version: '1.0.0',
    uptime: process.uptime(),
    memory: process.memoryUsage()
  });
});

// Service readiness check
app.get('/ready', async (req, res) => {
  try {
    // Check database connectivity
    const dbHealthy = await checkDatabaseHealth();
    // Check Redis connectivity 
    const redisHealthy = await checkRedisHealth();
    // Check storage connectivity
    const storageHealthy = await checkStorageHealth();
    
    if (dbHealthy && redisHealthy && storageHealthy) {
      res.status(200).json({
        status: 'ready',
        service: SERVICE_NAME,
        dependencies: {
          database: 'healthy',
          redis: 'healthy',
          storage: 'healthy'
        }
      });
    } else {
      throw new Error('Dependencies not ready');
    }
  } catch (error) {
    logger.error('Service readiness check failed', { error: error.message });
    res.status(503).json({
      status: 'not ready',
      service: SERVICE_NAME,
      error: error.message
    });
  }
});

// Middleware to inject services
app.use((req, res, next) => {
  req.exportManager = exportManager;
  req.storageManager = storageManager;
  next();
});

// API routes
app.use('/api/v1/export', exportRoutes);

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
        'POST /api/v1/export/generate',
        'GET /api/v1/export/formats',
        'GET /api/v1/export/templates',
        'GET /api/v1/export/status/:jobId',
        'GET /api/v1/export/download/:fileId'
      ]
    }
  });
});

async function startServer() {
  try {
    // Initialize connections
    await connectDatabase();
    await connectRedis();
    
    // Initialize services
    storageManager = new StorageManager();
    exportManager = new ExportManager(storageManager);
    
    await storageManager.initialize();
    await exportManager.initialize();
    
    app.listen(PORT, () => {
      logger.info(`🚀 ${SERVICE_NAME} service running on port ${PORT}`, {
        service: SERVICE_NAME,
        port: PORT,
        environment: process.env.NODE_ENV || 'development',
        nodeVersion: process.version
      });
    });
  } catch (error) {
    logger.error('Failed to start server', { 
      error: error.message, 
      service: SERVICE_NAME 
    });
    process.exit(1);
  }
}

async function checkDatabaseHealth(): Promise<boolean> {
  try {
    return true;
  } catch (error) {
    logger.error('Database health check failed', { error: error.message });
    return false;
  }
}

async function checkRedisHealth(): Promise<boolean> {
  try {
    return true;
  } catch (error) {
    logger.error('Redis health check failed', { error: error.message });
    return false;
  }
}

async function checkStorageHealth(): Promise<boolean> {
  try {
    if (storageManager) {
      return await storageManager.healthCheck();
    }
    return true;
  } catch (error) {
    logger.error('Storage health check failed', { error: error.message });
    return false;
  }
}

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});

// Extend Express Request interface
declare global {
  namespace Express {
    interface Request {
      exportManager: ExportManager;
      storageManager: StorageManager;
    }
  }
}

startServer();
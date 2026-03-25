import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { logger } from './utils/logger';
import { connectDatabase, getDatabaseOperations } from './database/connection';
import { connectRedis, getRedisClient } from './cache/redis';
import translationRoutes from './routes/translation';
import { errorHandler } from './middleware/errorHandler';
import { TemplateManager } from './services/TemplateManager';
import { LLMManager } from './services/LLMManager';
import './types/express'; // Import type extensions

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8002;
const SERVICE_NAME = 'translation-engine';

// Initialize services
let templateManager: TemplateManager;
let llmManager: LLMManager;

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:5173'],
  credentials: true
}));
app.use(morgan('combined'));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

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
    // Check LLM API connectivity
    const llmHealthy = await checkLLMHealth();
    
    if (dbHealthy && redisHealthy && llmHealthy) {
      res.status(200).json({
        status: 'ready',
        service: SERVICE_NAME,
        dependencies: {
          database: 'healthy',
          redis: 'healthy',
          llm_apis: 'healthy'
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
  req.templateManager = templateManager;
  req.llmManager = llmManager;
  next();
});

// API routes
app.use('/api/v1', translationRoutes);

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
        'POST /api/v1/translate',
        'POST /api/v1/translate/batch',
        'GET /api/v1/templates',
        'POST /api/v1/templates',
        'GET /api/v1/jobs',
        'POST /api/v1/jobs',
        'GET /api/v1/providers',
        'GET /api/v1/analytics/usage'
      ]
    }
  });
});

async function startServer() {
  try {
    // Initialize connections
    await connectDatabase();
    await connectRedis();
    
    // Get clients
    const redisClient = getRedisClient();
    
    // Initialize services
    templateManager = new TemplateManager();
    llmManager = new LLMManager();
    
    await templateManager.initialize(redisClient);
    await llmManager.initialize(redisClient);
    
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
    const dbOps = getDatabaseOperations();
    return await dbOps.healthCheck();
  } catch (error) {
    logger.error('Database health check failed', { error: error.message });
    return false;
  }
}

async function checkRedisHealth(): Promise<boolean> {
  try {
    const redisClient = getRedisClient();
    await redisClient.ping();
    return true;
  } catch (error) {
    logger.error('Redis health check failed', { error: error.message });
    return false;
  }
}

async function checkLLMHealth(): Promise<boolean> {
  try {
    // Check LLM API connectivity
    if (llmManager) {
      return await llmManager.healthCheck();
    }
    return true;
  } catch (error) {
    logger.error('LLM health check failed', { error: error.message });
    return false;
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  await gracefulShutdown();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  await gracefulShutdown();
  process.exit(0);
});

// Graceful shutdown handlers
async function gracefulShutdown(): Promise<void> {
  logger.info('Graceful shutdown initiated...');
  
  try {
    if (llmManager) {
      await llmManager.shutdown();
    }
    if (templateManager) {
      await templateManager.shutdown();
    }
    
    // Close database connections would go here
    logger.info('Graceful shutdown completed');
  } catch (error) {
    logger.error('Error during graceful shutdown', { error: error.message });
  }
}

startServer();
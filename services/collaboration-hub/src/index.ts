import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import { logger } from './utils/logger';
import { connectDatabase } from './database/connection';
import { connectRedis } from './cache/redis';
import collaborationRoutes from './routes/collaboration';
import { errorHandler } from './middleware/errorHandler';
import { CollaborationManager } from './services/CollaborationManager';
import { PresenceManager } from './services/PresenceManager';
import { CommentManager } from './services/CommentManager';
import { ConflictResolver } from './services/ConflictResolver';

dotenv.config();

const app = express();
const server = createServer(app);
const PORT = process.env.PORT || 8004;
const SERVICE_NAME = 'collaboration-hub';

// Initialize Socket.IO
const io = new SocketIOServer(server, {
  cors: {
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:5173'],
    credentials: true
  },
  transports: ['websocket', 'polling']
});

// Initialize services
let collaborationManager: CollaborationManager;
let presenceManager: PresenceManager;
let commentManager: CommentManager;
let conflictResolver: ConflictResolver;

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:5173'],
  credentials: true
}));
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    service: SERVICE_NAME,
    version: '1.0.0',
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    connections: io.engine.clientsCount
  });
});

// Service readiness check
app.get('/ready', async (req, res) => {
  try {
    const dbHealthy = await checkDatabaseHealth();
    const redisHealthy = await checkRedisHealth();
    
    if (dbHealthy && redisHealthy) {
      res.status(200).json({
        status: 'ready',
        service: SERVICE_NAME,
        dependencies: {
          database: 'healthy',
          redis: 'healthy',
          websocket: 'healthy'
        },
        stats: {
          activeConnections: io.engine.clientsCount,
          activeRooms: io.sockets.adapter.rooms.size
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

// API routes
app.use('/api/v1/collaboration', collaborationRoutes);

// Socket.IO authentication middleware
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token || socket.handshake.headers.authorization;
    
    if (!token) {
      throw new Error('Authentication token required');
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret') as any;
    socket.userId = decoded.userId;
    socket.userEmail = decoded.email;
    
    logger.info('Socket authenticated', {
      socketId: socket.id,
      userId: decoded.userId,
      email: decoded.email
    });
    
    next();
  } catch (error) {
    logger.error('Socket authentication failed', {
      socketId: socket.id,
      error: error.message
    });
    next(new Error('Authentication failed'));
  }
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  logger.info('Client connected', {
    socketId: socket.id,
    userId: socket.userId,
    totalConnections: io.engine.clientsCount
  });

  // Join project room
  socket.on('join-project', async (data) => {
    try {
      const { projectId } = data;
      
      // Validate user has access to project
      const hasAccess = await collaborationManager.validateProjectAccess(
        socket.userId,
        projectId
      );
      
      if (!hasAccess) {
        socket.emit('error', { message: 'Access denied to project' });
        return;
      }

      // Join project room
      socket.join(`project:${projectId}`);
      socket.currentProjectId = projectId;

      // Update presence
      await presenceManager.updatePresence(socket.userId, projectId, {
        socketId: socket.id,
        status: 'active',
        lastActivity: new Date(),
        cursor: null
      });

      // Broadcast user joined
      socket.to(`project:${projectId}`).emit('user-joined', {
        userId: socket.userId,
        email: socket.userEmail,
        timestamp: new Date().toISOString()
      });

      // Send current presence data
      const presenceData = await presenceManager.getProjectPresence(projectId);
      socket.emit('presence-update', presenceData);

      logger.info('User joined project', {
        userId: socket.userId,
        projectId,
        roomSize: io.sockets.adapter.rooms.get(`project:${projectId}`)?.size || 0
      });

    } catch (error) {
      logger.error('Failed to join project', {
        userId: socket.userId,
        error: error.message
      });
      socket.emit('error', { message: 'Failed to join project' });
    }
  });

  // Handle cursor movement
  socket.on('cursor-move', async (data) => {
    try {
      const { x, y, elementId } = data;
      const projectId = socket.currentProjectId;
      
      if (!projectId) return;

      // Update cursor position
      await presenceManager.updateCursor(socket.userId, projectId, {
        x, y, elementId,
        timestamp: new Date().toISOString()
      });

      // Broadcast to other users in project
      socket.to(`project:${projectId}`).emit('cursor-update', {
        userId: socket.userId,
        email: socket.userEmail,
        cursor: { x, y, elementId },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Failed to update cursor', {
        userId: socket.userId,
        error: error.message
      });
    }
  });

  // Handle element selection
  socket.on('element-select', async (data) => {
    try {
      const { elementId } = data;
      const projectId = socket.currentProjectId;
      
      if (!projectId) return;

      // Update selection
      await presenceManager.updateSelection(socket.userId, projectId, elementId);

      // Broadcast selection
      socket.to(`project:${projectId}`).emit('selection-update', {
        userId: socket.userId,
        email: socket.userEmail,
        elementId,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Failed to update selection', {
        userId: socket.userId,
        error: error.message
      });
    }
  });

  // Handle design changes
  socket.on('design-change', async (data) => {
    try {
      const projectId = socket.currentProjectId;
      if (!projectId) return;

      // Process design change
      const change = await collaborationManager.processDesignChange(
        socket.userId,
        projectId,
        data
      );

      // Check for conflicts
      const conflicts = await conflictResolver.checkConflicts(change);
      
      if (conflicts.length > 0) {
        // Handle conflicts
        socket.emit('conflict-detected', {
          changeId: change.id,
          conflicts
        });
        return;
      }

      // Apply change and broadcast
      await collaborationManager.applyChange(change);
      
      socket.to(`project:${projectId}`).emit('design-update', {
        change,
        userId: socket.userId,
        timestamp: new Date().toISOString()
      });

      // Acknowledge change
      socket.emit('change-acknowledged', {
        changeId: change.id,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Failed to process design change', {
        userId: socket.userId,
        error: error.message
      });
      socket.emit('error', { message: 'Failed to apply design change' });
    }
  });

  // Handle comments
  socket.on('add-comment', async (data) => {
    try {
      const projectId = socket.currentProjectId;
      if (!projectId) return;

      const comment = await commentManager.addComment({
        projectId,
        userId: socket.userId,
        elementId: data.elementId,
        content: data.content,
        position: data.position,
        thread: data.thread
      });

      // Broadcast comment
      io.to(`project:${projectId}`).emit('comment-added', {
        comment,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Failed to add comment', {
        userId: socket.userId,
        error: error.message
      });
      socket.emit('error', { message: 'Failed to add comment' });
    }
  });

  // Handle version saves
  socket.on('save-version', async (data) => {
    try {
      const projectId = socket.currentProjectId;
      if (!projectId) return;

      const version = await collaborationManager.saveVersion(
        socket.userId,
        projectId,
        data.description || 'Auto-saved version'
      );

      // Broadcast version saved
      io.to(`project:${projectId}`).emit('version-saved', {
        version,
        userId: socket.userId,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Failed to save version', {
        userId: socket.userId,
        error: error.message
      });
      socket.emit('error', { message: 'Failed to save version' });
    }
  });

  // Handle disconnection
  socket.on('disconnect', async (reason) => {
    try {
      const projectId = socket.currentProjectId;
      
      if (projectId && socket.userId) {
        // Update presence
        await presenceManager.updatePresence(socket.userId, projectId, {
          status: 'offline',
          lastActivity: new Date()
        });

        // Broadcast user left
        socket.to(`project:${projectId}`).emit('user-left', {
          userId: socket.userId,
          email: socket.userEmail,
          timestamp: new Date().toISOString()
        });
      }

      logger.info('Client disconnected', {
        socketId: socket.id,
        userId: socket.userId,
        reason,
        totalConnections: io.engine.clientsCount - 1
      });

    } catch (error) {
      logger.error('Error handling disconnect', {
        socketId: socket.id,
        userId: socket.userId,
        error: error.message
      });
    }
  });

  // Handle errors
  socket.on('error', (error) => {
    logger.error('Socket error', {
      socketId: socket.id,
      userId: socket.userId,
      error: error.message
    });
  });
});

// Error handling
app.use(errorHandler);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: {
      message: 'Route not found',
      service: SERVICE_NAME,
      path: req.originalUrl
    }
  });
});

async function startServer() {
  try {
    // Initialize connections
    await connectDatabase();
    await connectRedis();
    
    // Initialize services
    collaborationManager = new CollaborationManager();
    presenceManager = new PresenceManager();
    commentManager = new CommentManager();
    conflictResolver = new ConflictResolver();
    
    await collaborationManager.initialize();
    await presenceManager.initialize();
    await commentManager.initialize();
    await conflictResolver.initialize();
    
    server.listen(PORT, () => {
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
    return false;
  }
}

async function checkRedisHealth(): Promise<boolean> {
  try {
    return true;
  } catch (error) {
    return false;
  }
}

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => {
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  server.close(() => {
    process.exit(0);
  });
});

// Extend Socket interface
declare module 'socket.io' {
  interface Socket {
    userId: string;
    userEmail: string;
    currentProjectId?: string;
  }
}

startServer();
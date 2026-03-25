import express from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

const router = express.Router();

/**
 * GET /api/v1/collaboration/presence/:projectId
 * Get presence data for a project
 */
router.get('/presence/:projectId',
  asyncHandler(async (req: express.Request, res: express.Response) => {
    const { projectId } = req.params;
    
    logger.info('Presence request', { projectId });
    
    // Mock presence data for now
    res.json({
      projectId,
      activeUsers: [],
      cursors: {},
      selections: {}
    });
  })
);

export default router;
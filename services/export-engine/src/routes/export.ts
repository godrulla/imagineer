import express from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

const router = express.Router();

/**
 * POST /api/v1/export/generate
 * Generate export in specified format
 */
router.post('/generate',
  asyncHandler(async (req: express.Request, res: express.Response) => {
    const { designData, format = 'markdown', options = {} } = req.body;
    
    logger.info('Export request received', {
      format,
      options,
      ip: req.ip
    });

    const exportManager = req.exportManager;
    
    const result = await exportManager.generateExport({
      designData,
      format,
      options
    });

    logger.info('Export completed', {
      format,
      size: result.metadata.size,
      processingTime: result.metadata.processingTime
    });

    res.json(result);
  })
);

/**
 * GET /api/v1/export/formats
 * Get supported export formats
 */
router.get('/formats', (req, res) => {
  const formats = [
    'markdown', 'json', 'yaml', 'html', 'css', 
    'jsx', 'vue', 'angular', 'pdf', 'zip', 'custom'
  ];
  
  res.json({ formats });
});

export default router;
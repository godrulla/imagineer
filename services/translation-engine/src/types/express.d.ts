import { LLMManager } from '../services/LLMManager';
import { TemplateManager } from '../services/TemplateManager';

declare global {
  namespace Express {
    interface Request {
      llmManager: LLMManager;
      templateManager: TemplateManager;
      organizationId?: string;
      userId?: string;
    }
  }
}

export {};
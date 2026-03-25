import { logger } from '../utils/logger';
import { LLMManager, LLMProvider, LLMResponse, TranslationRequest, PromptTemplate } from './LLMManager';
import { TemplateManager } from './TemplateManager';
import { getDatabaseOperations } from '../database/connection';
import { RedisClient } from '../cache/redis';
import { v4 as uuidv4 } from 'uuid';

export interface ABTestVariant {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  userPromptTemplate: string;
  parameters: {
    temperature?: number;
    topP?: number;
    maxTokens?: number;
    frequencyPenalty?: number;
    presencePenalty?: number;
  };
  weight: number; // For traffic allocation (0-1)
  isControl: boolean;
  metadata: {
    hypothesis: string;
    expectedImprovement: string;
    createdBy: string;
    created: Date;
  };
}

export interface ABTest {
  id: string;
  name: string;
  description: string;
  organizationId: string;
  templateId?: string;
  variants: ABTestVariant[];
  trafficAllocation: number; // Percentage of traffic to include in test (0-100)
  status: 'draft' | 'running' | 'paused' | 'completed' | 'cancelled';
  startDate?: Date;
  endDate?: Date;
  targetSampleSize: number;
  confidenceLevel: number; // 0.90, 0.95, 0.99
  metrics: {
    primary: string; // 'quality_score' | 'user_rating' | 'completion_rate' | 'response_time'
    secondary: string[];
  };
  currentResults?: ABTestResults;
  winner?: string; // Variant ID
  created: Date;
  updated: Date;
  createdBy: string;
}

export interface ABTestResults {
  sampleSizes: Record<string, number>; // variant_id -> sample count
  metrics: Record<string, {
    mean: number;
    standardDeviation: number;
    confidenceInterval: [number, number];
    conversions?: number;
    conversionRate?: number;
  }>;
  significance: Record<string, { // variant_id vs control
    pValue: number;
    isSignificant: boolean;
    effect: number; // percentage improvement
  }>;
  powerAnalysis: {
    currentPower: number;
    requiredSampleSize: number;
    progressPercentage: number;
  };
  lastUpdated: Date;
}

export interface OptimizationRequest {
  templateId?: string;
  llmProvider: LLMProvider;
  inputData: any;
  contextData?: any;
  currentPrompt?: {
    system: string;
    user: string;
  };
  optimizationGoals: {
    primary: 'quality' | 'speed' | 'cost' | 'accuracy' | 'creativity';
    secondary?: string[];
  };
  constraints: {
    maxTokens?: number;
    maxCost?: number;
    maxResponseTime?: number;
    minQualityScore?: number;
  };
  iterations?: number;
}

export interface OptimizationResult {
  originalScore: number;
  optimizedScore: number;
  improvement: number;
  optimizedPrompt: {
    system: string;
    user: string;
    parameters: any;
  };
  iterations: {
    iteration: number;
    score: number;
    changes: string[];
    prompt: any;
  }[];
  confidence: number;
  recommendations: string[];
}

export interface QualityMetrics {
  accuracy: number;        // How well it matches expected output
  completeness: number;    // How complete the response is
  relevance: number;       // How relevant to the input
  clarity: number;         // How clear and understandable
  consistency: number;     // How consistent across similar inputs
  creativity: number;      // How creative/novel the response is
  efficiency: number;      // Tokens used vs output quality
  safety: number;          // Content safety score
  overall: number;         // Weighted average
}

export interface ValidationResult {
  isValid: boolean;
  score: number;
  metrics: QualityMetrics;
  issues: {
    type: 'error' | 'warning' | 'suggestion';
    message: string;
    severity: 'low' | 'medium' | 'high';
    category: string;
  }[];
  suggestions: string[];
  executionTime: number;
}

export class OptimizationManager {
  private llmManager: LLMManager;
  private templateManager: TemplateManager;
  private redis: RedisClient | null = null;
  private abTests: Map<string, ABTest> = new Map();
  private activeOptimizations: Map<string, any> = new Map();

  constructor(llmManager: LLMManager, templateManager: TemplateManager) {
    this.llmManager = llmManager;
    this.templateManager = templateManager;
  }

  async initialize(redisClient?: RedisClient): Promise<void> {
    try {
      this.redis = redisClient || null;
      
      // Load active A/B tests from database
      await this.loadActiveABTests();
      
      logger.info('Optimization Manager initialized successfully', {
        activeABTests: this.abTests.size
      });

    } catch (error) {
      logger.error('Failed to initialize Optimization Manager', { error: error.message });
      throw error;
    }
  }

  // ============================================================================
  // A/B TESTING
  // ============================================================================

  async createABTest(testData: Partial<ABTest>, createdBy: string): Promise<ABTest> {
    try {
      const test: ABTest = {
        id: uuidv4(),
        name: testData.name || 'Untitled A/B Test',
        description: testData.description || '',
        organizationId: testData.organizationId || 'default',
        templateId: testData.templateId,
        variants: testData.variants || [],
        trafficAllocation: testData.trafficAllocation || 50,
        status: 'draft',
        targetSampleSize: testData.targetSampleSize || 100,
        confidenceLevel: testData.confidenceLevel || 0.95,
        metrics: testData.metrics || {
          primary: 'quality_score',
          secondary: ['response_time', 'user_rating']
        },
        created: new Date(),
        updated: new Date(),
        createdBy
      };

      // Validate test configuration
      this.validateABTest(test);

      // Store in memory and database
      this.abTests.set(test.id, test);
      await this.persistABTest(test);

      logger.info('A/B test created successfully', {
        testId: test.id,
        name: test.name,
        variants: test.variants.length
      });

      return test;

    } catch (error) {
      logger.error('Failed to create A/B test', { error: error.message });
      throw error;
    }
  }

  async startABTest(testId: string): Promise<void> {
    const test = this.abTests.get(testId);
    if (!test) {
      throw new Error('A/B test not found');
    }

    if (test.status !== 'draft') {
      throw new Error('Only draft tests can be started');
    }

    // Validate test is ready to start
    this.validateTestReadyToStart(test);

    test.status = 'running';
    test.startDate = new Date();
    test.updated = new Date();

    await this.persistABTest(test);

    logger.info('A/B test started', { testId, name: test.name });
  }

  async stopABTest(testId: string, reason: 'completed' | 'cancelled' = 'completed'): Promise<void> {
    const test = this.abTests.get(testId);
    if (!test) {
      throw new Error('A/B test not found');
    }

    test.status = reason;
    test.endDate = new Date();
    test.updated = new Date();

    // Determine winner if completed
    if (reason === 'completed' && test.currentResults) {
      test.winner = this.determineWinner(test);
    }

    await this.persistABTest(test);

    logger.info('A/B test stopped', { testId, reason, winner: test.winner });
  }

  async allocateVariant(testId: string, userId?: string): Promise<ABTestVariant | null> {
    const test = this.abTests.get(testId);
    if (!test || test.status !== 'running') {
      return null;
    }

    // Check if user should be included in test
    if (!this.shouldIncludeInTest(test, userId)) {
      return null;
    }

    // Weighted random allocation
    const random = Math.random();
    let cumulativeWeight = 0;

    for (const variant of test.variants) {
      cumulativeWeight += variant.weight;
      if (random <= cumulativeWeight) {
        return variant;
      }
    }

    // Fallback to control variant
    return test.variants.find(v => v.isControl) || test.variants[0];
  }

  async recordABTestResult(
    testId: string, 
    variantId: string, 
    metrics: Partial<QualityMetrics>, 
    metadata?: any
  ): Promise<void> {
    const test = this.abTests.get(testId);
    if (!test || test.status !== 'running') {
      return;
    }

    try {
      // Store result in database
      const dbOps = getDatabaseOperations();
      
      // This would be implemented to store individual test results
      // await dbOps.recordABTestResult(testId, variantId, metrics, metadata);

      // Update test results
      await this.updateABTestResults(testId);

    } catch (error) {
      logger.error('Failed to record A/B test result', { testId, variantId, error: error.message });
    }
  }

  async getABTestResults(testId: string): Promise<ABTestResults | null> {
    const test = this.abTests.get(testId);
    if (!test) {
      return null;
    }

    return test.currentResults || null;
  }

  // ============================================================================
  // PROMPT OPTIMIZATION
  // ============================================================================

  async optimizePrompt(request: OptimizationRequest): Promise<OptimizationResult> {
    const optimizationId = uuidv4();
    
    try {
      logger.info('Starting prompt optimization', { optimizationId, goal: request.optimizationGoals.primary });

      this.activeOptimizations.set(optimizationId, {
        status: 'running',
        startTime: Date.now(),
        request
      });

      const iterations: any[] = [];
      let currentPrompt = request.currentPrompt;
      let bestScore = 0;
      let bestPrompt = currentPrompt;

      // Get baseline score
      if (currentPrompt) {
        const baselineResult = await this.evaluatePrompt(currentPrompt, request);
        bestScore = baselineResult.score;
        iterations.push({
          iteration: 0,
          score: bestScore,
          changes: ['baseline'],
          prompt: currentPrompt
        });
      }

      const maxIterations = request.iterations || 5;

      for (let i = 1; i <= maxIterations; i++) {
        // Generate optimization variants
        const variants = await this.generateOptimizationVariants(
          currentPrompt || bestPrompt,
          request,
          i
        );

        let iterationBestScore = bestScore;
        let iterationBestPrompt = bestPrompt;
        const changes: string[] = [];

        // Test each variant
        for (const variant of variants) {
          const result = await this.evaluatePrompt(variant.prompt, request);
          
          if (result.score > iterationBestScore) {
            iterationBestScore = result.score;
            iterationBestPrompt = variant.prompt;
            changes.push(...variant.changes);
          }
        }

        iterations.push({
          iteration: i,
          score: iterationBestScore,
          changes: changes.length > 0 ? changes : ['no improvement'],
          prompt: iterationBestPrompt
        });

        // Update best if improved
        if (iterationBestScore > bestScore) {
          bestScore = iterationBestScore;
          bestPrompt = iterationBestPrompt;
          currentPrompt = iterationBestPrompt;
        } else {
          // No improvement - apply different strategy
          currentPrompt = await this.applyAlternativeStrategy(bestPrompt, request);
        }
      }

      const result: OptimizationResult = {
        originalScore: iterations[0]?.score || 0,
        optimizedScore: bestScore,
        improvement: bestScore - (iterations[0]?.score || 0),
        optimizedPrompt: {
          system: bestPrompt?.system || '',
          user: bestPrompt?.user || '',
          parameters: this.getOptimizedParameters(request)
        },
        iterations,
        confidence: this.calculateOptimizationConfidence(iterations),
        recommendations: this.generateOptimizationRecommendations(iterations, request)
      };

      this.activeOptimizations.delete(optimizationId);

      logger.info('Prompt optimization completed', {
        optimizationId,
        improvement: result.improvement,
        iterations: iterations.length
      });

      return result;

    } catch (error) {
      this.activeOptimizations.delete(optimizationId);
      logger.error('Prompt optimization failed', { optimizationId, error: error.message });
      throw error;
    }
  }

  // ============================================================================
  // QUALITY VALIDATION
  // ============================================================================

  async validatePromptQuality(
    prompt: { system: string; user: string },
    inputData: any,
    provider: LLMProvider,
    expectedOutput?: string
  ): Promise<ValidationResult> {
    const startTime = Date.now();

    try {
      // Generate response using the prompt
      const translationRequest: TranslationRequest = {
        designData: inputData,
        targetLLM: provider,
        format: 'markdown',
        translationType: 'full',
        systemPrompt: prompt.system,
        userPrompt: prompt.user
      };

      const response = await this.llmManager.generateTranslation(translationRequest);

      // Calculate quality metrics
      const metrics = await this.calculateQualityMetrics(
        response,
        inputData,
        expectedOutput
      );

      // Identify issues and suggestions
      const issues = this.identifyQualityIssues(response, metrics);
      const suggestions = this.generateQualitySuggestions(metrics, issues);

      const result: ValidationResult = {
        isValid: metrics.overall >= 0.7, // 70% threshold
        score: metrics.overall,
        metrics,
        issues,
        suggestions,
        executionTime: Date.now() - startTime
      };

      return result;

    } catch (error) {
      logger.error('Quality validation failed', { error: error.message });
      
      return {
        isValid: false,
        score: 0,
        metrics: this.getDefaultMetrics(),
        issues: [{
          type: 'error',
          message: `Validation failed: ${error.message}`,
          severity: 'high',
          category: 'execution'
        }],
        suggestions: ['Fix the execution error and try again'],
        executionTime: Date.now() - startTime
      };
    }
  }

  async batchValidatePrompts(
    prompts: Array<{ id: string; prompt: { system: string; user: string } }>,
    inputData: any,
    provider: LLMProvider
  ): Promise<Record<string, ValidationResult>> {
    const results: Record<string, ValidationResult> = {};

    // Process in parallel with concurrency limit
    const BATCH_SIZE = 3;
    for (let i = 0; i < prompts.length; i += BATCH_SIZE) {
      const batch = prompts.slice(i, i + BATCH_SIZE);
      
      const batchPromises = batch.map(async ({ id, prompt }) => {
        const result = await this.validatePromptQuality(prompt, inputData, provider);
        return { id, result };
      });

      const batchResults = await Promise.all(batchPromises);
      
      for (const { id, result } of batchResults) {
        results[id] = result;
      }
    }

    return results;
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  private async loadActiveABTests(): Promise<void> {
    try {
      // In production, this would load from database
      logger.info('Loading active A/B tests from database');
    } catch (error) {
      logger.error('Failed to load A/B tests', { error: error.message });
    }
  }

  private validateABTest(test: ABTest): void {
    if (test.variants.length < 2) {
      throw new Error('A/B test must have at least 2 variants');
    }

    const controlVariants = test.variants.filter(v => v.isControl);
    if (controlVariants.length !== 1) {
      throw new Error('A/B test must have exactly one control variant');
    }

    const totalWeight = test.variants.reduce((sum, v) => sum + v.weight, 0);
    if (Math.abs(totalWeight - 1.0) > 0.01) {
      throw new Error('Variant weights must sum to 1.0');
    }
  }

  private validateTestReadyToStart(test: ABTest): void {
    if (!test.variants.length) {
      throw new Error('Test must have variants to start');
    }

    if (!test.metrics.primary) {
      throw new Error('Test must have a primary metric defined');
    }
  }

  private shouldIncludeInTest(test: ABTest, userId?: string): boolean {
    // Simple percentage-based allocation
    const hash = userId ? this.hashUserId(userId) : Math.random();
    return hash * 100 < test.trafficAllocation;
  }

  private hashUserId(userId: string): number {
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      const char = userId.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash) / Math.pow(2, 31);
  }

  private determineWinner(test: ABTest): string | undefined {
    if (!test.currentResults) return undefined;

    const control = test.variants.find(v => v.isControl);
    if (!control) return undefined;

    let bestVariant = control;
    let bestScore = 0;

    for (const variant of test.variants) {
      const significance = test.currentResults.significance[variant.id];
      const metrics = test.currentResults.metrics[variant.id];
      
      if (significance && significance.isSignificant && significance.effect > 0) {
        if (metrics.mean > bestScore) {
          bestScore = metrics.mean;
          bestVariant = variant;
        }
      }
    }

    return bestVariant.id;
  }

  private async updateABTestResults(testId: string): Promise<void> {
    // This would query the database for latest results and calculate statistics
    // Implementation would involve statistical analysis of the collected data
    logger.debug('Updating A/B test results', { testId });
  }

  private async persistABTest(test: ABTest): Promise<void> {
    try {
      // Store in Redis for fast access
      if (this.redis) {
        await this.redis.setex(
          `abtest:${test.id}`,
          86400, // 24 hours
          JSON.stringify(test)
        );
      }

      // Store in database for persistence
      // await dbOps.persistABTest(test);

    } catch (error) {
      logger.error('Failed to persist A/B test', { testId: test.id, error: error.message });
    }
  }

  private async evaluatePrompt(
    prompt: { system: string; user: string },
    request: OptimizationRequest
  ): Promise<{ score: number; metrics: QualityMetrics }> {
    try {
      const translationRequest: TranslationRequest = {
        designData: request.inputData,
        targetLLM: request.llmProvider,
        format: 'markdown',
        translationType: 'full',
        systemPrompt: prompt.system,
        userPrompt: prompt.user
      };

      const response = await this.llmManager.generateTranslation(translationRequest);
      const metrics = await this.calculateQualityMetrics(response, request.inputData);

      // Calculate weighted score based on optimization goals
      const score = this.calculateOptimizationScore(metrics, request.optimizationGoals, response);

      return { score, metrics };

    } catch (error) {
      logger.error('Failed to evaluate prompt', { error: error.message });
      return { score: 0, metrics: this.getDefaultMetrics() };
    }
  }

  private async generateOptimizationVariants(
    basePrompt: { system: string; user: string },
    request: OptimizationRequest,
    iteration: number
  ): Promise<Array<{ prompt: { system: string; user: string }; changes: string[] }>> {
    const variants = [];

    // Strategy 1: Improve clarity and specificity
    if (iteration <= 2) {
      variants.push({
        prompt: {
          system: this.improveClarity(basePrompt.system),
          user: this.improveSpecificity(basePrompt.user)
        },
        changes: ['improved_clarity', 'added_specificity']
      });
    }

    // Strategy 2: Optimize for target goal
    if (request.optimizationGoals.primary === 'quality') {
      variants.push({
        prompt: {
          system: this.optimizeForQuality(basePrompt.system),
          user: this.addQualityInstructions(basePrompt.user)
        },
        changes: ['quality_optimization', 'detailed_instructions']
      });
    }

    // Strategy 3: Reduce token usage while maintaining quality
    if (request.optimizationGoals.primary === 'cost' || request.constraints.maxCost) {
      variants.push({
        prompt: {
          system: this.compressPrompt(basePrompt.system),
          user: this.compressPrompt(basePrompt.user)
        },
        changes: ['token_optimization', 'compression']
      });
    }

    return variants;
  }

  private async applyAlternativeStrategy(
    prompt: { system: string; user: string },
    request: OptimizationRequest
  ): Promise<{ system: string; user: string }> {
    // Apply a different optimization strategy when stuck
    return {
      system: this.addContext(prompt.system, request),
      user: this.restructurePrompt(prompt.user)
    };
  }

  private async calculateQualityMetrics(
    response: LLMResponse,
    inputData: any,
    expectedOutput?: string
  ): Promise<QualityMetrics> {
    // This would implement sophisticated quality measurement
    // For now, providing a simplified implementation
    
    const content = response.content;
    const contentLength = content.length;
    const hasStructure = content.includes('#') || content.includes('##');
    const hasCodeBlocks = content.includes('```');
    
    const metrics: QualityMetrics = {
      accuracy: expectedOutput ? this.calculateSimilarity(content, expectedOutput) : 0.8,
      completeness: Math.min(contentLength / 1000, 1.0), // Simple length-based metric
      relevance: this.calculateRelevance(content, inputData),
      clarity: hasStructure ? 0.9 : 0.7,
      consistency: 0.85, // Would need multiple samples to calculate
      creativity: this.calculateCreativity(content),
      efficiency: Math.min(response.usage.totalTokens / 2000, 1.0),
      safety: response.metadata.contentSafety ? 0.95 : 0.9,
      overall: 0
    };

    // Calculate weighted overall score
    metrics.overall = (
      metrics.accuracy * 0.25 +
      metrics.completeness * 0.15 +
      metrics.relevance * 0.20 +
      metrics.clarity * 0.15 +
      metrics.consistency * 0.10 +
      metrics.creativity * 0.05 +
      metrics.efficiency * 0.05 +
      metrics.safety * 0.05
    );

    return metrics;
  }

  private calculateOptimizationScore(
    metrics: QualityMetrics,
    goals: OptimizationRequest['optimizationGoals'],
    response: LLMResponse
  ): number {
    const weights = {
      quality: { accuracy: 0.3, completeness: 0.2, relevance: 0.2, clarity: 0.2, consistency: 0.1 },
      speed: { efficiency: 0.5, clarity: 0.3, completeness: 0.2 },
      cost: { efficiency: 0.6, completeness: 0.4 },
      accuracy: { accuracy: 0.5, relevance: 0.3, consistency: 0.2 },
      creativity: { creativity: 0.4, quality: 0.3, clarity: 0.3 }
    };

    const goalWeights = weights[goals.primary] || weights.quality;
    
    let score = 0;
    for (const [metric, weight] of Object.entries(goalWeights)) {
      score += (metrics[metric] || 0) * weight;
    }

    // Apply response time penalty for speed optimization
    if (goals.primary === 'speed') {
      const timePenalty = Math.max(0, (response.responseTime - 2000) / 10000);
      score = Math.max(0, score - timePenalty);
    }

    return score;
  }

  private identifyQualityIssues(response: LLMResponse, metrics: QualityMetrics): ValidationResult['issues'] {
    const issues: ValidationResult['issues'] = [];

    if (metrics.accuracy < 0.6) {
      issues.push({
        type: 'warning',
        message: 'Low accuracy score indicates the response may not match expected output',
        severity: 'high',
        category: 'accuracy'
      });
    }

    if (metrics.completeness < 0.5) {
      issues.push({
        type: 'warning',
        message: 'Response appears incomplete or too brief',
        severity: 'medium',
        category: 'completeness'
      });
    }

    if (metrics.clarity < 0.6) {
      issues.push({
        type: 'suggestion',
        message: 'Response could be clearer with better structure',
        severity: 'medium',
        category: 'clarity'
      });
    }

    if (response.usage.totalTokens > 4000) {
      issues.push({
        type: 'warning',
        message: 'High token usage may impact cost efficiency',
        severity: 'low',
        category: 'efficiency'
      });
    }

    return issues;
  }

  private generateQualitySuggestions(metrics: QualityMetrics, issues: ValidationResult['issues']): string[] {
    const suggestions: string[] = [];

    if (metrics.accuracy < 0.7) {
      suggestions.push('Consider providing more specific instructions or examples in the prompt');
    }

    if (metrics.clarity < 0.7) {
      suggestions.push('Add structure to the prompt with clear sections and numbering');
    }

    if (metrics.efficiency < 0.7) {
      suggestions.push('Optimize prompt length to reduce token usage while maintaining quality');
    }

    if (issues.some(i => i.category === 'completeness')) {
      suggestions.push('Increase max_tokens parameter or adjust prompt to encourage more complete responses');
    }

    return suggestions;
  }

  // Helper methods for prompt modification
  private improveClarity(prompt: string): string {
    // Add structure and clear instructions
    if (!prompt.includes('##')) {
      return `## Task Overview\n${prompt}\n\n## Instructions\nPlease provide a clear, structured response.`;
    }
    return prompt;
  }

  private improveSpecificity(prompt: string): string {
    // Add specific requirements and examples
    return prompt + '\n\nPlease be specific and include detailed explanations.';
  }

  private optimizeForQuality(prompt: string): string {
    return prompt + '\n\nFocus on accuracy, completeness, and clarity in your response.';
  }

  private addQualityInstructions(prompt: string): string {
    return prompt + '\n\nEnsure your response is:\n1. Accurate and factual\n2. Complete and comprehensive\n3. Well-structured and clear';
  }

  private compressPrompt(prompt: string): string {
    return prompt
      .replace(/\s+/g, ' ')
      .replace(/\n\s*\n/g, '\n')
      .trim();
  }

  private addContext(prompt: string, request: OptimizationRequest): string {
    if (request.contextData) {
      return `Context: ${JSON.stringify(request.contextData)}\n\n${prompt}`;
    }
    return prompt;
  }

  private restructurePrompt(prompt: string): string {
    // Simple restructuring by adding numbered steps
    const sentences = prompt.split('. ');
    return sentences.map((s, i) => `${i + 1}. ${s.trim()}`).join('\n');
  }

  private calculateSimilarity(text1: string, text2: string): number {
    // Simple Jaccard similarity
    const words1 = new Set(text1.toLowerCase().split(/\s+/));
    const words2 = new Set(text2.toLowerCase().split(/\s+/));
    
    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);
    
    return intersection.size / union.size;
  }

  private calculateRelevance(content: string, inputData: any): number {
    // Simple relevance calculation based on keyword overlap
    const inputText = JSON.stringify(inputData).toLowerCase();
    const contentText = content.toLowerCase();
    
    const inputWords = new Set(inputText.split(/\s+/));
    const contentWords = new Set(contentText.split(/\s+/));
    
    const overlap = [...inputWords].filter(word => contentWords.has(word)).length;
    
    return Math.min(overlap / inputWords.size, 1.0);
  }

  private calculateCreativity(content: string): number {
    // Simple creativity metric based on vocabulary diversity
    const words = content.toLowerCase().split(/\s+/);
    const uniqueWords = new Set(words);
    
    return Math.min(uniqueWords.size / words.length, 1.0);
  }

  private calculateOptimizationConfidence(iterations: any[]): number {
    if (iterations.length < 2) return 0.5;
    
    const improvements = iterations.slice(1).map((iter, i) => 
      iter.score - iterations[i].score
    );
    
    const positiveImprovements = improvements.filter(imp => imp > 0).length;
    return positiveImprovements / improvements.length;
  }

  private generateOptimizationRecommendations(iterations: any[], request: OptimizationRequest): string[] {
    const recommendations: string[] = [];
    
    const finalScore = iterations[iterations.length - 1]?.score || 0;
    const initialScore = iterations[0]?.score || 0;
    
    if (finalScore > initialScore) {
      recommendations.push('Optimization was successful. Consider applying similar changes to other prompts.');
    } else {
      recommendations.push('Limited improvement achieved. Consider trying different optimization strategies.');
    }
    
    if (request.optimizationGoals.primary === 'cost') {
      recommendations.push('Focus on reducing prompt length while maintaining output quality.');
    }
    
    if (request.optimizationGoals.primary === 'quality') {
      recommendations.push('Add more specific examples and detailed instructions to improve quality.');
    }
    
    return recommendations;
  }

  private getOptimizedParameters(request: OptimizationRequest): any {
    const baseParams = {
      temperature: 0.7,
      topP: 1.0,
      maxTokens: 2000
    };

    if (request.optimizationGoals.primary === 'creativity') {
      baseParams.temperature = 0.9;
    } else if (request.optimizationGoals.primary === 'accuracy') {
      baseParams.temperature = 0.3;
    }

    if (request.constraints.maxTokens) {
      baseParams.maxTokens = Math.min(baseParams.maxTokens, request.constraints.maxTokens);
    }

    return baseParams;
  }

  private getDefaultMetrics(): QualityMetrics {
    return {
      accuracy: 0,
      completeness: 0,
      relevance: 0,
      clarity: 0,
      consistency: 0,
      creativity: 0,
      efficiency: 0,
      safety: 0,
      overall: 0
    };
  }

  // Public API methods
  getActiveABTests(): ABTest[] {
    return Array.from(this.abTests.values()).filter(test => test.status === 'running');
  }

  getOptimizationStatus(): { active: number; completed: number } {
    return {
      active: this.activeOptimizations.size,
      completed: 0 // Would track in database
    };
  }

  async shutdown(): Promise<void> {
    logger.info('Shutting down Optimization Manager...');
    
    // Clear active optimizations
    this.activeOptimizations.clear();
    this.abTests.clear();
    
    logger.info('Optimization Manager shutdown complete');
  }
}
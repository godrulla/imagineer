import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import type { 
  Job, 
  TranslationResult, 
  ExportResult,
  DesignFile 
} from '../lib/api'

// Workflow step definitions
export type WorkflowStep = 
  | 'import'
  | 'parsing'
  | 'translation'
  | 'review'
  | 'export'
  | 'complete'

export interface WorkflowState {
  // Current workflow state
  currentStep: WorkflowStep
  completedSteps: WorkflowStep[]
  isWorkflowActive: boolean
  
  // Import state
  importProgress: number
  importJob: Job | null
  importedFile: DesignFile | null
  
  // Parsing state
  parsingProgress: number
  parsingJob: Job | null
  parsingComplete: boolean
  
  // Translation state
  translationProgress: number
  translationJob: Job | null
  translationResult: TranslationResult | null
  generatedPrompt: string
  
  // Review state
  reviewedPrompt: string
  reviewChanges: Record<string, any>
  reviewApproved: boolean
  
  // Export state
  exportProgress: number
  exportJob: Job | null
  exportResult: ExportResult | null
  selectedExportFormat: string
  
  // Error tracking
  workflowErrors: Array<{
    step: WorkflowStep
    error: string
    timestamp: string
  }>
  
  // Actions
  
  // Workflow control
  startWorkflow: () => void
  resetWorkflow: () => void
  completeStep: (step: WorkflowStep) => void
  goToStep: (step: WorkflowStep) => void
  
  // Import actions
  setImportProgress: (progress: number) => void
  setImportJob: (job: Job | null) => void
  setImportedFile: (file: DesignFile | null) => void
  
  // Parsing actions
  setParsingProgress: (progress: number) => void
  setParsingJob: (job: Job | null) => void
  setParsingComplete: (complete: boolean) => void
  
  // Translation actions
  setTranslationProgress: (progress: number) => void
  setTranslationJob: (job: Job | null) => void
  setTranslationResult: (result: TranslationResult | null) => void
  setGeneratedPrompt: (prompt: string) => void
  
  // Review actions
  setReviewedPrompt: (prompt: string) => void
  setReviewChanges: (changes: Record<string, any>) => void
  setReviewApproved: (approved: boolean) => void
  
  // Export actions
  setExportProgress: (progress: number) => void
  setExportJob: (job: Job | null) => void
  setExportResult: (result: ExportResult | null) => void
  setSelectedExportFormat: (format: string) => void
  
  // Error handling
  addWorkflowError: (step: WorkflowStep, error: string) => void
  clearWorkflowErrors: () => void
  
  // Progress calculation
  getOverallProgress: () => number
  isStepCompleted: (step: WorkflowStep) => boolean
  canProceedToStep: (step: WorkflowStep) => boolean
}

const WORKFLOW_STEPS: WorkflowStep[] = [
  'import',
  'parsing', 
  'translation',
  'review',
  'export',
  'complete'
]

export const useWorkflowStore = create<WorkflowState>()(
  devtools(
    (set, get) => ({
      // Initial state
      currentStep: 'import',
      completedSteps: [],
      isWorkflowActive: false,
      
      // Import state
      importProgress: 0,
      importJob: null,
      importedFile: null,
      
      // Parsing state
      parsingProgress: 0,
      parsingJob: null,
      parsingComplete: false,
      
      // Translation state
      translationProgress: 0,
      translationJob: null,
      translationResult: null,
      generatedPrompt: '',
      
      // Review state
      reviewedPrompt: '',
      reviewChanges: {},
      reviewApproved: false,
      
      // Export state
      exportProgress: 0,
      exportJob: null,
      exportResult: null,
      selectedExportFormat: '',
      
      // Error tracking
      workflowErrors: [],
      
      // Workflow control actions
      startWorkflow: () => 
        set({
          isWorkflowActive: true,
          currentStep: 'import',
          completedSteps: [],
          workflowErrors: [],
          // Reset all progress
          importProgress: 0,
          parsingProgress: 0,
          translationProgress: 0,
          exportProgress: 0,
        }, false, 'startWorkflow'),
      
      resetWorkflow: () => 
        set({
          isWorkflowActive: false,
          currentStep: 'import',
          completedSteps: [],
          
          // Reset all state
          importProgress: 0,
          importJob: null,
          importedFile: null,
          
          parsingProgress: 0,
          parsingJob: null,
          parsingComplete: false,
          
          translationProgress: 0,
          translationJob: null,
          translationResult: null,
          generatedPrompt: '',
          
          reviewedPrompt: '',
          reviewChanges: {},
          reviewApproved: false,
          
          exportProgress: 0,
          exportJob: null,
          exportResult: null,
          selectedExportFormat: '',
          
          workflowErrors: [],
        }, false, 'resetWorkflow'),
      
      completeStep: (step) => 
        set((state) => {
          const completedSteps = [...state.completedSteps]
          if (!completedSteps.includes(step)) {
            completedSteps.push(step)
          }
          
          // Auto-advance to next step
          const currentIndex = WORKFLOW_STEPS.indexOf(step)
          const nextStep = WORKFLOW_STEPS[currentIndex + 1] || 'complete'
          
          return {
            completedSteps,
            currentStep: nextStep,
          }
        }, false, 'completeStep'),
      
      goToStep: (step) => 
        set({ currentStep: step }, false, 'goToStep'),
      
      // Import actions
      setImportProgress: (progress) => 
        set({ importProgress: progress }, false, 'setImportProgress'),
      
      setImportJob: (job) => 
        set({ importJob: job }, false, 'setImportJob'),
      
      setImportedFile: (file) => 
        set({ importedFile: file }, false, 'setImportedFile'),
      
      // Parsing actions
      setParsingProgress: (progress) => 
        set({ parsingProgress: progress }, false, 'setParsingProgress'),
      
      setParsingJob: (job) => 
        set({ parsingJob: job }, false, 'setParsingJob'),
      
      setParsingComplete: (complete) => 
        set({ parsingComplete: complete }, false, 'setParsingComplete'),
      
      // Translation actions
      setTranslationProgress: (progress) => 
        set({ translationProgress: progress }, false, 'setTranslationProgress'),
      
      setTranslationJob: (job) => 
        set({ translationJob: job }, false, 'setTranslationJob'),
      
      setTranslationResult: (result) => 
        set({ translationResult: result }, false, 'setTranslationResult'),
      
      setGeneratedPrompt: (prompt) => 
        set({ generatedPrompt: prompt }, false, 'setGeneratedPrompt'),
      
      // Review actions
      setReviewedPrompt: (prompt) => 
        set({ reviewedPrompt: prompt }, false, 'setReviewedPrompt'),
      
      setReviewChanges: (changes) => 
        set({ reviewChanges: changes }, false, 'setReviewChanges'),
      
      setReviewApproved: (approved) => 
        set({ reviewApproved: approved }, false, 'setReviewApproved'),
      
      // Export actions
      setExportProgress: (progress) => 
        set({ exportProgress: progress }, false, 'setExportProgress'),
      
      setExportJob: (job) => 
        set({ exportJob: job }, false, 'setExportJob'),
      
      setExportResult: (result) => 
        set({ exportResult: result }, false, 'setExportResult'),
      
      setSelectedExportFormat: (format) => 
        set({ selectedExportFormat: format }, false, 'setSelectedExportFormat'),
      
      // Error handling
      addWorkflowError: (step, error) => 
        set((state) => ({
          workflowErrors: [
            ...state.workflowErrors,
            {
              step,
              error,
              timestamp: new Date().toISOString(),
            }
          ]
        }), false, 'addWorkflowError'),
      
      clearWorkflowErrors: () => 
        set({ workflowErrors: [] }, false, 'clearWorkflowErrors'),
      
      // Computed methods
      getOverallProgress: () => {
        const state = get()
        const stepCount = WORKFLOW_STEPS.length - 1 // Exclude 'complete'
        const completedCount = state.completedSteps.filter(
          step => step !== 'complete'
        ).length
        
        // Add current step progress
        let currentStepProgress = 0
        switch (state.currentStep) {
          case 'import':
            currentStepProgress = state.importProgress / 100
            break
          case 'parsing':
            currentStepProgress = state.parsingProgress / 100
            break
          case 'translation':
            currentStepProgress = state.translationProgress / 100
            break
          case 'export':
            currentStepProgress = state.exportProgress / 100
            break
          case 'review':
            currentStepProgress = state.reviewApproved ? 1 : 0
            break
          case 'complete':
            currentStepProgress = 1
            break
        }
        
        return Math.round(((completedCount + currentStepProgress) / stepCount) * 100)
      },
      
      isStepCompleted: (step) => {
        const state = get()
        return state.completedSteps.includes(step)
      },
      
      canProceedToStep: (step) => {
        const state = get()
        const stepIndex = WORKFLOW_STEPS.indexOf(step)
        const currentIndex = WORKFLOW_STEPS.indexOf(state.currentStep)
        
        // Can only proceed to current step or completed steps
        return stepIndex <= currentIndex || state.completedSteps.includes(step)
      },
    }),
    {
      name: 'workflow-store',
    }
  )
)

// Selector hooks
export const useWorkflowStep = () => useWorkflowStore((state) => state.currentStep)
export const useWorkflowProgress = () => useWorkflowStore((state) => state.getOverallProgress())
export const useIsWorkflowActive = () => useWorkflowStore((state) => state.isWorkflowActive)
export const useCompletedSteps = () => useWorkflowStore((state) => state.completedSteps)
export const useWorkflowErrors = () => useWorkflowStore((state) => state.workflowErrors)

// Step-specific selectors
export const useImportState = () => useWorkflowStore((state) => ({
  progress: state.importProgress,
  job: state.importJob,
  file: state.importedFile,
}))

export const useParsingState = () => useWorkflowStore((state) => ({
  progress: state.parsingProgress,
  job: state.parsingJob,
  complete: state.parsingComplete,
}))

export const useTranslationState = () => useWorkflowStore((state) => ({
  progress: state.translationProgress,
  job: state.translationJob,
  result: state.translationResult,
  prompt: state.generatedPrompt,
}))

export const useReviewState = () => useWorkflowStore((state) => ({
  prompt: state.reviewedPrompt,
  changes: state.reviewChanges,
  approved: state.reviewApproved,
}))

export const useExportState = () => useWorkflowStore((state) => ({
  progress: state.exportProgress,
  job: state.exportJob,
  result: state.exportResult,
  format: state.selectedExportFormat,
}))
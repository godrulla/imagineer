import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-hot-toast'
import { 
  Wand2, 
  Cpu,
  FileText,
  Settings,
  Play,
  Pause,
  RotateCcw,
  Download,
  Eye,
  Edit3,
  CheckCircle,
  AlertCircle,
  Loader2,
  Sparkles,
  MessageSquare,
  Brain
} from 'lucide-react'
import { translationEngineService } from '../../lib/api'
import { useAppStore } from '../../stores/appStore'
import { useWorkflowStore } from '../../stores/workflowStore'
import type { 
  DesignFile, 
  TranslationRequest,
  TranslationResult, 
  Job 
} from '../../lib/api'

interface TranslationWorkflowProps {
  designFile: DesignFile
  onComplete?: (result: TranslationResult) => void
  onCancel?: () => void
}

interface LLMProvider {
  id: string
  name: string
  models: Array<{
    id: string
    name: string
    max_tokens: number
    cost_per_1k_tokens: { input: number; output: number }
  }>
}

interface TranslationSettings {
  target_format: 'markdown' | 'json' | 'yaml' | 'custom'
  llm_provider: string
  model_name: string
  context_strategy: 'minimal' | 'comprehensive' | 'custom'
  include_assets: boolean
  custom_instructions: string
  template_id?: string
  optimization_level: 'speed' | 'quality' | 'balanced'
}

export default function TranslationWorkflow({
  designFile,
  onComplete,
  onCancel
}: TranslationWorkflowProps) {
  const [currentStep, setCurrentStep] = useState<'settings' | 'preview' | 'generate' | 'review'>('settings')
  const [settings, setSettings] = useState<TranslationSettings>({
    target_format: 'markdown',
    llm_provider: 'openai',
    model_name: 'gpt-4',
    context_strategy: 'comprehensive',
    include_assets: true,
    custom_instructions: '',
    optimization_level: 'balanced',
  })
  const [generatedPrompt, setGeneratedPrompt] = useState('')
  const [editedPrompt, setEditedPrompt] = useState('')
  const [translationJob, setTranslationJob] = useState<Job | null>(null)
  const [translationResult, setTranslationResult] = useState<TranslationResult | null>(null)
  const [isPolling, setIsPolling] = useState(false)

  const { setLoading } = useAppStore()
  const queryClient = useQueryClient()

  // Fetch available LLM providers
  const { data: providersData, isLoading: providersLoading } = useQuery({
    queryKey: ['llm-providers'],
    queryFn: () => translationEngineService.getLLMProviders(),
  })

  // Fetch available templates
  const { data: templatesData } = useQuery({
    queryKey: ['translation-templates', settings.target_format],
    queryFn: () => translationEngineService.getTemplates({
      category: settings.target_format,
      limit: 20,
    }),
  })

  // Generate prompt mutation
  const generatePromptMutation = useMutation({
    mutationFn: () => translationEngineService.generatePrompt({
      design_file_id: designFile.id,
      context_strategy: settings.context_strategy,
      include_assets: settings.include_assets,
      custom_instructions: settings.custom_instructions,
      template_id: settings.template_id,
    }),
    onSuccess: (data) => {
      setGeneratedPrompt(data.prompt)
      setEditedPrompt(data.prompt)
      setCurrentStep('preview')
      toast.success('Prompt generated successfully')
    },
    onError: (error: any) => {
      const message = error.response?.data?.error?.message || 'Failed to generate prompt'
      toast.error(message)
    },
  })

  // Translation mutation
  const translationMutation = useMutation({
    mutationFn: () => {
      const request: TranslationRequest = {
        design_file_id: designFile.id,
        target_format: settings.target_format,
        llm_provider: settings.llm_provider,
        model_name: settings.model_name,
        context_strategy: settings.context_strategy,
        include_assets: settings.include_assets,
        custom_instructions: editedPrompt !== generatedPrompt ? editedPrompt : settings.custom_instructions,
        template_id: settings.template_id,
        optimization_level: settings.optimization_level,
      }
      return translationEngineService.createTranslation(request)
    },
    onSuccess: (job) => {
      setTranslationJob(job)
      setIsPolling(true)
      setCurrentStep('generate')
      toast.success('Translation started')
    },
    onError: (error: any) => {
      const message = error.response?.data?.error?.message || 'Failed to start translation'
      toast.error(message)
    },
  })

  // Poll translation job status
  useEffect(() => {
    if (!isPolling || !translationJob) return

    const pollInterval = setInterval(async () => {
      try {
        const updatedJob = await translationEngineService.getJob(translationJob.id)
        setTranslationJob(updatedJob)

        if (updatedJob.status === 'completed') {
          setIsPolling(false)
          // Fetch the translation result
          if (updatedJob.output_data?.translation_id) {
            const result = await translationEngineService.getTranslation(
              updatedJob.output_data.translation_id
            )
            setTranslationResult(result)
            setCurrentStep('review')
            toast.success('Translation completed successfully')
          }
        } else if (updatedJob.status === 'failed') {
          setIsPolling(false)
          toast.error(updatedJob.error_message || 'Translation failed')
        }
      } catch (error) {
        console.error('Error polling translation job:', error)
        setIsPolling(false)
      }
    }, 2000)

    return () => clearInterval(pollInterval)
  }, [isPolling, translationJob])

  const handleSettingsChange = (key: keyof TranslationSettings, value: any) => {
    setSettings(prev => ({ ...prev, [key]: value }))
  }

  const handleGeneratePrompt = () => {
    generatePromptMutation.mutate()
  }

  const handleStartTranslation = () => {
    translationMutation.mutate()
  }

  const handleComplete = () => {
    if (translationResult) {
      onComplete?.(translationResult)
    }
  }

  const estimatedCost = settings.llm_provider && providersData ? 
    translationEngineService.estimateTranslationCost(
      1000, // Estimated input tokens
      500,  // Estimated output tokens
      settings.llm_provider,
      settings.model_name
    ) : 0

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
          <Brain className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          LLM Translation
        </h1>
        <p className="text-gray-600">
          Transform your design into intelligent prompts using AI
        </p>
      </div>

      {/* Step Navigation */}
      <div className="mb-8">
        <nav className="flex space-x-8" aria-label="Tabs">
          {[
            { id: 'settings', name: 'Settings', icon: Settings },
            { id: 'preview', name: 'Preview', icon: Eye },
            { id: 'generate', name: 'Generate', icon: Wand2 },
            { id: 'review', name: 'Review', icon: CheckCircle },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => tab.id !== 'generate' && setCurrentStep(tab.id as any)}
              className={`flex items-center space-x-2 px-3 py-2 text-sm font-medium rounded-md
                ${currentStep === tab.id
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-500 hover:text-gray-700'
                }`}
              disabled={tab.id === 'preview' && !generatedPrompt}
            >
              <tab.icon className="h-4 w-4" />
              <span>{tab.name}</span>
            </button>
          ))}
        </nav>
      </div>

      <div className="bg-white rounded-lg shadow">
        {/* Settings Step */}
        {currentStep === 'settings' && (
          <div className="p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">
              Translation Settings
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Output Format */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Output Format
                </label>
                <select
                  value={settings.target_format}
                  onChange={(e) => handleSettingsChange('target_format', e.target.value)}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                >
                  {translationEngineService.getSupportedFormats().map((format) => (
                    <option key={format.id} value={format.id}>
                      {format.name}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-gray-500">
                  {translationEngineService.getSupportedFormats()
                    .find(f => f.id === settings.target_format)?.description}
                </p>
              </div>

              {/* LLM Provider */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  LLM Provider
                </label>
                {providersLoading ? (
                  <div className="flex items-center space-x-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm text-gray-500">Loading providers...</span>
                  </div>
                ) : (
                  <select
                    value={settings.llm_provider}
                    onChange={(e) => handleSettingsChange('llm_provider', e.target.value)}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  >
                    {providersData?.providers.map((provider) => (
                      <option key={provider.id} value={provider.id}>
                        {provider.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Model Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Model
                </label>
                <select
                  value={settings.model_name}
                  onChange={(e) => handleSettingsChange('model_name', e.target.value)}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                >
                  {providersData?.providers
                    .find(p => p.id === settings.llm_provider)?.models
                    .map((model) => (
                      <option key={model.id} value={model.id}>
                        {model.name}
                      </option>
                    ))}
                </select>
              </div>

              {/* Context Strategy */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Context Strategy
                </label>
                <select
                  value={settings.context_strategy}
                  onChange={(e) => handleSettingsChange('context_strategy', e.target.value)}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="minimal">Minimal - Key elements only</option>
                  <option value="comprehensive">Comprehensive - Full design context</option>
                  <option value="custom">Custom - User-defined instructions</option>
                </select>
              </div>

              {/* Template Selection */}
              {templatesData?.data.length > 0 && (
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Template (Optional)
                  </label>
                  <select
                    value={settings.template_id || ''}
                    onChange={(e) => handleSettingsChange('template_id', e.target.value || undefined)}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">No template</option>
                    {templatesData.data.map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Options */}
              <div className="md:col-span-2 space-y-3">
                <div className="flex items-center">
                  <input
                    id="include-assets"
                    type="checkbox"
                    checked={settings.include_assets}
                    onChange={(e) => handleSettingsChange('include_assets', e.target.checked)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="include-assets" className="ml-2 block text-sm text-gray-900">
                    Include asset references in prompt
                  </label>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Optimization Level
                  </label>
                  <div className="flex space-x-4">
                    {['speed', 'balanced', 'quality'].map((level) => (
                      <label key={level} className="flex items-center">
                        <input
                          type="radio"
                          value={level}
                          checked={settings.optimization_level === level}
                          onChange={(e) => handleSettingsChange('optimization_level', e.target.value)}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                        />
                        <span className="ml-2 text-sm text-gray-700 capitalize">{level}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              {/* Custom Instructions */}
              {settings.context_strategy === 'custom' && (
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Custom Instructions
                  </label>
                  <textarea
                    value={settings.custom_instructions}
                    onChange={(e) => handleSettingsChange('custom_instructions', e.target.value)}
                    rows={4}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Provide specific instructions for how the design should be translated..."
                  />
                </div>
              )}
            </div>

            {/* Cost Estimate */}
            {estimatedCost > 0 && (
              <div className="mt-6 p-4 bg-yellow-50 rounded-lg">
                <div className="flex items-center space-x-2">
                  <AlertCircle className="h-5 w-5 text-yellow-600" />
                  <span className="text-sm font-medium text-yellow-800">
                    Estimated cost: ${estimatedCost.toFixed(4)}
                  </span>
                </div>
              </div>
            )}

            <div className="mt-6 flex justify-end">
              <button
                onClick={handleGeneratePrompt}
                disabled={generatePromptMutation.isPending}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              >
                {generatePromptMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Generate Prompt
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Preview Step */}
        {currentStep === 'preview' && generatedPrompt && (
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900">
                Prompt Preview & Editing
              </h2>
              <div className="flex space-x-2">
                <button
                  onClick={() => setEditedPrompt(generatedPrompt)}
                  className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Reset
                </button>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Generated Prompt (editable)
                </label>
                <textarea
                  value={editedPrompt}
                  onChange={(e) => setEditedPrompt(e.target.value)}
                  rows={12}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
                />
              </div>

              {editedPrompt !== generatedPrompt && (
                <div className="p-3 bg-blue-50 rounded-lg">
                  <p className="text-sm text-blue-800">
                    <Edit3 className="h-4 w-4 inline mr-1" />
                    Prompt has been modified from original
                  </p>
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-between">
              <button
                onClick={() => setCurrentStep('settings')}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50"
              >
                Back to Settings
              </button>
              
              <button
                onClick={handleStartTranslation}
                disabled={translationMutation.isPending || !editedPrompt.trim()}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
              >
                {translationMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Starting...
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-2" />
                    Start Translation
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Generate Step */}
        {currentStep === 'generate' && (
          <div className="p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">
              Translation in Progress
            </h2>

            {translationJob && (
              <div className="space-y-4">
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-gray-900">
                      Translation Status
                    </span>
                    <span className={`text-xs px-2 py-1 rounded-full
                      ${translationJob.status === 'completed' ? 'bg-green-100 text-green-800' :
                        translationJob.status === 'failed' ? 'bg-red-100 text-red-800' :
                        'bg-blue-100 text-blue-800'
                      }`}>
                      {translationJob.status}
                    </span>
                  </div>
                  
                  {translationJob.status === 'processing' && (
                    <div className="space-y-2">
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${translationJob.progress_percentage}%` }}
                        />
                      </div>
                      <p className="text-sm text-gray-600">
                        {translationJob.progress_percentage}% complete
                      </p>
                    </div>
                  )}
                  
                  {translationJob.status === 'failed' && translationJob.error_message && (
                    <p className="text-sm text-red-600">
                      {translationJob.error_message}
                    </p>
                  )}
                </div>

                <div className="text-center">
                  <Cpu className="h-12 w-12 text-blue-500 mx-auto mb-3 animate-pulse" />
                  <p className="text-gray-600">
                    The AI is analyzing your design and generating the translation...
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Review Step */}
        {currentStep === 'review' && translationResult && (
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900">
                Translation Results
              </h2>
              <div className="flex items-center space-x-2 text-sm text-gray-600">
                <span>Confidence:</span>
                <span className={`font-medium
                  ${translationEngineService.getConfidenceScoreColor(translationResult.confidence_score) === 'green' ? 'text-green-600' :
                    translationEngineService.getConfidenceScoreColor(translationResult.confidence_score) === 'yellow' ? 'text-yellow-600' :
                    'text-red-600'
                  }`}>
                  {translationEngineService.formatConfidenceScore(translationResult.confidence_score)}
                </span>
              </div>
            </div>

            <div className="space-y-6">
              {/* Generated LLM Response */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Generated Response
                </label>
                <div className="bg-gray-50 rounded-lg p-4 max-h-96 overflow-y-auto">
                  <pre className="whitespace-pre-wrap text-sm font-mono">
                    {translationResult.llm_response}
                  </pre>
                </div>
              </div>

              {/* Token Usage */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-blue-50 rounded-lg p-3">
                  <p className="text-sm font-medium text-blue-900">Input Tokens</p>
                  <p className="text-lg font-semibold text-blue-600">
                    {translationResult.token_usage.input_tokens.toLocaleString()}
                  </p>
                </div>
                <div className="bg-green-50 rounded-lg p-3">
                  <p className="text-sm font-medium text-green-900">Output Tokens</p>
                  <p className="text-lg font-semibold text-green-600">
                    {translationResult.token_usage.output_tokens.toLocaleString()}
                  </p>
                </div>
                <div className="bg-purple-50 rounded-lg p-3">
                  <p className="text-sm font-medium text-purple-900">Total Cost</p>
                  <p className="text-lg font-semibold text-purple-600">
                    ${translationResult.token_usage.total_cost.toFixed(4)}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-between">
              <button
                onClick={() => setCurrentStep('preview')}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50"
              >
                Back to Edit
              </button>
              
              <div className="flex space-x-3">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(translationResult.llm_response || '')
                    toast.success('Response copied to clipboard')
                  }}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Copy
                </button>
                
                <button
                  onClick={handleComplete}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Continue to Export
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Cancel Button */}
      <div className="mt-6 text-center">
        <button
          onClick={onCancel}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          Cancel Workflow
        </button>
      </div>
    </div>
  )
}
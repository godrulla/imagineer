import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-hot-toast'
import { 
  Download, 
  FileText,
  Settings,
  Package,
  CheckCircle,
  AlertCircle,
  Loader2,
  Archive,
  Code,
  Eye,
  ExternalLink,
  Copy,
  Sparkles
} from 'lucide-react'
import { exportEngineService } from '../../lib/api'
import { useAppStore } from '../../stores/appStore'
import { useWorkflowStore } from '../../stores/workflowStore'
import type { 
  TranslationResult, 
  ExportRequest,
  ExportResult, 
  ExportFormat,
  Job 
} from '../../lib/api'

interface ExportWorkflowProps {
  translationResult: TranslationResult
  onComplete?: (result: ExportResult) => void
  onCancel?: () => void
}

interface ExportSettings {
  export_format: ExportFormat
  template_id?: string
  customizations: Record<string, any>
  output_options: {
    include_assets: boolean
    asset_optimization: 'none' | 'basic' | 'aggressive'
    bundle_type: 'single_file' | 'multi_file' | 'archive'
  }
}

export default function ExportWorkflow({
  translationResult,
  onComplete,
  onCancel
}: ExportWorkflowProps) {
  const [currentStep, setCurrentStep] = useState<'format' | 'settings' | 'preview' | 'generate' | 'download'>('format')
  const [settings, setSettings] = useState<ExportSettings>({
    export_format: 'react_typescript',
    customizations: {},
    output_options: {
      include_assets: true,
      asset_optimization: 'basic',
      bundle_type: 'multi_file',
    },
  })
  const [previewData, setPreviewData] = useState<any>(null)
  const [exportJob, setExportJob] = useState<Job | null>(null)
  const [exportResult, setExportResult] = useState<ExportResult | null>(null)
  const [isPolling, setIsPolling] = useState(false)
  const [selectedFiles, setSelectedFiles] = useState<string[]>([])

  const { setLoading } = useAppStore()
  const queryClient = useQueryClient()

  // Fetch available templates for selected format
  const { data: templatesData, isLoading: templatesLoading } = useQuery({
    queryKey: ['export-templates', settings.export_format],
    queryFn: () => exportEngineService.getTemplates({
      export_format: settings.export_format,
      limit: 20,
    }),
  })

  // Preview mutation
  const previewMutation = useMutation({
    mutationFn: () => exportEngineService.previewExport({
      source_type: 'translation_result',
      source_id: translationResult.id,
      export_format: settings.export_format,
      template_id: settings.template_id,
      customizations: settings.customizations,
    }),
    onSuccess: (data) => {
      setPreviewData(data)
      setCurrentStep('preview')
      toast.success('Preview generated successfully')
    },
    onError: (error: any) => {
      const message = error.response?.data?.error?.message || 'Failed to generate preview'
      toast.error(message)
    },
  })

  // Export mutation
  const exportMutation = useMutation({
    mutationFn: () => {
      const request: ExportRequest = {
        source_type: 'translation_result',
        source_id: translationResult.id,
        export_format: settings.export_format,
        template_id: settings.template_id,
        customizations: settings.customizations,
        output_options: settings.output_options,
      }
      return exportEngineService.createExport(request)
    },
    onSuccess: (job) => {
      setExportJob(job)
      setIsPolling(true)
      setCurrentStep('generate')
      toast.success('Export started')
    },
    onError: (error: any) => {
      const message = error.response?.data?.error?.message || 'Failed to start export'
      toast.error(message)
    },
  })

  // Poll export job status
  useEffect(() => {
    if (!isPolling || !exportJob) return

    const pollInterval = setInterval(async () => {
      try {
        const updatedJob = await exportEngineService.getJob(exportJob.id)
        setExportJob(updatedJob)

        if (updatedJob.status === 'completed') {
          setIsPolling(false)
          // Fetch the export result
          if (updatedJob.output_data?.export_id) {
            const result = await exportEngineService.getExport(
              updatedJob.output_data.export_id
            )
            setExportResult(result)
            setCurrentStep('download')
            toast.success('Export completed successfully')
          }
        } else if (updatedJob.status === 'failed') {
          setIsPolling(false)
          toast.error(updatedJob.error_message || 'Export failed')
        }
      } catch (error) {
        console.error('Error polling export job:', error)
        setIsPolling(false)
      }
    }, 2000)

    return () => clearInterval(pollInterval)
  }, [isPolling, exportJob])

  const handleSettingsChange = (key: keyof ExportSettings, value: any) => {
    setSettings(prev => ({ ...prev, [key]: value }))
  }

  const handleOutputOptionChange = (key: string, value: any) => {
    setSettings(prev => ({
      ...prev,
      output_options: { ...prev.output_options, [key]: value }
    }))
  }

  const handleFormatSelect = (format: ExportFormat) => {
    setSettings(prev => ({ ...prev, export_format: format }))
    setCurrentStep('settings')
  }

  const handleGeneratePreview = () => {
    previewMutation.mutate()
  }

  const handleStartExport = () => {
    exportMutation.mutate()
  }

  const handleDownloadFile = (fileId: string, filename: string) => {
    if (exportResult) {
      exportEngineService.downloadExportFile(exportResult.id, fileId, filename)
      toast.success(`Downloading ${filename}`)
    }
  }

  const handleDownloadAll = () => {
    if (exportResult) {
      exportEngineService.downloadExport(exportResult.id)
      toast.success('Downloading export archive')
    }
  }

  const supportedFormats = exportEngineService.getSupportedFormats()

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-gradient-to-r from-green-500 to-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
          <Package className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Export Generation
        </h1>
        <p className="text-gray-600">
          Transform your translation into production-ready code
        </p>
      </div>

      {/* Step Navigation */}
      <div className="mb-8">
        <nav className="flex space-x-8" aria-label="Tabs">
          {[
            { id: 'format', name: 'Format', icon: FileText },
            { id: 'settings', name: 'Settings', icon: Settings },
            { id: 'preview', name: 'Preview', icon: Eye },
            { id: 'generate', name: 'Generate', icon: Sparkles },
            { id: 'download', name: 'Download', icon: Download },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => tab.id !== 'generate' && setCurrentStep(tab.id as any)}
              className={`flex items-center space-x-2 px-3 py-2 text-sm font-medium rounded-md
                ${currentStep === tab.id
                  ? 'bg-green-100 text-green-700'
                  : 'text-gray-500 hover:text-gray-700'
                }`}
              disabled={
                (tab.id === 'settings' && !settings.export_format) ||
                (tab.id === 'preview' && !previewData) ||
                (tab.id === 'download' && !exportResult)
              }
            >
              <tab.icon className="h-4 w-4" />
              <span>{tab.name}</span>
            </button>
          ))}
        </nav>
      </div>

      <div className="bg-white rounded-lg shadow">
        {/* Format Selection Step */}
        {currentStep === 'format' && (
          <div className="p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">
              Choose Export Format
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {supportedFormats.map((format) => (
                <button
                  key={format.id}
                  onClick={() => handleFormatSelect(format.id)}
                  className={`p-4 border-2 rounded-lg text-left hover:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors
                    ${settings.export_format === format.id 
                      ? 'border-blue-500 bg-blue-50' 
                      : 'border-gray-200'
                    }`}
                >
                  <div className="flex items-center space-x-3 mb-3">
                    <span className="text-2xl">
                      {exportEngineService.getFormatIcon(format.id)}
                    </span>
                    <div>
                      <h3 className="font-medium text-gray-900">{format.name}</h3>
                      <p className="text-sm text-gray-500">{format.category}</p>
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 mb-2">{format.description}</p>
                  <div className="flex flex-wrap gap-1">
                    {format.extensions.map((ext) => (
                      <span
                        key={ext}
                        className="inline-block px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded"
                      >
                        {ext}
                      </span>
                    ))}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Settings Step */}
        {currentStep === 'settings' && (
          <div className="p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">
              Export Settings
            </h2>

            <div className="space-y-6">
              {/* Selected Format */}
              <div className="bg-blue-50 rounded-lg p-4">
                <div className="flex items-center space-x-3">
                  <span className="text-2xl">
                    {exportEngineService.getFormatIcon(settings.export_format)}
                  </span>
                  <div>
                    <h3 className="font-medium text-blue-900">
                      {supportedFormats.find(f => f.id === settings.export_format)?.name}
                    </h3>
                    <p className="text-sm text-blue-700">
                      {supportedFormats.find(f => f.id === settings.export_format)?.description}
                    </p>
                  </div>
                </div>
              </div>

              {/* Template Selection */}
              {templatesData?.data.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Template (Optional)
                  </label>
                  <select
                    value={settings.template_id || ''}
                    onChange={(e) => handleSettingsChange('template_id', e.target.value || undefined)}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Default template</option>
                    {templatesData.data.map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.name} - {template.description}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Output Options */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Output Options</h3>
                
                <div className="space-y-4">
                  {/* Bundle Type */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Bundle Type
                    </label>
                    <div className="space-y-2">
                      {[
                        { value: 'single_file', label: 'Single File', desc: 'Everything in one file' },
                        { value: 'multi_file', label: 'Multiple Files', desc: 'Organized file structure' },
                        { value: 'archive', label: 'Archive', desc: 'ZIP file with all assets' },
                      ].map((option) => (
                        <label key={option.value} className="flex items-center space-x-3">
                          <input
                            type="radio"
                            value={option.value}
                            checked={settings.output_options.bundle_type === option.value}
                            onChange={(e) => handleOutputOptionChange('bundle_type', e.target.value)}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                          />
                          <div>
                            <span className="text-sm font-medium text-gray-900">{option.label}</span>
                            <p className="text-xs text-gray-500">{option.desc}</p>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Asset Options */}
                  <div className="space-y-3">
                    <div className="flex items-center">
                      <input
                        id="include-assets"
                        type="checkbox"
                        checked={settings.output_options.include_assets}
                        onChange={(e) => handleOutputOptionChange('include_assets', e.target.checked)}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <label htmlFor="include-assets" className="ml-2 block text-sm text-gray-900">
                        Include assets (images, icons, etc.)
                      </label>
                    </div>

                    {settings.output_options.include_assets && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Asset Optimization
                        </label>
                        <select
                          value={settings.output_options.asset_optimization}
                          onChange={(e) => handleOutputOptionChange('asset_optimization', e.target.value)}
                          className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        >
                          <option value="none">No optimization</option>
                          <option value="basic">Basic optimization</option>
                          <option value="aggressive">Aggressive optimization</option>
                        </select>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Generation Time Estimate */}
              <div className="p-4 bg-yellow-50 rounded-lg">
                <div className="flex items-center space-x-2">
                  <AlertCircle className="h-5 w-5 text-yellow-600" />
                  <span className="text-sm font-medium text-yellow-800">
                    Estimated generation time: {
                      exportEngineService.estimateGenerationTime(
                        'translation_result',
                        settings.export_format,
                        1
                      )
                    } seconds
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-between">
              <button
                onClick={() => setCurrentStep('format')}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50"
              >
                Back to Format
              </button>
              
              <button
                onClick={handleGeneratePreview}
                disabled={previewMutation.isPending}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              >
                {previewMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Eye className="h-4 w-4 mr-2" />
                    Generate Preview
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Preview Step */}
        {currentStep === 'preview' && previewData && (
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900">
                Export Preview
              </h2>
              <div className="text-sm text-gray-600">
                Estimated size: {previewData.file_structure.reduce((acc: number, file: any) => acc + file.size_estimate, 0)} bytes
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* File Structure */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-3">
                  File Structure
                </h3>
                <div className="border rounded-lg overflow-hidden">
                  {previewData.file_structure.map((file: any, index: number) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 border-b last:border-b-0 hover:bg-gray-50"
                    >
                      <div className="flex items-center space-x-3">
                        <Code className="h-4 w-4 text-gray-400" />
                        <span className="text-sm font-mono">{file.filename}</span>
                      </div>
                      <div className="text-xs text-gray-500">
                        {exportEngineService.formatFileSize(file.size_estimate)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Preview Content */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-3">
                  Preview Content
                </h3>
                <div className="border rounded-lg p-4 bg-gray-50 max-h-96 overflow-y-auto">
                  <pre className="text-sm font-mono whitespace-pre-wrap">
                    {previewData.preview_content}
                  </pre>
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-between">
              <button
                onClick={() => setCurrentStep('settings')}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50"
              >
                Back to Settings
              </button>
              
              <button
                onClick={handleStartExport}
                disabled={exportMutation.isPending}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
              >
                {exportMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Starting...
                  </>
                ) : (
                  <>
                    <Package className="h-4 w-4 mr-2" />
                    Generate Export
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
              Export Generation in Progress
            </h2>

            {exportJob && (
              <div className="space-y-4">
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-gray-900">
                      Export Status
                    </span>
                    <span className={`text-xs px-2 py-1 rounded-full
                      ${exportJob.status === 'completed' ? 'bg-green-100 text-green-800' :
                        exportJob.status === 'failed' ? 'bg-red-100 text-red-800' :
                        'bg-blue-100 text-blue-800'
                      }`}>
                      {exportJob.status}
                    </span>
                  </div>
                  
                  {exportJob.status === 'processing' && (
                    <div className="space-y-2">
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-green-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${exportJob.progress_percentage}%` }}
                        />
                      </div>
                      <p className="text-sm text-gray-600">
                        {exportJob.progress_percentage}% complete
                      </p>
                    </div>
                  )}
                  
                  {exportJob.status === 'failed' && exportJob.error_message && (
                    <p className="text-sm text-red-600">
                      {exportJob.error_message}
                    </p>
                  )}
                </div>

                <div className="text-center">
                  <Package className="h-12 w-12 text-green-500 mx-auto mb-3 animate-pulse" />
                  <p className="text-gray-600">
                    Generating your export files...
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Download Step */}
        {currentStep === 'download' && exportResult && (
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900">
                Export Complete
              </h2>
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>

            <div className="space-y-6">
              {/* Export Summary */}
              <div className="bg-green-50 rounded-lg p-4">
                <h3 className="text-lg font-medium text-green-900 mb-2">
                  Export Successful!
                </h3>
                <p className="text-sm text-green-700">
                  Your {supportedFormats.find(f => f.id === settings.export_format)?.name} export 
                  has been generated with {exportResult.output_files.length} files.
                </p>
              </div>

              {/* Download Options */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium text-gray-900">
                    Download Files
                  </h3>
                  <button
                    onClick={handleDownloadAll}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
                  >
                    <Archive className="h-4 w-4 mr-2" />
                    Download All
                  </button>
                </div>

                <div className="border rounded-lg overflow-hidden">
                  {exportResult.output_files.map((file, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-4 border-b last:border-b-0 hover:bg-gray-50"
                    >
                      <div className="flex items-center space-x-3">
                        <FileText className="h-5 w-5 text-gray-400" />
                        <div>
                          <p className="text-sm font-medium text-gray-900">{file.filename}</p>
                          <p className="text-xs text-gray-500">
                            {file.file_type} • {exportEngineService.formatFileSize(file.file_size_bytes)}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex space-x-2">
                        <button
                          onClick={() => window.open(file.download_url, '_blank')}
                          className="text-blue-600 hover:text-blue-500 text-sm"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDownloadFile(file.filename, file.filename)}
                          className="text-green-600 hover:text-green-500 text-sm"
                        >
                          <Download className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-between">
              <button
                onClick={() => setCurrentStep('preview')}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50"
              >
                Back to Preview
              </button>
              
              <button
                onClick={() => onComplete?.(exportResult)}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Complete Workflow
              </button>
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
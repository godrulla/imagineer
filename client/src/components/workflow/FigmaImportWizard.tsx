import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-hot-toast'
import { 
  Upload, 
  Link as LinkIcon, 
  FileText, 
  CheckCircle, 
  XCircle,
  Loader2,
  RefreshCw,
  Eye,
  Download,
  ExternalLink
} from 'lucide-react'
import { designParserService } from '../../lib/api'
import { useAuth } from '../../AppNoAuth'
import { useAppStore } from '../../stores/appStore'
import { useWorkflowStore } from '../../stores/workflowStore'
import type { Project, Job, DesignFile } from '../../lib/api'

interface FigmaImportWizardProps {
  onComplete?: (file: DesignFile) => void
  onCancel?: () => void
  projectId?: string
}

interface ImportStep {
  id: string
  title: string
  description: string
  status: 'pending' | 'processing' | 'completed' | 'error'
}

export default function FigmaImportWizard({
  onComplete,
  onCancel,
  projectId
}: FigmaImportWizardProps) {
  const [figmaUrl, setFigmaUrl] = useState('')
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const [importJob, setImportJob] = useState<Job | null>(null)
  const [importedFile, setImportedFile] = useState<DesignFile | null>(null)
  const [currentStep, setCurrentStep] = useState(0)
  const [isPolling, setIsPolling] = useState(false)

  const { currentOrganization } = useAuth()
  const { setCurrentFile, setLoading } = useAppStore()
  const queryClient = useQueryClient()

  // Fetch projects for selection
  const { data: projectsData, isLoading: projectsLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: () => designParserService.getProjects({ limit: 50 }),
    enabled: !projectId, // Only fetch if no projectId provided
  })

  // Get specific project if projectId provided
  const { data: specificProject } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => designParserService.getProject(projectId!),
    enabled: !!projectId,
  })

  useEffect(() => {
    if (projectId && specificProject) {
      setSelectedProject(specificProject)
    }
  }, [projectId, specificProject])

  const steps: ImportStep[] = [
    {
      id: 'input',
      title: 'Enter Figma URL',
      description: 'Provide the URL to your Figma file',
      status: figmaUrl && designParserService.isValidFigmaUrl(figmaUrl) ? 'completed' : 'pending',
    },
    {
      id: 'project',
      title: 'Select Project',
      description: 'Choose or create a project for this import',
      status: selectedProject ? 'completed' : 'pending',
    },
    {
      id: 'import',
      title: 'Import File',
      description: 'Download and process the Figma file',
      status: importJob?.status === 'completed' ? 'completed' 
              : importJob?.status === 'failed' ? 'error'
              : importJob ? 'processing' : 'pending',
    },
    {
      id: 'parsing',
      title: 'Parse Design',
      description: 'Extract design elements and structure',
      status: importedFile?.processing_status === 'completed' ? 'completed'
              : importedFile?.processing_status === 'failed' ? 'error'
              : importedFile ? 'processing' : 'pending',
    },
  ]

  // Import mutation
  const importMutation = useMutation({
    mutationFn: async () => {
      if (!figmaUrl || !selectedProject) {
        throw new Error('Missing required data')
      }

      const fileKey = designParserService.extractFigmaFileKey(figmaUrl)
      if (!fileKey) {
        throw new Error('Invalid Figma URL')
      }

      return designParserService.importFromFigma({
        figma_file_key: fileKey,
        project_id: selectedProject.id,
        auto_sync: true,
      })
    },
    onSuccess: (job) => {
      setImportJob(job)
      setIsPolling(true)
      toast.success('Import started successfully')
    },
    onError: (error: any) => {
      const message = error.response?.data?.error?.message || 'Import failed'
      toast.error(message)
    },
  })

  // Poll job status
  useEffect(() => {
    if (!isPolling || !importJob) return

    const pollInterval = setInterval(async () => {
      try {
        const updatedJob = await designParserService.getJob(importJob.id)
        setImportJob(updatedJob)

        if (updatedJob.status === 'completed') {
          setIsPolling(false)
          // Fetch the imported file
          if (updatedJob.output_data?.file_id) {
            const file = await designParserService.getDesignFile(
              selectedProject!.id,
              updatedJob.output_data.file_id
            )
            setImportedFile(file)
            toast.success('File imported successfully')
          }
        } else if (updatedJob.status === 'failed') {
          setIsPolling(false)
          toast.error(updatedJob.error_message || 'Import failed')
        }
      } catch (error) {
        console.error('Error polling job status:', error)
        setIsPolling(false)
      }
    }, 2000)

    return () => clearInterval(pollInterval)
  }, [isPolling, importJob, selectedProject])

  const handleUrlChange = (url: string) => {
    setFigmaUrl(url)
    
    if (url && designParserService.isValidFigmaUrl(url)) {
      setCurrentStep(Math.max(currentStep, 1))
    }
  }

  const handleProjectSelect = (project: Project) => {
    setSelectedProject(project)
    setCurrentStep(Math.max(currentStep, 2))
  }

  const handleStartImport = () => {
    if (!figmaUrl || !selectedProject) return
    
    setCurrentStep(2)
    importMutation.mutate()
  }

  const handleComplete = () => {
    if (importedFile) {
      setCurrentFile(importedFile)
      onComplete?.(importedFile)
    }
  }

  const canProceed = figmaUrl && selectedProject && !isPolling

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center mx-auto mb-4">
          <LinkIcon className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Import from Figma
        </h1>
        <p className="text-gray-600">
          Connect your Figma file to start the design-to-LLM translation process
        </p>
      </div>

      {/* Progress Steps */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {steps.map((step, index) => (
            <div key={step.id} className="flex items-center">
              <div className="flex flex-col items-center">
                <div
                  className={`w-12 h-12 rounded-full flex items-center justify-center text-sm font-medium
                    ${step.status === 'completed' 
                      ? 'bg-green-100 text-green-600' 
                      : step.status === 'processing'
                      ? 'bg-blue-100 text-blue-600'
                      : step.status === 'error'
                      ? 'bg-red-100 text-red-600'
                      : 'bg-gray-100 text-gray-400'
                    }`}
                >
                  {step.status === 'completed' ? (
                    <CheckCircle className="w-6 h-6" />
                  ) : step.status === 'processing' ? (
                    <Loader2 className="w-6 h-6 animate-spin" />
                  ) : step.status === 'error' ? (
                    <XCircle className="w-6 h-6" />
                  ) : (
                    index + 1
                  )}
                </div>
                <div className="mt-2 text-center">
                  <p className="text-sm font-medium text-gray-900">{step.title}</p>
                  <p className="text-xs text-gray-500">{step.description}</p>
                </div>
              </div>
              {index < steps.length - 1 && (
                <div className="flex-1 h-px bg-gray-200 mx-4" />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Step Content */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        {/* Step 1: URL Input */}
        {currentStep >= 0 && (
          <div className="mb-6">
            <h3 className="text-lg font-medium text-gray-900 mb-3">
              Figma File URL
            </h3>
            <div className="space-y-3">
              <div>
                <label htmlFor="figma-url" className="block text-sm font-medium text-gray-700">
                  Paste your Figma file URL
                </label>
                <div className="mt-1 relative">
                  <input
                    id="figma-url"
                    type="url"
                    value={figmaUrl}
                    onChange={(e) => handleUrlChange(e.target.value)}
                    placeholder="https://www.figma.com/file/..."
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                  {figmaUrl && (
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                      {designParserService.isValidFigmaUrl(figmaUrl) ? (
                        <CheckCircle className="h-5 w-5 text-green-500" />
                      ) : (
                        <XCircle className="h-5 w-5 text-red-500" />
                      )}
                    </div>
                  )}
                </div>
                {figmaUrl && !designParserService.isValidFigmaUrl(figmaUrl) && (
                  <p className="mt-1 text-sm text-red-600">
                    Please enter a valid Figma file URL
                  </p>
                )}
              </div>

              {figmaUrl && (
                <div className="flex items-center space-x-2 text-sm text-gray-600">
                  <ExternalLink className="h-4 w-4" />
                  <a
                    href={figmaUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-500"
                  >
                    View in Figma
                  </a>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Step 2: Project Selection */}
        {currentStep >= 1 && figmaUrl && designParserService.isValidFigmaUrl(figmaUrl) && (
          <div className="mb-6">
            <h3 className="text-lg font-medium text-gray-900 mb-3">
              Select Project
            </h3>
            
            {projectId ? (
              <div className="bg-blue-50 rounded-lg p-4">
                <div className="flex items-center space-x-3">
                  <FileText className="h-6 w-6 text-blue-600" />
                  <div>
                    <p className="font-medium text-blue-900">
                      {selectedProject?.name}
                    </p>
                    <p className="text-sm text-blue-700">
                      File will be imported to this project
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {projectsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                    <span className="ml-2 text-gray-600">Loading projects...</span>
                  </div>
                ) : (
                  <div className="grid gap-3">
                    {projectsData?.data.map((project) => (
                      <button
                        key={project.id}
                        onClick={() => handleProjectSelect(project)}
                        className={`text-left p-4 border rounded-lg hover:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-500 
                          ${selectedProject?.id === project.id 
                            ? 'border-blue-500 bg-blue-50' 
                            : 'border-gray-200'
                          }`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="font-medium text-gray-900">{project.name}</h4>
                            {project.description && (
                              <p className="text-sm text-gray-600 mt-1">{project.description}</p>
                            )}
                            <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500">
                              <span>{project.source_tool}</span>
                              <span>{project.view_count} views</span>
                              <span>Updated {new Date(project.updated_at).toLocaleDateString()}</span>
                            </div>
                          </div>
                          {selectedProject?.id === project.id && (
                            <CheckCircle className="h-5 w-5 text-blue-600" />
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Step 3: Import Progress */}
        {currentStep >= 2 && selectedProject && (
          <div className="mb-6">
            <h3 className="text-lg font-medium text-gray-900 mb-3">
              Import Progress
            </h3>
            
            {!importJob ? (
              <div className="text-center py-6">
                <button
                  onClick={handleStartImport}
                  disabled={!canProceed || importMutation.isPending}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {importMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Starting Import...
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4 mr-2" />
                      Start Import
                    </>
                  )}
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-900">
                      Import Status
                    </span>
                    <span className={`text-xs px-2 py-1 rounded-full
                      ${importJob.status === 'completed' ? 'bg-green-100 text-green-800' :
                        importJob.status === 'failed' ? 'bg-red-100 text-red-800' :
                        'bg-blue-100 text-blue-800'
                      }`}>
                      {importJob.status}
                    </span>
                  </div>
                  
                  {importJob.status === 'processing' && (
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${importJob.progress_percentage}%` }}
                      />
                    </div>
                  )}
                  
                  {importJob.status === 'failed' && importJob.error_message && (
                    <p className="text-sm text-red-600 mt-2">
                      {importJob.error_message}
                    </p>
                  )}
                </div>

                {/* File Processing Status */}
                {importedFile && (
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-900">
                        Processing Status
                      </span>
                      <span className={`text-xs px-2 py-1 rounded-full
                        ${importedFile.processing_status === 'completed' ? 'bg-green-100 text-green-800' :
                          importedFile.processing_status === 'failed' ? 'bg-red-100 text-red-800' :
                          'bg-blue-100 text-blue-800'
                        }`}>
                        {importedFile.processing_status}
                      </span>
                    </div>
                    
                    <div className="flex items-center space-x-3 mt-3">
                      <FileText className="h-5 w-5 text-gray-400" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {importedFile.name}
                        </p>
                        <p className="text-xs text-gray-500">
                          {importedFile.file_size_bytes && 
                            designParserService.formatFileSize(importedFile.file_size_bytes)
                          }
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between">
        <button
          onClick={onCancel}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          Cancel
        </button>

        <div className="flex space-x-3">
          {importedFile?.processing_status === 'completed' && (
            <>
              <button
                onClick={() => {
                  // Preview the imported file
                  window.open(`/projects/${selectedProject?.id}/files/${importedFile.id}`, '_blank')
                }}
                className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <Eye className="h-4 w-4 mr-2" />
                Preview
              </button>
              
              <button
                onClick={handleComplete}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Continue to Translation
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
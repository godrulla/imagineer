import { useState, useCallback, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { v4 as uuidv4 } from 'uuid'
import DesignEditor from '../components/DesignEditor'
import LayersPanel from '../components/LayersPanel'
import PropertiesPanel from '../components/PropertiesPanel'
import { ArrowLeft, Save, Share, Download, FileText, Upload } from 'lucide-react'
import toast from 'react-hot-toast'

interface DesignElement {
  id: string
  type: 'rectangle' | 'circle' | 'text'
  x: number
  y: number
  width?: number
  height?: number
  radius?: number
  fill: string
  text?: string
  fontSize?: number
  visible?: boolean
  locked?: boolean
  name?: string
  rotation?: number
  opacity?: number
  draggable: boolean
}

export default function VisualEditor() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [elements, setElements] = useState<DesignElement[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [projectName, setProjectName] = useState('Untitled Design')
  const [projectId, setProjectId] = useState<string>('')
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [isAutoSaving, setIsAutoSaving] = useState(false)

  const selectedElement = elements.find(el => el.id === selectedId) || null

  // Load project from URL params or localStorage on mount
  useEffect(() => {
    const urlProjectId = searchParams.get('project')
    const templateId = searchParams.get('template')
    
    if (urlProjectId) {
      loadProject(urlProjectId)
    } else if (templateId) {
      loadTemplate(templateId)
    } else {
      // Create new project or load draft
      const draftProject = localStorage.getItem('imagineer-current-draft')
      if (draftProject) {
        const parsed = JSON.parse(draftProject)
        setElements(parsed.elements || [])
        setProjectName(parsed.name || 'Untitled Design')
        setProjectId(parsed.id || uuidv4())
      } else {
        setProjectId(uuidv4())
      }
    }
  }, [searchParams])

  // Auto-save functionality
  useEffect(() => {
    const autoSaveInterval = setInterval(() => {
      if (elements.length > 0 || projectName !== 'Untitled Design') {
        autoSaveProject()
      }
    }, 30000) // Auto-save every 30 seconds

    return () => clearInterval(autoSaveInterval)
  }, [elements, projectName, projectId])

  const loadProject = async (id: string) => {
    try {
      // Try to load from API first
      const response = await fetch(`/api/v1/projects/${id}`)
      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          setElements(data.project.elements || [])
          setProjectName(data.project.name)
          setProjectId(id)
          return
        }
      }

      // Fallback to localStorage
      const savedProjects = localStorage.getItem('imagineer-projects')
      if (savedProjects) {
        const projects = JSON.parse(savedProjects)
        const project = projects.find((p: any) => p.id === id)
        if (project) {
          setElements(project.elements || [])
          setProjectName(project.name)
          setProjectId(id)
          toast.success('Project loaded successfully')
          return
        }
      }
      
      toast.error('Project not found')
    } catch (error) {
      console.error('Failed to load project:', error)
      toast.error('Failed to load project')
    }
  }

  const loadTemplate = async (templateId: string) => {
    try {
      toast.loading('Loading template...')
      
      // Simulate template loading (in real app would fetch from API)
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      const templates: Record<string, any> = {
        '1': {
          name: 'Modern Landing Page',
          elements: [
            {
              id: uuidv4(),
              type: 'rectangle',
              x: 100,
              y: 50,
              width: 600,
              height: 300,
              fill: '#3b82f6',
              name: 'Hero Section',
              draggable: true
            },
            {
              id: uuidv4(),
              type: 'text',
              x: 200,
              y: 150,
              width: 400,
              height: 60,
              fill: '#ffffff',
              text: 'Welcome to Imagineer',
              fontSize: 32,
              name: 'Hero Title',
              draggable: true
            }
          ]
        }
      }
      
      const template = templates[templateId]
      if (template) {
        setElements(template.elements)
        setProjectName(`${template.name} - Copy`)
        setProjectId(uuidv4())
        toast.success('Template loaded successfully!')
      } else {
        throw new Error('Template not found')
      }
    } catch (error) {
      toast.error('Failed to load template')
    }
  }

  const autoSaveProject = async () => {
    if (isAutoSaving) return
    
    setIsAutoSaving(true)
    try {
      const projectData = {
        id: projectId,
        name: projectName,
        elements: elements,
        updatedAt: new Date().toISOString()
      }

      // Save to localStorage as backup
      localStorage.setItem('imagineer-current-draft', JSON.stringify(projectData))
      
      // Try to save to API
      try {
        const response = await fetch(`/api/v1/projects/${projectId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(projectData)
        })

        if (response.ok) {
          setLastSaved(new Date())
        }
      } catch (error) {
        // API save failed, but localStorage backup succeeded
        console.warn('API save failed, using localStorage backup:', error)
      }

    } catch (error) {
      console.error('Auto-save failed:', error)
    } finally {
      setIsAutoSaving(false)
    }
  }

  const saveProject = async () => {
    const loadingToast = toast.loading('Saving project...')
    
    try {
      const projectData = {
        id: projectId,
        name: projectName,
        elements: elements,
        createdAt: lastSaved ? undefined : new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }

      // Save to localStorage
      const savedProjects = localStorage.getItem('imagineer-projects')
      const projects = savedProjects ? JSON.parse(savedProjects) : []
      const existingIndex = projects.findIndex((p: any) => p.id === projectId)
      
      if (existingIndex >= 0) {
        projects[existingIndex] = projectData
      } else {
        projects.push(projectData)
      }
      
      localStorage.setItem('imagineer-projects', JSON.stringify(projects))

      // Try to save to API
      try {
        const response = await fetch(`/api/v1/projects/${projectId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(projectData)
        })

        if (!response.ok) {
          throw new Error('API save failed')
        }
      } catch (error) {
        console.warn('API save failed, project saved locally:', error)
      }

      setLastSaved(new Date())
      toast.success('Project saved successfully!', { id: loadingToast })
      
      // Clear draft since we saved the project
      localStorage.removeItem('imagineer-current-draft')
      
    } catch (error) {
      console.error('Save failed:', error)
      toast.error('Failed to save project', { id: loadingToast })
    }
  }

  // Handle element updates from the editor
  const handleElementsChange = useCallback((newElements: any[]) => {
    setElements(newElements.map(el => ({
      ...el,
      visible: el.visible !== false,
      locked: el.locked === true,
    })))
  }, [])

  // Handle element selection
  const handleSelectElement = useCallback((id: string) => {
    setSelectedId(id)
  }, [])

  // Handle element updates from properties panel
  const handleUpdateElement = useCallback((id: string, updates: Partial<DesignElement>) => {
    setElements(prev => prev.map(el => 
      el.id === id ? { ...el, ...updates } : el
    ))
  }, [])

  // Handle element deletion
  const handleDeleteElement = useCallback((id: string) => {
    setElements(prev => prev.filter(el => el.id !== id))
    if (selectedId === id) {
      setSelectedId(null)
    }
  }, [selectedId])

  // Handle element duplication
  const handleDuplicateElement = useCallback((id: string) => {
    const elementToDuplicate = elements.find(el => el.id === id)
    if (elementToDuplicate) {
      const newElement = {
        ...elementToDuplicate,
        id: uuidv4(),
        x: elementToDuplicate.x + 20,
        y: elementToDuplicate.y + 20,
        name: `${elementToDuplicate.name || elementToDuplicate.type} copy`
      }
      setElements(prev => [...prev, newElement])
      setSelectedId(newElement.id)
    }
  }, [elements])

  // Handle visibility toggle
  const handleToggleVisibility = useCallback((id: string) => {
    setElements(prev => prev.map(el => 
      el.id === id ? { ...el, visible: !el.visible } : el
    ))
  }, [])

  // Handle lock toggle
  const handleToggleLock = useCallback((id: string) => {
    setElements(prev => prev.map(el => 
      el.id === id ? { ...el, locked: !el.locked } : el
    ))
  }, [])

  // Handle element rename
  const handleRenameElement = useCallback((id: string, name: string) => {
    setElements(prev => prev.map(el => 
      el.id === id ? { ...el, name } : el
    ))
  }, [])

  // Generate LLM prompt using microservices
  const generateLLMPrompt = useCallback(async () => {
    if (elements.length === 0) {
      toast.error('Add some elements to your design first!')
      return
    }

    const loadingToast = toast.loading('Analyzing design and generating LLM prompt...')
    
    try {
      // Step 1: Send design to parser service for analysis
      const designData = {
        name: projectName,
        elements: elements.map(el => ({
          id: el.id,
          name: el.name || el.type,
          type: el.type,
          bounds: {
            x: el.x,
            y: el.y,
            width: el.width || (el.type === 'circle' ? (el.radius || 0) * 2 : 100),
            height: el.height || (el.type === 'circle' ? (el.radius || 0) * 2 : 100)
          },
          styles: {
            fills: [{ type: 'SOLID', color: hexToRgb(el.fill) }],
            ...(el.type === 'text' && {
              typography: {
                fontSize: el.fontSize || 16,
                fontFamily: 'Inter'
              }
            })
          },
          text: el.text
        }))
      }

      // Call design parser service
      const parseResponse = await fetch('/api/v1/parser/elements', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          designData: { document: designData },
          options: {
            minConfidence: 0.8,
            includeHidden: false
          }
        })
      })

      if (!parseResponse.ok) {
        throw new Error('Failed to parse design')
      }

      const parseResult = await parseResponse.json()
      toast.success('Design parsed successfully!', { id: loadingToast })
      
      // Step 2: Generate translation using translation service
      const translationLoadingToast = toast.loading('Generating LLM-optimized prompt...')
      
      const translationResponse = await fetch('/api/v1/translate/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          designData: parseResult.data,
          targetLLM: 'claude-3',
          format: 'markdown',
          options: {
            includeMetadata: true,
            optimizeForTokens: true,
            includeDesignSystem: true,
            verbosity: 'detailed'
          }
        })
      })

      if (!translationResponse.ok) {
        throw new Error('Failed to generate translation')
      }

      const translationResult = await translationResponse.json()
      toast.success(
        `Professional prompt generated! (${translationResult.usage?.totalTokens} tokens, ${translationResult.responseTime}ms)`, 
        { id: translationLoadingToast, duration: 4000 }
      )

      // Copy to clipboard
      await navigator.clipboard.writeText(translationResult.content)
      toast.success('LLM prompt copied to clipboard! 🎉')

      // Log results for debugging
      console.log('Design Analysis:', parseResult)
      console.log('Generated Translation:', translationResult)
      console.log('Final Prompt:', translationResult.content)

    } catch (error) {
      console.error('Translation error:', error)
      toast.error(
        `Failed to generate prompt: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { id: loadingToast }
      )
    }
  }, [elements, projectName])

  // Helper function to convert hex to RGB
  const hexToRgb = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
    return result ? {
      r: parseInt(result[1], 16) / 255,
      g: parseInt(result[2], 16) / 255,
      b: parseInt(result[3], 16) / 255
    } : { r: 0, g: 0, b: 1 }
  }

  // Import from Figma
  const handleFigmaImport = useCallback(async () => {
    const figmaUrl = prompt('Enter Figma URL or File ID:')
    if (!figmaUrl) return

    // Extract file ID from URL or use direct ID
    const fileId = figmaUrl.includes('figma.com') 
      ? figmaUrl.match(/file\/([a-zA-Z0-9]+)/)?.[1]
      : figmaUrl

    if (!fileId) {
      toast.error('Invalid Figma URL or File ID')
      return
    }

    const loadingToast = toast.loading('Importing from Figma...')

    try {
      // Call design parser service to analyze Figma file
      const response = await fetch('/api/v1/parser/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          figmaFileId: fileId,
          options: {
            includeChildren: true,
            extractStyles: true,
            analysisDepth: 'detailed'
          }
        })
      })

      if (!response.ok) {
        throw new Error('Failed to import from Figma')
      }

      const result = await response.json()
      
      // Poll for completion if it's async
      if (result.jobId) {
        let completed = false
        let attempts = 0
        const maxAttempts = 30

        while (!completed && attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 2000))
          
          const statusResponse = await fetch(`/api/v1/parser/status/${result.jobId}`)
          const statusResult = await statusResponse.json()
          
          if (statusResult.status === 'completed') {
            completed = true
            // Convert parsed elements to our format
            const importedElements = statusResult.data.elements.map((el: any) => ({
              id: uuidv4(),
              name: el.name || el.elementType,
              type: mapFigmaTypeToLocal(el.elementType),
              x: el.bounds.x,
              y: el.bounds.y,
              width: el.bounds.width,
              height: el.bounds.height,
              radius: el.type === 'circle' ? el.bounds.width / 2 : undefined,
              fill: el.styles?.fills?.[0] ? rgbToHex(el.styles.fills[0].color) : '#3b82f6',
              text: el.text,
              fontSize: el.styles?.typography?.fontSize || 16,
              draggable: true,
              visible: true,
              locked: false
            })).slice(0, 20) // Limit to 20 elements for demo

            setElements(importedElements)
            setProjectName(statusResult.data.nodeName || 'Imported from Figma')
            handleElementsChange(importedElements)
            
            toast.success(
              `Successfully imported ${importedElements.length} elements from Figma!`, 
              { id: loadingToast, duration: 4000 }
            )
          } else if (statusResult.status === 'failed') {
            throw new Error(statusResult.error?.message || 'Import failed')
          }
          
          attempts++
        }

        if (!completed) {
          throw new Error('Import timed out')
        }
      }

    } catch (error) {
      console.error('Figma import error:', error)
      toast.error(`Failed to import from Figma: ${error instanceof Error ? error.message : 'Unknown error'}`, { id: loadingToast })
    }
  }, [handleElementsChange])

  // Save project

  // Helper functions
  const mapFigmaTypeToLocal = (figmaType: string): 'rectangle' | 'circle' | 'text' => {
    switch (figmaType?.toLowerCase()) {
      case 'ellipse':
      case 'circle':
        return 'circle'
      case 'text':
        return 'text'
      default:
        return 'rectangle'
    }
  }

  const rgbToHex = (rgb: { r: number; g: number; b: number }): string => {
    const r = Math.round(rgb.r * 255)
    const g = Math.round(rgb.g * 255)
    const b = Math.round(rgb.b * 255)
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
  }

  return (
    <div className="h-screen flex flex-col bg-gray-100">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigate('/')}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          
          <input
            type="text"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            className="text-lg font-medium bg-transparent border-none outline-none focus:bg-gray-50 px-2 py-1 rounded"
            onFocus={(e) => e.target.select()}
          />
          
          <div className="flex items-center space-x-3 text-sm text-gray-500">
            <span>{elements.length} elements</span>
            {isAutoSaving && (
              <span className="flex items-center text-imagineer-blue-600">
                <div className="w-2 h-2 bg-imagineer-blue-600 rounded-full animate-pulse mr-1"></div>
                Saving...
              </span>
            )}
            {lastSaved && !isAutoSaving && (
              <span className="text-green-600">
                Saved {lastSaved.toLocaleTimeString()}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={handleFigmaImport}
            className="px-3 py-2 text-sm bg-purple-600 hover:bg-purple-700 text-white rounded-lg flex items-center space-x-2 transition-colors"
            title="Import from Figma"
          >
            <Upload className="w-4 h-4" />
            <span>Import Figma</span>
          </button>
          
          <button
            onClick={saveProject}
            disabled={isAutoSaving}
            className="px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 disabled:opacity-50 rounded-lg flex items-center space-x-2 transition-colors"
          >
            <Save className="w-4 h-4" />
            <span>Save</span>
          </button>
          
          <button
            onClick={generateLLMPrompt}
            className="px-4 py-2 bg-imagineer-blue-600 hover:bg-imagineer-blue-700 text-white rounded-lg flex items-center space-x-2 transition-colors"
          >
            <FileText className="w-4 h-4" />
            <span>Generate LLM Prompt</span>
          </button>
          
          <button className="px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg flex items-center space-x-2 transition-colors">
            <Share className="w-4 h-4" />
            <span>Share</span>
          </button>
          
          <button className="px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg flex items-center space-x-2 transition-colors">
            <Download className="w-4 h-4" />
            <span>Export</span>
          </button>
        </div>
      </div>

      {/* Main Editor Area */}
      <div className="flex-1 flex">
        {/* Layers Panel */}
        <LayersPanel
          elements={elements}
          selectedId={selectedId}
          onSelectElement={handleSelectElement}
          onDeleteElement={handleDeleteElement}
          onDuplicateElement={handleDuplicateElement}
          onToggleVisibility={handleToggleVisibility}
          onToggleLock={handleToggleLock}
          onRenameElement={handleRenameElement}
        />

        {/* Canvas Editor */}
        <div className="flex-1">
          <DesignEditor
            width={800}
            height={600}
            onElementsChange={handleElementsChange}
          />
        </div>

        {/* Properties Panel */}
        <PropertiesPanel
          selectedElement={selectedElement}
          onUpdateElement={handleUpdateElement}
        />
      </div>
    </div>
  )
}
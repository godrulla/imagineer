import { useState, useCallback, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { v4 as uuidv4 } from 'uuid'
import { 
  ArrowLeft, 
  Save, 
  Share, 
  Download, 
  Upload,
  Settings,
  Sun,
  Moon,
  Layers,
  MessageSquare,
  Grid3X3,
  Palette,
  Code,
  Eye,
  Play,
  Figma,
  Sparkles
} from 'lucide-react'
import toast from 'react-hot-toast'

import ProfessionalCanvas from '../components/ProfessionalCanvas'
import LayerManager from '../components/LayerManager'
import LLMChatPanel from '../components/LLMChatPanel'
import { useTheme } from '../contexts/ThemeContext'

interface DrawingElement {
  id: string
  type: 'rect' | 'circle' | 'text' | 'line' | 'pen' | 'group'
  x: number
  y: number
  width?: number
  height?: number
  radius?: number
  points?: number[]
  text?: string
  fontSize?: number
  fontFamily?: string
  fill: string
  stroke?: string
  strokeWidth?: number
  opacity?: number
  rotation?: number
  scaleX?: number
  scaleY?: number
  visible?: boolean
  locked?: boolean
  name: string
  layerId: string
  zIndex?: number
  properties?: Record<string, any>
}

interface DrawingLayer {
  id: string
  name: string
  visible: boolean
  locked: boolean
  opacity: number
  blendMode: string
  elements: string[]
  parent?: string
  expanded?: boolean
  type: 'layer' | 'group'
}

export default function ProfessionalEditor() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { theme, toggleTheme } = useTheme()
  
  const [projectName, setProjectName] = useState('Untitled Design')
  const [projectId, setProjectId] = useState<string>('')
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [isAutoSaving, setIsAutoSaving] = useState(false)
  
  // Canvas and drawing state
  const [elements, setElements] = useState<DrawingElement[]>([])
  const [layers, setLayers] = useState<DrawingLayer[]>([
    {
      id: 'layer_1',
      name: 'Background',
      visible: true,
      locked: false,
      opacity: 1,
      blendMode: 'normal',
      elements: [],
      type: 'layer'
    }
  ])
  
  // UI State
  const [selectedElementIds, setSelectedElementIds] = useState<string[]>([])
  const [selectedLayerId, setSelectedLayerId] = useState('layer_1')
  const [showLayers, setShowLayers] = useState(true)
  const [showGrid, setShowGrid] = useState(true)
  const [isChatOpen, setIsChatOpen] = useState(false)
  const [isPreviewMode, setIsPreviewMode] = useState(false)
  
  // Panel states
  const [leftPanelWidth, setLeftPanelWidth] = useState(280)
  const [rightPanelWidth, setRightPanelWidth] = useState(320)

  // Load project from URL params or create new
  useEffect(() => {
    const urlProjectId = searchParams.get('project')
    const templateId = searchParams.get('template')
    
    if (urlProjectId) {
      loadProject(urlProjectId)
    } else if (templateId) {
      loadTemplate(templateId)
    } else {
      const draftProject = localStorage.getItem('imagineer-current-draft')
      if (draftProject) {
        try {
          const parsed = JSON.parse(draftProject)
          setElements(parsed.elements || [])
          setLayers(parsed.layers || layers)
          setProjectName(parsed.name || 'Untitled Design')
          setProjectId(parsed.id || uuidv4())
        } catch (error) {
          console.error('Failed to load draft:', error)
          setProjectId(uuidv4())
        }
      } else {
        setProjectId(uuidv4())
      }
    }
  }, [searchParams])

  // Auto-save functionality
  useEffect(() => {
    const autoSaveInterval = setInterval(() => {
      if ((elements.length > 0 || projectName !== 'Untitled Design') && !isAutoSaving) {
        autoSaveProject()
      }
    }, 15000) // Auto-save every 15 seconds

    return () => clearInterval(autoSaveInterval)
  }, [elements, layers, projectName, projectId, isAutoSaving])

  const loadProject = async (id: string) => {
    try {
      const response = await fetch(`/api/v1/projects/${id}`)
      if (response.ok) {
        const data = await response.json()
        if (data.success && data.project) {
          setElements(data.project.elements || [])
          setLayers(data.project.layers || layers)
          setProjectName(data.project.name || 'Loaded Project')
          setProjectId(id)
          toast.success('Project loaded successfully')
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
          setLayers(project.layers || layers)
          setProjectName(project.name || 'Loaded Project')
          setProjectId(id)
          toast.success('Project loaded from local storage')
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
      const loadingToast = toast.loading('Loading template...')
      
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      const templates: Record<string, any> = {
        '1': {
          name: 'Modern Dashboard',
          elements: [
            {
              id: uuidv4(),
              type: 'rect',
              x: 50,
              y: 50,
              width: 1100,
              height: 80,
              fill: '#ffffff',
              stroke: '#e5e7eb',
              strokeWidth: 1,
              name: 'Header',
              layerId: 'layer_1',
              visible: true,
              locked: false
            },
            {
              id: uuidv4(),
              type: 'text',
              x: 100,
              y: 70,
              text: 'Dashboard',
              fontSize: 32,
              fontFamily: 'Inter, sans-serif',
              fill: '#1f2937',
              name: 'Dashboard Title',
              layerId: 'layer_1',
              visible: true,
              locked: false
            },
            {
              id: uuidv4(),
              type: 'rect',
              x: 50,
              y: 150,
              width: 350,
              height: 200,
              fill: '#f9fafb',
              stroke: '#e5e7eb',
              strokeWidth: 1,
              name: 'Stats Card 1',
              layerId: 'layer_1',
              visible: true,
              locked: false
            },
            {
              id: uuidv4(),
              type: 'rect',
              x: 420,
              y: 150,
              width: 350,
              height: 200,
              fill: '#f9fafb',
              stroke: '#e5e7eb',
              strokeWidth: 1,
              name: 'Stats Card 2',
              layerId: 'layer_1',
              visible: true,
              locked: false
            },
            {
              id: uuidv4(),
              type: 'rect',
              x: 790,
              y: 150,
              width: 350,
              height: 200,
              fill: '#f9fafb',
              stroke: '#e5e7eb',
              strokeWidth: 1,
              name: 'Stats Card 3',
              layerId: 'layer_1',
              visible: true,
              locked: false
            }
          ],
          layers: [
            {
              id: 'layer_1',
              name: 'UI Elements',
              visible: true,
              locked: false,
              opacity: 1,
              blendMode: 'normal',
              elements: [],
              type: 'layer'
            }
          ]
        }
      }
      
      const template = templates[templateId]
      if (template) {
        setElements(template.elements)
        setLayers(template.layers || layers)
        setProjectName(`${template.name} - Copy`)
        setProjectId(uuidv4())
        toast.success('Template loaded successfully!', { id: loadingToast })
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
        layers: layers,
        updatedAt: new Date().toISOString(),
        canvas: { width: 1200, height: 800 }
      }

      localStorage.setItem('imagineer-current-draft', JSON.stringify(projectData))
      
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
        layers: layers,
        createdAt: lastSaved ? undefined : new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        canvas: { width: 1200, height: 800 }
      }

      const savedProjects = localStorage.getItem('imagineer-projects')
      const projects = savedProjects ? JSON.parse(savedProjects) : []
      const existingIndex = projects.findIndex((p: any) => p.id === projectId)
      
      if (existingIndex >= 0) {
        projects[existingIndex] = projectData
      } else {
        projects.push(projectData)
      }
      
      localStorage.setItem('imagineer-projects', JSON.stringify(projects))

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
      localStorage.removeItem('imagineer-current-draft')
      
    } catch (error) {
      console.error('Save failed:', error)
      toast.error('Failed to save project', { id: loadingToast })
    }
  }

  const handleFigmaImport = async () => {
    const figmaUrl = prompt('Enter Figma URL or File ID:')
    if (!figmaUrl) return

    const fileId = figmaUrl.includes('figma.com') 
      ? figmaUrl.match(/file\/([a-zA-Z0-9]+)/)?.[1]
      : figmaUrl

    if (!fileId) {
      toast.error('Invalid Figma URL or File ID')
      return
    }

    const loadingToast = toast.loading('Importing from Figma...')

    try {
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
      
      if (result.success && result.data.elements) {
        const importedElements: DrawingElement[] = result.data.elements.map((el: any) => ({
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
          visible: true,
          locked: false,
          layerId: selectedLayerId,
          properties: el
        })).slice(0, 20)

        setElements([...elements, ...importedElements])
        setProjectName(result.data.nodeName || 'Imported from Figma')
        
        toast.success(
          `Successfully imported ${importedElements.length} elements from Figma!`, 
          { id: loadingToast, duration: 4000 }
        )
      }

    } catch (error) {
      console.error('Figma import error:', error)
      toast.error('Failed to import from Figma. Please check the URL and try again.', { id: loadingToast })
    }
  }

  const generateAdvancedPrompt = async () => {
    if (elements.length === 0) {
      toast.error('Add some elements to your design first!')
      return
    }

    const loadingToast = toast.loading('Generating sophisticated design prompt...')
    
    try {
      const designData = {
        name: projectName,
        elements: elements.map(el => ({
          id: el.id,
          name: el.name,
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
                fontFamily: el.fontFamily || 'Inter'
              }
            })
          },
          text: el.text,
          visible: el.visible !== false,
          locked: el.locked === true
        })),
        canvas: { width: 1200, height: 800 },
        layers: layers.map(layer => ({
          name: layer.name,
          visible: layer.visible,
          opacity: layer.opacity,
          elementCount: elements.filter(el => el.layerId === layer.id).length
        }))
      }

      const response = await fetch('/api/v1/translate/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          designData,
          targetLLM: 'claude-3',
          format: 'markdown',
          options: {
            includeMetadata: true,
            optimizeForTokens: true,
            includeDesignSystem: true,
            verbosity: 'detailed',
            includeCodeSuggestions: true,
            includeAccessibility: true,
            includeResponsiveDesign: true
          }
        })
      })

      if (!response.ok) {
        throw new Error('Failed to generate translation')
      }

      const result = await response.json()
      
      await navigator.clipboard.writeText(result.content)
      toast.success(
        `Professional prompt generated! (${result.usage?.totalTokens} tokens) - Copied to clipboard!`, 
        { id: loadingToast, duration: 6000 }
      )

      // Show advanced sharing options
      showSharingOptions(result.content, result)

    } catch (error) {
      console.error('Translation error:', error)
      toast.error('Failed to generate prompt. Please try again.', { id: loadingToast })
    }
  }

  const showSharingOptions = (content: string, metadata: any) => {
    const modal = document.createElement('div')
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50'
    modal.innerHTML = `
      <div class="${theme === 'dark' ? 'bg-gray-900' : 'bg-white'} rounded-lg p-6 w-[600px] max-h-[80vh] overflow-y-auto">
        <h3 class="text-xl font-bold mb-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}">Share Your Design</h3>
        <div class="space-y-4">
          <button id="copyPrompt" class="w-full p-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
            📋 Copy Advanced Prompt
          </button>
          <button id="downloadMarkdown" class="w-full p-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
            📄 Download as Markdown
          </button>
          <button id="exportJson" class="w-full p-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors">
            🔧 Export Design JSON
          </button>
          <button id="generateCode" class="w-full p-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors">
            💻 Generate React Code
          </button>
        </div>
        <button id="closeModal" class="mt-4 w-full p-2 border rounded-lg ${theme === 'dark' ? 'border-gray-600 hover:bg-gray-800' : 'border-gray-300 hover:bg-gray-50'}">
          Close
        </button>
      </div>
    `
    
    document.body.appendChild(modal)
    
    document.getElementById('copyPrompt')?.addEventListener('click', () => {
      navigator.clipboard.writeText(content)
      toast.success('Prompt copied to clipboard!')
    })
    
    document.getElementById('downloadMarkdown')?.addEventListener('click', () => {
      const blob = new Blob([content], { type: 'text/markdown' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${projectName.toLowerCase().replace(/\s+/g, '-')}-design-prompt.md`
      a.click()
      URL.revokeObjectURL(url)
    })
    
    document.getElementById('exportJson')?.addEventListener('click', () => {
      const designExport = { name: projectName, elements, layers, metadata }
      const blob = new Blob([JSON.stringify(designExport, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${projectName.toLowerCase().replace(/\s+/g, '-')}-design.json`
      a.click()
      URL.revokeObjectURL(url)
    })
    
    modal.addEventListener('click', (e) => {
      if (e.target === modal || e.target?.id === 'closeModal') {
        document.body.removeChild(modal)
      }
    })
  }

  // Helper functions
  const mapFigmaTypeToLocal = (figmaType: string): 'rect' | 'circle' | 'text' => {
    switch (figmaType?.toLowerCase()) {
      case 'ellipse':
      case 'circle':
        return 'circle'
      case 'text':
        return 'text'
      default:
        return 'rect'
    }
  }

  const rgbToHex = (rgb: { r: number, g: number, b: number }) => {
    const r = Math.round(rgb.r * 255)
    const g = Math.round(rgb.g * 255)  
    const b = Math.round(rgb.b * 255)
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
  }

  const hexToRgb = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
    return result ? {
      r: parseInt(result[1], 16) / 255,
      g: parseInt(result[2], 16) / 255,
      b: parseInt(result[3], 16) / 255
    } : { r: 0, g: 0, b: 1 }
  }

  const currentDesignForChat = {
    name: projectName,
    elements: elements.map(el => ({
      id: el.id,
      type: el.type,
      name: el.name,
      properties: {
        x: el.x,
        y: el.y,
        width: el.width,
        height: el.height,
        fill: el.fill,
        text: el.text,
        fontSize: el.fontSize
      }
    })),
    canvas: { width: 1200, height: 800 }
  }

  return (
    <div className={`h-screen flex flex-col ${theme === 'dark' ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-900'}`}>
      {/* Top Header */}
      <div className={`flex items-center justify-between px-6 py-4 border-b ${
        theme === 'dark' 
          ? 'bg-gray-800 border-gray-700' 
          : 'bg-white border-gray-200'
      }`}>
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigate('/')}
            className={`p-2 rounded-lg transition-colors ${
              theme === 'dark' ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
            }`}
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          
          <input
            type="text"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            className={`text-xl font-semibold bg-transparent border-none outline-none px-2 py-1 rounded ${
              theme === 'dark' ? 'focus:bg-gray-700' : 'focus:bg-gray-100'
            }`}
            onFocus={(e) => e.target.select()}
          />
          
          <div className={`flex items-center space-x-4 text-sm ${
            theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
          }`}>
            <span>{elements.length} elements</span>
            <span>•</span>
            <span>{layers.filter(l => l.visible).length} layers</span>
            {isAutoSaving && (
              <>
                <span>•</span>
                <span className="flex items-center text-blue-500">
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse mr-1"></div>
                  Auto-saving...
                </span>
              </>
            )}
            {lastSaved && !isAutoSaving && (
              <>
                <span>•</span>
                <span className="text-green-600">
                  Saved {lastSaved.toLocaleTimeString()}
                </span>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={handleFigmaImport}
            className="px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:from-purple-700 hover:to-pink-700 transition-all flex items-center space-x-2 shadow-lg"
            title="Import from Figma"
          >
            <Figma className="w-4 h-4" />
            <span>Import Figma</span>
          </button>
          
          <button
            onClick={saveProject}
            disabled={isAutoSaving}
            className={`px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors ${
              theme === 'dark'
                ? 'bg-gray-700 hover:bg-gray-600 disabled:opacity-50'
                : 'bg-gray-200 hover:bg-gray-300 disabled:opacity-50'
            }`}
          >
            <Save className="w-4 h-4" />
            <span>Save</span>
          </button>
          
          <button
            onClick={generateAdvancedPrompt}
            className="px-6 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all flex items-center space-x-2 shadow-lg"
          >
            <Sparkles className="w-4 h-4" />
            <span>Generate LLM Prompt</span>
          </button>

          <div className="h-6 w-px bg-gray-300 mx-2"></div>

          <button
            onClick={() => setShowGrid(!showGrid)}
            className={`p-2 rounded-lg transition-colors ${
              showGrid 
                ? 'bg-blue-100 text-blue-600' 
                : theme === 'dark' ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
            }`}
            title="Toggle Grid"
          >
            <Grid3X3 className="w-4 h-4" />
          </button>

          <button
            onClick={() => setShowLayers(!showLayers)}
            className={`p-2 rounded-lg transition-colors ${
              showLayers 
                ? 'bg-blue-100 text-blue-600' 
                : theme === 'dark' ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
            }`}
            title="Toggle Layers Panel"
          >
            <Layers className="w-4 h-4" />
          </button>

          <button
            onClick={() => setIsChatOpen(!isChatOpen)}
            className={`p-2 rounded-lg transition-colors ${
              isChatOpen 
                ? 'bg-green-100 text-green-600' 
                : theme === 'dark' ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
            }`}
            title="AI Assistant"
          >
            <MessageSquare className="w-4 h-4" />
          </button>

          <button
            onClick={toggleTheme}
            className={`p-2 rounded-lg transition-colors ${
              theme === 'dark' ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
            }`}
            title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - Tools & Properties */}
        <div className={`w-${leftPanelWidth}px border-r ${
          theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
        }`} style={{ width: `${leftPanelWidth}px` }}>
          {/* Properties Panel would go here */}
        </div>

        {/* Main Canvas Area */}
        <div className="flex-1 relative">
          <ProfessionalCanvas
            elements={elements}
            layers={layers}
            onElementsChange={setElements}
            onLayersChange={setLayers}
            selectedElementIds={selectedElementIds}
            onSelectionChange={setSelectedElementIds}
            canvasWidth={1200}
            canvasHeight={800}
            theme={theme}
          />
        </div>

        {/* Right Sidebar - Layers */}
        {showLayers && (
          <LayerManager
            layers={layers}
            elements={elements.map(el => ({ 
              id: el.id, 
              name: el.name, 
              type: el.type, 
              layerId: el.layerId,
              visible: el.visible,
              locked: el.locked,
              selected: selectedElementIds.includes(el.id)
            }))}
            onLayersChange={setLayers}
            onElementsChange={(updatedElements) => {
              const newElements = elements.map(el => {
                const updated = updatedElements.find(ue => ue.id === el.id)
                return updated ? { ...el, ...updated } : el
              })
              setElements(newElements)
            }}
            selectedLayerId={selectedLayerId}
            selectedElementIds={selectedElementIds}
            onLayerSelect={setSelectedLayerId}
            onElementSelect={setSelectedElementIds}
            theme={theme}
          />
        )}
      </div>

      {/* LLM Chat Panel */}
      <LLMChatPanel
        isOpen={isChatOpen}
        onToggle={() => setIsChatOpen(!isChatOpen)}
        theme={theme}
        currentDesign={currentDesignForChat}
        onApplyDesignSuggestion={(suggestion) => {
          // Handle design suggestions from AI
          console.log('Applying design suggestion:', suggestion)
        }}
      />
    </div>
  )
}
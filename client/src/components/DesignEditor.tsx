import React, { useState, useRef, useCallback, useEffect } from 'react'
import { Stage, Layer, Rect, Circle, Text, Transformer } from 'react-konva'
import { v4 as uuidv4 } from 'uuid'
import { 
  Square, 
  Circle as CircleIcon, 
  Type, 
  MousePointer,
  Hand,
  ZoomIn,
  ZoomOut,
  Undo,
  Redo,
  Play,
  Users,
  MessageCircle,
  Share2,
  Wifi,
  WifiOff
} from 'lucide-react'
import { useCollaboration } from '../hooks/useCollaboration'
import { useAppStore } from '../stores/appStore'
import { useAuth } from '../AppNoAuth'
import { toast } from 'react-hot-toast'

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
  draggable: boolean
}

interface DesignEditorProps {
  width?: number
  height?: number
  projectId?: string
  designFileId?: string
  enableCollaboration?: boolean
  onElementsChange?: (elements: DesignElement[]) => void
}

export default function DesignEditor({ 
  width = 800, 
  height = 600,
  projectId,
  designFileId,
  enableCollaboration = false,
  onElementsChange 
}: DesignEditorProps) {
  const { user } = useAuth()
  const {
    selectedElements,
    setSelectedElements,
    onlineUsers,
    zoom,
    setZoom,
    viewportPosition,
    setViewportPosition
  } = useAppStore()

  const [elements, setElements] = useState<DesignElement[]>([])
  const [tool, setTool] = useState<'select' | 'rectangle' | 'circle' | 'text' | 'hand'>('select')
  const [showCollaborators, setShowCollaborators] = useState(false)
  const [comments, setComments] = useState<Array<{
    id: string
    content: string
    position: { x: number; y: number }
    user_name: string
    timestamp: string
  }>>([])

  const stageRef = useRef<any>(null)
  const transformerRef = useRef<any>(null)
  const cursorUpdateTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Collaboration hook
  const collaboration = useCollaboration({
    projectId,
    designFileId,
    sessionType: 'design_editing',
    autoConnect: enableCollaboration,
  })

  // Sync local state with global state
  const scale = zoom
  const stagePos = viewportPosition

  // Add element to canvas
  const addElement = useCallback((type: 'rectangle' | 'circle' | 'text', e: any) => {
    if (tool !== type) return

    const stage = e.target.getStage()
    const point = stage.getPointerPosition()
    
    const newElement: DesignElement = {
      id: uuidv4(),
      type,
      x: (point.x - stagePos.x) / scale,
      y: (point.y - stagePos.y) / scale,
      fill: type === 'text' ? '#000000' : '#3b82f6',
      draggable: true,
      ...(type === 'rectangle' && { width: 100, height: 80 }),
      ...(type === 'circle' && { radius: 40 }),
      ...(type === 'text' && { text: 'Sample Text', fontSize: 16 })
    }

    setElements(prev => [...prev, newElement])
    setSelectedId(newElement.id)
    onElementsChange?.([...elements, newElement])
  }, [tool, scale, stagePos, elements, onElementsChange])

  // Handle element selection
  const handleElementClick = useCallback((id: string) => {
    const newSelection = selectedElements.includes(id) 
      ? selectedElements.filter(elId => elId !== id)
      : [...selectedElements, id]
    
    setSelectedElements(newSelection)
    
    // Send selection update to collaborators
    if (collaboration.isConnected) {
      collaboration.sendSelectionUpdate(newSelection)
    }
  }, [selectedElements, setSelectedElements, collaboration])

  // Handle element drag
  const handleElementDragEnd = useCallback((id: string, e: any) => {
    const newPos = { x: e.target.x(), y: e.target.y() }
    
    setElements(prev => prev.map(el => 
      el.id === id ? { ...el, ...newPos } : el
    ))

    // Send element update to collaborators
    if (collaboration.isConnected) {
      collaboration.sendElementUpdate(id, newPos)
    }

    onElementsChange?.(elements.map(el => 
      el.id === id ? { ...el, ...newPos } : el
    ))
  }, [elements, onElementsChange, collaboration])

  // Handle mouse move for cursor tracking
  const handleMouseMove = useCallback((e: any) => {
    if (!collaboration.isConnected || !user) return

    const stage = e.target.getStage()
    const pointer = stage.getPointerPosition()
    
    if (cursorUpdateTimeoutRef.current) {
      clearTimeout(cursorUpdateTimeoutRef.current)
    }

    cursorUpdateTimeoutRef.current = setTimeout(() => {
      collaboration.sendCursorPosition({
        x: (pointer.x - stagePos.x) / scale,
        y: (pointer.y - stagePos.y) / scale,
      })
    }, 50) // Throttle cursor updates
  }, [collaboration, user, stagePos, scale])

  // Handle transformer
  useEffect(() => {
    if (selectedElements.length > 0 && transformerRef.current) {
      const selectedNodes = selectedElements
        .map(id => stageRef.current?.findOne(`#${id}`))
        .filter(Boolean)
      
      if (selectedNodes.length > 0) {
        transformerRef.current.nodes(selectedNodes)
        transformerRef.current.getLayer().batchDraw()
      }
    } else if (transformerRef.current) {
      transformerRef.current.nodes([])
    }
  }, [selectedElements])

  // Handle stage click (deselect)
  const handleStageClick = useCallback((e: any) => {
    if (e.target === e.target.getStage()) {
      setSelectedElements([])
      transformerRef.current?.nodes([])
    }
  }, [setSelectedElements])

  // Zoom functions
  const zoomIn = () => setZoom(Math.min(zoom * 1.2, 3))
  const zoomOut = () => setZoom(Math.max(zoom / 1.2, 0.1))

  // Toggle collaboration
  const toggleCollaboration = useCallback(async () => {
    if (collaboration.isConnected) {
      await collaboration.disconnect()
      toast.info('Collaboration stopped')
    } else if (projectId) {
      const session = await collaboration.createSession()
      if (session) {
        toast.success('Collaboration started')
      }
    }
  }, [collaboration, projectId])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (cursorUpdateTimeoutRef.current) {
        clearTimeout(cursorUpdateTimeoutRef.current)
      }
    }
  }, [])

  // Tool handlers
  const tools = [
    { id: 'select', icon: MousePointer, label: 'Select' },
    { id: 'hand', icon: Hand, label: 'Pan' },
    { id: 'rectangle', icon: Square, label: 'Rectangle' },
    { id: 'circle', icon: CircleIcon, label: 'Circle' },
    { id: 'text', icon: Type, label: 'Text' },
  ]

  return (
    <div className="flex flex-col h-full bg-gray-100">
      {/* Toolbar */}
      <div className="flex items-center justify-between p-4 bg-white border-b border-gray-200">
        <div className="flex items-center space-x-2">
          {tools.map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              onClick={() => setTool(id as any)}
              className={`p-2 rounded-lg transition-colors ${
                tool === id 
                  ? 'bg-imagineer-blue-600 text-white' 
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
              title={label}
            >
              <Icon className="w-5 h-5" />
            </button>
          ))}
        </div>

        <div className="flex items-center space-x-2">
          {/* Collaboration Controls */}
          {enableCollaboration && projectId && (
            <>
              <button
                onClick={toggleCollaboration}
                className={`p-2 rounded-lg flex items-center space-x-2 ${
                  collaboration.isConnected
                    ? 'bg-green-100 text-green-700'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
                title={collaboration.isConnected ? 'Stop Collaboration' : 'Start Collaboration'}
              >
                {collaboration.isConnected ? <Wifi className="w-5 h-5" /> : <WifiOff className="w-5 h-5" />}
              </button>

              {collaboration.isConnected && (
                <button
                  onClick={() => setShowCollaborators(!showCollaborators)}
                  className="p-2 rounded-lg bg-blue-100 text-blue-700 hover:bg-blue-200 relative"
                  title="Show Collaborators"
                >
                  <Users className="w-5 h-5" />
                  {onlineUsers.length > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                      {onlineUsers.length}
                    </span>
                  )}
                </button>
              )}

              <div className="w-px h-6 bg-gray-300" />
            </>
          )}

          <button
            onClick={zoomOut}
            className="p-2 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200"
            title="Zoom Out"
          >
            <ZoomOut className="w-5 h-5" />
          </button>
          <span className="px-2 py-1 text-sm bg-gray-100 rounded">
            {Math.round(scale * 100)}%
          </span>
          <button
            onClick={zoomIn}
            className="p-2 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200"
            title="Zoom In"
          >
            <ZoomIn className="w-5 h-5" />
          </button>

          <div className="w-px h-6 bg-gray-300 mx-2" />

          <button
            className="p-2 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200"
            title="Undo"
          >
            <Undo className="w-5 h-5" />
          </button>
          <button
            className="p-2 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200"
            title="Redo"
          >
            <Redo className="w-5 h-5" />
          </button>

          <div className="w-px h-6 bg-gray-300 mx-2" />

          <button
            onClick={() => onElementsChange?.(elements)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center space-x-2"
          >
            <Play className="w-4 h-4" />
            <span>Generate LLM Prompt</span>
          </button>
        </div>
      </div>

      {/* Canvas Area */}
      <div className="flex-1 overflow-hidden relative">
        <div className="absolute inset-0 bg-gray-200 flex items-center justify-center">
          <div 
            className="bg-white shadow-lg" 
            style={{ 
              width: width * scale, 
              height: height * scale,
              transform: `translate(${stagePos.x}px, ${stagePos.y}px)`
            }}
          >
            <Stage
              ref={stageRef}
              width={width}
              height={height}
              scaleX={scale}
              scaleY={scale}
              onClick={handleStageClick}
              onMouseMove={handleMouseMove}
              onDblClick={(e) => {
                if (tool === 'rectangle') addElement('rectangle', e)
                else if (tool === 'circle') addElement('circle', e) 
                else if (tool === 'text') addElement('text', e)
              }}
              draggable={tool === 'hand'}
              onDragEnd={(e) => {
                if (tool === 'hand') {
                  const newPos = { x: e.target.x(), y: e.target.y() }
                  setViewportPosition(newPos)
                }
              }}
            >
              <Layer>
                {/* Grid background */}
                {Array.from({ length: Math.ceil(width / 20) }).map((_, i) => (
                  <React.Fragment key={`grid-v-${i}`}>
                    <Rect
                      x={i * 20}
                      y={0}
                      width={1}
                      height={height}
                      fill="#f0f0f0"
                    />
                  </React.Fragment>
                ))}
                {Array.from({ length: Math.ceil(height / 20) }).map((_, i) => (
                  <React.Fragment key={`grid-h-${i}`}>
                    <Rect
                      x={0}
                      y={i * 20}
                      width={width}
                      height={1}
                      fill="#f0f0f0"
                    />
                  </React.Fragment>
                ))}

                {/* Design elements */}
                {elements.map((element) => {
                  if (element.type === 'rectangle') {
                    return (
                      <Rect
                        key={element.id}
                        id={element.id}
                        x={element.x}
                        y={element.y}
                        width={element.width}
                        height={element.height}
                        fill={element.fill}
                        stroke={selectedElements.includes(element.id) ? '#3b82f6' : undefined}
                        strokeWidth={selectedElements.includes(element.id) ? 2 : 0}
                        draggable={element.draggable && tool === 'select'}
                        onClick={() => handleElementClick(element.id)}
                        onDragEnd={(e) => handleElementDragEnd(element.id, e)}
                      />
                    )
                  }
                  
                  if (element.type === 'circle') {
                    return (
                      <Circle
                        key={element.id}
                        id={element.id}
                        x={element.x + (element.radius || 40)}
                        y={element.y + (element.radius || 40)}
                        radius={element.radius}
                        fill={element.fill}
                        stroke={selectedElements.includes(element.id) ? '#3b82f6' : undefined}
                        strokeWidth={selectedElements.includes(element.id) ? 2 : 0}
                        draggable={element.draggable && tool === 'select'}
                        onClick={() => handleElementClick(element.id)}
                        onDragEnd={(e) => handleElementDragEnd(element.id, e)}
                      />
                    )
                  }
                  
                  if (element.type === 'text') {
                    return (
                      <Text
                        key={element.id}
                        id={element.id}
                        x={element.x}
                        y={element.y}
                        text={element.text}
                        fontSize={element.fontSize}
                        fill={element.fill}
                        stroke={selectedElements.includes(element.id) ? '#3b82f6' : undefined}
                        strokeWidth={selectedElements.includes(element.id) ? 2 : 0}
                        draggable={element.draggable && tool === 'select'}
                        onClick={() => handleElementClick(element.id)}
                        onDragEnd={(e) => handleElementDragEnd(element.id, e)}
                      />
                    )
                  }
                  
                  return null
                })}

                {/* Collaborator cursors */}
                {collaboration.isConnected && onlineUsers.map((user) => (
                  user.cursor_position && (
                    <Circle
                      key={`cursor-${user.user_id}`}
                      x={user.cursor_position.x}
                      y={user.cursor_position.y}
                      radius={4}
                      fill={user.color}
                      listening={false}
                    />
                  )
                ))}

                {/* Collaborator selections */}
                {collaboration.isConnected && onlineUsers.map((user) => (
                  user.selected_elements?.map((elementId) => {
                    const element = elements.find(el => el.id === elementId)
                    if (!element) return null

                    return (
                      <Rect
                        key={`selection-${user.user_id}-${elementId}`}
                        x={element.x - 2}
                        y={element.y - 2}
                        width={(element.width || element.radius! * 2) + 4}
                        height={(element.height || element.radius! * 2) + 4}
                        stroke={user.color}
                        strokeWidth={2}
                        dash={[5, 5]}
                        listening={false}
                      />
                    )
                  }) || []
                ))}

                {/* Transformer for selected element */}
                <Transformer
                  ref={transformerRef}
                  boundBoxFunc={(oldBox, newBox) => {
                    // Limit resize
                    if (newBox.width < 5 || newBox.height < 5) {
                      return oldBox
                    }
                    return newBox
                  }}
                />
              </Layer>
            </Stage>
          </div>
        </div>

        {/* Canvas info */}
        <div className="absolute bottom-4 left-4 bg-white rounded-lg shadow-sm px-3 py-2 text-sm text-gray-600">
          Canvas: {width} × {height} | Elements: {elements.length} | Scale: {Math.round(scale * 100)}%
          {collaboration.isConnected && (
            <span className="ml-4 text-green-600">• Live Collaboration</span>
          )}
        </div>

        {/* Collaborators Panel */}
        {showCollaborators && collaboration.isConnected && (
          <div className="absolute top-4 right-4 bg-white rounded-lg shadow-lg p-4 w-64">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium text-gray-900">Collaborators</h3>
              <button
                onClick={() => setShowCollaborators(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ×
              </button>
            </div>
            
            <div className="space-y-2">
              {/* Current user */}
              {user && (
                <div className="flex items-center space-x-3 p-2 bg-blue-50 rounded-lg">
                  <div 
                    className="w-3 h-3 rounded-full bg-blue-500"
                  />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">
                      {user.name} (You)
                    </p>
                    <p className="text-xs text-gray-500">Owner</p>
                  </div>
                </div>
              )}
              
              {/* Online collaborators */}
              {onlineUsers.map((collaborator) => (
                collaborator.user_id !== user?.id && (
                  <div key={collaborator.user_id} className="flex items-center space-x-3 p-2 rounded-lg">
                    <div 
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: collaborator.color }}
                    />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">
                        {collaborator.user_name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {collaborator.is_online ? 'Online' : 'Offline'}
                      </p>
                    </div>
                    {collaborator.selected_elements && collaborator.selected_elements.length > 0 && (
                      <div className="text-xs text-gray-400">
                        {collaborator.selected_elements.length} selected
                      </div>
                    )}
                  </div>
                )
              ))}
              
              {onlineUsers.filter(u => u.user_id !== user?.id).length === 0 && (
                <p className="text-sm text-gray-500 text-center py-2">
                  No other collaborators online
                </p>
              )}
            </div>

            {/* Session info */}
            <div className="mt-4 pt-3 border-t border-gray-200">
              <p className="text-xs text-gray-500">
                Session: {collaboration.session?.id.slice(0, 8)}...
              </p>
              {collaboration.error && (
                <p className="text-xs text-red-500 mt-1">
                  {collaboration.error}
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
import React, { useState, useRef, useCallback, useEffect } from 'react'
import { Stage, Layer, Rect, Circle, Text, Line, Transformer, Group } from 'react-konva'
import { 
  MousePointer, 
  Square, 
  Circle as CircleIcon, 
  Type, 
  Minus,
  Pen,
  Move,
  RotateCw,
  Copy,
  Trash2,
  Lock,
  Unlock,
  Eye,
  EyeOff,
  ZoomIn,
  ZoomOut,
  Grid3X3,
  Layers,
  Palette,
  Download
} from 'lucide-react'
import Konva from 'konva'

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
}

interface DrawingLayer {
  id: string
  name: string
  visible: boolean
  locked: boolean
  opacity: number
  blendMode: string
  elements: string[]
}

interface ProfessionalCanvasProps {
  elements: DrawingElement[]
  layers: DrawingLayer[]
  onElementsChange: (elements: DrawingElement[]) => void
  onLayersChange: (layers: DrawingLayer[]) => void
  selectedElementIds: string[]
  onSelectionChange: (ids: string[]) => void
  canvasWidth?: number
  canvasHeight?: number
  theme: 'light' | 'dark'
}

export default function ProfessionalCanvas({
  elements,
  layers,
  onElementsChange,
  onLayersChange,
  selectedElementIds,
  onSelectionChange,
  canvasWidth = 1200,
  canvasHeight = 800,
  theme
}: ProfessionalCanvasProps) {
  const [tool, setTool] = useState<'select' | 'rect' | 'circle' | 'text' | 'line' | 'pen'>('select')
  const [isDrawing, setIsDrawing] = useState(false)
  const [currentStroke, setCurrentStroke] = useState<number[]>([])
  const [zoom, setZoom] = useState(1)
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 })
  const [showGrid, setShowGrid] = useState(true)
  const [snapToGrid, setSnapToGrid] = useState(true)
  const [gridSize] = useState(20)
  const [drawingColor, setDrawingColor] = useState('#3b82f6')
  const [strokeWidth, setStrokeWidth] = useState(2)

  const stageRef = useRef<Konva.Stage>(null)
  const transformerRef = useRef<Konva.Transformer>(null)
  const layerRef = useRef<Konva.Layer>(null)

  // Colors palette
  const colorPalette = [
    '#000000', '#ffffff', '#ff0000', '#00ff00', '#0000ff',
    '#ffff00', '#ff00ff', '#00ffff', '#ffa500', '#800080',
    '#ffc0cb', '#a52a2a', '#808080', '#000080', '#008000',
    '#ff6347', '#4682b4', '#d2691e', '#ff1493', '#00ced1'
  ]

  // Update transformer when selection changes
  useEffect(() => {
    if (transformerRef.current && stageRef.current) {
      const selectedNodes = selectedElementIds.map(id => 
        stageRef.current?.findOne(`#${id}`)
      ).filter(Boolean)
      
      if (selectedNodes.length > 0) {
        transformerRef.current.nodes(selectedNodes)
        transformerRef.current.getLayer()?.batchDraw()
      } else {
        transformerRef.current.nodes([])
      }
    }
  }, [selectedElementIds])

  const snapToGridFunc = useCallback((pos: { x: number, y: number }) => {
    if (!snapToGrid) return pos
    return {
      x: Math.round(pos.x / gridSize) * gridSize,
      y: Math.round(pos.y / gridSize) * gridSize
    }
  }, [snapToGrid, gridSize])

  const handleStageClick = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
    if (tool !== 'select') return

    const clickedOnEmpty = e.target === e.target.getStage()
    if (clickedOnEmpty) {
      onSelectionChange([])
    } else {
      const id = e.target.id()
      if (id && !selectedElementIds.includes(id)) {
        const newSelection = e.evt.ctrlKey || e.evt.metaKey
          ? [...selectedElementIds, id]
          : [id]
        onSelectionChange(newSelection)
      }
    }
  }, [tool, selectedElementIds, onSelectionChange])

  const handleMouseDown = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
    if (tool === 'select') return

    const pos = snapToGridFunc(e.target.getStage()!.getPointerPosition()!)
    setIsDrawing(true)

    const newId = `${tool}_${Date.now()}`
    let newElement: DrawingElement

    const activeLayer = layers.find(l => l.visible && !l.locked) || layers[0]

    switch (tool) {
      case 'rect':
        newElement = {
          id: newId,
          type: 'rect',
          x: pos.x,
          y: pos.y,
          width: 0,
          height: 0,
          fill: drawingColor,
          stroke: theme === 'dark' ? '#ffffff' : '#000000',
          strokeWidth,
          name: 'Rectangle',
          layerId: activeLayer.id,
          visible: true,
          locked: false
        }
        break
      case 'circle':
        newElement = {
          id: newId,
          type: 'circle',
          x: pos.x,
          y: pos.y,
          radius: 0,
          fill: drawingColor,
          stroke: theme === 'dark' ? '#ffffff' : '#000000',
          strokeWidth,
          name: 'Circle',
          layerId: activeLayer.id,
          visible: true,
          locked: false
        }
        break
      case 'text':
        newElement = {
          id: newId,
          type: 'text',
          x: pos.x,
          y: pos.y,
          text: 'Double click to edit',
          fontSize: 24,
          fontFamily: 'Inter, sans-serif',
          fill: theme === 'dark' ? '#ffffff' : '#000000',
          name: 'Text',
          layerId: activeLayer.id,
          visible: true,
          locked: false
        }
        break
      case 'line':
        newElement = {
          id: newId,
          type: 'line',
          x: 0,
          y: 0,
          points: [pos.x, pos.y, pos.x, pos.y],
          stroke: drawingColor,
          strokeWidth,
          name: 'Line',
          layerId: activeLayer.id,
          visible: true,
          locked: false
        }
        break
      case 'pen':
        setCurrentStroke([pos.x, pos.y])
        return
      default:
        return
    }

    onElementsChange([...elements, newElement])
  }, [tool, elements, drawingColor, strokeWidth, theme, layers, snapToGridFunc, onElementsChange])

  const handleMouseMove = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
    if (!isDrawing) return

    const pos = snapToGridFunc(e.target.getStage()!.getPointerPosition()!)

    if (tool === 'pen') {
      setCurrentStroke(prev => [...prev, pos.x, pos.y])
      return
    }

    const newElements = [...elements]
    const lastElement = newElements[newElements.length - 1]

    if (!lastElement) return

    switch (tool) {
      case 'rect':
        lastElement.width = Math.abs(pos.x - lastElement.x)
        lastElement.height = Math.abs(pos.y - lastElement.y)
        if (pos.x < lastElement.x) {
          lastElement.x = pos.x
        }
        if (pos.y < lastElement.y) {
          lastElement.y = pos.y
        }
        break
      case 'circle':
        const radius = Math.sqrt(
          Math.pow(pos.x - lastElement.x, 2) + Math.pow(pos.y - lastElement.y, 2)
        )
        lastElement.radius = radius
        break
      case 'line':
        if (lastElement.points && lastElement.points.length >= 4) {
          lastElement.points[2] = pos.x
          lastElement.points[3] = pos.y
        }
        break
    }

    onElementsChange(newElements)
  }, [isDrawing, tool, elements, snapToGridFunc, onElementsChange])

  const handleMouseUp = useCallback(() => {
    if (tool === 'pen' && currentStroke.length > 0) {
      const activeLayer = layers.find(l => l.visible && !l.locked) || layers[0]
      const newElement: DrawingElement = {
        id: `pen_${Date.now()}`,
        type: 'pen',
        x: 0,
        y: 0,
        points: currentStroke,
        stroke: drawingColor,
        strokeWidth,
        name: 'Drawing',
        layerId: activeLayer.id,
        visible: true,
        locked: false
      }
      onElementsChange([...elements, newElement])
      setCurrentStroke([])
    }
    setIsDrawing(false)
  }, [tool, currentStroke, drawingColor, strokeWidth, elements, layers, onElementsChange])

  const handleZoom = useCallback((direction: 'in' | 'out') => {
    const newZoom = direction === 'in' 
      ? Math.min(zoom * 1.2, 5)
      : Math.max(zoom / 1.2, 0.1)
    setZoom(newZoom)
  }, [zoom])

  const renderGridLines = () => {
    if (!showGrid) return null
    
    const lines = []
    const stageWidth = canvasWidth * zoom
    const stageHeight = canvasHeight * zoom
    
    // Vertical lines
    for (let i = 0; i < stageWidth; i += gridSize * zoom) {
      lines.push(
        <Line
          key={`v${i}`}
          points={[i, 0, i, stageHeight]}
          stroke={theme === 'dark' ? '#374151' : '#e5e7eb'}
          strokeWidth={0.5}
          opacity={0.3}
        />
      )
    }
    
    // Horizontal lines
    for (let i = 0; i < stageHeight; i += gridSize * zoom) {
      lines.push(
        <Line
          key={`h${i}`}
          points={[0, i, stageWidth, i]}
          stroke={theme === 'dark' ? '#374151' : '#e5e7eb'}
          strokeWidth={0.5}
          opacity={0.3}
        />
      )
    }
    
    return lines
  }

  const renderElement = useCallback((element: DrawingElement) => {
    const layer = layers.find(l => l.id === element.layerId)
    if (!layer || !layer.visible || !element.visible) return null

    const commonProps = {
      id: element.id,
      x: element.x,
      y: element.y,
      fill: element.fill,
      stroke: element.stroke,
      strokeWidth: element.strokeWidth,
      opacity: (element.opacity || 1) * (layer.opacity || 1),
      rotation: element.rotation || 0,
      scaleX: element.scaleX || 1,
      scaleY: element.scaleY || 1,
      draggable: tool === 'select' && !element.locked && !layer.locked,
      onDragEnd: (e: Konva.KonvaEventObject<DragEvent>) => {
        const newElements = elements.map(el =>
          el.id === element.id
            ? { ...el, x: e.target.x(), y: e.target.y() }
            : el
        )
        onElementsChange(newElements)
      }
    }

    switch (element.type) {
      case 'rect':
        return (
          <Rect
            {...commonProps}
            width={element.width || 0}
            height={element.height || 0}
          />
        )
      case 'circle':
        return (
          <Circle
            {...commonProps}
            radius={element.radius || 0}
          />
        )
      case 'text':
        return (
          <Text
            {...commonProps}
            text={element.text || ''}
            fontSize={element.fontSize || 24}
            fontFamily={element.fontFamily || 'Inter, sans-serif'}
            onDblClick={() => {
              // Enable text editing
              const textNode = stageRef.current?.findOne(`#${element.id}`) as Konva.Text
              if (textNode) {
                textNode.hide()
                const textarea = document.createElement('textarea')
                document.body.appendChild(textarea)
                textarea.value = element.text || ''
                textarea.style.position = 'absolute'
                textarea.style.top = '50%'
                textarea.style.left = '50%'
                textarea.style.transform = 'translate(-50%, -50%)'
                textarea.style.width = '200px'
                textarea.style.height = '100px'
                textarea.style.fontSize = '16px'
                textarea.style.border = '2px solid #3b82f6'
                textarea.style.borderRadius = '4px'
                textarea.style.background = theme === 'dark' ? '#1f2937' : '#ffffff'
                textarea.style.color = theme === 'dark' ? '#ffffff' : '#000000'
                textarea.focus()
                textarea.select()
                
                const handleSubmit = () => {
                  const newElements = elements.map(el =>
                    el.id === element.id
                      ? { ...el, text: textarea.value }
                      : el
                  )
                  onElementsChange(newElements)
                  textNode.show()
                  document.body.removeChild(textarea)
                  layerRef.current?.batchDraw()
                }
                
                textarea.addEventListener('blur', handleSubmit)
                textarea.addEventListener('keydown', (e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleSubmit()
                  }
                })
              }
            }}
          />
        )
      case 'line':
        return (
          <Line
            {...commonProps}
            points={element.points || []}
          />
        )
      case 'pen':
        return (
          <Line
            {...commonProps}
            points={element.points || []}
            tension={0.5}
            lineCap="round"
            lineJoin="round"
          />
        )
      default:
        return null
    }
  }, [elements, layers, tool, theme, onElementsChange])

  return (
    <div className={`flex flex-col h-full ${theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'}`}>
      {/* Top Toolbar */}
      <div className={`flex items-center justify-between px-4 py-2 border-b ${
        theme === 'dark' 
          ? 'bg-gray-800 border-gray-700' 
          : 'bg-white border-gray-200'
      }`}>
        {/* Drawing Tools */}
        <div className="flex items-center space-x-1">
          <button
            onClick={() => setTool('select')}
            className={`p-2 rounded ${tool === 'select' 
              ? 'bg-blue-500 text-white' 
              : theme === 'dark' ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
            }`}
            title="Select Tool (V)"
          >
            <MousePointer className="w-4 h-4" />
          </button>
          <button
            onClick={() => setTool('rect')}
            className={`p-2 rounded ${tool === 'rect' 
              ? 'bg-blue-500 text-white' 
              : theme === 'dark' ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
            }`}
            title="Rectangle Tool (R)"
          >
            <Square className="w-4 h-4" />
          </button>
          <button
            onClick={() => setTool('circle')}
            className={`p-2 rounded ${tool === 'circle' 
              ? 'bg-blue-500 text-white' 
              : theme === 'dark' ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
            }`}
            title="Circle Tool (C)"
          >
            <CircleIcon className="w-4 h-4" />
          </button>
          <button
            onClick={() => setTool('text')}
            className={`p-2 rounded ${tool === 'text' 
              ? 'bg-blue-500 text-white' 
              : theme === 'dark' ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
            }`}
            title="Text Tool (T)"
          >
            <Type className="w-4 h-4" />
          </button>
          <button
            onClick={() => setTool('line')}
            className={`p-2 rounded ${tool === 'line' 
              ? 'bg-blue-500 text-white' 
              : theme === 'dark' ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
            }`}
            title="Line Tool (L)"
          >
            <Minus className="w-4 h-4" />
          </button>
          <button
            onClick={() => setTool('pen')}
            className={`p-2 rounded ${tool === 'pen' 
              ? 'bg-blue-500 text-white' 
              : theme === 'dark' ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
            }`}
            title="Pen Tool (P)"
          >
            <Pen className="w-4 h-4" />
          </button>
        </div>

        {/* Color Palette */}
        <div className="flex items-center space-x-2">
          <div className="flex space-x-1">
            {colorPalette.slice(0, 10).map(color => (
              <button
                key={color}
                onClick={() => setDrawingColor(color)}
                className={`w-6 h-6 rounded border-2 ${
                  drawingColor === color ? 'border-blue-500' : 'border-gray-300'
                }`}
                style={{ backgroundColor: color }}
                title={color}
              />
            ))}
          </div>
          <input
            type="color"
            value={drawingColor}
            onChange={(e) => setDrawingColor(e.target.value)}
            className="w-8 h-8 rounded border-none"
          />
        </div>

        {/* View Controls */}
        <div className="flex items-center space-x-2">
          <button
            onClick={() => handleZoom('out')}
            className={`p-2 rounded ${theme === 'dark' ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}
            title="Zoom Out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className={`text-sm px-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={() => handleZoom('in')}
            className={`p-2 rounded ${theme === 'dark' ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}
            title="Zoom In"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowGrid(!showGrid)}
            className={`p-2 rounded ${showGrid 
              ? 'bg-blue-500 text-white' 
              : theme === 'dark' ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
            }`}
            title="Toggle Grid"
          >
            <Grid3X3 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Canvas Area */}
      <div className="flex-1 overflow-hidden relative">
        <Stage
          ref={stageRef}
          width={canvasWidth}
          height={canvasHeight}
          scaleX={zoom}
          scaleY={zoom}
          x={panOffset.x}
          y={panOffset.y}
          onMouseDown={handleStageClick}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          className="border"
        >
          <Layer ref={layerRef}>
            {renderGridLines()}
            {elements
              .sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0))
              .map(element => (
                <React.Fragment key={element.id}>
                  {renderElement(element)}
                </React.Fragment>
              ))}
            {/* Current stroke for pen tool */}
            {tool === 'pen' && currentStroke.length > 0 && (
              <Line
                points={currentStroke}
                stroke={drawingColor}
                strokeWidth={strokeWidth}
                tension={0.5}
                lineCap="round"
                lineJoin="round"
              />
            )}
          </Layer>
          <Layer>
            <Transformer
              ref={transformerRef}
              boundBoxFunc={(oldBox, newBox) => {
                // Limit resize
                if (newBox.width < 10 || newBox.height < 10) {
                  return oldBox
                }
                return newBox
              }}
            />
          </Layer>
        </Stage>
      </div>

      {/* Status Bar */}
      <div className={`px-4 py-2 text-sm border-t flex justify-between items-center ${
        theme === 'dark' 
          ? 'bg-gray-800 border-gray-700 text-gray-300' 
          : 'bg-white border-gray-200 text-gray-600'
      }`}>
        <div>
          {elements.length} elements • {layers.filter(l => l.visible).length} visible layers
        </div>
        <div>
          {canvasWidth} × {canvasHeight}px • {Math.round(zoom * 100)}% zoom
        </div>
      </div>
    </div>
  )
}
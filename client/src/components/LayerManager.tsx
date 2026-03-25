import React, { useState, useRef } from 'react'
import {
  Eye,
  EyeOff,
  Lock,
  Unlock,
  ChevronDown,
  ChevronRight,
  Plus,
  Trash2,
  Copy,
  MoreHorizontal,
  Move,
  Folder,
  FolderOpen,
  Square,
  Circle,
  Type,
  Pen,
  Minus
} from 'lucide-react'

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

interface DrawingElement {
  id: string
  name: string
  type: 'rect' | 'circle' | 'text' | 'line' | 'pen' | 'group'
  layerId: string
  visible?: boolean
  locked?: boolean
  selected?: boolean
}

interface LayerManagerProps {
  layers: DrawingLayer[]
  elements: DrawingElement[]
  onLayersChange: (layers: DrawingLayer[]) => void
  onElementsChange: (elements: DrawingElement[]) => void
  selectedLayerId?: string
  selectedElementIds: string[]
  onLayerSelect: (layerId: string) => void
  onElementSelect: (elementIds: string[]) => void
  theme: 'light' | 'dark'
}

export default function LayerManager({
  layers,
  elements,
  onLayersChange,
  onElementsChange,
  selectedLayerId,
  selectedElementIds,
  onLayerSelect,
  onElementSelect,
  theme
}: LayerManagerProps) {
  const [draggedLayer, setDraggedLayer] = useState<string | null>(null)
  const [draggedElement, setDraggedElement] = useState<string | null>(null)
  const [contextMenu, setContextMenu] = useState<{
    x: number
    y: number
    target: string
    type: 'layer' | 'element'
  } | null>(null)
  const contextMenuRef = useRef<HTMLDivElement>(null)

  const createNewLayer = () => {
    const newLayer: DrawingLayer = {
      id: `layer_${Date.now()}`,
      name: `Layer ${layers.length + 1}`,
      visible: true,
      locked: false,
      opacity: 1,
      blendMode: 'normal',
      elements: [],
      type: 'layer'
    }
    onLayersChange([...layers, newLayer])
    onLayerSelect(newLayer.id)
  }

  const createLayerGroup = () => {
    const newGroup: DrawingLayer = {
      id: `group_${Date.now()}`,
      name: `Group ${layers.filter(l => l.type === 'group').length + 1}`,
      visible: true,
      locked: false,
      opacity: 1,
      blendMode: 'normal',
      elements: [],
      type: 'group',
      expanded: true
    }
    onLayersChange([...layers, newGroup])
    onLayerSelect(newGroup.id)
  }

  const duplicateLayer = (layerId: string) => {
    const layer = layers.find(l => l.id === layerId)
    if (!layer) return

    const newLayer: DrawingLayer = {
      ...layer,
      id: `layer_${Date.now()}`,
      name: `${layer.name} Copy`,
      elements: [] // Elements would be duplicated separately
    }

    const layerIndex = layers.findIndex(l => l.id === layerId)
    const newLayers = [...layers]
    newLayers.splice(layerIndex + 1, 0, newLayer)
    onLayersChange(newLayers)
  }

  const deleteLayer = (layerId: string) => {
    const layer = layers.find(l => l.id === layerId)
    if (!layer) return

    // Move elements to another layer or delete them
    const elementsInLayer = elements.filter(e => e.layerId === layerId)
    const remainingLayers = layers.filter(l => l.id !== layerId)
    const targetLayer = remainingLayers[0]

    if (targetLayer && elementsInLayer.length > 0) {
      // Move elements to first available layer
      const updatedElements = elements.map(e => 
        e.layerId === layerId 
          ? { ...e, layerId: targetLayer.id }
          : e
      )
      onElementsChange(updatedElements)
    } else {
      // Delete elements if no other layers exist
      const remainingElements = elements.filter(e => e.layerId !== layerId)
      onElementsChange(remainingElements)
    }

    onLayersChange(remainingLayers)
    
    if (selectedLayerId === layerId && remainingLayers.length > 0) {
      onLayerSelect(remainingLayers[0].id)
    }
  }

  const toggleLayerVisibility = (layerId: string) => {
    const updatedLayers = layers.map(layer =>
      layer.id === layerId 
        ? { ...layer, visible: !layer.visible }
        : layer
    )
    onLayersChange(updatedLayers)
  }

  const toggleLayerLock = (layerId: string) => {
    const updatedLayers = layers.map(layer =>
      layer.id === layerId 
        ? { ...layer, locked: !layer.locked }
        : layer
    )
    onLayersChange(updatedLayers)
  }

  const updateLayerOpacity = (layerId: string, opacity: number) => {
    const updatedLayers = layers.map(layer =>
      layer.id === layerId 
        ? { ...layer, opacity: opacity / 100 }
        : layer
    )
    onLayersChange(updatedLayers)
  }

  const renameLayer = (layerId: string, newName: string) => {
    const updatedLayers = layers.map(layer =>
      layer.id === layerId 
        ? { ...layer, name: newName }
        : layer
    )
    onLayersChange(updatedLayers)
  }

  const getElementIcon = (type: string) => {
    switch (type) {
      case 'rect': return <Square className="w-3 h-3" />
      case 'circle': return <Circle className="w-3 h-3" />
      case 'text': return <Type className="w-3 h-3" />
      case 'line': return <Minus className="w-3 h-3" />
      case 'pen': return <Pen className="w-3 h-3" />
      case 'group': return <Folder className="w-3 h-3" />
      default: return <Square className="w-3 h-3" />
    }
  }

  const handleContextMenu = (e: React.MouseEvent, target: string, type: 'layer' | 'element') => {
    e.preventDefault()
    e.stopPropagation()
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      target,
      type
    })
  }

  const closeContextMenu = () => {
    setContextMenu(null)
  }

  // Click outside to close context menu
  React.useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        closeContextMenu()
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const renderContextMenu = () => {
    if (!contextMenu) return null

    const isLayer = contextMenu.type === 'layer'
    
    return (
      <div
        ref={contextMenuRef}
        className={`fixed z-50 py-2 w-48 rounded-lg shadow-lg border ${
          theme === 'dark'
            ? 'bg-gray-800 border-gray-700'
            : 'bg-white border-gray-200'
        }`}
        style={{ left: contextMenu.x, top: contextMenu.y }}
      >
        {isLayer ? (
          <>
            <button
              onClick={() => {
                duplicateLayer(contextMenu.target)
                closeContextMenu()
              }}
              className={`w-full px-3 py-2 text-left text-sm flex items-center hover:${
                theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'
              }`}
            >
              <Copy className="w-4 h-4 mr-2" />
              Duplicate Layer
            </button>
            <button
              onClick={() => {
                deleteLayer(contextMenu.target)
                closeContextMenu()
              }}
              className={`w-full px-3 py-2 text-left text-sm flex items-center hover:${
                theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'
              } text-red-600`}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete Layer
            </button>
            <hr className={`my-1 ${theme === 'dark' ? 'border-gray-700' : 'border-gray-200'}`} />
            <button
              onClick={() => {
                createLayerGroup()
                closeContextMenu()
              }}
              className={`w-full px-3 py-2 text-left text-sm flex items-center hover:${
                theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'
              }`}
            >
              <Folder className="w-4 h-4 mr-2" />
              Create Group
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => {
                // Duplicate element logic would go here
                closeContextMenu()
              }}
              className={`w-full px-3 py-2 text-left text-sm flex items-center hover:${
                theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'
              }`}
            >
              <Copy className="w-4 h-4 mr-2" />
              Duplicate Element
            </button>
            <button
              onClick={() => {
                // Delete element logic would go here
                closeContextMenu()
              }}
              className={`w-full px-3 py-2 text-left text-sm flex items-center hover:${
                theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'
              } text-red-600`}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete Element
            </button>
          </>
        )}
      </div>
    )
  }

  return (
    <div className={`w-64 h-full flex flex-col border-l ${
      theme === 'dark'
        ? 'bg-gray-900 border-gray-700'
        : 'bg-white border-gray-200'
    }`}>
      {/* Header */}
      <div className={`px-3 py-2 border-b flex items-center justify-between ${
        theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
      }`}>
        <h3 className={`font-semibold text-sm ${
          theme === 'dark' ? 'text-white' : 'text-gray-900'
        }`}>
          Layers
        </h3>
        <div className="flex space-x-1">
          <button
            onClick={createNewLayer}
            className={`p-1 rounded hover:${
              theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'
            }`}
            title="New Layer"
          >
            <Plus className="w-4 h-4" />
          </button>
          <button
            onClick={createLayerGroup}
            className={`p-1 rounded hover:${
              theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'
            }`}
            title="New Group"
          >
            <Folder className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Layers List */}
      <div className="flex-1 overflow-y-auto">
        {layers.map((layer, index) => (
          <div key={layer.id} className="relative">
            {/* Layer Item */}
            <div
              className={`px-3 py-2 border-b cursor-pointer select-none ${
                selectedLayerId === layer.id
                  ? theme === 'dark'
                    ? 'bg-blue-900 border-blue-700'
                    : 'bg-blue-50 border-blue-200'
                  : theme === 'dark'
                    ? 'border-gray-700 hover:bg-gray-800'
                    : 'border-gray-100 hover:bg-gray-50'
              }`}
              onClick={() => onLayerSelect(layer.id)}
              onContextMenu={(e) => handleContextMenu(e, layer.id, 'layer')}
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center space-x-2 flex-1">
                  {layer.type === 'group' && (
                    <button className="p-0">
                      {layer.expanded ? (
                        <ChevronDown className="w-3 h-3" />
                      ) : (
                        <ChevronRight className="w-3 h-3" />
                      )}
                    </button>
                  )}
                  <div className="flex items-center space-x-1">
                    {layer.type === 'group' ? (
                      layer.expanded ? (
                        <FolderOpen className="w-4 h-4" />
                      ) : (
                        <Folder className="w-4 h-4" />
                      )
                    ) : (
                      <div className={`w-4 h-4 rounded border ${
                        theme === 'dark' ? 'border-gray-600' : 'border-gray-300'
                      }`} />
                    )}
                  </div>
                  <input
                    type="text"
                    value={layer.name}
                    onChange={(e) => renameLayer(layer.id, e.target.value)}
                    className={`bg-transparent border-none outline-none text-sm flex-1 ${
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    }`}
                    onFocus={(e) => e.target.select()}
                  />
                </div>
                <div className="flex items-center space-x-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      toggleLayerVisibility(layer.id)
                    }}
                    className={`p-1 rounded hover:${
                      theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'
                    }`}
                  >
                    {layer.visible ? (
                      <Eye className="w-3 h-3" />
                    ) : (
                      <EyeOff className="w-3 h-3 opacity-50" />
                    )}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      toggleLayerLock(layer.id)
                    }}
                    className={`p-1 rounded hover:${
                      theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'
                    }`}
                  >
                    {layer.locked ? (
                      <Lock className="w-3 h-3" />
                    ) : (
                      <Unlock className="w-3 h-3 opacity-50" />
                    )}
                  </button>
                </div>
              </div>
              
              {/* Opacity Slider */}
              <div className="mt-1">
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={Math.round(layer.opacity * 100)}
                  onChange={(e) => updateLayerOpacity(layer.id, parseInt(e.target.value))}
                  className="w-full h-1 rounded-lg appearance-none cursor-pointer bg-gray-300"
                  onClick={(e) => e.stopPropagation()}
                />
                <div className={`text-xs mt-1 ${
                  theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                }`}>
                  Opacity: {Math.round(layer.opacity * 100)}%
                </div>
              </div>
            </div>

            {/* Layer Elements */}
            {layer.visible && (!layer.type || layer.type === 'layer' || layer.expanded) && (
              <div className="ml-4">
                {elements
                  .filter(element => element.layerId === layer.id)
                  .map(element => (
                    <div
                      key={element.id}
                      className={`px-3 py-1 text-xs border-b cursor-pointer flex items-center space-x-2 ${
                        selectedElementIds.includes(element.id)
                          ? theme === 'dark'
                            ? 'bg-blue-900 border-blue-700'
                            : 'bg-blue-50 border-blue-200'
                          : theme === 'dark'
                            ? 'border-gray-700 hover:bg-gray-800'
                            : 'border-gray-100 hover:bg-gray-50'
                      }`}
                      onClick={(e) => {
                        e.stopPropagation()
                        const newSelection = e.ctrlKey || e.metaKey
                          ? selectedElementIds.includes(element.id)
                            ? selectedElementIds.filter(id => id !== element.id)
                            : [...selectedElementIds, element.id]
                          : [element.id]
                        onElementSelect(newSelection)
                      }}
                      onContextMenu={(e) => handleContextMenu(e, element.id, 'element')}
                    >
                      {getElementIcon(element.type)}
                      <span className={`flex-1 ${
                        theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
                      }`}>
                        {element.name}
                      </span>
                      <div className="flex items-center space-x-1">
                        {element.visible === false && (
                          <EyeOff className="w-3 h-3 opacity-50" />
                        )}
                        {element.locked && (
                          <Lock className="w-3 h-3" />
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className={`px-3 py-2 text-xs border-t ${
        theme === 'dark'
          ? 'border-gray-700 text-gray-400'
          : 'border-gray-200 text-gray-500'
      }`}>
        {layers.length} layers • {elements.length} elements
      </div>

      {renderContextMenu()}
    </div>
  )
}
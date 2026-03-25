import { 
  Layers, 
  Eye, 
  EyeOff, 
  Lock, 
  Unlock,
  Square,
  Circle,
  Type,
  Trash2,
  Copy
} from 'lucide-react'

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
}

interface LayersPanelProps {
  elements: DesignElement[]
  selectedId: string | null
  onSelectElement: (id: string) => void
  onDeleteElement: (id: string) => void
  onDuplicateElement: (id: string) => void
  onToggleVisibility: (id: string) => void
  onToggleLock: (id: string) => void
  onRenameElement: (id: string, name: string) => void
}

export default function LayersPanel({
  elements,
  selectedId,
  onSelectElement,
  onDeleteElement,
  onDuplicateElement,
  onToggleVisibility,
  onToggleLock,
  onRenameElement
}: LayersPanelProps) {
  const getElementIcon = (type: string) => {
    switch (type) {
      case 'rectangle': return <Square className="w-4 h-4" />
      case 'circle': return <Circle className="w-4 h-4" />
      case 'text': return <Type className="w-4 h-4" />
      default: return <Square className="w-4 h-4" />
    }
  }

  const getElementName = (element: DesignElement) => {
    if (element.name) return element.name
    if (element.type === 'text') return element.text || 'Text'
    return `${element.type.charAt(0).toUpperCase() + element.type.slice(1)}`
  }

  return (
    <div className="w-64 bg-white border-l border-gray-200 flex flex-col">
      {/* Panel Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center space-x-2">
          <Layers className="w-5 h-5 text-gray-600" />
          <h3 className="font-medium text-gray-900">Layers</h3>
          <span className="text-sm text-gray-500">({elements.length})</span>
        </div>
      </div>

      {/* Layers List */}
      <div className="flex-1 overflow-y-auto">
        {elements.length === 0 ? (
          <div className="p-4 text-center text-gray-500">
            <Layers className="w-8 h-8 mx-auto mb-2 text-gray-300" />
            <p className="text-sm">No layers yet</p>
            <p className="text-xs text-gray-400 mt-1">
              Double-click tools to add elements
            </p>
          </div>
        ) : (
          <div className="p-2">
            {elements.map((element, index) => {
              const isSelected = element.id === selectedId
              const isVisible = element.visible !== false
              const isLocked = element.locked === true
              
              return (
                <div
                  key={element.id}
                  className={`
                    group flex items-center p-2 rounded-lg cursor-pointer transition-colors
                    ${isSelected 
                      ? 'bg-imagineer-blue-100 border border-imagineer-blue-300' 
                      : 'hover:bg-gray-50 border border-transparent'
                    }
                  `}
                  onClick={() => onSelectElement(element.id)}
                >
                  {/* Element Icon */}
                  <div className={`
                    flex-shrink-0 p-1.5 rounded 
                    ${isSelected ? 'text-imagineer-blue-600' : 'text-gray-500'}
                  `}>
                    {getElementIcon(element.type)}
                  </div>

                  {/* Element Name */}
                  <div className="flex-1 mx-2 min-w-0">
                    <input
                      type="text"
                      value={getElementName(element)}
                      onChange={(e) => onRenameElement(element.id, e.target.value)}
                      className={`
                        w-full bg-transparent border-none outline-none text-sm
                        ${isSelected ? 'text-imagineer-blue-900' : 'text-gray-700'}
                      `}
                      onFocus={(e) => e.target.select()}
                    />
                    <div className="text-xs text-gray-400 truncate">
                      {Math.round(element.x)}, {Math.round(element.y)}
                      {element.type === 'rectangle' && ` • ${Math.round(element.width || 0)}×${Math.round(element.height || 0)}`}
                      {element.type === 'circle' && ` • r${Math.round(element.radius || 0)}`}
                    </div>
                  </div>

                  {/* Controls */}
                  <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {/* Visibility Toggle */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        onToggleVisibility(element.id)
                      }}
                      className="p-1 hover:bg-gray-200 rounded"
                      title={isVisible ? 'Hide' : 'Show'}
                    >
                      {isVisible ? (
                        <Eye className="w-3 h-3 text-gray-600" />
                      ) : (
                        <EyeOff className="w-3 h-3 text-gray-400" />
                      )}
                    </button>

                    {/* Lock Toggle */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        onToggleLock(element.id)
                      }}
                      className="p-1 hover:bg-gray-200 rounded"
                      title={isLocked ? 'Unlock' : 'Lock'}
                    >
                      {isLocked ? (
                        <Lock className="w-3 h-3 text-gray-600" />
                      ) : (
                        <Unlock className="w-3 h-3 text-gray-400" />
                      )}
                    </button>

                    {/* Duplicate */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        onDuplicateElement(element.id)
                      }}
                      className="p-1 hover:bg-gray-200 rounded"
                      title="Duplicate"
                    >
                      <Copy className="w-3 h-3 text-gray-600" />
                    </button>

                    {/* Delete */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        onDeleteElement(element.id)
                      }}
                      className="p-1 hover:bg-red-100 text-red-600 rounded"
                      title="Delete"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>

                  {/* Layer Order */}
                  <div className="flex-shrink-0 ml-2 text-xs text-gray-400">
                    {elements.length - index}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Layer Actions */}
      <div className="p-3 border-t border-gray-200 bg-gray-50">
        <div className="text-xs text-gray-500 mb-2">Layer Actions</div>
        <div className="grid grid-cols-3 gap-1">
          <button className="p-2 text-xs bg-white border border-gray-200 rounded hover:bg-gray-50">
            Group
          </button>
          <button className="p-2 text-xs bg-white border border-gray-200 rounded hover:bg-gray-50">
            Align
          </button>
          <button className="p-2 text-xs bg-white border border-gray-200 rounded hover:bg-gray-50">
            Order
          </button>
        </div>
      </div>
    </div>
  )
}
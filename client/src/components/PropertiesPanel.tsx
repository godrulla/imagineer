import { Settings, Palette, Move, Maximize, AlignCenter } from 'lucide-react'

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
  rotation?: number
  opacity?: number
}

interface PropertiesPanelProps {
  selectedElement: DesignElement | null
  onUpdateElement: (id: string, updates: Partial<DesignElement>) => void
}

export default function PropertiesPanel({
  selectedElement,
  onUpdateElement
}: PropertiesPanelProps) {
  const handleChange = (property: keyof DesignElement, value: any) => {
    if (!selectedElement) return
    onUpdateElement(selectedElement.id, { [property]: value })
  }

  const ColorPicker = ({ value, onChange, label }: { value: string, onChange: (color: string) => void, label: string }) => (
    <div className="flex items-center space-x-2">
      <label className="text-xs text-gray-600 w-12">{label}</label>
      <div className="flex items-center space-x-2 flex-1">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-8 h-8 rounded border border-gray-300 cursor-pointer"
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-imagineer-blue-500"
          placeholder="#000000"
        />
      </div>
    </div>
  )

  const NumberInput = ({ value, onChange, label, min, max, step = 1 }: { 
    value: number | undefined, 
    onChange: (value: number) => void, 
    label: string,
    min?: number,
    max?: number,
    step?: number
  }) => (
    <div className="flex items-center space-x-2">
      <label className="text-xs text-gray-600 w-12">{label}</label>
      <input
        type="number"
        value={value || 0}
        onChange={(e) => onChange(Number(e.target.value))}
        min={min}
        max={max}
        step={step}
        className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-imagineer-blue-500"
      />
    </div>
  )

  if (!selectedElement) {
    return (
      <div className="w-64 bg-white border-l border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center space-x-2">
            <Settings className="w-5 h-5 text-gray-600" />
            <h3 className="font-medium text-gray-900">Properties</h3>
          </div>
        </div>
        <div className="flex-1 p-4 flex items-center justify-center text-gray-500">
          <div className="text-center">
            <Settings className="w-8 h-8 mx-auto mb-2 text-gray-300" />
            <p className="text-sm">No element selected</p>
            <p className="text-xs text-gray-400 mt-1">
              Select an element to edit properties
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="w-64 bg-white border-l border-gray-200 flex flex-col">
      {/* Panel Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center space-x-2">
          <Settings className="w-5 h-5 text-gray-600" />
          <h3 className="font-medium text-gray-900">Properties</h3>
        </div>
        <div className="mt-1 text-sm text-gray-500 capitalize">
          {selectedElement.type} Selected
        </div>
      </div>

      {/* Properties Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        
        {/* Position & Size */}
        <div className="space-y-3">
          <div className="flex items-center space-x-2">
            <Move className="w-4 h-4 text-gray-600" />
            <h4 className="font-medium text-gray-900">Position</h4>
          </div>
          
          <NumberInput
            label="X"
            value={selectedElement.x}
            onChange={(value) => handleChange('x', value)}
          />
          
          <NumberInput
            label="Y"
            value={selectedElement.y}
            onChange={(value) => handleChange('y', value)}
          />

          {selectedElement.type === 'rectangle' && (
            <>
              <div className="flex items-center space-x-2 mt-4">
                <Maximize className="w-4 h-4 text-gray-600" />
                <h4 className="font-medium text-gray-900">Size</h4>
              </div>
              
              <NumberInput
                label="W"
                value={selectedElement.width}
                onChange={(value) => handleChange('width', value)}
                min={1}
              />
              
              <NumberInput
                label="H"
                value={selectedElement.height}
                onChange={(value) => handleChange('height', value)}
                min={1}
              />
            </>
          )}

          {selectedElement.type === 'circle' && (
            <>
              <div className="flex items-center space-x-2 mt-4">
                <Maximize className="w-4 h-4 text-gray-600" />
                <h4 className="font-medium text-gray-900">Size</h4>
              </div>
              
              <NumberInput
                label="Radius"
                value={selectedElement.radius}
                onChange={(value) => handleChange('radius', value)}
                min={1}
              />
            </>
          )}
        </div>

        {/* Appearance */}
        <div className="space-y-3">
          <div className="flex items-center space-x-2">
            <Palette className="w-4 h-4 text-gray-600" />
            <h4 className="font-medium text-gray-900">Appearance</h4>
          </div>

          <ColorPicker
            label="Fill"
            value={selectedElement.fill}
            onChange={(value) => handleChange('fill', value)}
          />

          <NumberInput
            label="Opacity"
            value={selectedElement.opacity || 1}
            onChange={(value) => handleChange('opacity', value)}
            min={0}
            max={1}
            step={0.1}
          />

          <NumberInput
            label="Rotation"
            value={selectedElement.rotation || 0}
            onChange={(value) => handleChange('rotation', value)}
            min={-180}
            max={180}
          />
        </div>

        {/* Text Properties */}
        {selectedElement.type === 'text' && (
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <AlignCenter className="w-4 h-4 text-gray-600" />
              <h4 className="font-medium text-gray-900">Text</h4>
            </div>

            <div className="flex items-center space-x-2">
              <label className="text-xs text-gray-600 w-12">Text</label>
              <input
                type="text"
                value={selectedElement.text || ''}
                onChange={(e) => handleChange('text', e.target.value)}
                className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-imagineer-blue-500"
                placeholder="Enter text..."
              />
            </div>

            <NumberInput
              label="Size"
              value={selectedElement.fontSize}
              onChange={(value) => handleChange('fontSize', value)}
              min={8}
              max={200}
            />

            <div className="grid grid-cols-3 gap-1 mt-2">
              <button className="p-2 text-xs border border-gray-300 rounded hover:bg-gray-50">
                <strong>B</strong>
              </button>
              <button className="p-2 text-xs border border-gray-300 rounded hover:bg-gray-50">
                <em>I</em>
              </button>
              <button className="p-2 text-xs border border-gray-300 rounded hover:bg-gray-50">
                <u>U</u>
              </button>
            </div>
          </div>
        )}

        {/* Effects */}
        <div className="space-y-3">
          <h4 className="font-medium text-gray-900">Effects</h4>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-600">Drop Shadow</span>
              <input type="checkbox" className="w-4 h-4" />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-600">Inner Shadow</span>
              <input type="checkbox" className="w-4 h-4" />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-600">Blur</span>
              <input type="checkbox" className="w-4 h-4" />
            </div>
          </div>
        </div>

        {/* Border */}
        <div className="space-y-3">
          <h4 className="font-medium text-gray-900">Border</h4>
          
          <ColorPicker
            label="Color"
            value="#000000"
            onChange={(value) => console.log('Border color:', value)}
          />
          
          <NumberInput
            label="Width"
            value={0}
            onChange={(value) => console.log('Border width:', value)}
            min={0}
            max={20}
          />
        </div>
      </div>

      {/* Quick Actions */}
      <div className="p-3 border-t border-gray-200 bg-gray-50">
        <div className="text-xs text-gray-500 mb-2">Quick Actions</div>
        <div className="grid grid-cols-2 gap-1">
          <button className="p-2 text-xs bg-white border border-gray-200 rounded hover:bg-gray-50">
            Duplicate
          </button>
          <button className="p-2 text-xs bg-white border border-gray-200 rounded hover:bg-gray-50">
            Delete
          </button>
        </div>
      </div>
    </div>
  )
}
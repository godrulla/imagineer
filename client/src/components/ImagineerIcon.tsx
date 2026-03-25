// Custom Icon Component for Imagineer
// This component loads SVG icons from the assets folder

interface IconProps {
  name: 'import' | 'ai-translate' | 'export' | 'projects' | 'templates' | 'collaborate'
  className?: string
  size?: number
}

export default function ImagineerIcon({ name, className = '', size = 24 }: IconProps) {
  const iconPath = `/assets/icons/${name}-icon.svg`
  
  return (
    <img 
      src={iconPath} 
      alt={`${name} icon`}
      className={className}
      width={size}
      height={size}
      style={{ 
        display: 'inline-block',
        verticalAlign: 'middle' 
      }}
    />
  )
}

// Usage examples:
// <ImagineerIcon name="import" className="text-blue-600" size={24} />
// <ImagineerIcon name="ai-translate" className="text-purple-600" />

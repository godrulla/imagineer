import React from 'react';

interface DynamicBackgroundProps {
  className?: string;
  style?: React.CSSProperties;
}

// Fallback MeshGradient component since @paper-design/shaders-react is not available
const MeshGradient: React.FC<{
  colors: string[];
  scale: number;
  speed: number;
  panelSize: number;
  style?: React.CSSProperties;
}> = ({ colors, style }) => {
  return (
    <div 
      style={{
        ...style,
        background: `linear-gradient(45deg, ${colors.join(', ')})`,
        backgroundSize: '400% 400%',
        animation: 'gradient-shift 8s ease infinite',
      }}
    />
  );
};

export default function DynamicBackground({ className = '', style = {} }: DynamicBackgroundProps) {
  return (
    <div className={className} style={{ width: '100vw', height: '100vh', ...style }}>
      <MeshGradient
        colors={["#6839c6","#def44e","#350dfd","#ea398e"]}
        scale={1.3}
        speed={2.2}
        panelSize={0.81}
        style={{ width: '100%', height: '100%' }}
      />
    </div>
  );
}
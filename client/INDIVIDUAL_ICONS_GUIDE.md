# Individual Icon Creation Guide for Imagineer

## 🎨 Icon Design Specifications

Each icon should be created separately in Canva with these specifications:
- **Size**: 24x24px (or 48x48px for higher quality)
- **Style**: Minimalist line art or filled shapes
- **Colors**: Blue to purple gradient (#3B82F6 to #8B5CF6)
- **Background**: Transparent
- **Format**: SVG (preferred) or PNG

## 📋 Icons to Create Individually

### 1. Import Icon (`import-icon.svg`)
**Design Brief**: Arrow pointing into a box/document
- Represents importing designs from Figma/other tools
- Suggested: Downward arrow into an open folder or document

### 2. AI Translate Icon (`ai-translate-icon.svg`)
**Design Brief**: Brain/neural network with transformation arrows
- Represents AI-powered translation
- Suggested: Brain icon with sparkles or circuit patterns

### 3. Export Icon (`export-icon.svg`)
**Design Brief**: Arrow pointing out of a box/document
- Represents exporting to various formats
- Suggested: Upward arrow from document with multiple paths

### 4. Projects Icon (`projects-icon.svg`)
**Design Brief**: Folder with layers or stack of folders
- Represents project organization
- Suggested: Layered folders or folder with grid inside

### 5. Templates Icon (`templates-icon.svg`)
**Design Brief**: Grid layout or template preview
- Represents template gallery
- Suggested: 2x2 grid with one highlighted square

### 6. Collaborate Icon (`collaborate-icon.svg`)
**Design Brief**: Multiple users or connection nodes
- Represents team collaboration
- Suggested: Two or three connected user avatars

## 🔧 How to Create in Canva

### For Each Icon:
1. Go to Canva.com
2. Click "Create a design"
3. Choose "Custom size" → 48x48 pixels
4. Search for icon elements matching the description
5. Apply gradient:
   - Select the icon
   - Click on color
   - Choose gradient
   - Set colors: #3B82F6 to #8B5CF6
6. Download:
   - File type: SVG (or PNG)
   - Transparent background ✓

## 💡 Alternative: Use Existing Icon Libraries

If creating custom icons is taking too long, here are some alternatives:

### Option 1: Use Lucide React Icons
```tsx
import { 
  Download,      // for import
  Sparkles,      // for AI translate
  Upload,        // for export
  Folders,       // for projects
  LayoutGrid,    // for templates
  Users          // for collaborate
} from 'lucide-react'
```

### Option 2: Use Heroicons
```bash
npm install @heroicons/react
```

### Option 3: Use Tabler Icons
```bash
npm install @tabler/icons-react
```

## 🎯 Quick Implementation with Placeholder Icons

While you create the custom icons, you can use this temporary solution:

```tsx
// components/icons/ImportIcon.tsx
export default function ImportIcon({ className = "w-6 h-6" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
        d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
    </svg>
  )
}
```

## 📝 Icon Usage in Components

```tsx
// Once you have the custom icons:
<img src="/assets/icons/import-icon.svg" alt="Import" className="w-6 h-6" />

// Or with the ImagineerIcon component:
<ImagineerIcon name="import" size={24} />
```

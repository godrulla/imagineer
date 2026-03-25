# Selected Imagineer Assets Implementation

## 🎨 Your Selected Assets

### 1. **Logo Option 2**
- **Canva Link**: https://design.canva.ai/bddjhy3x
- **Export as**: SVG (preferred) or PNG with transparency
- **Save to**: `/public/assets/images/imagineer-logo.svg`
- **Sizes needed**: Original for navbar, smaller versions for mobile

### 2. **App Icon 1**
- **Canva Link**: https://design.canva.ai/2p8s4x2s
- **Export as**: PNG with transparency
- **Save to**:
  - `/public/assets/icons/favicon-16x16.png` (16x16)
  - `/public/assets/icons/favicon-32x32.png` (32x32)
  - `/public/assets/icons/icon-192x192.png` (192x192)
  - `/public/assets/icons/icon-512x512.png` (512x512)

### 3. **Hero Banner 3**
- **Canva Link**: https://design.canva.ai/474vsc4s
- **Export as**: JPG or WebP
- **Save to**: `/public/assets/images/hero-banner.jpg`
- **Size**: 1920x800 (or full width)

### 4. **Empty State 3**
- **Canva Link**: https://design.canva.ai/yckshkb9
- **Export as**: SVG or PNG with transparency
- **Save to**: `/public/assets/illustrations/empty-state.svg`
- **Use for**: No projects, no designs, no templates states

### 5. **Icon Set 2**
- **Canva Link**: https://design.canva.ai/5n7wferd
- **Export as**: SVG (individual icons)
- **Save to**: `/public/assets/icons/`
  - `import-icon.svg`
  - `ai-translate-icon.svg`
  - `export-icon.svg`
  - `projects-icon.svg`
  - `templates-icon.svg`
  - `collaborate-icon.svg`

### 6. **Onboarding Flow 1**
- **Canva Link**: https://design.canva.ai/yhynvxce
- **Export as**: PNG for each slide
- **Save to**: `/public/assets/illustrations/onboarding/`
  - `step-1-connect.png`
  - `step-2-import.png`
  - `step-3-generate.png`
  - `step-4-export.png`

### 7. **OG Image 3**
- **Canva Link**: https://design.canva.ai/34methe7
- **Export as**: JPG (1200x630 exactly)
- **Save to**: `/public/assets/images/og-image.jpg`

### 8. **Architecture 3** ⚠️ NEEDS MODIFICATION
- **Canva Link**: https://design.canva.ai/26n8xdnj
- **Action Required**: Change background to dark blue (#1e3a8a or #1e40af)
- **Export as**: PNG or SVG
- **Save to**: `/public/assets/docs/architecture-diagram.png`

## 📥 Download Instructions

1. **Open each Canva link**
2. **For Architecture diagram**: 
   - Click "Edit design"
   - Select background
   - Change to dark blue (#1e3a8a)
   - Match the style of other assets
3. **Download using these settings**:
   - File type: As specified above
   - Transparent background: Where noted
   - Size: Custom dimensions where specified
   - Quality: Highest available

## 🔧 Quick Implementation

After downloading all assets, update your app:

### Update index.html
```html
<!-- Favicon -->
<link rel="icon" type="image/png" sizes="32x32" href="/assets/icons/favicon-32x32.png">
<link rel="icon" type="image/png" sizes="16x16" href="/assets/icons/favicon-16x16.png">
<link rel="apple-touch-icon" href="/assets/icons/icon-192x192.png">

<!-- Open Graph -->
<meta property="og:image" content="https://yourdomain.com/assets/images/og-image.jpg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
```

### Update Navbar Logo
```tsx
// In Navbar.tsx
<img src="/assets/images/imagineer-logo.svg" alt="Imagineer" className="h-8 w-auto" />
```

### Add Hero Banner
```tsx
// In Dashboard or Landing
<div className="relative h-[400px] overflow-hidden">
  <img 
    src="/assets/images/hero-banner.jpg" 
    alt="Design to LLM Translation Platform" 
    className="absolute inset-0 w-full h-full object-cover"
  />
  <div className="absolute inset-0 bg-gradient-to-t from-gray-900/50 to-transparent" />
  {/* Your content here */}
</div>
```

### Implement Empty States
```tsx
// In your components
{projects.length === 0 && (
  <div className="text-center py-12">
    <img 
      src="/assets/illustrations/empty-state.svg" 
      alt="No projects yet" 
      className="w-64 h-64 mx-auto mb-6"
    />
    <h3 className="text-xl font-semibold text-gray-900 mb-2">
      No projects yet
    </h3>
    <p className="text-gray-600 mb-6">
      Create your first project to get started
    </p>
    <Link to="/projects/new" className="btn-primary">
      Create Project
    </Link>
  </div>
)}
```

## ✅ Asset Checklist
- [ ] Download Logo Option 2
- [ ] Download and resize App Icon 1 (all sizes)
- [ ] Download Hero Banner 3
- [ ] Download Empty State 3
- [ ] Download and separate Icon Set 2
- [ ] Download Onboarding Flow 1 (all slides)
- [ ] Download OG Image 3
- [ ] Modify and download Architecture 3 (dark blue background)
- [ ] Update index.html with favicon and meta tags
- [ ] Replace logo in Navbar
- [ ] Implement hero banner
- [ ] Add empty state illustrations
- [ ] Test all assets on different devices

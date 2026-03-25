const express = require('express')
const cors = require('cors')

const app = express()
const PORT = 8090

// Middleware
app.use(cors())
app.use(express.json({ limit: '10mb' }))

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'imagineer-backend', timestamp: new Date().toISOString() })
})

// Design Parser API
app.post('/api/v1/parser/analyze', async (req, res) => {
  console.log('🔍 Design Parser: Analyze request', req.body)
  
  try {
    // Simulate analysis
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    res.json({
      success: true,
      data: {
        elements: [
          {
            id: 'elem-1',
            name: 'Sample Rectangle',
            elementType: 'rectangle',
            bounds: { x: 50, y: 50, width: 200, height: 100 },
            styles: {
              fills: [{ type: 'SOLID', color: { r: 0.2, g: 0.5, b: 1.0 } }]
            }
          },
          {
            id: 'elem-2', 
            name: 'Sample Text',
            elementType: 'text',
            bounds: { x: 100, y: 200, width: 150, height: 40 },
            text: 'Hello Imagineer!',
            styles: {
              typography: { fontSize: 24 }
            }
          }
        ],
        nodeName: 'Figma Import Demo',
        analysisAccuracy: 0.95
      },
      processingTime: 1000
    })
  } catch (error) {
    console.error('Parser error:', error)
    res.status(500).json({ error: 'Analysis failed' })
  }
})

app.post('/api/v1/parser/elements', async (req, res) => {
  console.log('🔍 Design Parser: Elements request', req.body)
  
  try {
    // Simulate element parsing
    await new Promise(resolve => setTimeout(resolve, 500))
    
    res.json({
      success: true,
      data: {
        elements: req.body.elements || [],
        designTokens: {
          colors: ['#3b82f6', '#ef4444', '#10b981'],
          fonts: ['Inter', 'System'],
          spacing: [8, 16, 24, 32]
        },
        metadata: {
          canvasSize: { width: 800, height: 600 },
          elementCount: req.body.elements?.length || 0
        }
      }
    })
  } catch (error) {
    console.error('Elements parsing error:', error)
    res.status(500).json({ error: 'Elements parsing failed' })
  }
})

// Translation Engine API
app.post('/api/v1/translate/generate', async (req, res) => {
  console.log('🤖 Translation Engine: Generate request', req.body)
  
  try {
    // Simulate LLM processing
    await new Promise(resolve => setTimeout(resolve, 1500))
    
    const { designData, targetLLM = 'claude-3', format = 'markdown' } = req.body
    const elementCount = designData?.elements?.length || 0
    
    const prompt = `# Design-to-LLM Translation

## Design Overview
This design contains ${elementCount} elements with a modern interface layout.

## Visual Hierarchy
- **Primary Elements**: Rectangles and text components
- **Color Palette**: Blue (#3b82f6), Red (#ef4444), Green (#10b981)
- **Typography**: System fonts with 24px headings

## Layout Structure
\`\`\`
Canvas (800x600)
├── Rectangle (200x100) at (50, 50) - Blue fill
└── Text "Hello Imagineer!" (150x40) at (100, 200) - 24px
\`\`\`

## Implementation Notes
- Responsive design recommended
- Accessible color contrast maintained
- Component-based architecture suggested

## AI-Optimized Prompt
Create a modern web interface with:
1. Blue rectangular container (200px width, 100px height)
2. Welcome text "Hello Imagineer!" with 24px font size
3. Clean, minimal aesthetic with proper spacing

Target: ${targetLLM.toUpperCase()}
Format: ${format.toUpperCase()}
Generated at: ${new Date().toISOString()}`

    res.json({
      success: true,
      content: prompt,
      metadata: {
        targetLLM,
        format,
        elementCount,
        designComplexity: 'simple',
        optimizationLevel: 'high'
      },
      usage: {
        totalTokens: 150 + (elementCount * 25),
        estimatedCost: '$0.002'
      },
      responseTime: 1500
    })
  } catch (error) {
    console.error('Translation error:', error)
    res.status(500).json({ error: 'Translation failed' })
  }
})

// Projects API
app.get('/api/v1/projects', (req, res) => {
  console.log('📁 Projects: List request')
  
  res.json({
    success: true,
    projects: [
      {
        id: 'demo-1',
        name: 'Demo Project',
        createdAt: new Date().toISOString(),
        elements: []
      }
    ]
  })
})

// Get single project
app.get('/api/v1/projects/:id', (req, res) => {
  console.log('📁 Projects: Get project', req.params.id)
  
  res.json({
    success: true,
    project: {
      id: req.params.id,
      name: 'Loaded Project',
      elements: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  })
})

// Save/Update project
app.put('/api/v1/projects/:id', (req, res) => {
  console.log('📁 Projects: Save project', req.params.id, 'Elements:', req.body.elements?.length || 0)
  
  res.json({
    success: true,
    message: 'Project saved successfully',
    project: {
      ...req.body,
      id: req.params.id
    }
  })
})

// Designs API
app.get('/api/v1/designs', (req, res) => {
  console.log('🎨 Designs: List request')
  
  res.json({
    success: true,
    designs: [
      {
        id: '1',
        name: 'Sample Design',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        author: 'You',
        elements: 5,
        status: 'completed',
        source: 'created',
        tags: ['sample', 'demo']
      }
    ]
  })
})

// Start server
app.listen(PORT, () => {
  console.log('\n🚀 Imagineer Backend Running!')
  console.log('=================================')
  console.log(`✅ API Gateway: http://localhost:${PORT}`)
  console.log('✅ All microservices: Mocked and ready')
  console.log('')
  console.log('Available endpoints:')
  console.log('• POST /api/v1/parser/analyze - Figma design analysis')
  console.log('• POST /api/v1/parser/elements - Element parsing')
  console.log('• POST /api/v1/translate/generate - LLM prompt generation')
  console.log('• GET  /api/v1/projects - Project listing')
  console.log('')
  console.log('🎯 Frontend: http://localhost:5173')
  console.log('📚 Test with "Import Figma" and "Generate LLM Prompt"')
})
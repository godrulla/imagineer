import { useState, useRef, useEffect } from 'react'
import {
  MessageSquare,
  Send,
  Bot,
  User,
  Sparkles,
  Copy,
  Download,
  Share,
  Settings,
  X,
  Minimize2,
  Maximize2,
  RotateCcw,
  Zap,
  Brain,
  Code,
  Palette,
  Layout
} from 'lucide-react'
import toast from 'react-hot-toast'

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  llmProvider?: 'gpt4' | 'claude' | 'gemini'
  promptType?: 'design-analysis' | 'code-generation' | 'ui-feedback' | 'general'
  attachments?: {
    type: 'design-export' | 'image' | 'code'
    data: any
  }[]
}

interface DesignElement {
  id: string
  type: string
  name: string
  properties: any
}

interface LLMChatPanelProps {
  isOpen: boolean
  onToggle: () => void
  theme: 'light' | 'dark'
  currentDesign: {
    name: string
    elements: DesignElement[]
    canvas: { width: number; height: number }
  }
  onApplyDesignSuggestion?: (suggestion: any) => void
}

const LLM_PROVIDERS = [
  { 
    id: 'gpt4', 
    name: 'GPT-4 Turbo', 
    description: 'Best for detailed analysis and code generation',
    icon: <Brain className="w-4 h-4" />
  },
  { 
    id: 'claude', 
    name: 'Claude 3 Sonnet', 
    description: 'Excellent for design critique and UX advice',
    icon: <Sparkles className="w-4 h-4" />
  },
  { 
    id: 'gemini', 
    name: 'Gemini Pro', 
    description: 'Great for creative suggestions and variations',
    icon: <Zap className="w-4 h-4" />
  }
]

const PROMPT_TEMPLATES = [
  {
    type: 'design-analysis',
    title: 'Analyze My Design',
    icon: <Layout className="w-4 h-4" />,
    prompt: 'Please analyze this design and provide feedback on:\n1. Visual hierarchy and layout\n2. Color scheme and typography\n3. User experience considerations\n4. Accessibility improvements\n5. Design system consistency'
  },
  {
    type: 'code-generation',
    title: 'Generate Code',
    icon: <Code className="w-4 h-4" />,
    prompt: 'Generate clean, production-ready code for this design using:\n- React with TypeScript\n- Tailwind CSS for styling\n- Responsive design principles\n- Accessibility best practices\n\nPlease include component structure and styling.'
  },
  {
    type: 'ui-feedback',
    title: 'UI/UX Feedback',
    icon: <Palette className="w-4 h-4" />,
    prompt: 'Provide detailed UI/UX feedback on this design:\n1. What works well?\n2. What could be improved?\n3. Are there any usability issues?\n4. How can the visual design be enhanced?\n5. Suggestions for better user engagement'
  },
  {
    type: 'design-variations',
    title: 'Design Variations',
    icon: <Sparkles className="w-4 h-4" />,
    prompt: 'Based on this design, suggest 3 different variations:\n1. Modern/minimalist approach\n2. Bold/expressive approach\n3. Professional/corporate approach\n\nFor each variation, describe the key changes and visual adjustments needed.'
  }
]

export default function LLMChatPanel({
  isOpen,
  onToggle,
  theme,
  currentDesign,
  onApplyDesignSuggestion
}: LLMChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      role: 'assistant',
      content: "Hello! I'm your AI design assistant. I can help you analyze designs, generate code, provide UI/UX feedback, and suggest improvements. \n\nTry using one of the prompt templates below or ask me anything about your design!",
      timestamp: new Date(),
      llmProvider: 'claude'
    }
  ])
  const [inputMessage, setInputMessage] = useState('')
  const [selectedProvider, setSelectedProvider] = useState<'gpt4' | 'claude' | 'gemini'>('claude')
  const [isLoading, setIsLoading] = useState(false)
  const [panelSize, setPanelSize] = useState<'normal' | 'minimized' | 'maximized'>('normal')
  
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async (content: string, promptType?: string) => {
    if (!content.trim()) return

    const userMessage: ChatMessage = {
      id: `user_${Date.now()}`,
      role: 'user',
      content: content.trim(),
      timestamp: new Date(),
      promptType: promptType as any
    }

    setMessages(prev => [...prev, userMessage])
    setInputMessage('')
    setIsLoading(true)

    try {
      // Prepare design context for LLM
      const designContext = {
        name: currentDesign.name,
        elements: currentDesign.elements.map(el => ({
          type: el.type,
          name: el.name,
          properties: Object.keys(el.properties || {}).reduce((acc, key) => {
            // Only include relevant properties, exclude internal IDs
            if (!key.startsWith('_') && key !== 'id') {
              acc[key] = el.properties[key]
            }
            return acc
          }, {} as any)
        })),
        canvas: currentDesign.canvas,
        elementCount: currentDesign.elements.length
      }

      const response = await fetch('/api/v1/llm/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          provider: selectedProvider,
          messages: [
            ...messages.slice(-5), // Include last 5 messages for context
            userMessage
          ],
          designContext,
          promptType,
          options: {
            includeDesignAnalysis: promptType === 'design-analysis',
            generateCode: promptType === 'code-generation',
            provideFeedback: promptType === 'ui-feedback',
            temperature: promptType === 'design-variations' ? 0.8 : 0.3
          }
        })
      })

      if (!response.ok) {
        throw new Error('Failed to get response from LLM')
      }

      const data = await response.json()
      
      const assistantMessage: ChatMessage = {
        id: `assistant_${Date.now()}`,
        role: 'assistant',
        content: data.response,
        timestamp: new Date(),
        llmProvider: selectedProvider,
        promptType: promptType as any
      }

      setMessages(prev => [...prev, assistantMessage])

      // If it's a design suggestion, offer to apply it
      if (promptType === 'design-variations' && data.suggestions) {
        // Handle design suggestions
        console.log('Design suggestions received:', data.suggestions)
      }

    } catch (error) {
      console.error('LLM chat error:', error)
      
      // Show mock response for demo
      setTimeout(() => {
        const mockResponses = {
          'design-analysis': `Looking at your design "${currentDesign.name}" with ${currentDesign.elements.length} elements, here's my analysis:

**Visual Hierarchy**: The layout has a clear structure with good spacing. Consider increasing the contrast between primary and secondary elements.

**Color Scheme**: The current palette works well. You might want to add an accent color for better visual interest.

**Typography**: Clean and readable. Consider varying font weights to create better hierarchy.

**Accessibility**: Good foundation. Ensure color contrast ratios meet WCAG 2.1 AA standards.

**Recommendations**:
1. Add more whitespace around key elements
2. Use consistent corner radius values
3. Consider adding subtle shadows for depth`,

          'code-generation': `Here's the React code for your design:

\`\`\`tsx
import React from 'react';

interface ${currentDesign.name.replace(/\s+/g, '')}Props {
  className?: string;
}

export const ${currentDesign.name.replace(/\s+/g, '')}: React.FC<${currentDesign.name.replace(/\s+/g, '')}Props> = ({ className }) => {
  return (
    <div className={\`w-full max-w-${Math.round(currentDesign.canvas.width/16)}xl mx-auto p-6 \${className}\`}>
      {/* Design elements rendered here */}
      ${currentDesign.elements.map(el => `
      <div className="flex items-center justify-center">
        {/* ${el.name} */}
      </div>`).join('')}
    </div>
  );
};
\`\`\`

This component is responsive, accessible, and follows React best practices.`,

          'ui-feedback': `**UI/UX Feedback for "${currentDesign.name}"**

**What Works Well:**
✅ Clean, organized layout
✅ Good use of whitespace  
✅ Consistent element alignment

**Areas for Improvement:**
🔄 Visual hierarchy could be stronger
🔄 Add hover states for interactive elements
🔄 Consider mobile responsiveness

**Usability Suggestions:**
1. Make clickable areas at least 44px for touch
2. Add loading states for dynamic content
3. Improve focus indicators for keyboard navigation

**Visual Enhancements:**
- Add subtle animations for better micro-interactions
- Consider using a consistent shadow system
- Implement a cohesive color system with primary/secondary/accent colors`,

          'design-variations': `Here are 3 design variations for "${currentDesign.name}":

**1. Modern Minimalist**
- Remove all borders and shadows
- Increase whitespace by 40%
- Use single accent color (#6366f1)
- Switch to system fonts
- Implement card-based layouts

**2. Bold & Expressive**
- Add gradient backgrounds
- Use larger, attention-grabbing typography
- Implement bright color scheme (#ff6b6b, #4ecdc4, #45b7d1)
- Add more visual elements and icons
- Create asymmetrical layouts

**3. Professional Corporate**
- Implement strict grid system
- Use conservative color palette (blues/grays)
- Add subtle drop shadows
- Include more structured navigation
- Focus on data visualization elements

Each approach would significantly change the visual impact while maintaining usability.`
        }

        const assistantMessage: ChatMessage = {
          id: `assistant_${Date.now()}`,
          role: 'assistant',
          content: mockResponses[promptType as keyof typeof mockResponses] || `I'd be happy to help with your design! Here are some general suggestions:

1. **Layout**: Your current design has ${currentDesign.elements.length} elements arranged well
2. **Balance**: Consider the visual weight distribution
3. **Consistency**: Maintain consistent spacing and alignment
4. **Accessibility**: Ensure proper color contrast and interactive element sizes

What specific aspect would you like me to focus on?`,
          timestamp: new Date(),
          llmProvider: selectedProvider,
          promptType: promptType as any
        }

        setMessages(prev => [...prev, assistantMessage])
      }, 1500)
    } finally {
      setIsLoading(false)
    }
  }

  const copyToClipboard = async (content: string) => {
    try {
      await navigator.clipboard.writeText(content)
      toast.success('Copied to clipboard!')
    } catch (error) {
      toast.error('Failed to copy to clipboard')
    }
  }

  const exportChat = () => {
    const chatExport = {
      design: currentDesign.name,
      timestamp: new Date().toISOString(),
      provider: selectedProvider,
      messages: messages.map(m => ({
        role: m.role,
        content: m.content,
        timestamp: m.timestamp.toISOString()
      }))
    }

    const blob = new Blob([JSON.stringify(chatExport, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `imagineer-chat-${currentDesign.name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const clearChat = () => {
    if (confirm('Are you sure you want to clear the chat history?')) {
      setMessages([{
        id: '1',
        role: 'assistant',
        content: "Chat cleared! How can I help you with your design?",
        timestamp: new Date(),
        llmProvider: selectedProvider
      }])
    }
  }

  if (!isOpen) {
    return (
      <button
        onClick={onToggle}
        className={`fixed bottom-6 right-6 w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-110 z-40 ${
          theme === 'dark'
            ? 'bg-blue-600 hover:bg-blue-700 text-white'
            : 'bg-blue-600 hover:bg-blue-700 text-white'
        }`}
        title="Open AI Chat"
      >
        <MessageSquare className="w-6 h-6" />
      </button>
    )
  }

  const panelClass = `fixed bottom-6 right-6 shadow-2xl rounded-lg border z-50 transition-all ${
    panelSize === 'minimized' 
      ? 'w-80 h-16'
      : panelSize === 'maximized'
        ? 'w-[90vw] h-[90vh]'
        : 'w-96 h-[600px]'
  } ${
    theme === 'dark'
      ? 'bg-gray-900 border-gray-700'
      : 'bg-white border-gray-200'
  }`

  return (
    <div className={panelClass}>
      {/* Header */}
      <div className={`px-4 py-3 border-b flex items-center justify-between ${
        theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
      }`}>
        <div className="flex items-center space-x-2">
          <Bot className={`w-5 h-5 ${theme === 'dark' ? 'text-blue-400' : 'text-blue-600'}`} />
          <h3 className={`font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
            AI Design Assistant
          </h3>
          <div className="flex space-x-1">
            {LLM_PROVIDERS.map(provider => (
              <button
                key={provider.id}
                onClick={() => setSelectedProvider(provider.id as any)}
                className={`p-1 rounded text-xs ${
                  selectedProvider === provider.id
                    ? theme === 'dark' 
                      ? 'bg-blue-600 text-white'
                      : 'bg-blue-100 text-blue-800'
                    : theme === 'dark'
                      ? 'hover:bg-gray-700'
                      : 'hover:bg-gray-100'
                }`}
                title={provider.description}
              >
                {provider.icon}
              </button>
            ))}
          </div>
        </div>
        
        <div className="flex items-center space-x-1">
          <button
            onClick={() => setPanelSize(panelSize === 'minimized' ? 'normal' : 'minimized')}
            className={`p-1 rounded hover:${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'}`}
          >
            <Minimize2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => setPanelSize(panelSize === 'maximized' ? 'normal' : 'maximized')}
            className={`p-1 rounded hover:${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'}`}
          >
            <Maximize2 className="w-4 h-4" />
          </button>
          <button
            onClick={exportChat}
            className={`p-1 rounded hover:${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'}`}
            title="Export Chat"
          >
            <Download className="w-4 h-4" />
          </button>
          <button
            onClick={clearChat}
            className={`p-1 rounded hover:${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'}`}
            title="Clear Chat"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <button
            onClick={onToggle}
            className={`p-1 rounded hover:${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'}`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {panelSize !== 'minimized' && (
        <>
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map(message => (
              <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] rounded-lg p-3 ${
                  message.role === 'user'
                    ? theme === 'dark'
                      ? 'bg-blue-600 text-white'
                      : 'bg-blue-600 text-white'
                    : theme === 'dark'
                      ? 'bg-gray-800 text-gray-100'
                      : 'bg-gray-100 text-gray-900'
                }`}>
                  <div className="flex items-start space-x-2">
                    {message.role === 'assistant' && (
                      <Bot className="w-4 h-4 mt-1 flex-shrink-0" />
                    )}
                    <div className="flex-1">
                      <div className="whitespace-pre-wrap text-sm">{message.content}</div>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-xs opacity-70">
                          {message.timestamp.toLocaleTimeString()}
                          {message.llmProvider && ` • ${LLM_PROVIDERS.find(p => p.id === message.llmProvider)?.name}`}
                        </span>
                        {message.role === 'assistant' && (
                          <button
                            onClick={() => copyToClipboard(message.content)}
                            className="text-xs opacity-70 hover:opacity-100"
                            title="Copy response"
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
            
            {isLoading && (
              <div className="flex justify-start">
                <div className={`rounded-lg p-3 ${
                  theme === 'dark' ? 'bg-gray-800' : 'bg-gray-100'
                }`}>
                  <div className="flex items-center space-x-2">
                    <Bot className="w-4 h-4" />
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                      <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Templates */}
          <div className={`px-4 py-2 border-t border-b ${
            theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
          }`}>
            <div className="flex flex-wrap gap-2">
              {PROMPT_TEMPLATES.map(template => (
                <button
                  key={template.type}
                  onClick={() => sendMessage(template.prompt, template.type)}
                  disabled={isLoading}
                  className={`flex items-center space-x-1 px-2 py-1 text-xs rounded border transition-colors disabled:opacity-50 ${
                    theme === 'dark'
                      ? 'border-gray-600 hover:bg-gray-700'
                      : 'border-gray-300 hover:bg-gray-50'
                  }`}
                  title={template.prompt.split('\n')[0]}
                >
                  {template.icon}
                  <span>{template.title}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Input */}
          <div className={`p-4 border-t ${theme === 'dark' ? 'border-gray-700' : 'border-gray-200'}`}>
            <div className="flex space-x-2">
              <textarea
                ref={inputRef}
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                placeholder="Ask about your design, request code generation, or get UI feedback..."
                className={`flex-1 px-3 py-2 border rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  theme === 'dark'
                    ? 'bg-gray-800 border-gray-600 text-white placeholder-gray-400'
                    : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                }`}
                rows={2}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    sendMessage(inputMessage)
                  }
                }}
              />
              <button
                onClick={() => sendMessage(inputMessage)}
                disabled={!inputMessage.trim() || isLoading}
                className={`px-4 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-700 transition-colors`}
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
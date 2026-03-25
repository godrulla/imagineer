import { useState } from 'react'
import { Link } from 'react-router-dom'
import { 
  Search, 
  Filter, 
  Grid3X3,
  List,
  Star,
  Download,
  Eye,
  Copy,
  Zap,
  Smartphone,
  Monitor,
  Tablet,
  Globe,
  ShoppingCart,
  BarChart3,
  FileText,
  Camera
} from 'lucide-react'
import toast from 'react-hot-toast'

interface Template {
  id: string
  name: string
  description: string
  thumbnail: string
  category: string
  tags: string[]
  complexity: 'beginner' | 'intermediate' | 'advanced'
  elements: number
  downloads: number
  rating: number
  author: string
  isPremium: boolean
  previewUrl?: string
}

const CATEGORIES = [
  { id: 'all', name: 'All Templates', icon: Grid3X3 },
  { id: 'web', name: 'Web Apps', icon: Monitor },
  { id: 'mobile', name: 'Mobile Apps', icon: Smartphone },
  { id: 'dashboard', name: 'Dashboards', icon: BarChart3 },
  { id: 'landing', name: 'Landing Pages', icon: Globe },
  { id: 'ecommerce', name: 'E-commerce', icon: ShoppingCart },
  { id: 'portfolio', name: 'Portfolio', icon: Camera },
  { id: 'documentation', name: 'Documentation', icon: FileText }
]

const SAMPLE_TEMPLATES: Template[] = [
  {
    id: '1',
    name: 'Modern Landing Page',
    description: 'Clean, conversion-focused landing page with hero section, features, and CTA',
    thumbnail: '/api/placeholder/300/200',
    category: 'landing',
    tags: ['landing', 'hero', 'modern', 'conversion'],
    complexity: 'beginner',
    elements: 12,
    downloads: 1247,
    rating: 4.8,
    author: 'Imagineer Team',
    isPremium: false
  },
  {
    id: '2',
    name: 'SaaS Dashboard',
    description: 'Complete dashboard template with charts, tables, and user management',
    thumbnail: '/api/placeholder/300/200',
    category: 'dashboard',
    tags: ['dashboard', 'saas', 'analytics', 'admin'],
    complexity: 'intermediate',
    elements: 24,
    downloads: 892,
    rating: 4.9,
    author: 'Imagineer Team',
    isPremium: true
  },
  {
    id: '3',
    name: 'Mobile Banking App',
    description: 'iOS banking app with account overview, transactions, and transfers',
    thumbnail: '/api/placeholder/300/200',
    category: 'mobile',
    tags: ['mobile', 'banking', 'ios', 'fintech'],
    complexity: 'advanced',
    elements: 18,
    downloads: 634,
    rating: 4.7,
    author: 'Imagineer Team',
    isPremium: true
  },
  {
    id: '4',
    name: 'E-commerce Store',
    description: 'Full e-commerce template with product grid, cart, and checkout flow',
    thumbnail: '/api/placeholder/300/200',
    category: 'ecommerce',
    tags: ['ecommerce', 'shop', 'product', 'checkout'],
    complexity: 'intermediate',
    elements: 28,
    downloads: 1456,
    rating: 4.6,
    author: 'Community',
    isPremium: false
  },
  {
    id: '5',
    name: 'Portfolio Website',
    description: 'Creative portfolio showcase with project gallery and contact form',
    thumbnail: '/api/placeholder/300/200',
    category: 'portfolio',
    tags: ['portfolio', 'creative', 'gallery', 'personal'],
    complexity: 'beginner',
    elements: 15,
    downloads: 987,
    rating: 4.5,
    author: 'Community',
    isPremium: false
  },
  {
    id: '6',
    name: 'Documentation Site',
    description: 'Clean documentation template with sidebar navigation and search',
    thumbnail: '/api/placeholder/300/200',
    category: 'documentation',
    tags: ['docs', 'documentation', 'api', 'reference'],
    complexity: 'beginner',
    elements: 10,
    downloads: 743,
    rating: 4.4,
    author: 'Community',
    isPremium: false
  }
]

export default function Templates() {
  const [templates] = useState<Template[]>(SAMPLE_TEMPLATES)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [complexityFilter, setComplexityFilter] = useState<'all' | 'beginner' | 'intermediate' | 'advanced'>('all')

  const filteredTemplates = templates.filter(template => {
    const matchesSearch = template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         template.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         template.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
    const matchesCategory = selectedCategory === 'all' || template.category === selectedCategory
    const matchesComplexity = complexityFilter === 'all' || template.complexity === complexityFilter
    return matchesSearch && matchesCategory && matchesComplexity
  })

  const handleUseTemplate = async (template: Template) => {
    if (template.isPremium) {
      toast.error('This is a premium template. Upgrade to use it.')
      return
    }

    try {
      const loadingToast = toast.loading('Creating project from template...')
      
      // Simulate template loading
      await new Promise(resolve => setTimeout(resolve, 1500))
      
      // Navigate to editor with template
      window.location.href = `/editor?template=${template.id}`
      
      toast.success('Template loaded successfully!', { id: loadingToast })
    } catch (error) {
      toast.error('Failed to load template')
    }
  }

  const getComplexityColor = (complexity: Template['complexity']) => {
    switch (complexity) {
      case 'beginner': return 'bg-green-100 text-green-800'
      case 'intermediate': return 'bg-yellow-100 text-yellow-800'
      case 'advanced': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Templates</h1>
        <p className="text-gray-600 mt-2">
          Kickstart your projects with professionally designed templates
        </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Sidebar */}
        <div className="lg:w-64 space-y-6">
          {/* Categories */}
          <div>
            <h3 className="font-semibold text-gray-900 mb-3">Categories</h3>
            <div className="space-y-1">
              {CATEGORIES.map(category => {
                const Icon = category.icon
                return (
                  <button
                    key={category.id}
                    onClick={() => setSelectedCategory(category.id)}
                    className={`w-full flex items-center px-3 py-2 text-sm rounded-lg transition-colors ${
                      selectedCategory === category.id
                        ? 'bg-imagineer-blue-50 text-imagineer-blue-600'
                        : 'text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <Icon className="w-4 h-4 mr-2" />
                    {category.name}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Complexity Filter */}
          <div>
            <h3 className="font-semibold text-gray-900 mb-3">Complexity</h3>
            <select
              value={complexityFilter}
              onChange={(e) => setComplexityFilter(e.target.value as any)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-imagineer-blue-500 focus:border-transparent"
            >
              <option value="all">All Levels</option>
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
            </select>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1">
          {/* Search and Controls */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search templates..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-imagineer-blue-500 focus:border-transparent w-full"
              />
            </div>

            <div className="flex rounded-lg border border-gray-300">
              <button
                onClick={() => setViewMode('grid')}
                className={`px-3 py-2 ${viewMode === 'grid' ? 'bg-imagineer-blue-50 text-imagineer-blue-600' : 'text-gray-500'}`}
              >
                <Grid3X3 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`px-3 py-2 ${viewMode === 'list' ? 'bg-imagineer-blue-50 text-imagineer-blue-600' : 'text-gray-500'}`}
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Templates Grid/List */}
          {filteredTemplates.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Search className="w-12 h-12 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No templates found</h3>
              <p className="text-gray-500 mb-6">
                Try adjusting your search or filter criteria
              </p>
              <button
                onClick={() => {
                  setSearchTerm('')
                  setSelectedCategory('all')
                  setComplexityFilter('all')
                }}
                className="btn-outline"
              >
                Clear Filters
              </button>
            </div>
          ) : (
            <div className={viewMode === 'grid' 
              ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'
              : 'space-y-4'
            }>
              {filteredTemplates.map((template) => (
                <div
                  key={template.id}
                  className={`card hover:shadow-lg transition-shadow relative ${
                    viewMode === 'list' ? 'flex items-center p-4' : 'p-0 overflow-hidden'
                  }`}
                >
                  {template.isPremium && (
                    <div className="absolute top-2 right-2 z-10 bg-gradient-to-r from-yellow-400 to-orange-500 text-white text-xs px-2 py-1 rounded-full font-medium">
                      PRO
                    </div>
                  )}

                  {viewMode === 'grid' ? (
                    <>
                      {/* Thumbnail */}
                      <div className="h-48 bg-gradient-to-br from-imagineer-blue-100 to-imagineer-purple-100 flex items-center justify-center">
                        <div className="text-center">
                          <Zap className="w-12 h-12 text-imagineer-blue-600 mx-auto mb-2" />
                          <p className="text-sm text-gray-600">{template.name}</p>
                        </div>
                      </div>

                      {/* Content */}
                      <div className="p-4">
                        <div className="flex items-start justify-between mb-2">
                          <h3 className="font-semibold text-gray-900 flex-1 pr-2">{template.name}</h3>
                          <div className="flex items-center text-sm text-yellow-500">
                            <Star className="w-4 h-4 fill-current" />
                            <span className="ml-1">{template.rating}</span>
                          </div>
                        </div>
                        
                        <p className="text-sm text-gray-600 mb-3 line-clamp-2">{template.description}</p>

                        <div className="flex items-center justify-between text-xs text-gray-500 mb-3">
                          <span>{template.elements} elements</span>
                          <span>{template.downloads.toLocaleString()} downloads</span>
                        </div>

                        <div className="flex items-center justify-between mb-4">
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${getComplexityColor(template.complexity)}`}>
                            {template.complexity}
                          </span>
                          <span className="text-xs text-gray-500">by {template.author}</span>
                        </div>

                        {/* Tags */}
                        <div className="flex flex-wrap gap-1 mb-4">
                          {template.tags.slice(0, 3).map(tag => (
                            <span key={tag} className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded">
                              {tag}
                            </span>
                          ))}
                        </div>

                        {/* Actions */}
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleUseTemplate(template)}
                            className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                              template.isPremium
                                ? 'bg-gradient-to-r from-yellow-400 to-orange-500 text-white hover:from-yellow-500 hover:to-orange-600'
                                : 'bg-imagineer-blue-600 text-white hover:bg-imagineer-blue-700'
                            }`}
                          >
                            Use Template
                          </button>
                          <button className="p-2 text-gray-500 hover:text-gray-700 border border-gray-300 rounded-lg">
                            <Eye className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      {/* List View */}
                      <div className="w-16 h-16 bg-gradient-to-br from-imagineer-blue-100 to-imagineer-purple-100 rounded flex items-center justify-center mr-4">
                        <Zap className="w-8 h-8 text-imagineer-blue-600" />
                      </div>
                      
                      <div className="flex-1">
                        <div className="flex items-start justify-between">
                          <div>
                            <h3 className="font-semibold text-gray-900">{template.name}</h3>
                            <p className="text-sm text-gray-600 mt-1">{template.description}</p>
                            <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500">
                              <span>{template.elements} elements</span>
                              <span>{template.downloads.toLocaleString()} downloads</span>
                              <span className="flex items-center">
                                <Star className="w-3 h-3 fill-current text-yellow-500 mr-1" />
                                {template.rating}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2 ml-4">
                            <span className={`px-2 py-1 text-xs font-medium rounded-full ${getComplexityColor(template.complexity)}`}>
                              {template.complexity}
                            </span>
                            <button
                              onClick={() => handleUseTemplate(template)}
                              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                                template.isPremium
                                  ? 'bg-gradient-to-r from-yellow-400 to-orange-500 text-white hover:from-yellow-500 hover:to-orange-600'
                                  : 'bg-imagineer-blue-600 text-white hover:bg-imagineer-blue-700'
                              }`}
                            >
                              Use Template
                            </button>
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
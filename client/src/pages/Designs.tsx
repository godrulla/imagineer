import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { 
  Plus, 
  Search, 
  Filter, 
  Grid3X3,
  List,
  Calendar,
  User,
  Eye,
  Edit3,
  Download,
  Trash2,
  Clock,
  Figma,
  FileText,
  Zap
} from 'lucide-react'
import toast from 'react-hot-toast'

interface Design {
  id: string
  name: string
  thumbnail?: string
  createdAt: string
  updatedAt: string
  author: string
  elements: number
  status: 'draft' | 'completed' | 'archived'
  source: 'created' | 'figma' | 'template'
  tags: string[]
}

export default function Designs() {
  const [designs, setDesigns] = useState<Design[]>([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState<'all' | 'draft' | 'completed' | 'archived'>('all')

  useEffect(() => {
    loadDesigns()
  }, [])

  const loadDesigns = async () => {
    try {
      setLoading(true)
      
      // Load designs from localStorage first
      const savedDesigns = localStorage.getItem('imagineer-designs')
      if (savedDesigns) {
        setDesigns(JSON.parse(savedDesigns))
      }

      // Then fetch from API
      const response = await fetch('/api/v1/designs')
      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          setDesigns(data.designs)
          localStorage.setItem('imagineer-designs', JSON.stringify(data.designs))
        }
      }
    } catch (error) {
      console.error('Failed to load designs:', error)
      // Show sample designs if API fails
      setDesigns([
        {
          id: '1',
          name: 'Landing Page Design',
          createdAt: '2024-01-15T10:30:00Z',
          updatedAt: '2024-01-15T14:22:00Z',
          author: 'You',
          elements: 12,
          status: 'completed',
          source: 'created',
          tags: ['landing', 'web', 'modern']
        },
        {
          id: '2',
          name: 'Mobile App UI',
          createdAt: '2024-01-14T09:15:00Z',
          updatedAt: '2024-01-14T16:45:00Z',
          author: 'You',
          elements: 8,
          status: 'draft',
          source: 'figma',
          tags: ['mobile', 'app', 'ios']
        },
        {
          id: '3',
          name: 'Dashboard Template',
          createdAt: '2024-01-13T11:20:00Z',
          updatedAt: '2024-01-13T15:30:00Z',
          author: 'You',
          elements: 15,
          status: 'completed',
          source: 'template',
          tags: ['dashboard', 'admin', 'analytics']
        }
      ])
    } finally {
      setLoading(false)
    }
  }

  const filteredDesigns = designs.filter(design => {
    const matchesSearch = design.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         design.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
    const matchesFilter = filterStatus === 'all' || design.status === filterStatus
    return matchesSearch && matchesFilter
  })

  const handleDelete = async (designId: string) => {
    if (!confirm('Are you sure you want to delete this design?')) return

    try {
      const updatedDesigns = designs.filter(d => d.id !== designId)
      setDesigns(updatedDesigns)
      localStorage.setItem('imagineer-designs', JSON.stringify(updatedDesigns))
      toast.success('Design deleted successfully')
    } catch (error) {
      toast.error('Failed to delete design')
    }
  }

  const getStatusColor = (status: Design['status']) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800'
      case 'draft': return 'bg-yellow-100 text-yellow-800'
      case 'archived': return 'bg-gray-100 text-gray-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getSourceIcon = (source: Design['source']) => {
    switch (source) {
      case 'figma': return <Figma className="w-4 h-4" />
      case 'template': return <FileText className="w-4 h-4" />
      default: return <Edit3 className="w-4 h-4" />
    }
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-64 mb-4"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="h-64 bg-gray-200 rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">My Designs</h1>
          <p className="text-gray-600 mt-2">
            {designs.length} design{designs.length !== 1 ? 's' : ''} in your workspace
          </p>
        </div>
        <Link
          to="/editor"
          className="btn-primary flex items-center space-x-2"
        >
          <Plus className="w-4 h-4" />
          <span>Create New Design</span>
        </Link>
      </div>

      {/* Filters and Search */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Search designs..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-imagineer-blue-500 focus:border-transparent w-full"
          />
        </div>
        
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as any)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-imagineer-blue-500 focus:border-transparent"
        >
          <option value="all">All Status</option>
          <option value="draft">Draft</option>
          <option value="completed">Completed</option>
          <option value="archived">Archived</option>
        </select>

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

      {/* Designs Grid/List */}
      {filteredDesigns.length === 0 ? (
        <div className="text-center py-12">
          <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Zap className="w-12 h-12 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No designs found</h3>
          <p className="text-gray-500 mb-6">
            {searchTerm || filterStatus !== 'all' 
              ? 'Try adjusting your search or filter criteria'
              : 'Create your first design to get started'
            }
          </p>
          <Link to="/editor" className="btn-primary">
            Create Your First Design
          </Link>
        </div>
      ) : (
        <div className={viewMode === 'grid' 
          ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'
          : 'space-y-4'
        }>
          {filteredDesigns.map((design) => (
            <div
              key={design.id}
              className={`card hover:shadow-lg transition-shadow ${
                viewMode === 'list' ? 'flex items-center p-4' : 'p-6'
              }`}
            >
              {viewMode === 'grid' ? (
                <>
                  {/* Thumbnail */}
                  <div className="h-32 bg-gray-100 rounded-lg mb-4 flex items-center justify-center">
                    {design.thumbnail ? (
                      <img src={design.thumbnail} alt={design.name} className="w-full h-full object-cover rounded-lg" />
                    ) : (
                      <div className="text-center">
                        {getSourceIcon(design.source)}
                        <p className="text-xs text-gray-500 mt-1">{design.elements} elements</p>
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1">
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-semibold text-gray-900 truncate">{design.name}</h3>
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(design.status)}`}>
                        {design.status}
                      </span>
                    </div>
                    
                    <div className="text-sm text-gray-500 mb-3">
                      <div className="flex items-center mb-1">
                        <Calendar className="w-4 h-4 mr-1" />
                        <span>{new Date(design.updatedAt).toLocaleDateString()}</span>
                      </div>
                      <div className="flex items-center">
                        <User className="w-4 h-4 mr-1" />
                        <span>{design.author}</span>
                      </div>
                    </div>

                    {/* Tags */}
                    <div className="flex flex-wrap gap-1 mb-4">
                      {design.tags.slice(0, 3).map(tag => (
                        <span key={tag} className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded">
                          {tag}
                        </span>
                      ))}
                    </div>

                    {/* Actions */}
                    <div className="flex justify-between">
                      <div className="flex space-x-2">
                        <Link
                          to={`/editor?project=${design.id}`}
                          className="text-imagineer-blue-600 hover:text-imagineer-blue-700 text-sm"
                          title="Edit"
                        >
                          <Edit3 className="w-4 h-4" />
                        </Link>
                        <button 
                          className="text-gray-500 hover:text-gray-700 text-sm"
                          title="Preview"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button 
                          className="text-gray-500 hover:text-gray-700 text-sm"
                          title="Download"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                      </div>
                      <button 
                        onClick={() => handleDelete(design.id)}
                        className="text-red-500 hover:text-red-700 text-sm"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  {/* List View */}
                  <div className="w-12 h-12 bg-gray-100 rounded flex items-center justify-center mr-4">
                    {getSourceIcon(design.source)}
                  </div>
                  
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-gray-900">{design.name}</h3>
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(design.status)}`}>
                        {design.status}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500">
                      {design.elements} elements • Updated {new Date(design.updatedAt).toLocaleDateString()}
                    </p>
                  </div>
                  
                  <div className="flex items-center space-x-2 ml-4">
                    <Link
                      to={`/editor?project=${design.id}`}
                      className="text-imagineer-blue-600 hover:text-imagineer-blue-700"
                    >
                      <Edit3 className="w-4 h-4" />
                    </Link>
                    <button className="text-gray-500 hover:text-gray-700">
                      <Eye className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => handleDelete(design.id)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
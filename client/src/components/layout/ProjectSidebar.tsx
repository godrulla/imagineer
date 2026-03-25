import { useState } from 'react'
import { Link, useParams, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { 
  Folder, 
  Plus, 
  Search, 
  Filter,
  ChevronDown,
  ChevronRight,
  FileText,
  Clock,
  CheckCircle,
  AlertCircle,
  Users,
  Settings,
  Archive
} from 'lucide-react'
import { useAuth } from '../../AppNoAuth'

interface Project {
  id: string
  name: string
  description: string
  status: string
  designs_count: number
  updated_at: string
  tags: string[]
  collaborators: Array<{
    id: string
    name: string
    role: string
  }>
}

interface Design {
  id: string
  name: string
  project_id: string
  status: string
  translation_status: string
  updated_at: string
}

export default function ProjectSidebar() {
  const { user } = useAuth()
  const params = useParams()
  const location = useLocation()
  const [searchTerm, setSearchTerm] = useState('')
  const [expandedProjects, setExpandedProjects] = useState<string[]>([])
  const [showCreateForm, setShowCreateForm] = useState(false)

  // Fetch projects
  const { data: projectsData, isLoading } = useQuery({
    queryKey: ['projects', searchTerm],
    queryFn: async () => {
      const url = new URL('/api/v1/projects', 'http://localhost:8090')
      if (searchTerm) url.searchParams.set('search', searchTerm)
      const response = await fetch(url.toString())
      return response.json()
    }
  })

  // Fetch designs for expanded projects
  const { data: designsData } = useQuery({
    queryKey: ['designs'],
    queryFn: async () => {
      const response = await fetch('http://localhost:8090/api/v1/designs')
      return response.json()
    }
  })

  const projects = projectsData?.data || []
  const designs = designsData?.data || []

  const toggleProject = (projectId: string) => {
    setExpandedProjects(prev => 
      prev.includes(projectId) 
        ? prev.filter(id => id !== projectId)
        : [...prev, projectId]
    )
  }

  const getProjectDesigns = (projectId: string) => {
    return designs.filter((design: Design) => design.project_id === projectId)
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'in_progress':
        return <Clock className="h-4 w-4 text-yellow-500" />
      case 'draft':
        return <FileText className="h-4 w-4 text-gray-400" />
      default:
        return <AlertCircle className="h-4 w-4 text-gray-400" />
    }
  }

  const isActive = (path: string) => location.pathname === path

  if (isLoading) {
    return (
      <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <div className="h-6 bg-gray-200 rounded animate-pulse mb-3"></div>
          <div className="h-8 bg-gray-200 rounded animate-pulse"></div>
        </div>
        <div className="flex-1 p-4 space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-12 bg-gray-200 rounded animate-pulse"></div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="w-80 bg-white border-r border-gray-200 flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-900">Projects</h2>
          <button 
            onClick={() => setShowCreateForm(true)}
            className="p-1 hover:bg-gray-100 rounded-md transition-colors"
            title="Create New Project"
          >
            <Plus className="h-5 w-5 text-gray-600" />
          </button>
        </div>
        
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search projects..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Navigation Links */}
      <div className="px-4 py-3 border-b border-gray-200">
        <nav className="space-y-1">
          <Link
            to="/"
            className={`flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              isActive('/') 
                ? 'bg-blue-100 text-blue-700' 
                : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            <FileText className="h-4 w-4 mr-3" />
            Dashboard
          </Link>
          <Link
            to="/projects"
            className={`flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              isActive('/projects') 
                ? 'bg-blue-100 text-blue-700' 
                : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            <Folder className="h-4 w-4 mr-3" />
            All Projects
          </Link>
          <Link
            to="/designs"
            className={`flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              isActive('/designs') 
                ? 'bg-blue-100 text-blue-700' 
                : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            <FileText className="h-4 w-4 mr-3" />
            All Designs
          </Link>
          <Link
            to="/templates"
            className={`flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              isActive('/templates') 
                ? 'bg-blue-100 text-blue-700' 
                : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            <Archive className="h-4 w-4 mr-3" />
            Templates
          </Link>
        </nav>
      </div>

      {/* Projects List */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-gray-900">Recent Projects</h3>
            <span className="text-xs text-gray-500">{projects.length} total</span>
          </div>

          <div className="space-y-1">
            {projects.map((project: Project) => {
              const isExpanded = expandedProjects.includes(project.id)
              const projectDesigns = getProjectDesigns(project.id)
              const isProjectActive = params.id === project.id

              return (
                <div key={project.id} className="group">
                  <div className={`flex items-center px-3 py-2 rounded-md text-sm transition-colors ${
                    isProjectActive 
                      ? 'bg-blue-50 text-blue-700 border border-blue-200' 
                      : 'hover:bg-gray-50 text-gray-700'
                  }`}>
                    <button
                      onClick={() => toggleProject(project.id)}
                      className="mr-2 p-0.5 hover:bg-gray-200 rounded"
                    >
                      {isExpanded ? (
                        <ChevronDown className="h-3 w-3" />
                      ) : (
                        <ChevronRight className="h-3 w-3" />
                      )}
                    </button>
                    
                    <Folder className="h-4 w-4 mr-2 flex-shrink-0 text-blue-500" />
                    
                    <Link
                      to={`/projects/${project.id}`}
                      className="flex-1 truncate hover:text-blue-600"
                      title={project.name}
                    >
                      {project.name}
                    </Link>
                    
                    <div className="flex items-center space-x-1 ml-2">
                      <span className="text-xs text-gray-500">
                        {project.designs_count || 0}
                      </span>
                      {(project.collaborators?.length || 0) > 1 && (
                        <Users className="h-3 w-3 text-gray-400" />
                      )}
                    </div>
                  </div>

                  {/* Project Designs */}
                  {isExpanded && (
                    <div className="ml-6 mt-1 space-y-1">
                      {projectDesigns.length > 0 ? (
                        projectDesigns.map((design: Design) => (
                          <Link
                            key={design.id}
                            to={`/projects/${project.id}/designs/${design.id}`}
                            className="flex items-center px-3 py-1.5 rounded-md text-xs text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors"
                          >
                            {getStatusIcon(design.status)}
                            <span className="ml-2 truncate">{design.name}</span>
                          </Link>
                        ))
                      ) : (
                        <div className="px-3 py-1.5 text-xs text-gray-500 italic">
                          No designs yet
                        </div>
                      )}
                      
                      <Link
                        to={`/projects/${project.id}/designs/new`}
                        className="flex items-center px-3 py-1.5 rounded-md text-xs text-blue-600 hover:bg-blue-50 transition-colors"
                      >
                        <Plus className="h-3 w-3 mr-2" />
                        Add Design
                      </Link>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {projects.length === 0 && (
            <div className="text-center py-8">
              <Folder className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-500 mb-3">No projects found</p>
              <button 
                onClick={() => setShowCreateForm(true)}
                className="text-sm text-blue-600 hover:text-blue-700"
              >
                Create your first project
              </button>
            </div>
          )}
        </div>
      </div>

      {/* User Info */}
      <div className="p-4 border-t border-gray-200 bg-gray-50">
        <div className="flex items-center">
          <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm font-medium">
            {user?.name?.charAt(0) || 'A'}
          </div>
          <div className="ml-3 flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">
              {user?.name || 'User'}
            </p>
            <p className="text-xs text-gray-500 truncate">
              {user?.email || 'user@example.com'}
            </p>
          </div>
          <Settings className="h-4 w-4 text-gray-400" />
        </div>
      </div>
    </div>
  )
}
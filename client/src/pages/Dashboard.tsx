import { useAuth } from '../AppNoAuth'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { 
  BarChart3, 
  FileText, 
  Folder, 
  Plus, 
  ArrowRight,
  Zap,
  Clock,
  TrendingUp 
} from 'lucide-react'

export default function Dashboard() {
  const { user } = useAuth()

  // Mock data query
  const { data: stats } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async () => ({
      projects: 5,
      designs: 12,
      translations: 38,
      accuracy: 94
    })
  })

  if (!user) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            Please Sign In
          </h1>
          <p className="text-lg text-gray-600 mb-8">
            You need to be logged in to access the dashboard.
          </p>
          <div className="space-x-4">
            <Link to="/login" className="btn-primary">
              Sign In
            </Link>
            <Link to="/" className="btn-outline">
              Back to Homepage
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600 mt-2">Welcome back, {user.name}!</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="card">
          <div className="flex items-center">
            <div className="p-3 bg-blue-100 rounded-lg">
              <Folder className="h-6 w-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-2xl font-bold text-gray-900">{stats?.projects || 0}</p>
              <p className="text-sm text-gray-600">Projects</p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center">
            <div className="p-3 bg-green-100 rounded-lg">
              <FileText className="h-6 w-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-2xl font-bold text-gray-900">{stats?.designs || 0}</p>
              <p className="text-sm text-gray-600">Designs</p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center">
            <div className="p-3 bg-purple-100 rounded-lg">
              <Zap className="h-6 w-6 text-purple-600" />
            </div>
            <div className="ml-4">
              <p className="text-2xl font-bold text-gray-900">{stats?.translations || 0}</p>
              <p className="text-sm text-gray-600">Translations</p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center">
            <div className="p-3 bg-yellow-100 rounded-lg">
              <BarChart3 className="h-6 w-6 text-yellow-600" />
            </div>
            <div className="ml-4">
              <p className="text-2xl font-bold text-gray-900">{stats?.accuracy || 0}%</p>
              <p className="text-sm text-gray-600">Accuracy</p>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid md:grid-cols-2 gap-8 mb-8">
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Quick Actions</h2>
            <Plus className="h-5 w-5 text-gray-400" />
          </div>
          <div className="space-y-3">
            <Link
              to="/projects/new"
              className="flex items-center p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors group"
            >
              <Plus className="h-5 w-5 text-gray-500 mr-3" />
              <span className="text-gray-700 group-hover:text-gray-900">Create New Project</span>
              <ArrowRight className="h-4 w-4 text-gray-400 ml-auto" />
            </Link>
            
            <Link
              to="/editor"
              className="flex items-center p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors group"
            >
              <Zap className="h-5 w-5 text-gray-500 mr-3" />
              <span className="text-gray-700 group-hover:text-gray-900">Open Visual Editor</span>
              <ArrowRight className="h-4 w-4 text-gray-400 ml-auto" />
            </Link>
            
            <Link
              to="/designs/import"
              className="flex items-center p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors group"
            >
              <FileText className="h-5 w-5 text-gray-500 mr-3" />
              <span className="text-gray-700 group-hover:text-gray-900">Import from Figma</span>
              <ArrowRight className="h-4 w-4 text-gray-400 ml-auto" />
            </Link>
            
            <Link
              to="/templates"
              className="flex items-center p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors group"
            >
              <Zap className="h-5 w-5 text-gray-500 mr-3" />
              <span className="text-gray-700 group-hover:text-gray-900">Browse Templates</span>
              <ArrowRight className="h-4 w-4 text-gray-400 ml-auto" />
            </Link>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Recent Activity</h2>
            <Clock className="h-5 w-5 text-gray-400" />
          </div>
          <div className="space-y-3">
            <div className="flex items-center p-3 bg-gray-50 rounded-lg">
              <div className="w-2 h-2 bg-green-500 rounded-full mr-3"></div>
              <div>
                <p className="text-sm font-medium text-gray-900">Design translated successfully</p>
                <p className="text-xs text-gray-500">Landing Page - 2 minutes ago</p>
              </div>
            </div>
            
            <div className="flex items-center p-3 bg-gray-50 rounded-lg">
              <div className="w-2 h-2 bg-blue-500 rounded-full mr-3"></div>
              <div>
                <p className="text-sm font-medium text-gray-900">New design imported</p>
                <p className="text-xs text-gray-500">Dashboard UI - 15 minutes ago</p>
              </div>
            </div>
            
            <div className="flex items-center p-3 bg-gray-50 rounded-lg">
              <div className="w-2 h-2 bg-purple-500 rounded-full mr-3"></div>
              <div>
                <p className="text-sm font-medium text-gray-900">Project created</p>
                <p className="text-xs text-gray-500">E-commerce App - 1 hour ago</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
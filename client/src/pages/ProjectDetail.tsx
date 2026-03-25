import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Folder, Plus, FileText, Zap, Download, Settings } from 'lucide-react'

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>()
  
  const { data: project, isLoading } = useQuery({
    queryKey: ['project', id],
    queryFn: async () => {
      // Mock project data
      return {
        id: id,
        name: 'E-commerce Platform',
        description: 'Modern e-commerce website with clean design',
        designs: [
          {
            id: 'design-1',
            name: 'Homepage',
            status: 'completed',
            translations: 3,
            updatedAt: new Date().toISOString()
          },
          {
            id: 'design-2', 
            name: 'Product Page',
            status: 'processing',
            translations: 1,
            updatedAt: new Date().toISOString()
          }
        ]
      }
    }
  })

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2 mb-8"></div>
          <div className="grid md:grid-cols-2 gap-6">
            {[1, 2].map((i) => (
              <div key={i} className="h-32 bg-gray-200 rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="flex items-center space-x-3 mb-2">
            <div className="p-2 bg-imagineer-blue-100 rounded-lg">
              <Folder className="h-6 w-6 text-imagineer-blue-600" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900">{project?.name}</h1>
          </div>
          {project?.description && (
            <p className="text-gray-600">{project.description}</p>
          )}
        </div>
        <div className="flex items-center space-x-3">
          <button className="btn-outline">
            <Settings className="h-5 w-5" />
            Settings
          </button>
          <button className="btn-primary">
            <Plus className="h-5 w-5" />
            Import Design
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="card">
          <div className="flex items-center">
            <div className="p-3 bg-blue-100 rounded-lg">
              <FileText className="h-6 w-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-2xl font-bold text-gray-900">{project?.designs?.length || 0}</p>
              <p className="text-sm text-gray-600">Designs</p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center">
            <div className="p-3 bg-green-100 rounded-lg">
              <Zap className="h-6 w-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-2xl font-bold text-gray-900">
                {project?.designs?.reduce((acc: number, d: any) => acc + d.translations, 0) || 0}
              </p>
              <p className="text-sm text-gray-600">Translations</p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center">
            <div className="p-3 bg-purple-100 rounded-lg">
              <Download className="h-6 w-6 text-purple-600" />
            </div>
            <div className="ml-4">
              <p className="text-2xl font-bold text-gray-900">94%</p>
              <p className="text-sm text-gray-600">Avg Accuracy</p>
            </div>
          </div>
        </div>
      </div>

      {/* Designs */}
      <div className="card">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900">Designs</h2>
          <button className="btn-primary">
            <Plus className="h-5 w-5" />
            Add Design
          </button>
        </div>

        {!project?.designs || project.designs.length === 0 ? (
          <div className="text-center py-8">
            <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No designs yet</h3>
            <p className="text-gray-600 mb-4">Import your first design from Figma to get started</p>
            <button className="btn-primary">
              <Plus className="h-5 w-5" />
              Import from Figma
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {project.designs.map((design: any) => (
              <div
                key={design.id}
                className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center space-x-4">
                  <div className="p-2 bg-white rounded-lg shadow-sm">
                    <FileText className="h-5 w-5 text-gray-600" />
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900">{design.name}</h3>
                    <p className="text-sm text-gray-600">
                      {design.translations} translations • Updated {new Date(design.updatedAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-3">
                  <span className={`status-badge ${
                    design.status === 'completed' ? 'status-success' :
                    design.status === 'processing' ? 'status-warning' :
                    'status-info'
                  }`}>
                    {design.status}
                  </span>
                  <button className="btn-outline text-sm px-3 py-1">
                    View
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
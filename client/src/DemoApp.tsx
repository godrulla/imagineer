import { useState } from 'react'
import { Toaster } from 'react-hot-toast'

function DemoApp() {
  const [activeTab, setActiveTab] = useState('dashboard')

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                🚀 Imagineer
              </h1>
              <div className="ml-10 flex items-baseline space-x-4">
                <button
                  onClick={() => setActiveTab('dashboard')}
                  className={`px-3 py-2 rounded-md text-sm font-medium ${
                    activeTab === 'dashboard'
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Dashboard
                </button>
                <button
                  onClick={() => setActiveTab('editor')}
                  className={`px-3 py-2 rounded-md text-sm font-medium ${
                    activeTab === 'editor'
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Design Editor
                </button>
                <button
                  onClick={() => setActiveTab('projects')}
                  className={`px-3 py-2 rounded-md text-sm font-medium ${
                    activeTab === 'projects'
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Projects
                </button>
              </div>
            </div>
            <div className="flex items-center">
              <span className="text-sm text-gray-600 mr-4">Welcome, Armando!</span>
              <button className="text-sm bg-gray-200 hover:bg-gray-300 px-4 py-2 rounded-md">
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'dashboard' && (
          <div>
            <h2 className="text-3xl font-bold text-gray-900 mb-8">Dashboard</h2>
            
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="bg-white p-6 rounded-lg shadow">
                <div className="text-sm text-gray-600">Total Projects</div>
                <div className="text-3xl font-bold text-blue-600">12</div>
              </div>
              <div className="bg-white p-6 rounded-lg shadow">
                <div className="text-sm text-gray-600">Designs Created</div>
                <div className="text-3xl font-bold text-purple-600">48</div>
              </div>
              <div className="bg-white p-6 rounded-lg shadow">
                <div className="text-sm text-gray-600">LLM Translations</div>
                <div className="text-3xl font-bold text-green-600">156</div>
              </div>
            </div>

            {/* Recent Projects */}
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b">
                <h3 className="text-lg font-semibold">Recent Projects</h3>
              </div>
              <div className="p-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div>
                      <h4 className="font-semibold">E-Commerce Platform</h4>
                      <p className="text-sm text-gray-600">Last updated 2 hours ago</p>
                    </div>
                    <button className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
                      Open
                    </button>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div>
                      <h4 className="font-semibold">Mobile Banking App</h4>
                      <p className="text-sm text-gray-600">Last updated 1 day ago</p>
                    </div>
                    <button className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
                      Open
                    </button>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div>
                      <h4 className="font-semibold">SaaS Dashboard</h4>
                      <p className="text-sm text-gray-600">Last updated 3 days ago</p>
                    </div>
                    <button className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
                      Open
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'editor' && (
          <div>
            <h2 className="text-3xl font-bold text-gray-900 mb-8">Design Editor</h2>
            <div className="bg-white rounded-lg shadow" style={{ height: '600px' }}>
              <div className="flex h-full">
                {/* Sidebar */}
                <div className="w-64 bg-gray-50 border-r p-4">
                  <h3 className="font-semibold mb-4">Components</h3>
                  <div className="space-y-2">
                    <div className="p-3 bg-white rounded border cursor-pointer hover:border-blue-500">
                      📦 Button
                    </div>
                    <div className="p-3 bg-white rounded border cursor-pointer hover:border-blue-500">
                      📝 Text Input
                    </div>
                    <div className="p-3 bg-white rounded border cursor-pointer hover:border-blue-500">
                      🎨 Card
                    </div>
                    <div className="p-3 bg-white rounded border cursor-pointer hover:border-blue-500">
                      📊 Chart
                    </div>
                  </div>
                  
                  <h3 className="font-semibold mt-6 mb-4">Actions</h3>
                  <button className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 mb-2">
                    Import from Figma
                  </button>
                  <button className="w-full px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700">
                    Generate LLM Prompt
                  </button>
                </div>

                {/* Canvas */}
                <div className="flex-1 p-8">
                  <div className="h-full border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center">
                    <div className="text-center">
                      <div className="text-6xl mb-4">🎨</div>
                      <h3 className="text-xl font-semibold text-gray-700 mb-2">
                        Design Canvas
                      </h3>
                      <p className="text-gray-500 mb-4">
                        Drag components here or import from Figma
                      </p>
                      <button className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-md hover:from-blue-700 hover:to-purple-700">
                        Start Designing
                      </button>
                    </div>
                  </div>
                </div>

                {/* Properties Panel */}
                <div className="w-64 bg-gray-50 border-l p-4">
                  <h3 className="font-semibold mb-4">Properties</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Width
                      </label>
                      <input
                        type="text"
                        className="w-full px-3 py-2 border rounded-md"
                        placeholder="100%"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Height
                      </label>
                      <input
                        type="text"
                        className="w-full px-3 py-2 border rounded-md"
                        placeholder="auto"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Background
                      </label>
                      <input
                        type="text"
                        className="w-full px-3 py-2 border rounded-md"
                        placeholder="#ffffff"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'projects' && (
          <div>
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-3xl font-bold text-gray-900">Projects</h2>
              <button className="px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700">
                + New Project
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[
                { name: 'E-Commerce Platform', designs: 12, updated: '2 hours ago' },
                { name: 'Mobile Banking App', designs: 8, updated: '1 day ago' },
                { name: 'SaaS Dashboard', designs: 15, updated: '3 days ago' },
                { name: 'Landing Page', designs: 5, updated: '1 week ago' },
                { name: 'Blog Platform', designs: 9, updated: '2 weeks ago' },
                { name: 'Admin Panel', designs: 11, updated: '3 weeks ago' },
              ].map((project, index) => (
                <div key={index} className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow cursor-pointer">
                  <div className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="text-3xl">📁</div>
                      <span className="text-sm text-gray-500">{project.updated}</span>
                    </div>
                    <h3 className="font-semibold text-lg mb-2">{project.name}</h3>
                    <p className="text-gray-600 text-sm mb-4">{project.designs} designs</p>
                    <div className="flex space-x-2">
                      <button className="flex-1 px-3 py-2 bg-blue-100 text-blue-700 rounded hover:bg-blue-200">
                        Open
                      </button>
                      <button className="flex-1 px-3 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200">
                        Export
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      <Toaster position="top-right" />
    </div>
  )
}

export default DemoApp
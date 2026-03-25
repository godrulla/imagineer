import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../AppNoAuth'
import { LogOut, User, Zap } from 'lucide-react'

export default function Navbar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <nav className="fixed top-0 left-0 right-0 bg-white border-b border-gray-200 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link to="/" className="flex items-center space-x-2">
              <img 
                src="/assets/images/imagineer-logo.svg" 
                alt="Imagineer" 
                className="h-8 w-auto"
                onError={(e) => {
                  // Fallback to icon if logo not loaded yet
                  e.currentTarget.style.display = 'none';
                  e.currentTarget.nextElementSibling?.classList.remove('hidden');
                }}
              />
              <div className="hidden p-2 bg-imagineer-blue-600 rounded-lg">
                <Zap className="h-6 w-6 text-white" />
              </div>
              <span className="text-xl font-bold text-gray-900">Imagineer</span>
            </Link>
            
            {user && (
              <div className="hidden md:ml-10 md:flex md:space-x-8">
                <Link
                  to="/projects"
                  className="text-gray-700 hover:text-imagineer-blue-600 px-3 py-2 rounded-md text-sm font-medium transition-colors"
                >
                  Projects
                </Link>
                <Link
                  to="/designs"
                  className="text-gray-700 hover:text-imagineer-blue-600 px-3 py-2 rounded-md text-sm font-medium transition-colors"
                >
                  Designs
                </Link>
                <Link
                  to="/templates"
                  className="text-gray-700 hover:text-imagineer-blue-600 px-3 py-2 rounded-md text-sm font-medium transition-colors"
                >
                  Templates
                </Link>
              </div>
            )}
          </div>

          <div className="flex items-center space-x-4">
            {user ? (
              <div className="flex items-center space-x-3">
                <span className="text-sm text-gray-700">Welcome, {user.name}</span>
                <div className="relative">
                  <button className="flex items-center space-x-2 text-gray-700 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-imagineer-blue-500 rounded-md p-2">
                    <User className="h-5 w-5" />
                  </button>
                </div>
                <button
                  onClick={handleLogout}
                  className="flex items-center space-x-2 text-gray-700 hover:text-red-600 focus:outline-none focus:ring-2 focus:ring-red-500 rounded-md p-2 transition-colors"
                  title="Logout"
                >
                  <LogOut className="h-5 w-5" />
                </button>
              </div>
            ) : (
              <div className="flex items-center space-x-4">
                <Link
                  to="/login"
                  className="text-gray-700 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium"
                >
                  Sign in
                </Link>
                <Link
                  to="/register"
                  className="btn-primary text-sm"
                >
                  Get Started
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  )
}
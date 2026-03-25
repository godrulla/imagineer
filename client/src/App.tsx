import { Routes, Route } from 'react-router-dom'
import { Suspense, lazy } from 'react'
import { Toaster } from 'react-hot-toast'
import Navbar from './components/layout/Navbar'
import { AuthProvider } from './contexts/AuthContext'
import { ThemeProvider } from './contexts/ThemeContext'
import ErrorBoundary from './components/common/ErrorBoundary'
import { NotFoundError } from './components/common/ErrorState'
import { PageLoading } from './components/common/LoadingState'

// Lazy load pages for code splitting
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Projects = lazy(() => import('./pages/Projects'))
const ProjectDetail = lazy(() => import('./pages/ProjectDetail'))
const ProfessionalEditor = lazy(() => import('./pages/ProfessionalEditor'))
const Designs = lazy(() => import('./pages/Designs'))
const Templates = lazy(() => import('./pages/Templates'))
const Login = lazy(() => import('./pages/Login'))
const Register = lazy(() => import('./pages/Register'))

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <ThemeProvider>
          <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
            <ErrorBoundary>
              <Navbar />
            </ErrorBoundary>
            <main className="pt-16">
              <ErrorBoundary>
                <Suspense fallback={<PageLoading message="Loading page..." />}>
                  <Routes>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/login" element={<Login />} />
                    <Route path="/register" element={<Register />} />
                    <Route path="/projects" element={<Projects />} />
                    <Route path="/projects/:id" element={<ProjectDetail />} />
                    <Route path="/designs" element={<Designs />} />
                    <Route path="/templates" element={<Templates />} />
                    <Route path="/editor" element={<ProfessionalEditor />} />
                    <Route path="*" element={
                      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
                        <NotFoundError 
                          onGoHome={() => window.location.href = '/'}
                          onGoBack={() => window.history.back()}
                        />
                      </div>
                    } />
                  </Routes>
                </Suspense>
              </ErrorBoundary>
            </main>
            <Toaster
              position="top-right"
              toastOptions={{
                duration: 4000,
                style: {
                  background: '#fff',
                  color: '#374151',
                  boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                },
              }}
            />
          </div>
        </ThemeProvider>
      </AuthProvider>
    </ErrorBoundary>
  )
}

export default App
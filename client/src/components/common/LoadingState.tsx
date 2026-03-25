import React from 'react'
import { Loader2, RefreshCw } from 'lucide-react'

interface LoadingStateProps {
  size?: 'sm' | 'md' | 'lg'
  message?: string
  showRetry?: boolean
  onRetry?: () => void
  variant?: 'spinner' | 'skeleton' | 'progress' | 'dots'
  progress?: number
  className?: string
}

export function LoadingSpinner({ 
  size = 'md', 
  message, 
  showRetry = false, 
  onRetry,
  className = ''
}: Omit<LoadingStateProps, 'variant'>) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
  }

  return (
    <div className={`flex flex-col items-center justify-center space-y-3 ${className}`}>
      <Loader2 className={`animate-spin text-blue-600 ${sizeClasses[size]}`} />
      {message && (
        <p className="text-sm text-gray-600 text-center max-w-sm">{message}</p>
      )}
      {showRetry && onRetry && (
        <button
          onClick={onRetry}
          className="flex items-center space-x-2 text-sm text-blue-600 hover:text-blue-500"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Retry</span>
        </button>
      )}
    </div>
  )
}

export function LoadingSkeleton({ className = '' }: { className?: string }) {
  return (
    <div className={`animate-pulse ${className}`}>
      <div className="space-y-3">
        <div className="h-4 bg-gray-200 rounded w-3/4"></div>
        <div className="h-4 bg-gray-200 rounded w-1/2"></div>
        <div className="h-4 bg-gray-200 rounded w-5/6"></div>
      </div>
    </div>
  )
}

export function LoadingProgress({ 
  progress = 0, 
  message, 
  className = '' 
}: Pick<LoadingStateProps, 'progress' | 'message' | 'className'>) {
  return (
    <div className={`space-y-3 ${className}`}>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div 
          className="bg-blue-600 h-2 rounded-full transition-all duration-300 ease-out"
          style={{ width: `${Math.min(Math.max(progress, 0), 100)}%` }}
        />
      </div>
      <div className="flex justify-between text-sm text-gray-600">
        <span>{message || 'Loading...'}</span>
        <span>{Math.round(progress)}%</span>
      </div>
    </div>
  )
}

export function LoadingDots({ 
  message, 
  className = '' 
}: Pick<LoadingStateProps, 'message' | 'className'>) {
  return (
    <div className={`flex flex-col items-center space-y-3 ${className}`}>
      <div className="flex space-x-1">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="w-2 h-2 bg-blue-600 rounded-full animate-bounce"
            style={{ animationDelay: `${i * 0.1}s` }}
          />
        ))}
      </div>
      {message && (
        <p className="text-sm text-gray-600 text-center">{message}</p>
      )}
    </div>
  )
}

// Main LoadingState component
export function LoadingState({
  variant = 'spinner',
  size = 'md',
  message,
  showRetry = false,
  onRetry,
  progress,
  className = '',
}: LoadingStateProps) {
  switch (variant) {
    case 'skeleton':
      return <LoadingSkeleton className={className} />
    case 'progress':
      return <LoadingProgress progress={progress} message={message} className={className} />
    case 'dots':
      return <LoadingDots message={message} className={className} />
    case 'spinner':
    default:
      return (
        <LoadingSpinner 
          size={size} 
          message={message} 
          showRetry={showRetry}
          onRetry={onRetry}
          className={className}
        />
      )
  }
}

// Page-level loading component
export function PageLoading({ 
  message = 'Loading...', 
  showLogo = true 
}: { 
  message?: string
  showLogo?: boolean 
}) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        {showLogo && (
          <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <Loader2 className="w-8 h-8 text-white animate-spin" />
          </div>
        )}
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Imagineer</h2>
        <p className="text-gray-600">{message}</p>
      </div>
    </div>
  )
}

// Inline loading component for buttons
export function ButtonLoading({ 
  size = 'sm', 
  className = '' 
}: { 
  size?: 'sm' | 'md'
  className?: string 
}) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
  }

  return (
    <Loader2 className={`animate-spin ${sizeClasses[size]} ${className}`} />
  )
}

// Content loading overlay
export function LoadingOverlay({ 
  isLoading, 
  message = 'Loading...', 
  children 
}: {
  isLoading: boolean
  message?: string
  children: React.ReactNode
}) {
  return (
    <div className="relative">
      {children}
      {isLoading && (
        <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center z-50">
          <LoadingSpinner message={message} />
        </div>
      )}
    </div>
  )
}

// Loading card for lists
export function LoadingCard({ className = '' }: { className?: string }) {
  return (
    <div className={`bg-white rounded-lg border p-4 ${className}`}>
      <div className="animate-pulse">
        <div className="flex items-center space-x-3 mb-3">
          <div className="w-10 h-10 bg-gray-200 rounded-full"></div>
          <div className="flex-1">
            <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
            <div className="h-3 bg-gray-200 rounded w-1/2"></div>
          </div>
        </div>
        <div className="space-y-2">
          <div className="h-3 bg-gray-200 rounded"></div>
          <div className="h-3 bg-gray-200 rounded w-5/6"></div>
          <div className="h-3 bg-gray-200 rounded w-4/6"></div>
        </div>
      </div>
    </div>
  )
}

export default LoadingState
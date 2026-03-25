import React from 'react'
import { 
  AlertTriangle, 
  AlertCircle, 
  XCircle, 
  RefreshCw, 
  Home,
  ArrowLeft,
  Wifi,
  WifiOff,
  Shield,
  Clock
} from 'lucide-react'

interface ErrorStateProps {
  type?: 'generic' | 'network' | 'permission' | 'notFound' | 'timeout' | 'validation'
  title?: string
  message?: string
  actions?: Array<{
    label: string
    onClick: () => void
    variant?: 'primary' | 'secondary'
  }>
  showRetry?: boolean
  onRetry?: () => void
  showGoBack?: boolean
  onGoBack?: () => void
  showGoHome?: boolean
  onGoHome?: () => void
  className?: string
  size?: 'sm' | 'md' | 'lg'
}

const errorConfigs = {
  generic: {
    icon: AlertTriangle,
    iconColor: 'text-red-600',
    bgColor: 'bg-red-100',
    title: 'Something went wrong',
    message: 'An unexpected error occurred. Please try again or contact support if the problem persists.',
  },
  network: {
    icon: WifiOff,
    iconColor: 'text-orange-600',
    bgColor: 'bg-orange-100',
    title: 'Connection problem',
    message: 'Unable to connect to our servers. Please check your internet connection and try again.',
  },
  permission: {
    icon: Shield,
    iconColor: 'text-yellow-600',
    bgColor: 'bg-yellow-100',
    title: 'Access denied',
    message: 'You don\'t have permission to access this resource. Please contact an administrator.',
  },
  notFound: {
    icon: AlertCircle,
    iconColor: 'text-blue-600',
    bgColor: 'bg-blue-100',
    title: 'Not found',
    message: 'The resource you\'re looking for doesn\'t exist or has been moved.',
  },
  timeout: {
    icon: Clock,
    iconColor: 'text-purple-600',
    bgColor: 'bg-purple-100',
    title: 'Request timeout',
    message: 'The request took too long to complete. Please try again.',
  },
  validation: {
    icon: XCircle,
    iconColor: 'text-red-600',
    bgColor: 'bg-red-100',
    title: 'Invalid data',
    message: 'Please check your input and try again.',
  },
}

export function ErrorState({
  type = 'generic',
  title,
  message,
  actions = [],
  showRetry = true,
  onRetry,
  showGoBack = false,
  onGoBack,
  showGoHome = false,
  onGoHome,
  className = '',
  size = 'md',
}: ErrorStateProps) {
  const config = errorConfigs[type]
  const Icon = config.icon

  const sizeClasses = {
    sm: {
      container: 'p-4',
      icon: 'w-8 h-8',
      iconContainer: 'w-12 h-12',
      title: 'text-lg',
      message: 'text-sm',
    },
    md: {
      container: 'p-6',
      icon: 'w-10 h-10',
      iconContainer: 'w-16 h-16',
      title: 'text-xl',
      message: 'text-base',
    },
    lg: {
      container: 'p-8',
      icon: 'w-12 h-12',
      iconContainer: 'w-20 h-20',
      title: 'text-2xl',
      message: 'text-lg',
    },
  }

  const sizeClass = sizeClasses[size]

  const defaultActions = []
  
  if (showRetry && onRetry) {
    defaultActions.push({
      label: 'Try Again',
      onClick: onRetry,
      variant: 'primary' as const,
    })
  }
  
  if (showGoBack && onGoBack) {
    defaultActions.push({
      label: 'Go Back',
      onClick: onGoBack,
      variant: 'secondary' as const,
    })
  }
  
  if (showGoHome && onGoHome) {
    defaultActions.push({
      label: 'Go Home',
      onClick: onGoHome,
      variant: 'secondary' as const,
    })
  }

  const allActions = [...actions, ...defaultActions]

  return (
    <div className={`text-center ${className}`}>
      <div className={`flex items-center justify-center ${sizeClass.iconContainer} ${config.bgColor} rounded-full mx-auto mb-4`}>
        <Icon className={`${sizeClass.icon} ${config.iconColor}`} />
      </div>
      
      <h3 className={`font-semibold text-gray-900 mb-2 ${sizeClass.title}`}>
        {title || config.title}
      </h3>
      
      <p className={`text-gray-600 mb-6 max-w-md mx-auto ${sizeClass.message}`}>
        {message || config.message}
      </p>

      {allActions.length > 0 && (
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          {allActions.map((action, index) => (
            <button
              key={index}
              onClick={action.onClick}
              className={`inline-flex items-center justify-center px-4 py-2 border text-sm font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${
                action.variant === 'primary'
                  ? 'border-transparent text-white bg-blue-600 hover:bg-blue-700'
                  : 'border-gray-300 text-gray-700 bg-white hover:bg-gray-50'
              }`}
            >
              {action.label === 'Try Again' && <RefreshCw className="w-4 h-4 mr-2" />}
              {action.label === 'Go Back' && <ArrowLeft className="w-4 h-4 mr-2" />}
              {action.label === 'Go Home' && <Home className="w-4 h-4 mr-2" />}
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// Specialized error components
export function NetworkError({ onRetry, className = '' }: { onRetry?: () => void, className?: string }) {
  return (
    <ErrorState
      type="network"
      showRetry={!!onRetry}
      onRetry={onRetry}
      className={className}
    />
  )
}

export function NotFoundError({ onGoHome, onGoBack, className = '' }: { 
  onGoHome?: () => void
  onGoBack?: () => void
  className?: string 
}) {
  return (
    <ErrorState
      type="notFound"
      title="Page not found"
      message="The page you're looking for doesn't exist."
      showGoHome={!!onGoHome}
      onGoHome={onGoHome}
      showGoBack={!!onGoBack}
      onGoBack={onGoBack}
      showRetry={false}
      className={className}
    />
  )
}

export function PermissionError({ onGoHome, className = '' }: { 
  onGoHome?: () => void
  className?: string 
}) {
  return (
    <ErrorState
      type="permission"
      showGoHome={!!onGoHome}
      onGoHome={onGoHome}
      showRetry={false}
      className={className}
    />
  )
}

// Inline error for forms and components
export function InlineError({ 
  message, 
  onDismiss, 
  className = '' 
}: { 
  message: string
  onDismiss?: () => void
  className?: string 
}) {
  return (
    <div className={`flex items-center p-3 text-sm text-red-800 bg-red-100 rounded-lg ${className}`}>
      <AlertCircle className="w-4 h-4 mr-2 flex-shrink-0" />
      <span className="flex-1">{message}</span>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="ml-2 text-red-600 hover:text-red-800"
        >
          <XCircle className="w-4 h-4" />
        </button>
      )}
    </div>
  )
}

// Page-level error
export function PageError({ 
  type = 'generic',
  title,
  message,
  onRetry,
  onGoHome = () => window.location.href = '/',
}: Omit<ErrorStateProps, 'size' | 'className'>) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <ErrorState
          type={type}
          title={title}
          message={message}
          size="lg"
          showRetry={!!onRetry}
          onRetry={onRetry}
          showGoHome={!!onGoHome}
          onGoHome={onGoHome}
        />
      </div>
    </div>
  )
}

// Error alert for notifications
export function ErrorAlert({ 
  title, 
  message, 
  onClose,
  className = '' 
}: {
  title?: string
  message: string
  onClose?: () => void
  className?: string
}) {
  return (
    <div className={`rounded-md bg-red-50 p-4 ${className}`}>
      <div className="flex">
        <div className="flex-shrink-0">
          <XCircle className="h-5 w-5 text-red-400" />
        </div>
        <div className="ml-3 flex-1">
          {title && (
            <h3 className="text-sm font-medium text-red-800 mb-1">
              {title}
            </h3>
          )}
          <div className="text-sm text-red-700">
            <p>{message}</p>
          </div>
        </div>
        {onClose && (
          <div className="ml-auto pl-3">
            <div className="-mx-1.5 -my-1.5">
              <button
                onClick={onClose}
                className="inline-flex rounded-md bg-red-50 p-1.5 text-red-500 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-600 focus:ring-offset-2 focus:ring-offset-red-50"
              >
                <XCircle className="h-5 w-5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default ErrorState
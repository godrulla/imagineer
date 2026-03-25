import { Link } from 'react-router-dom'

interface EmptyStateProps {
  title: string
  description: string
  actionLabel?: string
  actionLink?: string
  onAction?: () => void
}

export default function EmptyState({ 
  title, 
  description, 
  actionLabel, 
  actionLink,
  onAction 
}: EmptyStateProps) {
  return (
    <div className="text-center py-12 px-4">
      <img 
        src="/assets/illustrations/empty-state.svg" 
        alt="No content" 
        className="w-48 h-48 md:w-64 md:h-64 mx-auto mb-6 opacity-80"
      />
      <h3 className="text-xl md:text-2xl font-semibold text-gray-900 mb-2">
        {title}
      </h3>
      <p className="text-gray-600 mb-6 max-w-md mx-auto">
        {description}
      </p>
      {actionLabel && (
        <>
          {actionLink ? (
            <Link to={actionLink} className="btn-primary">
              {actionLabel}
            </Link>
          ) : (
            <button onClick={onAction} className="btn-primary">
              {actionLabel}
            </button>
          )}
        </>
      )}
    </div>
  )
}

// Usage examples:
// <EmptyState 
//   title="No projects yet"
//   description="Create your first project to get started with Imagineer"
//   actionLabel="Create Project"
//   actionLink="/projects/new"
// />

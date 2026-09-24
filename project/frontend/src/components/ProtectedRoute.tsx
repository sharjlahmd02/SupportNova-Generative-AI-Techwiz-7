import { Link, Navigate, Outlet } from 'react-router-dom'
import { ShieldAlert } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { getHomePath } from '../lib/roles'
import { Card, SkeletonCard } from './ui'

interface ProtectedRouteProps {
  allowedRoles: string[]
  children?: React.ReactNode
}

export default function ProtectedRoute({ allowedRoles, children }: ProtectedRouteProps) {
  const { user, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="space-y-4">
        <SkeletonCard lines={3} />
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (!allowedRoles.includes(user.role)) {
    return (
      <Card className="mx-auto max-w-lg text-center">
        <span className="mx-auto grid size-11 place-items-center rounded-full bg-danger-bg text-danger">
          <ShieldAlert className="size-5" aria-hidden="true" />
        </span>
        <h2 className="mt-3 text-lg font-semibold text-ink">Access denied</h2>
        <p className="mt-1 text-sm text-muted">
          Your role <span className="font-medium text-ink">({user.role})</span> cannot open this page.
        </p>
        <div className="mt-5 flex justify-center">
          <Link
            to={getHomePath(user.role)}
            className="inline-flex h-11 items-center rounded-md bg-brand-600 px-4 text-sm font-medium text-white shadow-sm transition-colors hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 focus-visible:ring-offset-1"
          >
            Go to my dashboard
          </Link>
        </div>
      </Card>
    )
  }

  return children ? <>{children}</> : <Outlet />
}

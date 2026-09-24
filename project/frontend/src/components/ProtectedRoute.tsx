import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Navigate, Outlet } from 'react-router-dom'
import { getHomePath } from '../lib/roles'

interface ProtectedRouteProps {
  allowedRoles: string[]
  children?: React.ReactNode
}

export default function ProtectedRoute({ allowedRoles, children }: ProtectedRouteProps) {
  const { user, isLoading } = useAuth()

  if (isLoading) {
    return <div className="card">Checking your session...</div>
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (!allowedRoles.includes(user.role)) {
    return (
      <div className="card">
        <h2>Access denied</h2>
        <p style={{ color: '#666', margin: '0.5rem 0 1rem' }}>
          Your role ({user.role}) cannot open this page.
        </p>
        <Link to={getHomePath(user.role)} className="btn btn-primary">
          Go to my dashboard
        </Link>
      </div>
    )
  }

  return children ? <>{children}</> : <Outlet />
}

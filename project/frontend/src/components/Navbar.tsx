import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getHomePath } from '../lib/roles'

export default function Navbar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  if (!user) return null

  return (
    <nav className="navbar">
      <div className="container navbar-content">
        <Link to={getHomePath(user.role)} className="navbar-brand">
          SupportNova
        </Link>
        <div className="navbar-nav">
          <Link to={getHomePath(user.role)} className="nav-link">
            Dashboard
          </Link>
          {['admin', 'manager'].includes(user.role) && (
            <Link to="/admin/dashboard" className="nav-link">Admin</Link>
          )}
          {['agent', 'manager', 'admin'].includes(user.role) && (
            <Link to="/agent/dashboard" className="nav-link">Agent</Link>
          )}
          {['reviewer', 'manager', 'admin'].includes(user.role) && (
            <Link to="/reviewer/queue" className="nav-link">Review Queue</Link>
          )}
          <Link to="/complaints/new" className="nav-link">New Complaint</Link>
          <span className="nav-link" style={{ color: '#666' }}>
            {user.username} ({user.role})
          </span>
          <button type="button" onClick={handleLogout} className="btn btn-secondary">
            Logout
          </button>
        </div>
      </div>
    </nav>
  )
}

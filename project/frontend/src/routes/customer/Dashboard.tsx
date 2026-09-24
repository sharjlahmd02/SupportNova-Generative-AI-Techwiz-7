import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

export function CustomerDashboard() {
  const { user } = useAuth()

  return (
    <div>
      <header className="page-header">
        <h1 className="page-title">My Complaints</h1>
        <p className="page-subtitle">Welcome, {user?.username}</p>
      </header>
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2>Your Complaints</h2>
          <Link to="/complaints/new" className="btn btn-primary">Submit New Complaint</Link>
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Title</th>
              <th>Status</th>
              <th>Date</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={5} style={{ textAlign: 'center', color: '#999' }}>No complaints yet</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
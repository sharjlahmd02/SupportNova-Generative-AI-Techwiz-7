import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { api } from '../../lib/api'
import { getErrorMessage } from '../../lib/errors'
import { formatDate, statusClass, verificationClass, verificationLabel } from '../../lib/format'
import type { Complaint, DashboardStats } from '../../types'

export function CustomerDashboard() {
  const { user } = useAuth()
  const [complaints, setComplaints] = useState<Complaint[]>([])
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    const [complaintsResult, statsResult] = await Promise.allSettled([
      api.get<Complaint[]>('/complaints'),
      api.get<DashboardStats>('/dashboard/stats'),
    ])

    if (complaintsResult.status === 'fulfilled') {
      setComplaints(complaintsResult.value.data)
    } else {
      setComplaints([])
      setError(getErrorMessage(complaintsResult.reason, 'Failed to load your complaints'))
    }

    if (statsResult.status === 'fulfilled') {
      setStats(statsResult.value.data)
    } else {
      setStats(null)
      setError((current) =>
        current || getErrorMessage(statsResult.reason, 'Failed to load your summary'),
      )
    }

    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  return (
    <div>
      <header className="page-header">
        <h1 className="page-title">My Complaints</h1>
        <p className="page-subtitle">Welcome, {user?.username}</p>
      </header>

      {error && (
        <div className="alert alert-error">
          {error}{' '}
          <button type="button" className="link-button" onClick={load}>
            Retry
          </button>
        </div>
      )}

      {stats && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '1rem',
            marginBottom: '1rem',
          }}
        >
          <div className="card">
            <h3>Total complaints</h3>
            <p className="stat-value">{stats.total_complaints}</p>
          </div>
          <div className="card">
            <h3>Escalated</h3>
            <p className="stat-value">{stats.escalation_count}</p>
          </div>
          <div className="card">
            <h3>Open</h3>
            <p className="stat-value">
              {Object.entries(stats.by_status)
                .filter(([status]) => status !== 'Resolved' && status !== 'Closed')
                .reduce((total, [, count]) => total + count, 0)}
            </p>
          </div>
        </div>
      )}

      <div className="card">
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '1rem',
          }}
        >
          <h2>Your Complaints</h2>
          <Link to="/complaints/new" className="btn btn-primary">
            Submit New Complaint
          </Link>
        </div>

        {loading ? (
          <p className="empty-state">Loading…</p>
        ) : complaints.length === 0 ? (
          <p className="empty-state">
            No complaints yet.{' '}
            <Link to="/complaints/new">Submit your first complaint</Link>.
          </p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Title</th>
                <th>Category</th>
                <th>Status</th>
                <th>Verification</th>
                <th>Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {complaints.map((complaint) => (
                <tr key={complaint.id}>
                  <td>{complaint.id}</td>
                  <td>{complaint.title}</td>
                  <td>{complaint.category || '—'}</td>
                  <td>
                    <span className={statusClass(complaint.status)}>{complaint.status}</span>
                  </td>
                  <td>
                    <span className={verificationClass(complaint.verification_status)}>
                      {verificationLabel(complaint.verification_status)}
                    </span>
                  </td>
                  <td>{formatDate(complaint.date || complaint.created_at)}</td>
                  <td>
                    <Link to={`/complaints/${complaint.id}`}>View</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

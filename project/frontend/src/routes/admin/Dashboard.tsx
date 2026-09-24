import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../lib/api'
import { getErrorMessage } from '../../lib/errors'
import { formatDate, statusClass } from '../../lib/format'
import type { Complaint, DashboardStats } from '../../types'

function Breakdown({ title, values }: { title: string; values: Record<string, number> }) {
  const entries = Object.entries(values).sort((a, b) => b[1] - a[1])
  return (
    <div className="card">
      <h3>{title}</h3>
      {entries.length === 0 ? (
        <p className="empty-state" style={{ padding: '0.75rem 0' }}>
          No data yet
        </p>
      ) : (
        <div className="breakdown">
          {entries.map(([label, count]) => (
            <span key={label} className="badge">
              {label}: {count}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

export function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [recent, setRecent] = useState<Complaint[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    const [statsResult, recentResult] = await Promise.allSettled([
      api.get<DashboardStats>('/dashboard/stats'),
      api.get<Complaint[]>('/complaints', { params: { limit: 5 } }),
    ])

    if (statsResult.status === 'fulfilled') {
      setStats(statsResult.value.data)
    } else {
      setStats(null)
      setError(getErrorMessage(statsResult.reason, 'Failed to load dashboard statistics'))
    }

    if (recentResult.status === 'fulfilled') {
      setRecent(recentResult.value.data)
    } else {
      setRecent([])
      setError((current) =>
        current || getErrorMessage(recentResult.reason, 'Failed to load recent complaints'),
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
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '1rem',
          }}
        >
          <div>
            <h1 className="page-title">Admin Dashboard</h1>
            <p className="page-subtitle">System overview and analytics</p>
          </div>
          <div className="actions-row">
            <Link to="/reviewer/queue" className="btn btn-secondary">
              Review queue
            </Link>
            <button type="button" className="btn btn-primary" onClick={load} disabled={loading}>
              {loading ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>
        </div>
      </header>

      {error && (
        <div className="alert alert-error">
          {error}{' '}
          <button type="button" className="link-button" onClick={load}>
            Retry
          </button>
        </div>
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
          gap: '1rem',
          marginBottom: '2rem',
        }}
      >
        <div className="card">
          <h3>Total Complaints</h3>
          <p className="stat-value">{stats ? stats.total_complaints : loading ? '…' : '—'}</p>
        </div>
        <div className="card">
          <h3>Pending Review</h3>
          <p className="stat-value">{stats ? stats.manual_review_count : loading ? '…' : '—'}</p>
        </div>
        <div className="card">
          <h3>Escalations</h3>
          <p className="stat-value">{stats ? stats.escalation_count : loading ? '…' : '—'}</p>
        </div>
        <div className="card">
          <h3>GenAI / Python Mismatches</h3>
          <p className="stat-value">{stats ? stats.mismatch_count : loading ? '…' : '—'}</p>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '1rem',
          marginBottom: '1rem',
        }}
      >
        <Breakdown title="By status" values={stats?.by_status ?? {}} />
        <Breakdown title="By category" values={stats?.by_category ?? {}} />
        <Breakdown title="By department" values={stats?.by_department ?? {}} />
        <Breakdown title="By priority" values={stats?.by_priority ?? {}} />
        <Breakdown title="By sentiment" values={stats?.by_sentiment ?? {}} />
      </div>

      <div className="card">
        <h2>Recent Activity</h2>
        {loading ? (
          <p className="empty-state">Loading…</p>
        ) : recent.length === 0 ? (
          <p className="empty-state">No complaints yet</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Title</th>
                <th>Category</th>
                <th>Status</th>
                <th>Created</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {recent.map((complaint) => (
                <tr key={complaint.id}>
                  <td>{complaint.id}</td>
                  <td>{complaint.title}</td>
                  <td>{complaint.category || '—'}</td>
                  <td>
                    <span className={statusClass(complaint.status)}>{complaint.status}</span>
                  </td>
                  <td>{formatDate(complaint.created_at)}</td>
                  <td>
                    <Link to={`/complaints/${complaint.id}`}>Open</Link>
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

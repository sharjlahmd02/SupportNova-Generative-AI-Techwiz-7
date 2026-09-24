import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../lib/api'
import { getErrorMessage } from '../../lib/errors'
import { statusClass, verificationClass, verificationLabel } from '../../lib/format'
import type { Complaint } from '../../types'

export function AgentDashboard() {
  const [complaints, setComplaints] = useState<Complaint[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const { data } = await api.get<Complaint[]>('/complaints', { params: { limit: 200 } })
      setComplaints(data)
    } catch (err) {
      setComplaints([])
      setError(getErrorMessage(err, 'Failed to load complaints'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const openComplaints = complaints.filter(
    (complaint) => complaint.status !== 'Resolved' && complaint.status !== 'Closed',
  )

  return (
    <div>
      <header className="page-header">
        <h1 className="page-title">Agent Dashboard</h1>
        <p className="page-subtitle">Assigned complaints and workload</p>
      </header>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '1rem',
          marginBottom: '1rem',
        }}
      >
        <div className="card">
          <h3>Open complaints</h3>
          <p className="stat-value">{loading ? '…' : openComplaints.length}</p>
        </div>
        <div className="card">
          <h3>Escalated</h3>
          <p className="stat-value">
            {loading ? '…' : complaints.filter((c) => c.status === 'Escalated').length}
          </p>
        </div>
        <div className="card">
          <h3>Needs review</h3>
          <p className="stat-value">
            {loading
              ? '…'
              : complaints.filter((c) => c.verification_status === 'manual_review' || c.verification_status === 'mismatch').length}
          </p>
        </div>
      </div>

      <div className="card">
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '1rem',
          }}
        >
          <h2>Assigned Complaints</h2>
          <button type="button" className="btn btn-secondary" onClick={load} disabled={loading}>
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>

        {error && (
          <div className="alert alert-error">
            {error}{' '}
            <button type="button" className="link-button" onClick={load}>
              Retry
            </button>
          </div>
        )}

        {loading ? (
          <p className="empty-state">Loading…</p>
        ) : complaints.length === 0 ? (
          <p className="empty-state">No complaints assigned right now.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Title</th>
                <th>Category</th>
                <th>Department</th>
                <th>Priority</th>
                <th>Sentiment</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {complaints.map((complaint) => (
                <tr key={complaint.id}>
                  <td>{complaint.id}</td>
                  <td>{complaint.title}</td>
                  <td>{complaint.category || '—'}</td>
                  <td>{complaint.department || '—'}</td>
                  <td>{complaint.priority || '—'}</td>
                  <td>{complaint.sentiment || '—'}</td>
                  <td>
                    <span className={statusClass(complaint.status)}>{complaint.status}</span>
                    {complaint.verification_status && (
                      <>
                        {' '}
                        <span className={verificationClass(complaint.verification_status)}>
                          {verificationLabel(complaint.verification_status)}
                        </span>
                      </>
                    )}
                  </td>
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

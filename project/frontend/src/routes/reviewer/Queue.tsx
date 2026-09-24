import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../lib/api'
import { getErrorMessage } from '../../lib/errors'
import { formatDate } from '../../lib/format'
import type { ReviewCase } from '../../types'

const ACTIONS: Array<{ action: string; label: string; className: string }> = [
  { action: 'approve', label: 'Approve', className: 'btn btn-primary' },
  { action: 'modify', label: 'Modify', className: 'btn btn-secondary' },
  { action: 'reassign', label: 'Reassign', className: 'btn btn-secondary' },
  { action: 'escalate', label: 'Escalate', className: 'btn btn-danger' },
  { action: 'regenerate', label: 'Regenerate', className: 'btn btn-secondary' },
]

function DiffTable({ diff }: { diff: Record<string, unknown> }) {
  const entries = Object.entries(diff)
  if (entries.length === 0) {
    return <p className="empty-state">No differing fields.</p>
  }
  return (
    <table className="table">
      <thead>
        <tr>
          <th>Field</th>
          <th>GenAI (Pipeline 1)</th>
          <th>Python (Pipeline 2)</th>
        </tr>
      </thead>
      <tbody>
        {entries.map(([field, value]) => {
          const pair = value as { genai?: unknown; python?: unknown }
          return (
            <tr key={field}>
              <td>{field}</td>
              <td>{String(pair.genai ?? '—')}</td>
              <td>{String(pair.python ?? '—')}</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

export function ReviewerQueue() {
  const [cases, setCases] = useState<ReviewCase[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionError, setActionError] = useState('')
  const [actionSuccess, setActionSuccess] = useState('')
  const [busyId, setBusyId] = useState<number | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const { data } = await api.get<ReviewCase[]>('/review/queue')
      setCases(data)
    } catch (err) {
      setCases([])
      setError(getErrorMessage(err, 'Failed to load the review queue'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const takeAction = async (caseId: number, action: string) => {
    setBusyId(caseId)
    setActionError('')
    setActionSuccess('')
    try {
      await api.post(`/review/${caseId}/action`, { action })
      setActionSuccess(`Case #${caseId} marked as "${action}".`)
      await load()
    } catch (err) {
      setActionError(getErrorMessage(err, `Failed to ${action} case #${caseId}`))
    } finally {
      setBusyId(null)
    }
  }

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
            <h1 className="page-title">Manual Review Queue</h1>
            <p className="page-subtitle">Complaints requiring human review</p>
          </div>
          <button type="button" className="btn btn-secondary" onClick={load} disabled={loading}>
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
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
      {actionError && <div className="alert alert-error">{actionError}</div>}
      {actionSuccess && <div className="alert alert-success">{actionSuccess}</div>}

      {loading ? (
        <div className="card">
          <p className="empty-state">Loading review queue…</p>
        </div>
      ) : cases.length === 0 ? (
        <div className="card">
          <p className="empty-state">
            No cases in the review queue. Run <strong>analyze</strong> then{' '}
            <strong>validate</strong> on a complaint to generate a comparison.
          </p>
        </div>
      ) : (
        cases.map((reviewCase) => (
          <div className="card" key={reviewCase.id}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '0.5rem',
              }}
            >
              <h2>Case #{reviewCase.id} · Complaint #{reviewCase.complaint_id}</h2>
              <Link to={`/complaints/${reviewCase.complaint_id}`}>Open complaint</Link>
            </div>
            <p style={{ color: '#666', fontSize: '0.875rem' }}>
              Created {formatDate(reviewCase.created_at)}
              {reviewCase.reviewer_action && ` · handled by ${reviewCase.reviewer_action}`}
            </p>

            <DiffTable diff={reviewCase.diff} />

            <div className="actions-row" style={{ marginTop: '1rem' }}>
              {ACTIONS.map(({ action, label, className }) => (
                <button
                  key={action}
                  type="button"
                  className={className}
                  disabled={busyId !== null}
                  onClick={() => takeAction(reviewCase.id, action)}
                >
                  {busyId === reviewCase.id ? 'Working…' : label}
                </button>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  )
}

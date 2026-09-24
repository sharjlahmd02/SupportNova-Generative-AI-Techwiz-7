import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { api } from '../../lib/api'

interface Complaint {
  id: number
  title: string
  description: string
  customer_type: string
  product_service: string
  order_ref: string
  channel: string
  date: string
  status: string
}

export function ComplaintDetail() {
  const { id } = useParams<{ id: string }>()
  const [complaint, setComplaint] = useState<Complaint | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (id) {
      fetchComplaint()
    }
  }, [id])

  const fetchComplaint = async () => {
    try {
      const response = await api.get(`/complaints/${id}`)
      setComplaint(response.data)
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load complaint')
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <div className="card">Loading...</div>
  if (error) return <div className="alert alert-error">{error}</div>
  if (!complaint) return <div className="alert alert-error">Complaint not found</div>

  return (
    <div>
      <header className="page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 className="page-title">{complaint.title}</h1>
            <p className="page-subtitle">Complaint #{complaint.id} • {complaint.status}</p>
          </div>
          <Link to="/complaints/new" className="btn btn-secondary">New Complaint</Link>
        </div>
      </header>

      <div className="card">
        <h2>Complaint Details</h2>
        <dl style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
          <div><dt style={{ color: '#666', fontSize: '0.875rem' }}>ID</dt><dd>{complaint.id}</dd></div>
          <div><dt style={{ color: '#666', fontSize: '0.875rem' }}>Customer Type</dt><dd>{complaint.customer_type || '—'}</dd></div>
          <div><dt style={{ color: '#666', fontSize: '0.875rem' }}>Product/Service</dt><dd>{complaint.product_service || '—'}</dd></div>
          <div><dt style={{ color: '#666', fontSize: '0.875rem' }}>Order Ref</dt><dd>{complaint.order_ref || '—'}</dd></div>
          <div><dt style={{ color: '#666', fontSize: '0.875rem' }}>Channel</dt><dd>{complaint.channel}</dd></div>
          <div><dt style={{ color: '#666', fontSize: '0.875rem' }}>Date</dt><dd>{new Date(complaint.date).toLocaleString()}</dd></div>
          <div><dt style={{ color: '#666', fontSize: '0.875rem' }}>Status</dt><dd><span className="badge badge-verified">{complaint.status}</span></dd></div>
        </dl>
      </div>

      <div className="card">
        <h2>Description</h2>
        <p style={{ whiteSpace: 'pre-wrap' }}>{complaint.description}</p>
      </div>

      <div className="card">
        <h2>Pipeline Analysis</h2>
        <p style={{ color: '#999' }}>Pipeline 1 (Gemini) and Pipeline 2 (Python) results will appear here after analysis.</p>
        <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
          <button className="btn btn-primary" disabled>Run Gemini Analysis</button>
          <button className="btn btn-secondary" disabled>Run Python Validation</button>
        </div>
      </div>
    </div>
  )
}
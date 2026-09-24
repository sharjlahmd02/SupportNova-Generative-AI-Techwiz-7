import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../../lib/api'
import { getErrorMessage } from '../../lib/errors'
import type { Complaint } from '../../types'

const OPTIONAL_TEXT_FIELDS = [
  'customer_type',
  'product_service',
  'order_ref',
  'channel',
  'prior_complaint_ref',
  'requested_resolution',
] as const

const EMPTY_FORM = {
  title: '',
  description: '',
  customer_type: '',
  product_service: '',
  order_ref: '',
  channel: 'web',
  attachments: '',
  prior_complaint_ref: '',
  requested_resolution: '',
}

export function ComplaintNew() {
  const [formData, setFormData] = useState({ ...EMPTY_FORM })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const buildPayload = (): Record<string, unknown> => {
    const title = formData.title.trim()
    const description = formData.description.trim()
    if (!title) throw new Error('Title is required.')
    if (!description) throw new Error('Description is required.')

    const payload: Record<string, unknown> = { title, description }

    for (const field of OPTIONAL_TEXT_FIELDS) {
      const value = formData[field].trim()
      if (value) payload[field] = value
    }

    const attachments = formData.attachments.trim()
    if (attachments) {
      try {
        payload.attachments = JSON.parse(attachments)
      } catch {
        throw new Error('Attachments must be valid JSON, or left empty.')
      }
    }

    return payload
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)
    try {
      const response = await api.post<Complaint>('/complaints', buildPayload())
      setSuccess('Complaint submitted successfully! Taking you to the complaint…')
      setTimeout(() => navigate(`/complaints/${response.data.id}`, { replace: true }), 700)
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to submit complaint'))
      setLoading(false)
    }
  }

  return (
    <div>
      <header className="page-header">
        <h1 className="page-title">Submit Complaint</h1>
        <p className="page-subtitle">Fill in the details below to submit a new complaint</p>
      </header>
      <div className="card">
        <form onSubmit={handleSubmit}>
          {error && <div className="alert alert-error">{error}</div>}
          {success && <div className="alert alert-success">{success}</div>}

          <div className="form-group">
            <label htmlFor="title">Title *</label>
            <input
              id="title"
              name="title"
              type="text"
              value={formData.title}
              onChange={handleChange}
              required
              maxLength={200}
              placeholder="Brief summary of the issue"
            />
          </div>

          <div className="form-group">
            <label htmlFor="description">Description *</label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              required
              rows={6}
              placeholder="Detailed description of the complaint..."
            />
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '1rem',
            }}
          >
            <div className="form-group">
              <label htmlFor="customer_type">Customer Type</label>
              <select
                id="customer_type"
                name="customer_type"
                value={formData.customer_type}
                onChange={handleChange}
              >
                <option value="">Select...</option>
                <option value="individual">Individual</option>
                <option value="business">Business</option>
                <option value="vip">VIP</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="product_service">Product/Service</label>
              <input
                id="product_service"
                name="product_service"
                type="text"
                value={formData.product_service}
                onChange={handleChange}
                placeholder="Product or service name"
              />
            </div>

            <div className="form-group">
              <label htmlFor="order_ref">Order Reference</label>
              <input
                id="order_ref"
                name="order_ref"
                type="text"
                value={formData.order_ref}
                onChange={handleChange}
                placeholder="Order or transaction ID"
              />
            </div>

            <div className="form-group">
              <label htmlFor="channel">Channel</label>
              <select
                id="channel"
                name="channel"
                value={formData.channel}
                onChange={handleChange}
              >
                <option value="web">Web</option>
                <option value="email">Email</option>
                <option value="phone">Phone</option>
                <option value="chat">Chat</option>
                <option value="in_person">In Person</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="prior_complaint_ref">Prior Complaint Reference</label>
            <input
              id="prior_complaint_ref"
              name="prior_complaint_ref"
              type="text"
              value={formData.prior_complaint_ref}
              onChange={handleChange}
              placeholder="Reference to previous related complaint (if any)"
            />
          </div>

          <div className="form-group">
            <label htmlFor="requested_resolution">Requested Resolution</label>
            <textarea
              id="requested_resolution"
              name="requested_resolution"
              value={formData.requested_resolution}
              onChange={handleChange}
              rows={3}
              placeholder="What resolution are you seeking?"
            />
          </div>

          <div className="form-group">
            <label htmlFor="attachments">Attachments (JSON, optional)</label>
            <textarea
              id="attachments"
              name="attachments"
              value={formData.attachments}
              onChange={handleChange}
              rows={3}
              placeholder='[{"filename": "doc.pdf", "url": "..."}]'
            />
          </div>

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Submitting...' : 'Submit Complaint'}
            </button>
            <Link to="/" className="btn btn-secondary">
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}

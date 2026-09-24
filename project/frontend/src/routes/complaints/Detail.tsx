import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import axios from 'axios'
import { api } from '../../lib/api'
import { getErrorMessage } from '../../lib/errors'
import { formatDate, statusClass, verificationClass, verificationLabel } from '../../lib/format'
import type { Complaint, PipelineResult, ValidationResult } from '../../types'

async function getOptional<T>(path: string): Promise<T | null> {
  try {
    const { data } = await api.get<T>(path)
    return data
  } catch (error) {
    // "not analysed yet" and "not allowed to see it" both mean: show nothing here.
    if (axios.isAxiosError(error)) {
      const status = error.response?.status
      if (status === 404 || status === 403) return null
    }
    throw error
  }
}

const COMPARED_FIELDS: Array<{ key: keyof PipelineResult; label: string }> = [
  { key: 'issue_category', label: 'Category' },
  { key: 'subcategory', label: 'Subcategory' },
  { key: 'department', label: 'Department' },
  { key: 'urgency', label: 'Urgency' },
  { key: 'priority', label: 'Priority' },
  { key: 'escalation_level', label: 'Escalation level' },
]

function Field({ label, value }: { label: string; value: unknown }) {
  const display =
    value === null || value === undefined || value === ''
      ? '—'
      : typeof value === 'boolean'
        ? value ? 'Yes' : 'No'
        : String(value)
  return (
    <div>
      <span className="kv-key">{label}</span>
      <span className="kv-value">{display}</span>
    </div>
  )
}

function PipelinePanel({
  title,
  subtitle,
  result,
  emptyText,
}: {
  title: string
  subtitle?: string
  result: PipelineResult | null
  emptyText: string
}) {
  if (!result) {
    return (
      <div className="card">
        <h2>{title}</h2>
        <p className="empty-state">{emptyText}</p>
      </div>
    )
  }

  return (
    <div className="card">
      <h2>{title}</h2>
      {subtitle && <p style={{ color: '#666', fontSize: '0.875rem' }}>{subtitle}</p>}
      <div className="kv-list">
        <Field label="Primary issue" value={result.primary_issue} />
        <Field label="Category" value={result.issue_category} />
        <Field label="Subcategory" value={result.subcategory} />
        <Field label="Department" value={result.department} />
        <Field label="Sentiment" value={result.sentiment} />
        <Field label="Urgency" value={result.urgency} />
        <Field label="Priority" value={result.priority} />
        <Field label="Escalation required" value={result.escalation_required} />
        <Field label="Escalation level" value={result.escalation_level} />
        <Field label="Policy" value={result.policy_id ?? result.policy_section} />
      </div>
      {result.escalation_reason && (
        <p style={{ marginTop: '0.75rem', color: '#a71d2a' }}>
          Escalation reason: {result.escalation_reason}
        </p>
      )}
      {result.clarification_questions && result.clarification_questions.length > 0 && (
        <div style={{ marginTop: '0.75rem' }}>
          <strong>Clarification questions</strong>
          <ul>
            {result.clarification_questions.map((question, index) => (
              <li key={index}>{question}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

export function ComplaintDetail() {
  const { id } = useParams<{ id: string }>()
  const [complaint, setComplaint] = useState<Complaint | null>(null)
  const [analysis, setAnalysis] = useState<PipelineResult | null>(null)
  const [validation, setValidation] = useState<ValidationResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [actionError, setActionError] = useState('')
  const [actionSuccess, setActionSuccess] = useState('')
  const [running, setRunning] = useState<'analyze' | 'validate' | null>(null)

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setLoadError('')

    const results = await Promise.allSettled([
      api.get<Complaint>(`/complaints/${id}`),
      getOptional<PipelineResult>(`/complaints/${id}/analysis`),
      getOptional<ValidationResult>(`/complaints/${id}/validation`),
    ])

    const [complaintResult, analysisResult, validationResult] = results

    if (complaintResult.status === 'fulfilled') {
      setComplaint(complaintResult.value.data)
    } else {
      setComplaint(null)
      setLoadError(getErrorMessage(complaintResult.reason, 'Failed to load complaint'))
    }

    if (analysisResult.status === 'fulfilled') {
      setAnalysis(analysisResult.value)
    } else {
      setAnalysis(null)
      setLoadError((current) =>
        current || getErrorMessage(analysisResult.reason, 'Failed to load GenAI analysis'),
      )
    }

    if (validationResult.status === 'fulfilled') {
      setValidation(validationResult.value)
    } else {
      setValidation(null)
      setLoadError((current) =>
        current || getErrorMessage(validationResult.reason, 'Failed to load validation result'),
      )
    }

    setLoading(false)
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  const runPipeline = async (pipeline: 'analyze' | 'validate') => {
    if (!id) return
    setRunning(pipeline)
    setActionError('')
    setActionSuccess('')
    try {
      if (pipeline === 'analyze') {
        await api.post(`/complaints/${id}/analyze`)
        setActionSuccess('Gemini analysis complete.')
      } else {
        await api.post(`/complaints/${id}/validate`)
        setActionSuccess('Python validation complete.')
      }
      await load()
    } catch (error) {
      setActionError(
        getErrorMessage(
          error,
          pipeline === 'analyze'
            ? 'Gemini analysis failed. Check the backend logs / API key.'
            : 'Validation failed.',
        ),
      )
    } finally {
      setRunning(null)
    }
  }

  if (loading) return <div className="card">Loading complaint…</div>

  if (loadError && !complaint) {
    return (
      <div className="alert alert-error error-state">
        <strong>Could not load this complaint.</strong>
        <p style={{ margin: '0.5rem 0 1rem' }}>{loadError}</p>
        <div className="actions-row">
          <button type="button" className="btn btn-secondary" onClick={load}>
            Retry
          </button>
          <Link to="/" className="btn btn-primary">
            Back to dashboard
          </Link>
        </div>
      </div>
    )
  }

  if (!complaint) return <div className="alert alert-error">Complaint not found</div>

  return (
    <div>
      <header className="page-header">
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '1rem',
            flexWrap: 'wrap',
          }}
        >
          <div>
            <h1 className="page-title">{complaint.title}</h1>
            <p className="page-subtitle">
              Complaint #{complaint.id} • <span className={statusClass(complaint.status)}>{complaint.status}</span>
            </p>
          </div>
          <Link to="/complaints/new" className="btn btn-secondary">
            New Complaint
          </Link>
        </div>
      </header>

      {loadError && <div className="alert alert-error">{loadError}</div>}
      {actionError && <div className="alert alert-error">{actionError}</div>}
      {actionSuccess && <div className="alert alert-success">{actionSuccess}</div>}

      <div className="card">
        <h2>Complaint Details</h2>
        <dl className="kv-list">
          <Field label="ID" value={complaint.id} />
          <Field label="Customer type" value={complaint.customer_type} />
          <Field label="Product/Service" value={complaint.product_service} />
          <Field label="Order Ref" value={complaint.order_ref} />
          <Field label="Channel" value={complaint.channel} />
          <Field label="Submitted" value={formatDate(complaint.date || complaint.created_at)} />
          <Field label="Status" value={complaint.status} />
          <Field label="Category" value={complaint.category} />
          <Field label="Department" value={complaint.department} />
          <Field label="Priority" value={complaint.priority} />
          <Field label="Sentiment" value={complaint.sentiment} />
          <Field label="Escalation" value={complaint.escalation_required} />
          <Field
            label="Verification"
            value={complaint.verification_status ? verificationLabel(complaint.verification_status) : null}
          />
        </dl>
      </div>

      <div className="card">
        <h2>Description</h2>
        <p style={{ whiteSpace: 'pre-wrap' }}>{complaint.description}</p>
        {complaint.requested_resolution && (
          <>
            <h2 style={{ marginTop: '1.25rem' }}>Requested resolution</h2>
            <p style={{ whiteSpace: 'pre-wrap' }}>{complaint.requested_resolution}</p>
          </>
        )}
      </div>

      <div className="card">
        <h2>Pipeline Analysis</h2>
        <div className="actions-row" style={{ marginTop: '0.75rem' }}>
          <button
            type="button"
            className="btn btn-primary"
            disabled={running !== null}
            onClick={() => runPipeline('analyze')}
          >
            {running === 'analyze' ? 'Analyzing…' : analysis ? 'Re-run Gemini Analysis' : 'Run Gemini Analysis'}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            disabled={running !== null}
            onClick={() => runPipeline('validate')}
          >
            {running === 'validate' ? 'Validating…' : validation ? 'Re-run Python Validation' : 'Run Python Validation'}
          </button>
          {validation && (
            <span className={verificationClass(validation.verification_status)}>
              {verificationLabel(validation.verification_status)}
            </span>
          )}
        </div>

        {validation && validation.mismatch_reasons.length > 0 && (
          <div className="alert alert-info" style={{ marginTop: '1rem' }}>
            <strong>Comparison notes</strong>
            <ul style={{ marginTop: '0.5rem', paddingLeft: '1.25rem' }}>
              {validation.mismatch_reasons.map((reason, index) => (
                <li key={index}>{reason}</li>
              ))}
            </ul>
          </div>
        )}

        {analysis && validation && (
          <div style={{ marginTop: '1.5rem' }}>
            <h2>Side-by-side comparison</h2>
            <table className="table">
              <thead>
                <tr>
                  <th>Field</th>
                  <th>Pipeline 1 (Gemini)</th>
                  <th>Pipeline 2 (Python)</th>
                  <th>Match</th>
                </tr>
              </thead>
              <tbody>
                {COMPARED_FIELDS.map(({ key, label }) => {
                  const genaiValue = analysis[key]
                  const pythonValue = validation[key]
                  const matches = String(genaiValue ?? '') === String(pythonValue ?? '')
                  return (
                    <tr key={String(key)}>
                      <td>{label}</td>
                      <td>{String(genaiValue ?? '—')}</td>
                      <td>{String(pythonValue ?? '—')}</td>
                      <td>
                        <span className={matches ? 'badge badge-verified' : 'badge badge-mismatch'}>
                          {matches ? 'Match' : 'Differs'}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="pipeline-grid" style={{ marginTop: '1rem' }}>
          <PipelinePanel
            title="Pipeline 1 — Gemini"
            subtitle={analysis ? `${analysis.model ?? 'unknown model'} · ${analysis.prompt_version ?? ''}` : undefined}
            result={analysis}
            emptyText="No GenAI analysis yet. Run the analysis to see Pipeline 1 output."
          />
          <PipelinePanel
            title="Pipeline 2 — Python rule engine"
            subtitle={validation ? `${validation.model ?? 'rule-engine'}` : undefined}
            result={validation}
            emptyText="No validation yet. Run the validation to see Pipeline 2 output."
          />
        </div>
      </div>
    </div>
  )
}

import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import axios from 'axios'
import {
  ArrowLeft,
  FilePlus2,
  GitCompare,
  History,
  RefreshCw,
  Sparkles,
} from 'lucide-react'
import { api } from '../../lib/api'
import { getErrorMessage } from '../../lib/errors'
import {
  formatDate,
  priorityTone,
  statusTone,
  urgencyTone,
  verificationLabel,
  verificationTone,
} from '../../lib/format'
import type { Complaint, PipelineResult, ReviewCase, ValidationResult } from '../../types'
import {
  Alert,
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  KeyValue,
  PageHeader,
  SkeletonCard,
  Table,
  TBody,
  Td,
  Th,
  THead,
  Tabs,
  Tr,
  useToast,
} from '../../components/ui'

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
      <EmptyState
        icon={<Sparkles className="size-5" />}
        title={title}
        description={emptyText}
        compact
      />
    )
  }

  return (
    <Card padded={false}>
      <CardHeader className="px-4 py-3.5 sm:px-5" title={title} description={subtitle} />
      <div className="p-4 sm:p-5">
        <dl className="grid gap-x-8 sm:grid-cols-2">
          <KeyValue label="Primary issue" value={result.primary_issue} />
          <KeyValue label="Category" value={result.issue_category} />
          <KeyValue label="Subcategory" value={result.subcategory} />
          <KeyValue label="Department" value={result.department} />
          <KeyValue label="Sentiment" value={result.sentiment} />
          <KeyValue label="Urgency" value={<Badge tone={urgencyTone(result.urgency)}>{result.urgency}</Badge>} />
          <KeyValue label="Priority" value={<Badge tone={priorityTone(result.priority)}>{result.priority}</Badge>} />
          <KeyValue label="Escalation required" value={result.escalation_required ? 'Yes' : 'No'} />
          <KeyValue label="Escalation level" value={result.escalation_level ?? '—'} />
          <KeyValue label="Policy" value={result.policy_id ?? result.policy_section ?? '—'} />
        </dl>

        {result.escalation_reason && (
          <p className="mt-4 rounded-md border border-danger-border bg-danger-bg px-3 py-2 text-sm text-danger">
            <span className="font-semibold">Escalation reason:</span> {result.escalation_reason}
          </p>
        )}

        {result.clarification_questions && result.clarification_questions.length > 0 && (
          <div className="mt-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">
              Clarification questions
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink-soft">
              {result.clarification_questions.map((question, index) => (
                <li key={index}>{question}</li>
              ))}
            </ul>
          </div>
        )}

        {result.customer_response && (
          <div className="mt-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">
              Drafted customer response
            </p>
            <p className="mt-1.5 whitespace-pre-wrap rounded-md bg-canvas px-3 py-2.5 text-sm text-ink-soft">
              {result.customer_response}
            </p>
          </div>
        )}

        {result.agent_guidance && result.agent_guidance.length > 0 && (
          <div className="mt-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Agent guidance</p>
            <ul className="mt-1.5 list-disc space-y-1 pl-5 text-sm text-ink-soft">
              {result.agent_guidance.map((line, index) => (
                <li key={index}>{line}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Card>
  )
}

export function ComplaintDetail() {
  const { id } = useParams<{ id: string }>()
  const { toast } = useToast()
  const [complaint, setComplaint] = useState<Complaint | null>(null)
  const [analysis, setAnalysis] = useState<PipelineResult | null>(null)
  const [validation, setValidation] = useState<ValidationResult | null>(null)
  const [reviewCase, setReviewCase] = useState<ReviewCase | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [running, setRunning] = useState<'analyze' | 'validate' | null>(null)
  const [activeTab, setActiveTab] = useState('overview')

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setLoadError('')

    const results = await Promise.allSettled([
      api.get<Complaint>(`/complaints/${id}`),
      getOptional<PipelineResult>(`/complaints/${id}/analysis`),
      getOptional<ValidationResult>(`/complaints/${id}/validation`),
      api.get<ReviewCase[]>('/review/queue'),
    ])

    const [complaintResult, analysisResult, validationResult, queueResult] = results

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

    if (queueResult.status === 'fulfilled') {
      const match = queueResult.value.data.find(
        (item) => String(item.complaint_id) === String(id),
      )
      setReviewCase(match ?? null)
    } else {
      setReviewCase(null)
    }

    setLoading(false)
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  const runPipeline = async (pipeline: 'analyze' | 'validate') => {
    if (!id) return
    setRunning(pipeline)
    try {
      if (pipeline === 'analyze') {
        await api.post(`/complaints/${id}/analyze`)
        toast({ tone: 'success', title: 'GenAI analysis complete', description: 'Pipeline 1 output is ready.' })
      } else {
        await api.post(`/complaints/${id}/validate`)
        toast({ tone: 'success', title: 'Python validation complete', description: 'Pipeline 2 output is ready.' })
      }
      await load()
    } catch (error) {
      toast({
        tone: 'error',
        title: pipeline === 'analyze' ? 'GenAI analysis failed' : 'Validation failed',
        description: getErrorMessage(
          error,
          pipeline === 'analyze'
            ? 'Check the backend logs / GEMINI_API_KEY.'
            : 'The rule engine could not complete.',
        ),
      })
    } finally {
      setRunning(null)
    }
  }

  if (loading) {
    return (
      <div className="grid gap-4 lg:grid-cols-2">
        <SkeletonCard lines={5} />
        <SkeletonCard lines={5} />
      </div>
    )
  }

  if (loadError && !complaint) {
    return (
      <Alert
        tone="error"
        title="Could not load this complaint"
        actions={
          <>
            <Button size="sm" variant="secondary" onClick={load}>
              Retry
            </Button>
            <Link
              to="/"
              className="inline-flex h-9 items-center rounded-md bg-brand-600 px-3 text-xs font-medium text-white hover:bg-brand-700"
            >
              Back to dashboard
            </Link>
          </>
        }
      >
        {loadError}
      </Alert>
    )
  }

  if (!complaint) {
    return <Alert tone="error" title="Complaint not found">This complaint does not exist or you cannot view it.</Alert>
  }

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'pipeline1', label: 'Pipeline 1 · GenAI' },
    { id: 'pipeline2', label: 'Pipeline 2 · Python' },
    {
      id: 'comparison',
      label: 'Comparison',
      badge: validation ? (
        <Badge tone={verificationTone(validation.verification_status)}>
          {verificationLabel(validation.verification_status)}
        </Badge>
      ) : undefined,
    },
    { id: 'audit', label: 'Audit trail' },
  ]

  return (
    <div className="space-y-6">
      <Link
        to="/"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted transition-colors hover:text-ink"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Back to dashboard
      </Link>

      <PageHeader
        title={complaint.title}
        description={`Complaint #${complaint.id} · submitted ${formatDate(
          complaint.date || complaint.created_at,
        )}`}
        meta={
          <>
            <Badge tone={statusTone(complaint.status)}>{complaint.status}</Badge>
            {complaint.priority && <Badge tone={priorityTone(complaint.priority)}>{complaint.priority}</Badge>}
            {complaint.verification_status && (
              <Badge tone={verificationTone(complaint.verification_status)}>
                {verificationLabel(complaint.verification_status)}
              </Badge>
            )}
            {complaint.escalation_required && <Badge tone="danger">Escalation required</Badge>}
          </>
        }
        actions={
          <Link
            to="/complaints/new"
            className="inline-flex h-11 items-center gap-2 rounded-md border border-border bg-surface px-4 text-sm font-medium text-ink transition-colors hover:bg-canvas"
          >
            <FilePlus2 className="size-4" aria-hidden="true" />
            New complaint
          </Link>
        }
      />

      {loadError && <Alert tone="warn" onDismiss={() => setLoadError('')}>{loadError}</Alert>}

      <Tabs items={tabs} active={activeTab} onChange={setActiveTab} />

      {activeTab === 'overview' && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card padded={false}>
            <CardHeader className="px-4 py-3.5 sm:px-5" title="Complaint details" />
            <div className="p-4 sm:p-5">
              <dl>
                <KeyValue label="ID" value={`#${complaint.id}`} />
                <KeyValue label="Customer type" value={complaint.customer_type || '—'} />
                <KeyValue label="Product / service" value={complaint.product_service || '—'} />
                <KeyValue label="Order reference" value={complaint.order_ref || '—'} />
                <KeyValue label="Channel" value={complaint.channel || '—'} />
                <KeyValue label="Submitted" value={formatDate(complaint.date || complaint.created_at)} />
                <KeyValue label="Department" value={complaint.department || '—'} />
                <KeyValue label="Category" value={complaint.category || '—'} />
                <KeyValue label="Sentiment" value={complaint.sentiment || '—'} />
                <KeyValue label="Escalation" value={complaint.escalation_required ? 'Yes' : 'No'} />
              </dl>
            </div>
          </Card>

          <Card padded={false}>
            <CardHeader className="px-4 py-3.5 sm:px-5" title="Description" />
            <div className="space-y-4 p-4 sm:p-5">
              <p className="whitespace-pre-wrap text-sm text-ink-soft">{complaint.description}</p>
              {complaint.requested_resolution && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                    Requested resolution
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-ink-soft">
                    {complaint.requested_resolution}
                  </p>
                </div>
              )}
            </div>
          </Card>
        </div>
      )}

      {activeTab === 'pipeline1' && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button
              icon={<Sparkles className="size-4" />}
              loading={running === 'analyze'}
              disabled={running !== null}
              onClick={() => runPipeline('analyze')}
            >
              {running === 'analyze'
                ? 'Analysing…'
                : analysis
                  ? 'Re-run GenAI analysis'
                  : 'Run GenAI analysis'}
            </Button>
          </div>
          <PipelinePanel
            title="Pipeline 1 — Gemini"
            subtitle={
              analysis
                ? `${analysis.model ?? 'unknown model'} · prompt ${analysis.prompt_version ?? 'n/a'} · ${formatDate(analysis.analysis_timestamp)}`
                : undefined
            }
            result={analysis}
            emptyText="No GenAI analysis yet. Run the analysis to see Pipeline 1 output."
          />
        </div>
      )}

      {activeTab === 'pipeline2' && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              icon={<RefreshCw className="size-4" />}
              loading={running === 'validate'}
              disabled={running !== null}
              onClick={() => runPipeline('validate')}
            >
              {running === 'validate'
                ? 'Validating…'
                : validation
                  ? 'Re-run Python validation'
                  : 'Run Python validation'}
            </Button>
          </div>
          <PipelinePanel
            title="Pipeline 2 — Python rule engine"
            subtitle={validation ? `${validation.model ?? 'rule-engine'}` : undefined}
            result={validation}
            emptyText="No validation yet. Run the validation to see the independent Pipeline 2 output."
          />
        </div>
      )}

      {activeTab === 'comparison' && (
        <div className="space-y-4">
          {!analysis || !validation ? (
            <EmptyState
              icon={<GitCompare className="size-5" />}
              title="Comparison needs both pipelines"
              description="Run the GenAI analysis and the Python validation first — the comparison is what decides auto-verify versus manual review."
              action={
                <div className="flex flex-wrap justify-center gap-2">
                  <Button size="sm" disabled={running !== null} loading={running === 'analyze'} onClick={() => runPipeline('analyze')}>
                    Run analysis
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={running !== null}
                    loading={running === 'validate'}
                    onClick={() => runPipeline('validate')}
                  >
                    Run validation
                  </Button>
                </div>
              }
            />
          ) : (
            <>
              <Card padded={false}>
                <CardHeader
                  className="px-4 py-3.5 sm:px-5"
                  title="Side-by-side comparison"
                  description="Field-by-field diff between Pipeline 1 and Pipeline 2."
                  actions={
                    <Badge tone={verificationTone(validation.verification_status)}>
                      {verificationLabel(validation.verification_status)}
                    </Badge>
                  }
                />
                <div className="p-4 sm:p-5">
                  <Table>
                    <THead>
                      <Tr>
                        <Th>Field</Th>
                        <Th>Pipeline 1 (Gemini)</Th>
                        <Th>Pipeline 2 (Python)</Th>
                        <Th>Match</Th>
                      </Tr>
                    </THead>
                    <TBody>
                      {COMPARED_FIELDS.map(({ key, label }) => {
                        const genaiValue = analysis[key]
                        const pythonValue = validation[key]
                        const matches = String(genaiValue ?? '') === String(pythonValue ?? '')
                        return (
                          <Tr key={String(key)}>
                            <Td className="font-medium text-ink">{label}</Td>
                            <Td>{String(genaiValue ?? '—')}</Td>
                            <Td>{String(pythonValue ?? '—')}</Td>
                            <Td>
                              <Badge tone={matches ? 'success' : 'danger'}>
                                {matches ? 'Match' : 'Differs'}
                              </Badge>
                            </Td>
                          </Tr>
                        )
                      })}
                    </TBody>
                  </Table>
                </div>
              </Card>

              {validation.mismatch_reasons.length > 0 && (
                <Alert tone="info" title="Comparison notes">
                  <ul className="list-disc space-y-1 pl-5">
                    {validation.mismatch_reasons.map((reason, index) => (
                      <li key={index}>{reason}</li>
                    ))}
                  </ul>
                </Alert>
              )}
            </>
          )}
        </div>
      )}

      {activeTab === 'audit' && (
        <div className="space-y-4">
          {!reviewCase ? (
            <EmptyState
              icon={<History className="size-5" />}
              title="No audit entries yet"
              description="A review case is created automatically when the two pipelines disagree. That case records the original AI output, the rule output and every reviewer decision."
            />
          ) : (
            <Card padded={false}>
              <CardHeader
                className="px-4 py-3.5 sm:px-5"
                title={`Review case #${reviewCase.id}`}
                description={`Created ${formatDate(reviewCase.created_at)}`}
                actions={
                  <Badge tone={reviewCase.reviewer_action ? 'success' : 'warn'}>
                    {reviewCase.reviewer_action ? reviewCase.reviewer_action : 'Awaiting decision'}
                  </Badge>
                }
              />
              <div className="p-4 sm:p-5">
                <dl>
                  <KeyValue label="Complaint" value={`#${reviewCase.complaint_id}`} />
                  <KeyValue label="Reviewer action" value={reviewCase.reviewer_action || '—'} />
                  <KeyValue label="Reviewer notes" value={reviewCase.reviewer_notes || '—'} />
                  <KeyValue label="Resolved" value={formatDate(reviewCase.resolved_at)} />
                </dl>

                <p className="mt-5 text-xs font-semibold uppercase tracking-wide text-muted">
                  Recorded audit log
                </p>
                <pre className="mt-2 max-h-80 overflow-auto rounded-md bg-canvas p-3 text-xs text-ink-soft">
                  {JSON.stringify(
                    reviewCase.audit_log ?? {
                      genai_result: reviewCase.genai_result,
                      python_result: reviewCase.python_result,
                      diff: reviewCase.diff,
                    },
                    null,
                    2,
                  )}
                </pre>
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}

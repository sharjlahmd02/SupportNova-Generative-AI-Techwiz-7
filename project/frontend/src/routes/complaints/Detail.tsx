import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import axios from 'axios'
import {
  ArrowLeft,
  CheckCircle2,
  Download,
  FilePlus2,
  GitCompare,
  History,
  MessageSquare,
  Paperclip,
  RefreshCw,
  RotateCcw,
  Send,
  Sparkles,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { api } from '../../lib/api'
import { getErrorMessage } from '../../lib/errors'
import {
  attachmentList,
  channelLabel,
  complaintReference,
  contactLabel,
  customerTypeLabel,
  formatDate,
  formatBytes,
  priorityTone,
  sanitizeInput,
  slaFor,
  statusTone,
  urgencyTone,
  verificationLabel,
  verificationTone,
} from '../../lib/format'
import type {
  Complaint,
  ComplaintEvent,
  ComplaintMessage,
  PipelineResult,
  ReviewCase,
  StoredAttachment,
  ValidationResult,
} from '../../types'
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
  Textarea,
  Th,
  THead,
  Tabs,
  Tr,
  useToast,
  type TabItem,
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

const MESSAGE_KIND_LABELS: Record<string, string> = {
  clarification: 'Clarification requested',
  reply: 'Customer reply',
  response: 'Official response',
  system: 'System',
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
  const { user } = useAuth()
  const { toast } = useToast()
  const isCustomer = user?.role === 'customer'

  const [complaint, setComplaint] = useState<Complaint | null>(null)
  const [analysis, setAnalysis] = useState<PipelineResult | null>(null)
  const [validation, setValidation] = useState<ValidationResult | null>(null)
  const [reviewCase, setReviewCase] = useState<ReviewCase | null>(null)
  const [messages, setMessages] = useState<ComplaintMessage[]>([])
  const [events, setEvents] = useState<ComplaintEvent[]>([])
  const [replyBody, setReplyBody] = useState('')
  const [sending, setSending] = useState(false)
  const [action, setAction] = useState<'accept' | 'reopen' | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [running, setRunning] = useState<'analyze' | 'validate' | null>(null)
  const [activeTab, setActiveTab] = useState('overview')
  const autoRan = useRef(false)

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setLoadError('')

    const requests: Promise<unknown>[] = [
      api.get<Complaint>(`/complaints/${id}`),
      getOptional<PipelineResult>(`/complaints/${id}/analysis`),
      getOptional<ValidationResult>(`/complaints/${id}/validation`),
      getOptional<ComplaintMessage[]>(`/complaints/${id}/messages`),
      getOptional<ComplaintEvent[]>(`/complaints/${id}/events`),
    ]
    if (!isCustomer) requests.push(getOptional<ReviewCase[]>('/review/queue'))

    const results = await Promise.allSettled(requests)
    const [complaintResult, analysisResult, validationResult, messageResult, eventResult, queueResult] = results

    if (complaintResult.status === 'fulfilled') {
      setComplaint((complaintResult.value as { data: Complaint }).data)
    } else {
      setComplaint(null)
      setLoadError(getErrorMessage(complaintResult.reason, 'Failed to load complaint'))
    }

    if (analysisResult.status === 'fulfilled') setAnalysis(analysisResult.value as PipelineResult | null)
    else
      setLoadError((current) =>
        current || getErrorMessage(analysisResult.reason, 'Failed to load GenAI analysis'),
      )

    if (validationResult.status === 'fulfilled')
      setValidation(validationResult.value as ValidationResult | null)
    else
      setLoadError((current) =>
        current || getErrorMessage(validationResult.reason, 'Failed to load validation result'),
      )

    setMessages(
      messageResult.status === 'fulfilled' ? ((messageResult.value as ComplaintMessage[] | null) ?? []) : [],
    )
    setEvents(eventResult.status === 'fulfilled' ? ((eventResult.value as ComplaintEvent[] | null) ?? []) : [])

    if (queueResult && queueResult.status === 'fulfilled') {
      const queue = (queueResult.value as ReviewCase[] | null) ?? []
      setReviewCase(queue.find((item) => String(item.complaint_id) === String(id)) ?? null)
    } else {
      setReviewCase(null)
    }

    setLoading(false)
  }, [id, isCustomer])

  useEffect(() => {
    load()
  }, [load])

  // Customers never press "run analysis" themselves — the platform processes the
  // ticket as soon as it is opened, so the official response appears on its own.
  useEffect(() => {
    if (autoRan.current || loading || !isCustomer) return
    if (!complaint || complaint.status !== 'New' || analysis) return
    autoRan.current = true
    void (async () => {
      try {
        await api.post(`/complaints/${id}/analyze`)
        await load()
      } catch {
        /* the GenAI key may not be configured — leave the ticket as New */
      }
    })()
  }, [loading, isCustomer, complaint, analysis, id, load])

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

  const sendReply = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!id) return
    const body = sanitizeInput(replyBody, 4000)
    if (!body) return

    setSending(true)
    try {
      await api.post(`/complaints/${id}/messages`, {
        body,
        kind: isCustomer ? 'reply' : 'response',
      })
      setReplyBody('')
      toast({ tone: 'success', title: 'Message sent', description: 'Your reply is now on the ticket.' })
      await load()
    } catch (error) {
      toast({ tone: 'error', title: 'Could not send the message', description: getErrorMessage(error) })
    } finally {
      setSending(false)
    }
  }

  const runAction = async (kind: 'accept' | 'reopen') => {
    if (!id) return
    setAction(kind)
    try {
      const response = await api.post<Complaint>(`/complaints/${id}/${kind === 'accept' ? 'accept' : 'reopen'}`)
      setComplaint(response.data)
      toast({
        tone: 'success',
        title: kind === 'accept' ? 'Resolution accepted' : 'Complaint reopened',
        description:
          kind === 'accept'
            ? 'Thank you — the ticket is now closed.'
            : 'We will pick this up again and keep you posted.',
      })
      await load()
    } catch (error) {
      toast({
        tone: 'error',
        title: kind === 'accept' ? 'Could not accept the resolution' : 'Could not reopen the ticket',
        description: getErrorMessage(error),
      })
    } finally {
      setAction(null)
    }
  }

  const downloadAttachment = async (file: StoredAttachment) => {
    if (!id) return
    try {
      const response = await api.get(`/complaints/${id}/attachments/${encodeURIComponent(file.filename)}`, {
        responseType: 'blob',
      })
      const url = URL.createObjectURL(response.data)
      const link = document.createElement('a')
      link.href = url
      link.download = file.original_name
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
    } catch (error) {
      toast({ tone: 'error', title: 'Download failed', description: getErrorMessage(error) })
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
              className="inline-flex h-9 items-center rounded-lg bg-ink px-3 text-[13px] font-medium text-white hover:bg-ink/85"
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

  const sla = slaFor(complaint)
  const attachments = attachmentList(complaint.attachments)
  const unresolvedQuestions = complaint.clarification_questions ?? []
  const needsClarification =
    complaint.status === 'Awaiting Customer' || unresolvedQuestions.length > 0
  const resolutionSteps = complaint.resolution_steps ?? []
  const officialMessage = complaint.customer_response || complaint.follow_up_message || ''
  const hasOfficialResponse =
    Boolean(officialMessage) || resolutionSteps.length > 0 || Boolean(complaint.follow_up_message)

  const tabs: TabItem[] = [
    { id: 'overview', label: 'Overview' },
    {
      id: 'conversation',
      label: 'Conversation',
      badge: needsClarification ? <Badge tone="warn">Action needed</Badge> : undefined,
    },
    { id: 'history', label: 'History' },
    ...(isCustomer
      ? []
      : [
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
        ]),
  ]
  const visibleTab = tabs.some((tab) => tab.id === activeTab) ? activeTab : 'overview'

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
        description={`${complaintReference(complaint)} · submitted ${formatDate(
          complaint.date || complaint.created_at,
        )}${complaint.department ? ` · ${complaint.department}` : ''}`}
        meta={
          <>
            <Badge tone={statusTone(complaint.status)}>{complaint.status}</Badge>
            <Badge tone={sla.tone} title={sla.due_at.toLocaleString()}>
              {sla.label}
            </Badge>
            {complaint.priority && <Badge tone={priorityTone(complaint.priority)}>{complaint.priority}</Badge>}
            {complaint.verification_status && !isCustomer && (
              <Badge tone={verificationTone(complaint.verification_status)}>
                {verificationLabel(complaint.verification_status)}
              </Badge>
            )}
            {complaint.escalation_required && <Badge tone="danger">Escalation required</Badge>}
            {complaint.resolution_accepted_at && (
              <Badge tone="success">Accepted {formatDate(complaint.resolution_accepted_at)}</Badge>
            )}
            {complaint.duplicate_of && (
              <Badge tone="neutral">Linked to #{complaint.duplicate_of}</Badge>
            )}
          </>
        }
        actions={
          <>
            {complaint.status === 'Resolved' && (
              <Button
                icon={<CheckCircle2 className="size-4" />}
                loading={action === 'accept'}
                disabled={action !== null}
                onClick={() => runAction('accept')}
              >
                Accept &amp; confirm resolution
              </Button>
            )}
            {complaint.status === 'Closed' && (
              <Button
                variant="secondary"
                icon={<RotateCcw className="size-4" />}
                loading={action === 'reopen'}
                disabled={action !== null}
                onClick={() => runAction('reopen')}
              >
                Reopen complaint
              </Button>
            )}
            <Link
              to="/complaints/new"
              className="inline-flex h-11 items-center gap-2 rounded-lg border border-border bg-surface px-4 text-sm font-medium text-ink transition-colors hover:border-border-strong hover:bg-brand-50"
            >
              <FilePlus2 className="size-4" aria-hidden="true" />
              New complaint
            </Link>
          </>
        }
      />

      {loadError && <Alert tone="warn" onDismiss={() => setLoadError('')}>{loadError}</Alert>}

      <Tabs items={tabs} active={visibleTab} onChange={setActiveTab} />

      {visibleTab === 'overview' && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card padded={false}>
            <CardHeader className="px-4 py-3.5 sm:px-5" title="Complaint details" />
            <div className="p-4 sm:p-5">
              <dl>
                <KeyValue label="Reference" value={complaintReference(complaint)} />
                <KeyValue label="Customer type" value={customerTypeLabel(complaint.customer_type)} />
                <KeyValue label="Product / service" value={complaint.product_service || '—'} />
                <KeyValue label="Order reference" value={complaint.order_ref || '—'} />
                <KeyValue label="Submission channel" value={channelLabel(complaint.channel)} />
                <KeyValue label="Preferred contact" value={contactLabel(complaint.preferred_contact)} />
                <KeyValue
                  label="Prior complaint"
                  value={complaint.prior_complaint_ref || '—'}
                />
                <KeyValue label="Submitted" value={formatDate(complaint.date || complaint.created_at)} />
                <KeyValue label="Last update" value={formatDate(complaint.updated_at)} />
                <KeyValue label="Department" value={complaint.department || '—'} />
                <KeyValue label="Category" value={complaint.category || '—'} />
                <KeyValue label="Sentiment" value={complaint.sentiment || '—'} />
                <KeyValue
                  label="Resolution accepted"
                  value={complaint.resolution_accepted_at ? formatDate(complaint.resolution_accepted_at) : '—'}
                />
              </dl>
            </div>
          </Card>

          <div className="space-y-4">
            <Card padded={false}>
              <CardHeader
                className="px-4 py-3.5 sm:px-5"
                title="Description"
                description="Exactly what you submitted — inputs are sanitised and whitespace is normalised."
              />
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

            <Card padded={false}>
              <CardHeader
                className="px-4 py-3.5 sm:px-5"
                title="Supporting documents"
                description={`${attachments.length} file${attachments.length === 1 ? '' : 's'} attached.`}
              />
              <div className="p-4 sm:p-5">
                {attachments.length === 0 ? (
                  <p className="text-sm text-muted">No attachments on this complaint.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {attachments.map((file) => (
                      <li
                        key={file.filename}
                        className="flex items-center gap-3 rounded-lg border border-border bg-canvas px-3 py-2"
                      >
                        <Paperclip className="size-4 shrink-0 text-muted" aria-hidden="true" />
                        <span className="min-w-0 flex-1 truncate text-sm text-ink">
                          {file.original_name}
                        </span>
                        <span className="shrink-0 text-xs text-muted">
                          {file.size ? formatBytes(file.size) : ''}
                        </span>
                        <Button
                          size="sm"
                          variant="ghost"
                          icon={<Download className="size-4" />}
                          onClick={() => downloadAttachment(file)}
                        >
                          Download
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </Card>
          </div>
        </div>
      )}

      {visibleTab === 'conversation' && (
        <div className="space-y-4">
          {needsClarification && unresolvedQuestions.length > 0 && (
            <Alert tone="warn" title="More information needed to proceed">
              <p>To keep this complaint moving, please answer the following:</p>
              <ul className="mt-1.5 list-disc space-y-1 pl-5">
                {unresolvedQuestions.map((question, index) => (
                  <li key={index}>{question}</li>
                ))}
              </ul>
            </Alert>
          )}

          {hasOfficialResponse ? (
            <Card padded={false}>
              <CardHeader
                className="px-4 py-3.5 sm:px-5"
                title="Official response"
                description="Professional, policy-compliant resolution from SupportNova."
                actions={
                  <Badge tone={statusTone(complaint.status)}>{complaint.status}</Badge>
                }
              />
              <div className="space-y-5 p-4 sm:p-5">
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink-soft">
                  {officialMessage}
                </p>

                {resolutionSteps.length > 0 && (
                  <section>
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">
                      Actionable next steps
                    </h3>
                    <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm text-ink-soft">
                      {resolutionSteps.map((step, index) => (
                        <li key={index}>{step}</li>
                      ))}
                    </ol>
                  </section>
                )}

                {complaint.follow_up_message && complaint.customer_response && (
                  <Alert tone="info" title="Follow-up">
                    {complaint.follow_up_message}
                  </Alert>
                )}

                <div className="flex flex-wrap gap-3 border-t border-border pt-4">
                  {complaint.status === 'Resolved' && (
                    <Button
                      icon={<CheckCircle2 className="size-4" />}
                      loading={action === 'accept'}
                      disabled={action !== null}
                      onClick={() => runAction('accept')}
                    >
                      Accept &amp; confirm resolution
                    </Button>
                  )}
                  {(complaint.status === 'Closed' || complaint.status === 'Resolved') && (
                    <Button
                      variant="secondary"
                      icon={<RotateCcw className="size-4" />}
                      loading={action === 'reopen'}
                      disabled={action !== null}
                      onClick={() => runAction('reopen')}
                    >
                      Reopen complaint
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ) : (
            <EmptyState
              icon={<MessageSquare className="size-5" />}
              title="No official response yet"
              description="Your complaint is being analysed. As soon as a resolution is approved you will see the response, the next steps and any follow-up here."
            />
          )}

          <Card padded={false}>
            <CardHeader
              className="px-4 py-3.5 sm:px-5"
              title="Message thread"
              description="Every clarification, reply and response on this ticket, oldest first."
            />
            <div className="space-y-4 p-4 sm:p-5">
              {messages.length === 0 ? (
                <p className="text-sm text-muted">No messages yet.</p>
              ) : (
                <ol className="space-y-3">
                  {messages.map((message) => (
                    <li key={message.id} className="rounded-lg border border-border bg-canvas p-3.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-ink">{message.author_name}</span>
                        <Badge tone={message.kind === 'clarification' ? 'warn' : message.kind === 'response' ? 'brand' : 'neutral'}>
                          {MESSAGE_KIND_LABELS[message.kind] ?? message.kind}
                        </Badge>
                        <span className="ml-auto text-xs text-muted">
                          {formatDate(message.created_at)}
                        </span>
                      </div>
                      <p className="mt-2 whitespace-pre-wrap text-sm text-ink-soft">{message.body}</p>
                    </li>
                  ))}
                </ol>
              )}

              <form onSubmit={sendReply} className="space-y-3 border-t border-border pt-4">
                <Textarea
                  label={isCustomer ? 'Your reply' : 'Send an official response'}
                  rows={4}
                  placeholder={
                    isCustomer
                      ? 'Answer the clarification or add anything that helps us resolve this…'
                      : 'Write the response the customer should see…'
                  }
                  hint="Inputs are sanitised and whitespace is normalised before they are stored."
                  value={replyBody}
                  onChange={(event) => setReplyBody(event.target.value)}
                />
                <Button
                  type="submit"
                  loading={sending}
                  disabled={!replyBody.trim()}
                  icon={<Send className="size-4" />}
                >
                  {isCustomer ? 'Send reply' : 'Send response'}
                </Button>
              </form>
            </div>
          </Card>
        </div>
      )}

      {visibleTab === 'history' && (
        <Card padded={false}>
          <CardHeader
            className="px-4 py-3.5 sm:px-5"
            title="Complaint history"
            description="Every lifecycle change recorded against this ticket, newest first."
          />
          <div className="p-4 sm:p-5">
            {events.length === 0 ? (
              <EmptyState
                icon={<History className="size-5" />}
                title="No history recorded yet"
                description="Lifecycle events appear here as soon as the ticket moves."
                compact
              />
            ) : (
              <ol className="relative space-y-5 border-l border-border pl-5">
                {[...events].reverse().map((event) => (
                  <li key={event.id} className="relative">
                    <span
                      aria-hidden="true"
                      className="absolute -left-[27px] top-1.5 size-3 rounded-full bg-ink ring-4 ring-surface"
                    />
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-ink">{event.label}</span>
                      <Badge tone="neutral">{event.event_type}</Badge>
                      <span className="ml-auto text-xs text-muted">{formatDate(event.created_at)}</span>
                    </div>
                    {event.actor && <p className="mt-0.5 text-xs text-muted">by {event.actor}</p>}
                    {event.detail && (
                      <pre className="mt-1.5 max-h-40 overflow-auto rounded-md bg-canvas p-2.5 text-xs text-ink-soft">
                        {JSON.stringify(event.detail, null, 2)}
                      </pre>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </div>
        </Card>
      )}

      {visibleTab === 'pipeline1' && (
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

      {visibleTab === 'pipeline2' && (
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

      {visibleTab === 'comparison' && (
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

      {visibleTab === 'audit' && (
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

import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2, GitCompare, Inbox, RefreshCw, ShieldAlert } from 'lucide-react'
import { api } from '../../lib/api'
import { getErrorMessage } from '../../lib/errors'
import { formatDate } from '../../lib/format'
import type { ReviewCase } from '../../types'
import {
  Alert,
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  PageHeader,
  SkeletonCard,
  Table,
  TBody,
  Td,
  Th,
  THead,
  Tr,
  useToast,
} from '../../components/ui'

interface ReviewAction {
  action: string
  label: string
  variant: 'primary' | 'secondary' | 'danger'
  confirm?: { title: string; description: string }
}

const ACTIONS: ReviewAction[] = [
  { action: 'approve', label: 'Approve', variant: 'primary' },
  { action: 'modify', label: 'Modify', variant: 'secondary' },
  { action: 'reassign', label: 'Reassign', variant: 'secondary' },
  {
    action: 'escalate',
    label: 'Escalate',
    variant: 'danger',
    confirm: {
      title: 'Escalate this complaint?',
      description:
        'The complaint is routed to a specialist team and the escalation is written to the audit trail.',
    },
  },
  {
    action: 'regenerate',
    label: 'Regenerate',
    variant: 'secondary',
    confirm: {
      title: 'Regenerate the GenAI analysis?',
      description:
        'Pipeline 1 runs again on this complaint. The original output stays in the audit trail.',
    },
  },
]

function DiffTable({ diff }: { diff: Record<string, unknown> }) {
  const entries = Object.entries(diff)
  if (entries.length === 0) {
    return <p className="py-2 text-sm text-muted">No differing fields — both pipelines agree.</p>
  }

  return (
    <Table>
      <THead>
        <Tr>
          <Th>Field</Th>
          <Th>GenAI (Pipeline 1)</Th>
          <Th>Python (Pipeline 2)</Th>
        </Tr>
      </THead>
      <TBody>
        {entries.map(([field, value]) => {
          const pair = value as { genai?: unknown; python?: unknown }
          return (
            <Tr key={field}>
              <Td className="font-medium text-ink">{field}</Td>
              <Td>{String(pair.genai ?? '—')}</Td>
              <Td>{String(pair.python ?? '—')}</Td>
            </Tr>
          )
        })}
      </TBody>
    </Table>
  )
}

export function ReviewerQueue() {
  const { toast } = useToast()
  const [cases, setCases] = useState<ReviewCase[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState<number | null>(null)
  const [pending, setPending] = useState<{ caseId: number; action: ReviewAction } | null>(null)

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

  const execute = async (caseId: number, action: string) => {
    setBusyId(caseId)
    try {
      await api.post(`/review/${caseId}/action`, { action })
      toast({ tone: 'success', title: `Case #${caseId} — ${action} recorded`, description: 'The audit trail has been updated.' })
      await load()
    } catch (err) {
      toast({
        tone: 'error',
        title: `Could not ${action} case #${caseId}`,
        description: getErrorMessage(err),
      })
    } finally {
      setBusyId(null)
      setPending(null)
    }
  }

  const requestAction = (caseId: number, action: ReviewAction) => {
    if (action.confirm) {
      setPending({ caseId, action })
      return
    }
    void execute(caseId, action.action)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Manual review queue"
        description="Complaints where the two pipelines disagreed — decide, and keep the audit trail intact."
        actions={
          <Button variant="secondary" icon={<RefreshCw className="size-4" />} onClick={load} loading={loading}>
            Refresh
          </Button>
        }
      />

      {error && (
        <Alert
          tone="error"
          title="Could not load the queue"
          onDismiss={() => setError('')}
          actions={
            <Button size="sm" variant="secondary" onClick={load}>
              Retry
            </Button>
          }
        >
          {error}
        </Alert>
      )}

      {loading ? (
        <div className="space-y-4">
          <SkeletonCard lines={3} />
          <SkeletonCard lines={3} />
        </div>
      ) : cases.length === 0 ? (
        <Card>
          <EmptyState
            icon={<CheckCircle2 className="size-5" />}
            title="Nothing waiting for review"
            description="Run analyze then validate on a complaint — any mismatch between Pipeline 1 and Pipeline 2 lands here automatically."
            action={
              <Link
                to="/complaints/new"
                className="inline-flex h-9 items-center rounded-md bg-brand-600 px-3 text-xs font-medium text-white hover:bg-brand-700"
              >
                Submit a test complaint
              </Link>
            }
          />
        </Card>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm text-muted">
            <Inbox className="size-4" aria-hidden="true" />
            {cases.length} case{cases.length === 1 ? '' : 's'} awaiting a decision
          </div>

          {cases.map((reviewCase) => (
            <Card key={reviewCase.id}>
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-base font-semibold text-ink">
                      Case #{reviewCase.id} · Complaint #{reviewCase.complaint_id}
                    </h2>
                    <Badge tone={reviewCase.reviewer_action ? 'success' : 'warn'}>
                      {reviewCase.reviewer_action ? 'Handled' : 'Awaiting decision'}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted">
                    Created {formatDate(reviewCase.created_at)}
                    {reviewCase.reviewer_action && ` · ${reviewCase.reviewer_action}`}
                    {reviewCase.resolved_at && ` · closed ${formatDate(reviewCase.resolved_at)}`}
                  </p>
                </div>
                <Link
                  to={`/complaints/${reviewCase.complaint_id}`}
                  className="text-sm font-medium text-brand-600 hover:text-brand-700 hover:underline"
                >
                  Open complaint
                </Link>
              </div>

              <div className="mt-4">
                <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
                  <GitCompare className="size-3.5" aria-hidden="true" />
                  Field differences
                </p>
                <DiffTable diff={reviewCase.diff} />
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {ACTIONS.map((action) => (
                  <Button
                    key={action.action}
                    variant={action.variant}
                    size="sm"
                    loading={busyId === reviewCase.id}
                    disabled={busyId !== null}
                    onClick={() => requestAction(reviewCase.id, action)}
                  >
                    {action.label}
                  </Button>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={pending !== null}
        onClose={() => setPending(null)}
        onConfirm={() => pending && void execute(pending.caseId, pending.action.action)}
        title={pending?.action.confirm?.title ?? ''}
        description={pending?.action.confirm?.description}
        confirmLabel={pending?.action.label}
        confirmVariant={pending?.action.variant === 'danger' ? 'danger' : 'primary'}
        busy={busyId !== null}
      >
        <p className="flex items-start gap-2">
          <ShieldAlert className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden="true" />
          <span>
            Reviewing case <strong>#{pending?.caseId}</strong>. Both the original AI output and your
            decision are retained.
          </span>
        </p>
      </ConfirmDialog>
    </div>
  )
}

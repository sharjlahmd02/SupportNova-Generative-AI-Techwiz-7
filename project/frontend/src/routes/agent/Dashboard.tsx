import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, Briefcase, RefreshCw, Search } from 'lucide-react'
import { api } from '../../lib/api'
import { getErrorMessage } from '../../lib/errors'
import {
  priorityTone,
  sentimentTone,
  statusTone,
  verificationLabel,
  verificationTone,
} from '../../lib/format'
import type { Complaint } from '../../types'
import {
  Alert,
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  Input,
  PageHeader,
  Select,
  SkeletonTable,
  StatCard,
  Table,
  TBody,
  Td,
  Th,
  THead,
  Tr,
} from '../../components/ui'

const STATUSES = ['', 'New', 'Analyzed', 'Assigned', 'In Progress', 'Awaiting Customer', 'Escalated', 'Resolved', 'Closed', 'Reopened']
const PRIORITIES = ['', 'P0', 'P1', 'P2', 'P3']

export function AgentDashboard() {
  const [complaints, setComplaints] = useState<Complaint[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('')

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

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return complaints.filter((complaint) => {
      if (statusFilter && complaint.status !== statusFilter) return false
      if (priorityFilter && complaint.priority !== priorityFilter) return false
      if (!needle) return true
      return (
        String(complaint.id).includes(needle) ||
        complaint.title.toLowerCase().includes(needle) ||
        (complaint.category ?? '').toLowerCase().includes(needle) ||
        (complaint.department ?? '').toLowerCase().includes(needle)
      )
    })
  }, [complaints, query, statusFilter, priorityFilter])

  const open = complaints.filter(
    (complaint) => complaint.status !== 'Resolved' && complaint.status !== 'Closed',
  )
  const escalated = complaints.filter((complaint) => complaint.status === 'Escalated')
  const needsReview = complaints.filter(
    (complaint) =>
      complaint.verification_status === 'manual_review' ||
      complaint.verification_status === 'mismatch',
  )

  const filtersActive = Boolean(query || statusFilter || priorityFilter)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Agent workspace"
        description="Assigned complaints, routing, sentiment and validation status."
        actions={
          <Button variant="secondary" icon={<RefreshCw className="size-4" />} onClick={load} loading={loading}>
            Refresh
          </Button>
        }
      />

      {error && (
        <Alert
          tone="error"
          title="Could not load complaints"
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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Open complaints"
          value={loading ? '' : open.length}
          loading={loading}
          icon={<Briefcase className="size-4" />}
          hint="Awaiting resolution"
        />
        <StatCard
          label="Escalated"
          value={loading ? '' : escalated.length}
          loading={loading}
          icon={<AlertTriangle className="size-4" />}
          tone="danger"
          hint="Rule engine forced an escalation"
        />
        <StatCard
          label="Needs review"
          value={loading ? '' : needsReview.length}
          loading={loading}
          icon={<Search className="size-4" />}
          tone="warn"
          hint="Pipelines disagree or unvalidated"
        />
        <StatCard
          label="Showing"
          value={loading ? '' : `${filtered.length}/${complaints.length}`}
          loading={loading}
          tone="neutral"
          hint="Matches the active filters"
        />
      </div>

      <Card padded={false}>
        <CardHeader
          className="px-4 py-3.5 sm:px-5"
          title="Complaint inbox"
          description="Every complaint routed to your team, newest first."
        />

        <div className="grid gap-3 border-b border-border p-4 sm:grid-cols-2 sm:p-5 lg:grid-cols-4">
          <Input
            label="Search"
            fieldClassName="lg:col-span-2"
            placeholder="ID, title, category or department…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <Select
            label="Status"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            {STATUSES.map((status) => (
              <option key={status} value={status}>
                {status || 'All statuses'}
              </option>
            ))}
          </Select>
          <Select
            label="Priority"
            value={priorityFilter}
            onChange={(event) => setPriorityFilter(event.target.value)}
          >
            {PRIORITIES.map((priority) => (
              <option key={priority} value={priority}>
                {priority || 'All priorities'}
              </option>
            ))}
          </Select>
        </div>

        <div className="p-4 sm:p-5">
          {loading ? (
            <SkeletonTable rows={6} cols={8} />
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={<Briefcase className="size-5" />}
              title={filtersActive ? 'No complaints match those filters' : 'No complaints assigned right now'}
              description={
                filtersActive
                  ? 'Try clearing the search or picking a different status.'
                  : 'New complaints routed to your department will appear here.'
              }
              action={
                filtersActive ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setQuery('')
                      setStatusFilter('')
                      setPriorityFilter('')
                    }}
                  >
                    Clear filters
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <Table>
              <THead>
                <Tr>
                  <Th>ID</Th>
                  <Th>Title</Th>
                  <Th>Category</Th>
                  <Th>Department</Th>
                  <Th>Priority</Th>
                  <Th>Sentiment</Th>
                  <Th>Status</Th>
                  <Th>Validation</Th>
                  <Th className="text-right">Action</Th>
                </Tr>
              </THead>
              <TBody>
                {filtered.map((complaint) => (
                  <Tr key={complaint.id}>
                    <Td className="font-medium tabular-nums text-ink">#{complaint.id}</Td>
                    <Td className="max-w-60">
                      <span className="line-clamp-1">{complaint.title}</span>
                    </Td>
                    <Td>{complaint.category || '—'}</Td>
                    <Td>{complaint.department || '—'}</Td>
                    <Td>
                      {complaint.priority ? (
                        <Badge tone={priorityTone(complaint.priority)}>{complaint.priority}</Badge>
                      ) : (
                        '—'
                      )}
                    </Td>
                    <Td>
                      {complaint.sentiment ? (
                        <Badge tone={sentimentTone(complaint.sentiment)}>{complaint.sentiment}</Badge>
                      ) : (
                        '—'
                      )}
                    </Td>
                    <Td>
                      <span className="flex flex-wrap items-center gap-1">
                        <Badge tone={statusTone(complaint.status)}>{complaint.status}</Badge>
                        {complaint.escalation_required && (
                          <Badge tone="danger" title="Escalation warning">
                            <AlertTriangle className="size-3" aria-hidden="true" />
                            Escalate
                          </Badge>
                        )}
                      </span>
                    </Td>
                    <Td>
                      <Badge tone={verificationTone(complaint.verification_status)}>
                        {verificationLabel(complaint.verification_status)}
                      </Badge>
                    </Td>
                    <Td className="text-right">
                      <Link
                        to={`/complaints/${complaint.id}`}
                        className="font-medium text-brand-600 hover:text-brand-700 hover:underline"
                      >
                        Open
                      </Link>
                    </Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          )}
        </div>
      </Card>

      <p className="text-xs text-muted">
        GenAI recommendation and suggested response are shown per complaint on its detail page.
      </p>
    </div>
  )
}

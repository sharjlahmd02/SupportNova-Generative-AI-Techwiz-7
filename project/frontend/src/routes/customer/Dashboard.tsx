import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, FilePlus2, Inbox, Search, TrendingUp, X } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { api } from '../../lib/api'
import { getErrorMessage } from '../../lib/errors'
import {
  complaintReference,
  formatDate,
  resolutionLabel,
  resolutionTone,
  slaFor,
  statusTone,
} from '../../lib/format'
import type { Complaint, DashboardStats } from '../../types'
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

/** SRS 5.2 - the nine lifecycle states a customer can filter on. */
const LIFECYCLE_STATUSES = [
  'New',
  'Analyzed',
  'Assigned',
  'In Progress',
  'Awaiting Customer',
  'Escalated',
  'Resolved',
  'Closed',
  'Reopened',
]

const OPEN_STATUSES = new Set([
  'New',
  'Analyzed',
  'Assigned',
  'In Progress',
  'Awaiting Customer',
  'Escalated',
  'Reopened',
])

export function CustomerDashboard() {
  const { user } = useAuth()
  const [complaints, setComplaints] = useState<Complaint[]>([])
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [statsLoading, setStatsLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const loadStats = useCallback(async () => {
    setStatsLoading(true)
    try {
      const response = await api.get<DashboardStats>('/dashboard/stats')
      setStats(response.data)
    } catch (err) {
      setStats(null)
      setError(getErrorMessage(err, 'Failed to load your summary'))
    }
    setStatsLoading(false)
  }, [])

  const loadComplaints = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await api.get<Complaint[]>('/complaints', {
        params: { q: query || undefined, status: statusFilter || undefined },
      })
      setComplaints(response.data)
    } catch (err) {
      setComplaints([])
      setError(getErrorMessage(err, 'Failed to load your complaints'))
    }
    setLoading(false)
  }, [query, statusFilter])

  useEffect(() => {
    void loadStats()
  }, [loadStats])

  useEffect(() => {
    const handle = window.setTimeout(() => setQuery(searchInput.trim()), 300)
    return () => window.clearTimeout(handle)
  }, [searchInput])

  useEffect(() => {
    void loadComplaints()
  }, [loadComplaints])

  const openCount = complaints.filter((complaint) => OPEN_STATUSES.has(complaint.status)).length
  const escalatedCount = complaints.filter((complaint) => complaint.status === 'Escalated').length
  const awaitingCount = complaints.filter(
    (complaint) => complaint.status === 'Awaiting Customer',
  ).length
  const filtered = Boolean(query || statusFilter)

  return (
    <div className="space-y-6">
      <PageHeader
        title="My complaints"
        description={`Welcome back, ${user?.username}. Track every request you've raised.`}
        actions={
          <Link
            to="/complaints/new"
            className="inline-flex h-11 items-center gap-2 rounded-lg bg-ink px-4 text-sm font-medium text-white transition-colors hover:bg-ink/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/30 focus-visible:ring-offset-2"
          >
            <FilePlus2 className="size-4" aria-hidden="true" />
            New complaint
          </Link>
        }
      />

      {error && (
        <Alert
          tone="error"
          title="Could not load your data"
          onDismiss={() => setError('')}
          actions={
            <Button size="sm" variant="secondary" onClick={() => { void loadStats(); void loadComplaints() }}>
              Retry
            </Button>
          }
        >
          {error}
        </Alert>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total complaints"
          value={stats ? stats.total_complaints : complaints.length}
          loading={statsLoading && loading}
          icon={<Inbox className="size-4" />}
          hint="All complaints you've submitted"
        />
        <StatCard
          label="Open"
          value={openCount}
          loading={loading && !stats}
          icon={<TrendingUp className="size-4" />}
          tone="warn"
          hint="Not yet resolved or closed"
        />
        <StatCard
          label="Awaiting your reply"
          value={awaitingCount}
          loading={loading && !stats}
          icon={<Search className="size-4" />}
          tone={awaitingCount > 0 ? 'warn' : 'neutral'}
          hint="More information is needed to proceed"
        />
        <StatCard
          label="Escalated"
          value={escalatedCount}
          loading={loading && !stats}
          icon={<AlertTriangle className="size-4" />}
          tone={escalatedCount > 0 ? 'danger' : 'neutral'}
          hint="Routed to a specialist team"
        />
      </div>

      <Card padded={false}>
        <CardHeader
          className="px-4 py-3.5 sm:px-5"
          title="Your complaints"
          description="Reference, department, lifecycle status, response window and last update."
          actions={
            <Link
              to="/complaints/new"
              className="inline-flex h-9 items-center rounded-lg border border-border bg-surface px-3 text-[13px] font-medium text-ink transition-colors hover:border-border-strong hover:bg-brand-50"
            >
              Submit new
            </Link>
          }
        />

        <div className="flex flex-col gap-3 border-b border-border px-4 py-3 sm:flex-row sm:items-end sm:px-5">
          <Input
            label="Search"
            type="search"
            placeholder="Reference, title, description, order ID…"
            fieldClassName="flex-1"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            className="h-10"
          />
          <Select
            label="Status"
            fieldClassName="sm:w-56"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="h-10"
          >
            <option value="">All lifecycle statuses</option>
            {LIFECYCLE_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </Select>
          {filtered && (
            <Button
              variant="ghost"
              size="sm"
              className="mb-0.5"
              icon={<X className="size-4" />}
              onClick={() => {
                setSearchInput('')
                setStatusFilter('')
              }}
            >
              Clear
            </Button>
          )}
        </div>

        <div className="p-4 sm:p-5">
          {loading ? (
            <SkeletonTable rows={5} cols={7} />
          ) : complaints.length === 0 ? (
            <EmptyState
              icon={<FilePlus2 className="size-5" />}
              title={filtered ? 'No complaints match those filters' : 'No complaints yet'}
              description={
                filtered
                  ? 'Try a different reference or clear the status filter to see everything.'
                  : "Submit your first complaint and watch GenAI analyse it while the Python rule engine verifies the result."
              }
              action={
                filtered ? (
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setSearchInput('')
                      setStatusFilter('')
                    }}
                  >
                    Clear filters
                  </Button>
                ) : (
                  <Link
                    to="/complaints/new"
                    className="inline-flex h-9 items-center rounded-lg bg-ink px-3 text-[13px] font-medium text-white hover:bg-ink/85"
                  >
                    Submit your first complaint
                  </Link>
                )
              }
            />
          ) : (
            <Table>
              <THead>
                <Tr>
                  <Th>Reference</Th>
                  <Th>Complaint</Th>
                  <Th>Department</Th>
                  <Th>Status</Th>
                  <Th>Resolution</Th>
                  <Th>SLA</Th>
                  <Th className="text-right">Action</Th>
                </Tr>
              </THead>
              <TBody>
                {complaints.map((complaint) => {
                  const sla = slaFor(complaint)
                  return (
                    <Tr key={complaint.id}>
                      <Td className="whitespace-nowrap font-medium tabular-nums text-ink">
                        {complaintReference(complaint)}
                      </Td>
                      <Td className="max-w-64">
                        <span className="line-clamp-1 text-ink">{complaint.title}</span>
                        <span className="mt-0.5 block text-xs text-muted">
                          Submitted {formatDate(complaint.date || complaint.created_at)}
                          {complaint.duplicate_of
                            ? ` · linked to #${complaint.duplicate_of}`
                            : ''}
                        </span>
                      </Td>
                      <Td>{complaint.department || '—'}</Td>
                      <Td>
                        <Badge tone={statusTone(complaint.status)}>{complaint.status}</Badge>
                      </Td>
                      <Td>
                        <Badge tone={resolutionTone(complaint.status)}>
                          {resolutionLabel(complaint.status)}
                        </Badge>
                      </Td>
                      <Td>
                        <Badge tone={sla.tone} title={sla.due_at.toLocaleString()}>
                          {sla.label}
                        </Badge>
                      </Td>
                      <Td className="text-right">
                        <Link
                          to={`/complaints/${complaint.id}`}
                          className="font-medium text-ink underline-offset-4 hover:underline"
                        >
                          View
                        </Link>
                      </Td>
                    </Tr>
                  )
                })}
              </TBody>
            </Table>
          )}
        </div>
      </Card>

      <p className="text-xs text-muted">
        Each account only sees the complaints it submitted — sign in as another demo user to compare.
      </p>
    </div>
  )
}

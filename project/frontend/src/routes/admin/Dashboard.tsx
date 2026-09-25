import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  BarChart3,
  GitCompare,
  Inbox,
  RefreshCw,
  ShieldAlert,
} from 'lucide-react'
import { api } from '../../lib/api'
import { getErrorMessage } from '../../lib/errors'
import { formatDate, statusTone } from '../../lib/format'
import type { Complaint, DashboardStats } from '../../types'
import {
  Alert,
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  PageHeader,
  SkeletonTable,
  StatCard,
  Table,
  TBody,
  Td,
  Th,
  THead,
  Tr,
} from '../../components/ui'

function Breakdown({ title, values }: { title: string; values: Record<string, number> }) {
  const entries = Object.entries(values).sort((a, b) => b[1] - a[1])
  const max = entries.reduce((peak, [, count]) => Math.max(peak, count), 0)

  return (
    <Card padded={false}>
      <CardHeader className="px-4 py-3.5 sm:px-5" title={title} />
      <div className="p-4 sm:p-5">
        {entries.length === 0 ? (
          <p className="py-3 text-center text-xs text-muted">No data yet</p>
        ) : (
          <ul className="space-y-3">
            {entries.map(([label, count]) => (
              <li key={label}>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="truncate text-sm text-ink-soft">{label}</span>
                  <span className="text-sm font-semibold tabular-nums text-ink">{count}</span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-canvas">
                  <div
                    className="h-full rounded-full bg-ink transition-all"
                    style={{ width: `${max > 0 ? Math.round((count / max) * 100) : 0}%` }}
                    aria-hidden="true"
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  )
}

export function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [recent, setRecent] = useState<Complaint[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    const [statsResult, recentResult] = await Promise.allSettled([
      api.get<DashboardStats>('/dashboard/stats'),
      api.get<Complaint[]>('/complaints', { params: { limit: 5 } }),
    ])

    if (statsResult.status === 'fulfilled') {
      setStats(statsResult.value.data)
    } else {
      setStats(null)
      setError(getErrorMessage(statsResult.reason, 'Failed to load dashboard statistics'))
    }

    if (recentResult.status === 'fulfilled') {
      setRecent(recentResult.value.data)
    } else {
      setRecent([])
      setError((current) =>
        current || getErrorMessage(recentResult.reason, 'Failed to load recent complaints'),
      )
    }

    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const resolved =
    stats?.by_status.Resolved ?? 0
  const inProgress = (stats?.by_status.Closed ?? 0) + resolved

  return (
    <div className="space-y-6">
      <PageHeader
        title="Admin console"
        description="System-wide volumes, escalations, pipeline agreement and resolution status."
        actions={
          <>
            <Link
              to="/reviewer/queue"
              className="inline-flex h-11 items-center rounded-lg border border-border bg-surface px-4 text-sm font-medium text-ink transition-colors hover:border-border-strong hover:bg-brand-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/30"
            >
              Review queue
            </Link>
            <Button variant="secondary" icon={<RefreshCw className="size-4" />} onClick={load} loading={loading}>
              Refresh
            </Button>
          </>
        }
      />

      {error && (
        <Alert
          tone="error"
          title="Could not load the dashboard"
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

      {/* SRS Step 63 field set */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard
          label="Total complaints"
          value={stats ? stats.total_complaints : ''}
          loading={loading && !stats}
          icon={<Inbox className="size-4" />}
        />
        <StatCard
          label="Escalations"
          value={stats ? stats.escalation_count : ''}
          loading={loading && !stats}
          icon={<AlertTriangle className="size-4" />}
          tone="danger"
        />
        <StatCard
          label="GenAI / Python mismatches"
          value={stats ? stats.mismatch_count : ''}
          loading={loading && !stats}
          icon={<GitCompare className="size-4" />}
          tone="warn"
        />
        <StatCard
          label="Manual-review cases"
          value={stats ? stats.manual_review_count : ''}
          loading={loading && !stats}
          icon={<ShieldAlert className="size-4" />}
          tone="warn"
        />
        <StatCard
          label="SLA risks"
          value="—"
          loading={false}
          icon={<BarChart3 className="size-4" />}
          tone="neutral"
          hint="SLA tracking not implemented yet"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard
          label="Resolution status"
          value={loading && !stats ? '' : `${inProgress} closed`}
          loading={loading && !stats}
          tone="success"
          hint={
            stats
              ? `${resolved} resolved · ${stats.by_status.Closed ?? 0} closed · ${
                  stats.by_status.Reopened ?? 0
                } reopened`
              : '—'
          }
        />
        <StatCard
          label="Average resolution time"
          value={
            stats?.avg_resolution_time_hours != null
              ? `${stats.avg_resolution_time_hours.toFixed(1)} h`
              : '—'
          }
          loading={loading && !stats}
          tone="brand"
          hint="Across resolved complaints"
        />
        <StatCard
          label="Open vs closed"
          value={
            stats
              ? `${Math.max(
                  stats.total_complaints - inProgress,
                  0,
                )} / ${inProgress}`
              : ''
          }
          loading={loading && !stats}
          tone="neutral"
          hint="Still open / closed"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Breakdown title="By status" values={stats?.by_status ?? {}} />
        <Breakdown title="By category" values={stats?.by_category ?? {}} />
        <Breakdown title="By department" values={stats?.by_department ?? {}} />
        <Breakdown title="By priority" values={stats?.by_priority ?? {}} />
        <Breakdown title="By sentiment" values={stats?.by_sentiment ?? {}} />
      </div>

      <Card padded={false}>
        <CardHeader className="px-4 py-3.5 sm:px-5" title="Recent activity" description="The five most recent complaints." />
        <div className="p-4 sm:p-5">
          {loading ? (
            <SkeletonTable rows={5} cols={6} />
          ) : recent.length === 0 ? (
            <EmptyState
              title="No complaints yet"
              description="Submitted complaints will show up here as soon as they arrive."
            />
          ) : (
            <Table>
              <THead>
                <Tr>
                  <Th>ID</Th>
                  <Th>Title</Th>
                  <Th>Category</Th>
                  <Th>Status</Th>
                  <Th>Created</Th>
                  <Th className="text-right">Action</Th>
                </Tr>
              </THead>
              <TBody>
                {recent.map((complaint) => (
                  <Tr key={complaint.id}>
                    <Td className="font-medium tabular-nums text-ink">#{complaint.id}</Td>
                    <Td className="max-w-72">
                      <span className="line-clamp-1">{complaint.title}</span>
                    </Td>
                    <Td>{complaint.category || '—'}</Td>
                    <Td>
                      <Badge tone={statusTone(complaint.status)}>{complaint.status}</Badge>
                    </Td>
                    <Td className="whitespace-nowrap text-xs text-muted">
                      {formatDate(complaint.created_at)}
                    </Td>
                    <Td className="text-right">
                      <Link
                        to={`/complaints/${complaint.id}`}
                        className="font-medium text-ink underline-offset-4 hover:underline"
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
    </div>
  )
}

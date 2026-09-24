import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, FilePlus2, Inbox, TrendingUp } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { api } from '../../lib/api'
import { getErrorMessage } from '../../lib/errors'
import {
  formatDate,
  resolutionLabel,
  resolutionTone,
  statusTone,
  verificationLabel,
  verificationTone,
} from '../../lib/format'
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

export function CustomerDashboard() {
  const { user } = useAuth()
  const [complaints, setComplaints] = useState<Complaint[]>([])
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    const [complaintsResult, statsResult] = await Promise.allSettled([
      api.get<Complaint[]>('/complaints'),
      api.get<DashboardStats>('/dashboard/stats'),
    ])

    if (complaintsResult.status === 'fulfilled') {
      setComplaints(complaintsResult.value.data)
    } else {
      setComplaints([])
      setError(getErrorMessage(complaintsResult.reason, 'Failed to load your complaints'))
    }

    if (statsResult.status === 'fulfilled') {
      setStats(statsResult.value.data)
    } else {
      setStats(null)
      setError((current) =>
        current || getErrorMessage(statsResult.reason, 'Failed to load your summary'),
      )
    }

    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const openCount = complaints.filter(
    (complaint) => complaint.status !== 'Resolved' && complaint.status !== 'Closed',
  ).length
  const escalatedCount = complaints.filter((complaint) => complaint.status === 'Escalated').length

  return (
    <div className="space-y-6">
      <PageHeader
        title="My complaints"
        description={`Welcome back, ${user?.username}. Track every request you've raised.`}
        actions={
          <Link
            to="/complaints/new"
            className="inline-flex h-11 items-center gap-2 rounded-md bg-brand-600 px-4 text-sm font-medium text-white shadow-sm transition-colors hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 focus-visible:ring-offset-1"
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
            <Button size="sm" variant="secondary" onClick={load}>
              Retry
            </Button>
          }
        >
          {error}
        </Alert>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard
          label="Total complaints"
          value={stats ? stats.total_complaints : loading ? '' : complaints.length}
          loading={loading && !stats}
          icon={<Inbox className="size-4" />}
          hint="All complaints you've submitted"
        />
        <StatCard
          label="Open"
          value={loading && !stats ? '' : openCount}
          loading={loading && !stats}
          icon={<TrendingUp className="size-4" />}
          tone="warn"
          hint="Not yet resolved or closed"
        />
        <StatCard
          label="Escalated"
          value={loading && !stats ? '' : escalatedCount}
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
          description="ID, department, status, resolution and the latest update."
          actions={
            <Link
              to="/complaints/new"
              className="inline-flex h-9 items-center rounded-md border border-border bg-surface px-3 text-xs font-medium text-ink transition-colors hover:bg-canvas"
            >
              Submit new
            </Link>
          }
        />

        <div className="p-4 sm:p-5">
          {loading ? (
            <SkeletonTable rows={5} cols={8} />
          ) : complaints.length === 0 ? (
            <EmptyState
              icon={<FilePlus2 className="size-5" />}
              title="No complaints yet"
              description="Submit your first complaint and watch GenAI analyse it while the Python rule engine verifies the result."
              action={
                <Link
                  to="/complaints/new"
                  className="inline-flex h-9 items-center rounded-md bg-brand-600 px-3 text-xs font-medium text-white hover:bg-brand-700"
                >
                  Submit your first complaint
                </Link>
              }
            />
          ) : (
            <Table>
              <THead>
                <Tr>
                  <Th>ID</Th>
                  <Th>Complaint</Th>
                  <Th>Department</Th>
                  <Th>Status</Th>
                  <Th>Resolution status</Th>
                  <Th>AI verification</Th>
                  <Th>Last update</Th>
                  <Th className="text-right">Action</Th>
                </Tr>
              </THead>
              <TBody>
                {complaints.map((complaint) => (
                  <Tr key={complaint.id}>
                    <Td className="font-medium tabular-nums text-ink">#{complaint.id}</Td>
                    <Td className="max-w-64">
                      <span className="line-clamp-1 text-ink">{complaint.title}</span>
                      <span className="mt-0.5 block text-xs text-muted">
                        Submitted {formatDate(complaint.date || complaint.created_at)}
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
                      <Badge tone={verificationTone(complaint.verification_status)}>
                        {verificationLabel(complaint.verification_status)}
                      </Badge>
                    </Td>
                    <Td className="whitespace-nowrap text-xs text-muted">
                      {formatDate(complaint.updated_at)}
                    </Td>
                    <Td className="text-right">
                      <Link
                        to={`/complaints/${complaint.id}`}
                        className="font-medium text-brand-600 hover:text-brand-700 hover:underline"
                      >
                        View
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
        Each account only sees the complaints it submitted — sign in as another demo user to compare.
      </p>
    </div>
  )
}

export function formatDate(value?: string | null): string {
  if (!value) return '—'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return '—'
  return parsed.toLocaleString()
}

export function statusClass(status?: string | null): string {
  switch ((status ?? '').toLowerCase()) {
    case 'new':
      return 'badge badge-new'
    case 'analyzed':
      return 'badge badge-analyzed'
    case 'assigned':
      return 'badge badge-assigned'
    case 'escalated':
      return 'badge badge-escalated'
    case 'resolved':
      return 'badge badge-resolved'
    case 'closed':
      return 'badge badge-closed'
    default:
      return 'badge'
  }
}

export function verificationClass(status?: string | null): string {
  switch (status) {
    case 'verified':
      return 'badge badge-verified'
    case 'mismatch':
      return 'badge badge-mismatch'
    case 'manual_review':
      return 'badge badge-manual-review'
    default:
      return 'badge'
  }
}

export function verificationLabel(status?: string | null): string {
  switch (status) {
    case 'verified':
      return 'Verified'
    case 'mismatch':
      return 'Mismatch'
    case 'manual_review':
      return 'Manual review'
    default:
      return 'Not validated'
  }
}

export function pluralize(count: number, singular: string, plural?: string): string {
  return `${count} ${count === 1 ? singular : plural ?? `${singular}s`}`
}

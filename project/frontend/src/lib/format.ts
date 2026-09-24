import type { BadgeTone } from '../components/ui/Badge'

export function formatDate(value?: string | null): string {
  if (!value) return '—'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return '—'
  return parsed.toLocaleString()
}

/**
 * One palette for every status — the same value always renders the same pill in
 * tables, the detail page, dashboards and the review queue (design.md §10.1).
 * Covers all ten SRS Step 60 statuses.
 */
const STATUS_TONES: Record<string, BadgeTone> = {
  new: 'info',
  analyzed: 'neutral',
  assigned: 'brand',
  'in progress': 'info',
  'awaiting customer': 'warn',
  escalated: 'danger',
  resolved: 'success',
  closed: 'neutral',
  reopened: 'warn',
}

export function statusTone(status?: string | null): BadgeTone {
  return STATUS_TONES[(status ?? '').trim().toLowerCase()] ?? 'neutral'
}

const VERIFICATION_TONES: Record<string, BadgeTone> = {
  verified: 'success',
  mismatch: 'danger',
  manual_review: 'warn',
}

export function verificationTone(status?: string | null): BadgeTone {
  return VERIFICATION_TONES[(status ?? '').trim()] ?? 'neutral'
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

const PRIORITY_TONES: Record<string, BadgeTone> = {
  p0: 'danger',
  p1: 'warn',
  p2: 'brand',
  p3: 'neutral',
}

export function priorityTone(priority?: string | null): BadgeTone {
  return PRIORITY_TONES[(priority ?? '').trim().toLowerCase()] ?? 'neutral'
}

const SENTIMENT_TONES: Record<string, BadgeTone> = {
  positive: 'success',
  neutral: 'neutral',
  negative: 'warn',
  'strongly negative': 'danger',
}

export function sentimentTone(sentiment?: string | null): BadgeTone {
  return SENTIMENT_TONES[(sentiment ?? '').trim().toLowerCase()] ?? 'neutral'
}

const URGENCY_TONES: Record<string, BadgeTone> = {
  low: 'neutral',
  medium: 'brand',
  high: 'warn',
  critical: 'danger',
}

export function urgencyTone(urgency?: string | null): BadgeTone {
  return URGENCY_TONES[(urgency ?? '').trim().toLowerCase()] ?? 'neutral'
}

/**
 * SRS Step 61 asks for a "Resolution status" alongside the raw lifecycle status —
 * this collapses the ten statuses into the four answers a customer cares about.
 */
const RESOLUTION_LABELS: Array<[string[], string, BadgeTone]> = [
  [['resolved', 'closed'], 'Resolved', 'success'],
  [['reopened'], 'Reopened', 'warn'],
  [['escalated'], 'Escalated', 'danger'],
  [['awaiting customer'], 'Waiting on you', 'warn'],
  [['in progress', 'assigned', 'analyzed'], 'In progress', 'info'],
  [['new'], 'Received', 'neutral'],
]

export function resolutionLabel(status?: string | null): string {
  const key = (status ?? '').trim().toLowerCase()
  const match = RESOLUTION_LABELS.find(([keys]) => keys.includes(key))
  return match ? match[1] : 'In progress'
}

export function resolutionTone(status?: string | null): BadgeTone {
  const key = (status ?? '').trim().toLowerCase()
  const match = RESOLUTION_LABELS.find(([keys]) => keys.includes(key))
  return match ? match[2] : 'neutral'
}

export function pluralize(count: number, singular: string, plural?: string): string {
  return `${count} ${count === 1 ? singular : plural ?? `${singular}s`}`
}

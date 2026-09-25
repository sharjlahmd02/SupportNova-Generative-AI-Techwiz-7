import type { BadgeTone } from '../components/ui/Badge'
import type { StoredAttachment } from '../types'

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

/**
 * Client-side mirror of `backend/app/security/input_sanitizer.py`.
 * Written without regex escapes so the stored text and the rendered text are
 * byte-for-byte identical (SRS section 6 - "No crash on odd input").
 */
const NL = String.fromCharCode(10)
const CR = String.fromCharCode(13)
const TAB = String.fromCharCode(9)

function dropUnsafeCharacters(text: string): string {
  let out = ''
  for (const character of text) {
    const code = character.codePointAt(0) ?? 0
    const zeroWidth = (code >= 0x200b && code <= 0x200d) || code === 0xfeff
    const control =
      code < 0x20 ? character !== TAB && character !== NL : code >= 0x7f && code <= 0x9f
    if (zeroWidth || control) continue
    out += character
  }
  return out
}

function collapseWhitespace(text: string): string {
  let out = ''
  let pendingSpace = false
  let newlineRun = 0
  for (const character of text) {
    if (character === ' ' || character === TAB) {
      pendingSpace = out.length > 0 && !out.endsWith(NL)
      continue
    }
    if (character === NL) {
      while (out.endsWith(' ')) out = out.slice(0, -1)
      newlineRun += 1
      if (newlineRun <= 2) out += NL
      pendingSpace = false
      continue
    }
    newlineRun = 0
    if (pendingSpace) {
      out += ' '
      pendingSpace = false
    }
    out += character
  }
  return out
}

export function sanitizeInput(value: string, maxLength = 6000): string {
  const normalised = value
    .normalize('NFKC')
    .split(CR + NL)
    .join(NL)
    .split(CR)
    .join(NL)
  return collapseWhitespace(dropUnsafeCharacters(normalised))
    .trim()
    .slice(0, maxLength)
}

/** Short, copy-friendly ticket number: `CMP-TRV-00104` (SRS section 5). */
const REFERENCE_CODES: Record<string, string> = {
  billing: 'BIL',
  finance: 'BIL',
  payment: 'BIL',
  refund: 'BIL',
  technical: 'TEC',
  technology: 'TEC',
  system: 'TEC',
  account: 'ACC',
  login: 'ACC',
  access: 'ACC',
  travel: 'TRV',
  booking: 'TRV',
  itinerary: 'TRV',
  delivery: 'DEL',
  shipping: 'DEL',
  service: 'SVC',
  support: 'SVC',
  general: 'GEN',
}

export function complaintReference(complaint: {
  id: number
  category?: string | null
  subcategory?: string | null
  department?: string | null
}): string {
  let code = 'GEN'
  for (const source of [complaint.category, complaint.subcategory, complaint.department]) {
    const key = (source ?? '').trim().toLowerCase()
    if (!key) continue
    const mapped = REFERENCE_CODES[key]
    const slug = key.replace(/[^a-z0-9]/g, '')
    code = mapped ?? slug.slice(0, 3).padEnd(3, 'X').toUpperCase()
    break
  }
  return `CMP-${code}-${String(complaint.id).padStart(5, '0')}`
}

/** Response-window budget by severity, once Pipeline 1 has set a priority. */
const SLA_HOURS: Record<string, number> = { p0: 4, p1: 8, p2: 24, p3: 72 }
const DEFAULT_SLA_HOURS = 24
const TERMINAL_STATUSES = new Set(['resolved', 'closed'])

export interface SlaState {
  due_at: Date
  remaining_ms: number
  overdue: boolean
  label: string
  tone: BadgeTone
}

function humanDuration(ms: number): string {
  const minutes = Math.max(1, Math.round(ms / 60000))
  if (minutes < 60) return `${minutes}m`
  const hours = Math.round(minutes / 60)
  if (hours < 48) return `${hours}h`
  return `${Math.round(hours / 24)}d`
}

/**
 * SRS section 5 "SLA indicator": a plain-language countdown to the first
 * response window. Terminal tickets report `Resolved` instead of a countdown.
 */
export function slaFor(complaint: {
  status?: string | null
  priority?: string | null
  date?: string | null
  created_at?: string
}): SlaState {
  const status = (complaint.status ?? '').trim().toLowerCase()
  const started = new Date(complaint.date || complaint.created_at || Date.now())
  const windowHours =
    SLA_HOURS[(complaint.priority ?? '').trim().toLowerCase()] ?? DEFAULT_SLA_HOURS
  const due_at = new Date(started.getTime() + windowHours * 3600000)
  const remaining_ms = due_at.getTime() - Date.now()
  const overdue = remaining_ms < 0

  if (TERMINAL_STATUSES.has(status)) {
    return { due_at, remaining_ms: 0, overdue: false, label: 'Resolved', tone: 'success' }
  }

  const fractionLeft = remaining_ms / (windowHours * 3600000)
  return {
    due_at,
    remaining_ms,
    overdue,
    label: overdue
      ? `Overdue by ${humanDuration(-remaining_ms)}`
      : `Due in ${humanDuration(remaining_ms)}`,
    tone: overdue ? 'danger' : fractionLeft < 0.25 ? 'warn' : 'neutral',
  }
}

const CHANNEL_LABELS: Record<string, string> = {
  web_portal: 'Web portal',
  email: 'Email',
  in_app: 'In-app',
  in_app_chat: 'In-app chat',
  document_upload: 'Document upload',
  phone: 'Phone',
}

export function channelLabel(value?: string | null): string {
  if (!value) return '—'
  return CHANNEL_LABELS[value] ?? value.replace(/_/g, ' ')
}

const CUSTOMER_TYPE_LABELS: Record<string, string> = {
  regular: 'Regular',
  vip_gold: 'VIP – Gold',
  corporate: 'Corporate',
  first_time: 'First-time',
}

export function customerTypeLabel(value?: string | null): string {
  if (!value) return '—'
  return CUSTOMER_TYPE_LABELS[value] ?? value
}

const CONTACT_LABELS: Record<string, string> = {
  web_portal: 'Web portal',
  email: 'Email',
  in_app: 'In-app',
}

export function contactLabel(value?: string | null): string {
  if (!value) return '—'
  return CONTACT_LABELS[value] ?? value
}

export function attachmentList(attachments: unknown): StoredAttachment[] {
  if (!Array.isArray(attachments)) return []
  return attachments.filter(
    (item): item is StoredAttachment =>
      !!item &&
      typeof item === 'object' &&
      typeof (item as StoredAttachment).filename === 'string' &&
      typeof (item as StoredAttachment).original_name === 'string',
  )
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const exponent = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)))
  const value = bytes / Math.pow(1024, exponent)
  return `${value >= 10 || exponent === 0 ? Math.round(value) : value.toFixed(1)} ${units[exponent]}`
}


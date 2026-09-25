import { useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, FileWarning, Send, ShieldAlert } from 'lucide-react'
import { api } from '../../lib/api'
import { getErrorMessage } from '../../lib/errors'
import { formatBytes, sanitizeInput } from '../../lib/format'
import { useToast } from '../../components/ui'
import type { Complaint, DuplicateCandidate, StoredAttachment } from '../../types'
import {
  ACCEPT_HINT,
  Alert,
  Button,
  Card,
  FileDropzone,
  Input,
  MAX_ATTACHMENTS,
  MAX_UPLOAD_BYTES,
  PageHeader,
  Select,
  Textarea,
} from '../../components/ui'

/** SRS section 3 - the nine structured details a customer may provide. */
const CUSTOMER_TYPES = [
  { value: 'regular', label: 'Regular' },
  { value: 'vip_gold', label: 'VIP / Gold Member' },
  { value: 'corporate', label: 'Corporate' },
  { value: 'first_time', label: 'First-Time Customer' },
]

const CONTACT_CHANNELS = [
  { value: 'web_portal', label: 'Web Portal' },
  { value: 'email', label: 'Email' },
  { value: 'in_app', label: 'In-App Notification' },
]

/** SRS section 2 - the supported submission channels. */
const INTAKE_CHANNELS = [
  { value: 'web_portal', label: 'Web portal form' },
  { value: 'in_app_chat', label: 'In-App / Live chat' },
  { value: 'document_upload', label: 'Complaint document upload' },
]

const RESOLUTION_OPTIONS = [
  'Full refund',
  'Product replacement',
  'Flight rebooking',
  'Service re-performance',
  'Discount or account credit',
  'Formal apology',
]
const OTHER_RESOLUTION = '__other'

const TITLE_MAX = 200
const DESCRIPTION_MAX = 6000

const EMPTY_FORM = {
  title: '',
  description: '',
  product_service: '',
  order_ref: '',
  customer_type: '',
  preferred_contact: 'web_portal',
  channel: 'web_portal',
  prior_complaint_ref: '',
  resolution_choice: '',
  resolution_other: '',
}

type FormState = typeof EMPTY_FORM
type FieldErrors = Partial<Record<keyof FormState | 'attachments' | 'form', string>>

export function ComplaintNew() {
  const [formData, setFormData] = useState<FormState>({ ...EMPTY_FORM })
  const [files, setFiles] = useState<StoredAttachment[]>([])
  const [errors, setErrors] = useState<FieldErrors>({})
  const [loading, setLoading] = useState(false)
  const [duplicates, setDuplicates] = useState<DuplicateCandidate[] | null>(null)
  const pendingPayload = useRef<Record<string, unknown> | null>(null)
  const navigate = useNavigate()
  const { toast } = useToast()
  const titleRef = useRef<HTMLInputElement>(null)
  const descriptionRef = useRef<HTMLTextAreaElement>(null)

  const handleChange = (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => {
    const { name, value } = event.target
    setFormData((current) => ({ ...current, [name]: value }))
    setErrors((current) => ({ ...current, [name]: undefined, form: undefined }))
    if (name === 'channel' && value === 'document_upload' && files.length === 0) {
      setErrors((current) => ({
        ...current,
        attachments: 'The document upload channel needs at least one file attached.',
      }))
    }
  }

  const buildPayload = (): Record<string, unknown> | null => {
    const next: FieldErrors = {}

    const title = sanitizeInput(formData.title, TITLE_MAX)
    const description = sanitizeInput(formData.description, DESCRIPTION_MAX)
    const productService = sanitizeInput(formData.product_service, 200)
    const orderRef = sanitizeInput(formData.order_ref, 200)
    const priorRef = sanitizeInput(formData.prior_complaint_ref, 200)
    const otherResolution = sanitizeInput(formData.resolution_other, 500)

    if (!title) next.title = 'A title is required so the complaint can be routed.'
    else if (title.length < 8) next.title = 'Give the title at least 8 characters of detail.'

    if (!description)
      next.description = 'Describe the issue so both pipelines have something to analyse.'
    else if (description.length < 20)
      next.description = 'Add a little more detail — at least 20 characters.'

    if (formData.resolution_choice === OTHER_RESOLUTION && !otherResolution)
      next.resolution_other = 'Tell us the outcome you are looking for.'

    if (formData.channel === 'document_upload' && files.length === 0)
      next.attachments = 'The document upload channel needs at least one file attached.'

    if (formData.customer_type && !CUSTOMER_TYPES.some((o) => o.value === formData.customer_type))
      next.customer_type = 'Pick one of the listed account tiers.'
    if (formData.preferred_contact && !CONTACT_CHANNELS.some((o) => o.value === formData.preferred_contact))
      next.preferred_contact = 'Pick one of the listed contact channels.'
    if (formData.channel && !INTAKE_CHANNELS.some((o) => o.value === formData.channel))
      next.channel = 'Pick one of the listed submission channels.'

    if (Object.keys(next).length > 0) {
      setErrors(next)
      if (next.title) titleRef.current?.focus()
      else if (next.description) descriptionRef.current?.focus()
      return null
    }

    const requested =
      formData.resolution_choice === OTHER_RESOLUTION
        ? otherResolution
        : formData.resolution_choice

    return {
      title,
      description,
      product_service: productService,
      order_ref: orderRef,
      customer_type: formData.customer_type,
      preferred_contact: formData.preferred_contact,
      channel: formData.channel,
      prior_complaint_ref: priorRef,
      requested_resolution: requested,
      attachments: files.length > 0 ? files : null,
    }
  }

  const create = async (payload: Record<string, unknown>) => {
    setLoading(true)
    try {
      const response = await api.post<Complaint>('/complaints', payload)
      toast({
        tone: 'success',
        title: 'Complaint submitted',
        description: 'Track its lifecycle from the dashboard — an analysis runs automatically.',
      })
      setTimeout(() => navigate(`/complaints/${response.data.id}`, { replace: true }), 400)
    } catch (err) {
      setErrors({ form: getErrorMessage(err, 'Failed to submit complaint') })
      setLoading(false)
    }
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setDuplicates(null)

    const payload = buildPayload()
    if (!payload) return

    setLoading(true)
    try {
      const check = await api.post<DuplicateCandidate[]>('/complaints/duplicate-check', {
        title: payload.title,
        description: payload.description,
      })
      if (check.data.length > 0) {
        pendingPayload.current = payload
        setDuplicates(check.data)
        setLoading(false)
        return
      }
    } catch {
      // A failed duplicate check must never block a legitimate submission.
    }
    await create(payload)
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Submit a complaint"
        description="Tell us what happened. The GenAI pipeline interprets it while an independent Python rule engine checks the result."
      />

      {errors.form && (
        <Alert
          tone="error"
          title="Could not submit the complaint"
          onDismiss={() => setErrors((current) => ({ ...current, form: undefined }))}
        >
          {errors.form}
        </Alert>
      )}

      {duplicates && duplicates.length > 0 && (
        <Alert
          tone="warn"
          title="This looks like a duplicate"
          actions={
            <>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => navigate(`/complaints/${duplicates[0].id}`)}
              >
                Open the existing ticket
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  const payload = pendingPayload.current
                  pendingPayload.current = null
                  setDuplicates(null)
                  if (payload) void create(payload)
                }}
              >
                Submit anyway
              </Button>
            </>
          }
        >
          <p>
            We found an existing ticket that reads very similarly. Linking them keeps the queue
            accurate — you can still submit this as a new complaint.
          </p>
          <ul className="mt-2 space-y-1">
            {duplicates.map((candidate) => (
              <li key={candidate.id} className="flex items-center gap-2 text-sm">
                <FileWarning className="size-3.5 shrink-0" aria-hidden="true" />
                <span className="truncate">{candidate.title}</span>
                <span className="shrink-0 text-xs opacity-70">
                  {Math.round(candidate.similarity * 100)}% match
                </span>
              </li>
            ))}
          </ul>
        </Alert>
      )}

      <Card>
        <form onSubmit={handleSubmit} noValidate className="space-y-6">
          <section aria-labelledby="basics-heading" className="space-y-5">
            <div>
              <h2 id="basics-heading" className="text-sm font-semibold tracking-tight text-ink">
                What happened
              </h2>
              <p className="text-xs text-muted">
                Fields marked with an asterisk are required.
              </p>
            </div>

            <Input
              ref={titleRef}
              label="Complaint title"
              required
              maxLength={TITLE_MAX}
              placeholder="Brief summary of the grievance"
              hint="One line — this is what appears in every dashboard."
              error={errors.title}
              value={formData.title}
              onChange={handleChange}
              name="title"
            />

            <Textarea
              ref={descriptionRef}
              label="Complaint description"
              required
              rows={8}
              placeholder="What happened, when, and what you have already tried…"
              hint="Sentiment and urgency are derived from this text — the rule engine, not the model, decides urgency."
              error={errors.description}
              value={formData.description}
              onChange={handleChange}
              name="description"
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Product / service"
                placeholder="e.g. NovaCloud Backup"
                hint="The product, service or feature affected."
                error={errors.product_service}
                value={formData.product_service}
                onChange={handleChange}
                name="product_service"
              />

              <Input
                label="Order / transaction reference"
                placeholder="Order ID, PNR, invoice or ticket ID"
                hint="Leave blank if you do not have one to hand."
                error={errors.order_ref}
                value={formData.order_ref}
                onChange={handleChange}
                name="order_ref"
              />
            </div>
          </section>

          <section aria-labelledby="account-heading" className="space-y-5">
            <h2 id="account-heading" className="text-sm font-semibold tracking-tight text-ink">
              Your account
            </h2>

            <div className="grid gap-4 sm:grid-cols-2">
              <Select
                label="Customer type"
                hint="Account tier used for prioritisation."
                error={errors.customer_type}
                value={formData.customer_type}
                onChange={handleChange}
                name="customer_type"
              >
                <option value="">Select…</option>
                {CUSTOMER_TYPES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>

              <Select
                label="Preferred contact channel"
                hint="Where official responses should reach you."
                error={errors.preferred_contact}
                value={formData.preferred_contact}
                onChange={handleChange}
                name="preferred_contact"
              >
                {CONTACT_CHANNELS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>

              <Select
                label="Submission channel"
                hint="How this complaint reaches SupportNova."
                error={errors.channel}
                value={formData.channel}
                onChange={handleChange}
                name="channel"
              >
                {INTAKE_CHANNELS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>

              <Input
                label="Previous complaint reference"
                placeholder="Reference to a prior or recurring ticket"
                hint="Recurring issues get linked to their original case."
                error={errors.prior_complaint_ref}
                value={formData.prior_complaint_ref}
                onChange={handleChange}
                name="prior_complaint_ref"
              />
            </div>
          </section>

          <section aria-labelledby="resolution-heading" className="space-y-5">
            <h2 id="resolution-heading" className="text-sm font-semibold tracking-tight text-ink">
              What you would like to happen
            </h2>

            <Select
              label="Requested resolution"
              hint="Your expected outcome — pick the closest match."
              error={errors.resolution_choice}
              value={formData.resolution_choice}
              onChange={handleChange}
              name="resolution_choice"
            >
              <option value="">Select…</option>
              {RESOLUTION_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
              <option value={OTHER_RESOLUTION}>Something else (describe below)</option>
            </Select>

            {formData.resolution_choice === OTHER_RESOLUTION && (
              <Textarea
                label="Describe the outcome you want"
                required
                rows={3}
                placeholder="e.g. Rebook me on the next available flight and refund the baggage fee."
                error={errors.resolution_other}
                value={formData.resolution_other}
                onChange={handleChange}
                name="resolution_other"
              />
            )}
          </section>

          <section aria-labelledby="attachments-heading" className="space-y-4">
            <div>
              <h2 id="attachments-heading" className="text-sm font-semibold tracking-tight text-ink">
                Supporting documents
              </h2>
              <p className="text-xs text-muted">
                Photos of damaged goods, booking receipts or billing statements. Maximum{' '}
                {formatBytes(MAX_UPLOAD_BYTES)} per file, {MAX_ATTACHMENTS} files. Accepted: {ACCEPT_HINT}.
              </p>
            </div>

            <FileDropzone
              label="Attachments"
              files={files}
              error={errors.attachments}
              onAdd={(stored) => {
                setFiles((current) => [...current, stored])
                setErrors((current) => ({ ...current, attachments: undefined }))
              }}
              onRemove={(filename) =>
                setFiles((current) => current.filter((file) => file.filename !== filename))
              }
            />
          </section>

          <div className="flex flex-wrap items-center gap-3 border-t border-border pt-5">
            <Button
              type="submit"
              loading={loading}
              icon={<Send className="size-4" />}
            >
              {loading ? 'Submitting…' : 'Submit complaint'}
            </Button>
            <Link
              to="/"
              className="inline-flex h-11 items-center rounded-lg border border-border bg-surface px-4 text-sm font-medium text-ink transition-colors hover:border-border-strong hover:bg-brand-50"
            >
              Cancel
            </Link>
            <p className="ml-auto hidden items-center gap-1.5 text-xs text-muted sm:flex">
              <ShieldAlert className="size-3.5" aria-hidden="true" />
              Inputs are sanitised before they are stored.
              <ArrowRight className="size-3.5" aria-hidden="true" />
            </p>
          </div>
        </form>
      </Card>
    </div>
  )
}

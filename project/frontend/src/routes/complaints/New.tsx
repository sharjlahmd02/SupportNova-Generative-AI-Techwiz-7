import { useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Send } from 'lucide-react'
import { api } from '../../lib/api'
import { getErrorMessage } from '../../lib/errors'
import { useToast } from '../../components/ui'
import type { Complaint } from '../../types'
import {
  Alert,
  Button,
  Card,
  Input,
  PageHeader,
  Select,
  Textarea,
} from '../../components/ui'

const OPTIONAL_TEXT_FIELDS = [
  'customer_type',
  'product_service',
  'order_ref',
  'channel',
  'prior_complaint_ref',
  'requested_resolution',
] as const

const EMPTY_FORM = {
  title: '',
  description: '',
  customer_type: '',
  product_service: '',
  order_ref: '',
  channel: 'web',
  attachments: '',
  prior_complaint_ref: '',
  requested_resolution: '',
}

type FormState = typeof EMPTY_FORM
type FieldErrors = Partial<Record<keyof FormState | 'form', string>>

export function ComplaintNew() {
  const [formData, setFormData] = useState<FormState>({ ...EMPTY_FORM })
  const [errors, setErrors] = useState<FieldErrors>({})
  const [loading, setLoading] = useState(false)
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
  }

  const validate = (): { payload: Record<string, unknown> | null; errors: FieldErrors } => {
    const next: FieldErrors = {}
    const title = formData.title.trim()
    const description = formData.description.trim()

    if (!title) next.title = 'A title is required so the complaint can be routed.'
    if (!description) next.description = 'Describe the issue so both pipelines have something to analyse.'

    const attachments = formData.attachments.trim()
    if (attachments) {
      try {
        JSON.parse(attachments)
      } catch {
        next.attachments = 'Attachments must be valid JSON, or left empty.'
      }
    }

    if (Object.keys(next).length > 0) return { payload: null, errors: next }

    const payload: Record<string, unknown> = { title, description }
    for (const field of OPTIONAL_TEXT_FIELDS) {
      const value = formData[field].trim()
      if (value) payload[field] = value
    }
    if (attachments) payload.attachments = JSON.parse(attachments)

    return { payload, errors: next }
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    const { payload, errors: nextErrors } = validate()

    if (!payload) {
      setErrors(nextErrors)
      if (nextErrors.title) titleRef.current?.focus()
      else if (nextErrors.description) descriptionRef.current?.focus()
      return
    }

    setLoading(true)
    try {
      const response = await api.post<Complaint>('/complaints', payload)
      toast({
        tone: 'success',
        title: `Complaint #${response.data.id} submitted`,
        description: 'Opening it now — run the analysis when you are ready.',
      })
      setTimeout(() => navigate(`/complaints/${response.data.id}`, { replace: true }), 500)
    } catch (err) {
      setErrors({ form: getErrorMessage(err, 'Failed to submit complaint') })
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Submit a complaint"
        description="Describe the issue. GenAI will interpret it while the Python rule engine independently checks the result."
      />

      {errors.form && (
        <Alert tone="error" title="Could not submit the complaint" onDismiss={() => setErrors((c) => ({ ...c, form: undefined }))}>
          {errors.form}
        </Alert>
      )}

      <Card>
        <form onSubmit={handleSubmit} noValidate className="space-y-5">
          <Input
            ref={titleRef}
            label="Title"
            required
            maxLength={200}
            placeholder="Brief summary of the issue"
            hint="One line — this is what appears in every dashboard."
            error={errors.title}
            value={formData.title}
            onChange={handleChange}
            name="title"
          />

          <Textarea
            ref={descriptionRef}
            label="Description"
            required
            rows={7}
            placeholder="What happened, when, and what you have already tried…"
            hint="Sentiment and urgency are derived from this text — the rule engine, not the model, decides urgency."
            error={errors.description}
            value={formData.description}
            onChange={handleChange}
            name="description"
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <Select
              label="Customer type"
              value={formData.customer_type}
              onChange={handleChange}
              name="customer_type"
            >
              <option value="">Select…</option>
              <option value="individual">Individual</option>
              <option value="business">Business</option>
              <option value="vip">VIP</option>
            </Select>

            <Input
              label="Product / service"
              placeholder="e.g. NovaCloud Backup"
              value={formData.product_service}
              onChange={handleChange}
              name="product_service"
            />

            <Input
              label="Order reference"
              placeholder="Order or transaction ID"
              value={formData.order_ref}
              onChange={handleChange}
              name="order_ref"
            />

            <Select label="Channel" value={formData.channel} onChange={handleChange} name="channel">
              <option value="web">Web</option>
              <option value="email">Email</option>
              <option value="phone">Phone</option>
              <option value="chat">Chat</option>
              <option value="in_person">In person</option>
            </Select>
          </div>

          <Input
            label="Prior complaint reference"
            placeholder="Reference to a previous related complaint (if any)"
            hint="Repeat complaints get linked to their original case."
            value={formData.prior_complaint_ref}
            onChange={handleChange}
            name="prior_complaint_ref"
          />

          <Textarea
            label="Requested resolution"
            rows={3}
            placeholder="What resolution are you seeking?"
            value={formData.requested_resolution}
            onChange={handleChange}
            name="requested_resolution"
          />

          <Textarea
            label="Attachments (JSON, optional)"
            rows={3}
            placeholder='[{"filename": "doc.pdf", "url": "..."}]'
            hint="Leave empty if you have nothing to attach."
            error={errors.attachments}
            value={formData.attachments}
            onChange={handleChange}
            name="attachments"
          />

          <div className="flex flex-wrap gap-3 border-t border-border pt-4">
            <Button type="submit" loading={loading} icon={<Send className="size-4" />}>
              {loading ? 'Submitting…' : 'Submit complaint'}
            </Button>
            <Link
              to="/"
              className="inline-flex h-11 items-center rounded-md border border-border bg-surface px-4 text-sm font-medium text-ink transition-colors hover:bg-canvas"
            >
              Cancel
            </Link>
          </div>
        </form>
      </Card>
    </div>
  )
}

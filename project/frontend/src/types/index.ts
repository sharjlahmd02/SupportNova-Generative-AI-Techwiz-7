export interface User {
  id: number
  username: string
  email: string
  role: string
}

export interface Complaint {
  id: number
  title: string
  description: string
  customer_type: string | null
  product_service: string | null
  order_ref: string | null
  channel: string | null
  attachments: unknown
  prior_complaint_ref: string | null
  requested_resolution: string | null
  status: string
  customer_id: number | null
  date: string | null
  created_at: string
  updated_at: string
  category?: string | null
  subcategory?: string | null
  department?: string | null
  sentiment?: string | null
  urgency?: string | null
  priority?: string | null
  escalation_required?: boolean | null
  verification_status?: string | null
  mismatch_reasons?: string[] | null
}

export interface PipelineResult {
  complaint_id: string
  primary_issue: string
  secondary_issue?: string | null
  issue_category: string
  subcategory: string
  sentiment: string
  urgency: string
  priority: string
  entities?: Record<string, unknown>
  department: string
  secondary_department?: string | null
  policy_id?: string | null
  policy_section?: string | null
  resolution_steps?: string[]
  escalation_required: boolean
  escalation_reason?: string | null
  escalation_level?: string | null
  response_type?: string | null
  customer_response?: string | null
  follow_up_required?: boolean
  follow_up_message?: string | null
  clarification_questions?: string[]
  agent_guidance?: string[]
  prompt_version?: string
  model?: string
  analysis_timestamp: string
}

export interface ValidationResult extends PipelineResult {
  verification_status: 'verified' | 'mismatch' | 'manual_review'
  mismatch_reasons: string[]
}

export interface DashboardStats {
  total_complaints: number
  by_status: Record<string, number>
  by_category: Record<string, number>
  by_department: Record<string, number>
  by_priority: Record<string, number>
  by_sentiment: Record<string, number>
  escalation_count: number
  mismatch_count: number
  manual_review_count: number
  avg_resolution_time_hours: number | null
}

export interface ReviewCase {
  id: number
  complaint_id: number
  genai_result: Record<string, unknown>
  python_result: Record<string, unknown>
  diff: Record<string, unknown>
  reviewer_action: string | null
  reviewer_notes: string | null
  audit_log: Record<string, unknown> | null
  created_at: string
  resolved_at: string | null
}

import type { ReactNode } from 'react'
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react'
import { cn } from '../../lib/cn'

export type AlertTone = 'error' | 'success' | 'info' | 'warn'

const TONES: Record<AlertTone, string> = {
  error: 'border-danger-border bg-danger-bg text-danger',
  success: 'border-success-border bg-success-bg text-success',
  info: 'border-info-border bg-info-bg text-info',
  warn: 'border-warn-border bg-warn-bg text-warn',
}

const ICONS: Record<AlertTone, ReactNode> = {
  error: <XCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />,
  success: <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden="true" />,
  info: <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />,
  warn: <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />,
}

/**
 * Inline banner for load errors, form errors and confirmations.
 * Always carries an icon + text so tone is never the only signal (§10.4 rule 7).
 */
export function Alert({
  tone = 'info',
  title,
  children,
  actions,
  onDismiss,
  className,
}: {
  tone?: AlertTone
  title?: ReactNode
  children?: ReactNode
  actions?: ReactNode
  onDismiss?: () => void
  className?: string
}) {
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={cn(
        'flex items-start gap-2.5 rounded-lg border px-3.5 py-3 text-sm',
        TONES[tone],
        className,
      )}
    >
      {ICONS[tone]}
      <div className="min-w-0 flex-1">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={cn('text-ink-soft', title && 'mt-0.5')}>{children}</div>}
        {actions && <div className="mt-2 flex flex-wrap gap-2">{actions}</div>}
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="-m-1 rounded p-1 opacity-60 transition-opacity hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      )}
    </div>
  )
}

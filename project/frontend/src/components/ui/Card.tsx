import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

export function Card({
  className,
  children,
  padded = true,
}: {
  className?: string
  children: ReactNode
  padded?: boolean
}) {
  return (
    <section
      className={cn(
        'rounded-xl border border-border bg-surface shadow-card',
        padded && 'p-4 sm:p-5',
        className,
      )}
    >
      {children}
    </section>
  )
}

export function CardHeader({
  title,
  description,
  actions,
  className,
}: {
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  className?: string
}) {
  return (
    <header
      className={cn(
        'flex flex-wrap items-start justify-between gap-3 border-b border-border pb-3.5',
        className,
      )}
    >
      <div className="min-w-0">
        <h2 className="text-[15px] font-semibold tracking-tight text-ink">{title}</h2>
        {description && <p className="mt-0.5 text-xs text-muted">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  )
}

/**
 * Dashboard tile. `loading` renders a shimmer instead of a dash so the layout
 * never jumps between loading and loaded (design.md §10.4 rule 1).
 */
export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = 'brand',
  loading = false,
}: {
  label: string
  value: ReactNode
  hint?: ReactNode
  icon?: ReactNode
  tone?: 'brand' | 'success' | 'warn' | 'danger' | 'neutral'
  loading?: boolean
}) {
  const accent =
    tone === 'success'
      ? 'bg-success-bg text-success'
      : tone === 'warn'
        ? 'bg-warn-bg text-warn'
        : tone === 'danger'
          ? 'bg-danger-bg text-danger'
          : tone === 'neutral'
            ? 'bg-brand-50 text-ink-soft'
            : 'bg-ink text-white'

  return (
    <Card className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase leading-snug tracking-wider text-muted line-clamp-2">
          {label}
        </p>
        {loading ? (
          <div className="mt-2 h-8 w-16 animate-pulse rounded bg-border/70" aria-hidden="true" />
        ) : (
          <p className="mt-1.5 text-[28px] font-semibold leading-none tracking-tight tabular-nums text-ink">
            {value}
          </p>
        )}
        {hint && <p className="mt-2 text-xs text-muted">{hint}</p>}
      </div>
      {icon && (
        <span
          className={cn('grid size-9 shrink-0 place-items-center rounded-lg ring-1 ring-inset ring-black/5', accent)}
          aria-hidden="true"
        >
          {icon}
        </span>
      )}
    </Card>
  )
}

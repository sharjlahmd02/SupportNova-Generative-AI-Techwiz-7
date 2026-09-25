import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

export type BadgeTone = 'neutral' | 'brand' | 'success' | 'warn' | 'danger' | 'info'

const TONES: Record<BadgeTone, string> = {
  neutral: 'bg-brand-50 text-ink-soft ring-border-strong',
  brand: 'bg-ink text-white ring-ink',
  success: 'bg-success-bg text-success ring-success-border',
  warn: 'bg-warn-bg text-warn ring-warn-border',
  danger: 'bg-danger-bg text-danger ring-danger-border',
  info: 'bg-info-bg text-info ring-info-border',
}

export interface BadgeProps {
  tone?: BadgeTone
  className?: string
  children: ReactNode
  title?: string
}

/**
 * The one status pill in the app. Every status/priority/verification value maps to a
 * tone through lib/format.ts so the same value always looks the same everywhere
 * (design.md §10.1).
 */
export function Badge({ tone = 'neutral', className, children, title }: BadgeProps) {
  return (
    <span
      title={title}
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold',
        'ring-1 ring-inset whitespace-nowrap',
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}

import {
  forwardRef,
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '../../lib/cn'

/**
 * One control definition for every field in the app: 44px tall (matches the
 * 44px button hit target), 14px text, neutral border that snaps to ink on
 * focus with a soft halo.
 */
const CONTROL =
  'block w-full rounded-lg border border-border bg-surface px-3.5 text-sm text-ink placeholder:text-faint ' +
  'transition-[border-color,box-shadow,background-color] duration-150 hover:border-border-strong ' +
  'focus:border-ink focus:outline-none focus:ring-4 focus:ring-ink/[0.06] ' +
  'disabled:cursor-not-allowed disabled:bg-canvas disabled:text-muted disabled:hover:border-border'

const HEIGHT = 'h-11'

const INVALID =
  'border-danger bg-danger-bg hover:border-danger focus:border-danger focus:ring-danger/15'

interface FieldShellProps {
  label: ReactNode
  hint?: ReactNode
  error?: string | null
  required?: boolean
  className?: string
  children: (ids: { id: string; describedBy: string | undefined; invalid: boolean }) => ReactNode
}

/**
 * Label + control + hint + error, wired together. Errors are rendered as text
 * (never colour alone) and linked via aria-describedby (design.md §10.4 rules 2, 7).
 */
function FieldShell({ label, hint, error, required, className, children }: FieldShellProps) {
  const id = useId()
  const hintId = `${id}-hint`
  const errorId = `${id}-error`
  const describedBy = cn(error && errorId, hint && hintId) || undefined

  return (
    <div className={cn('space-y-2', className)}>
      <label
        htmlFor={id}
        className="block text-[13px] font-semibold leading-tight text-ink"
      >
        {label}
        {required && <span className="ml-0.5 text-danger" aria-hidden="true">*</span>}
        {required && <span className="sr-only"> (required)</span>}
      </label>
      {children({ id, describedBy, invalid: Boolean(error) })}
      {hint && !error && (
        <p id={hintId} className="text-xs leading-snug text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="text-xs font-medium leading-snug text-danger">
          {error}
        </p>
      )}
    </div>
  )
}

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  label: ReactNode
  hint?: ReactNode
  error?: string | null
  fieldClassName?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, error, required, className, fieldClassName, ...rest },
  ref,
) {
  return (
    <FieldShell label={label} hint={hint} error={error} required={required} className={fieldClassName}>
      {({ id, describedBy, invalid }) => (
        <input
          ref={ref}
          id={id}
          required={required}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          className={cn(CONTROL, HEIGHT, invalid && INVALID, className)}
          {...rest}
        />
      )}
    </FieldShell>
  )
})

export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'id'> {
  label: ReactNode
  hint?: ReactNode
  error?: string | null
  fieldClassName?: string
  children: ReactNode
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, hint, error, required, className, fieldClassName, children, ...rest },
  ref,
) {
  return (
    <FieldShell label={label} hint={hint} error={error} required={required} className={fieldClassName}>
      {({ id, describedBy, invalid }) => (
        <div className="relative">
          <select
            ref={ref}
            id={id}
            required={required}
            aria-invalid={invalid || undefined}
            aria-describedby={describedBy}
            className={cn(CONTROL, HEIGHT, 'appearance-none pr-10', invalid && INVALID, className)}
            {...rest}
          >
            {children}
          </select>
          <ChevronDown
            className="pointer-events-none absolute right-3.5 top-1/2 size-4 -translate-y-1/2 text-muted"
            aria-hidden="true"
          />
        </div>
      )}
    </FieldShell>
  )
})

export interface TextareaProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'id'> {
  label: ReactNode
  hint?: ReactNode
  error?: string | null
  fieldClassName?: string
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, hint, error, required, className, fieldClassName, ...rest },
  ref,
) {
  return (
    <FieldShell label={label} hint={hint} error={error} required={required} className={fieldClassName}>
      {({ id, describedBy, invalid }) => (
        <textarea
          ref={ref}
          id={id}
          required={required}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          className={cn(CONTROL, 'min-h-32 resize-y py-3 leading-relaxed', invalid && INVALID, className)}
          {...rest}
        />
      )}
    </FieldShell>
  )
})

/** Read-only key/value row used across detail + pipeline panels. */
export function KeyValue({ label, value }: { label: ReactNode; value: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-border/70 py-2.5 last:border-0">
      <dt className="text-xs font-medium text-muted">{label}</dt>
      <dd className="text-right text-sm font-medium text-ink">{value}</dd>
    </div>
  )
}

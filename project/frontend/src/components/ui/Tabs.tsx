import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

export interface TabItem {
  id: string
  label: ReactNode
  badge?: ReactNode
}

/**
 * Underlined tab bar. Keyboard-operable (roving tabindex + arrow keys),
 * which is what makes it usable without a mouse.
 */
export function Tabs({
  items,
  active,
  onChange,
  className,
}: {
  items: TabItem[]
  active: string
  onChange: (id: string) => void
  className?: string
}) {
  const move = (delta: number) => {
    const index = items.findIndex((item) => item.id === active)
    const next = items[(index + delta + items.length) % items.length]
    if (next) onChange(next.id)
  }

  return (
    <div
      role="tablist"
      className={cn(
        'flex gap-1 overflow-x-auto border-b border-border -mx-4 px-4 sm:mx-0 sm:px-0',
        className,
      )}
    >
      {items.map((item) => {
        const selected = item.id === active
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(item.id)}
            onKeyDown={(event) => {
              if (event.key === 'ArrowRight') {
                event.preventDefault()
                move(1)
              } else if (event.key === 'ArrowLeft') {
                event.preventDefault()
                move(-1)
              }
            }}
            className={cn(
              'relative -mb-px flex shrink-0 items-center gap-2 whitespace-nowrap px-3 py-3 text-sm font-medium',
              'transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/30 focus-visible:ring-offset-0',
              selected ? 'text-ink' : 'text-muted hover:text-ink',
            )}
          >
            {item.label}
            {item.badge}
            <span
              aria-hidden="true"
              className={cn(
                'absolute inset-x-0 bottom-0 h-0.5 rounded-t',
                selected ? 'bg-ink' : 'bg-transparent',
              )}
            />
          </button>
        )
      })}
    </div>
  )
}

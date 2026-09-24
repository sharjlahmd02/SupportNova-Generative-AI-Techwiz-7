import type { ReactNode, TdHTMLAttributes, ThHTMLAttributes } from 'react'
import { cn } from '../../lib/cn'

/**
 * Tables scroll horizontally on small screens instead of clipping (design.md §10.4 rule 8).
 * Head stays visible on long lists.
 */
export function Table({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className="w-full overflow-x-auto">
      <table className={cn('w-full border-collapse text-sm', className)}>{children}</table>
    </div>
  )
}

export function THead({ children }: { children: ReactNode }) {
  return <thead className="sticky top-0 z-0 bg-canvas/90 backdrop-blur">{children}</thead>
}

export function TBody({ children }: { children: ReactNode }) {
  return <tbody className="divide-y divide-border">{children}</tbody>
}

export function Th({ className, children, ...rest }: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      scope="col"
      className={cn(
        'px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-muted',
        className,
      )}
      {...rest}
    >
      {children}
    </th>
  )
}

export function Td({ className, children, ...rest }: TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td className={cn('px-3 py-2.5 align-middle text-ink-soft', className)} {...rest}>
      {children}
    </td>
  )
}

export function Tr({ className, children }: { className?: string; children: ReactNode }) {
  return <tr className={cn('transition-colors hover:bg-canvas', className)}>{children}</tr>
}

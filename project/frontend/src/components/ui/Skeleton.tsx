import { cn } from '../../lib/cn'

/** Single shimmer block. Shape it like the real content it replaces. */
export function Skeleton({ className, ...rest }: { className?: string } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden="true"
      className={cn('animate-pulse rounded-md bg-border/70', className)}
      {...rest}
    />
  )
}

export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn('space-y-2', className)} aria-hidden="true">
      {Array.from({ length: lines }).map((_, index) => (
        <Skeleton key={index} className={cn('h-3.5', index === lines - 1 ? 'w-2/3' : 'w-full')} />
      ))}
    </div>
  )
}

/** Table-shaped placeholder — keeps the layout identical to the loaded state. */
export function SkeletonTable({ rows = 5, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-3" aria-hidden="true">
      <Skeleton className="h-4 w-1/4" />
      <div className="space-y-2">
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div key={rowIndex} className="flex gap-3">
            {Array.from({ length: cols }).map((__, colIndex) => (
              <Skeleton key={colIndex} className="h-8 flex-1" />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

/** Full-card loading block used where a Card would sit. */
export function SkeletonCard({ lines = 4 }: { lines?: number }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4 sm:p-5" aria-hidden="true">
      <Skeleton className="h-4 w-40" />
      <Skeleton className="mt-4 h-7 w-20" />
      <SkeletonText lines={lines} className="mt-4" />
    </div>
  )
}

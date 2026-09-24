/**
 * Tiny class joiner — accepts anything so `cond && 'x'` and `title && 'mt-0.5'`
 * compose inline; only non-empty strings are kept.
 */
export type ClassValue = string | number | boolean | null | undefined

export function cn(...parts: ClassValue[]): string {
  return parts.filter((part): part is string => typeof part === 'string' && part !== '').join(' ')
}

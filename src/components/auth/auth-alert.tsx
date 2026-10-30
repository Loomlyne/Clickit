import { AlertCircle, CheckCircle2 } from 'lucide-react'

import { cn } from '@/lib/utils'

/**
 * Inline form feedback. Error = role="alert" (announced at once), success =
 * role="status". Field radius (8px) for a single line, card radius (12px) for
 * the success block that carries two lines.
 */
export function AuthAlert({
  variant,
  children,
  className,
}: {
  variant: 'error' | 'success'
  children: React.ReactNode
  className?: string
}) {
  const isError = variant === 'error'
  return (
    <div
      role={isError ? 'alert' : 'status'}
      className={cn(
        'flex items-start gap-2 border px-4 py-2 text-sm',
        isError
          ? 'rounded-lg border-destructive/35 bg-destructive/12 text-[var(--color-brand-red-safe)]'
          : 'rounded-xl border-[var(--color-brand-green-safe)]/35 bg-[var(--color-brand-green-safe)]/12 p-4 text-[var(--color-brand-green-safe)]',
        className
      )}
    >
      <span className="flex h-5 shrink-0 items-center">
        {isError ? (
          <AlertCircle className="size-4" aria-hidden />
        ) : (
          <CheckCircle2 className="size-4" aria-hidden />
        )}
      </span>
      <div className="min-w-0">{children}</div>
    </div>
  )
}

/**
 * Unboxed note for pending and success states (UI-SPEC 5.4): a 16px icon and
 * a line of text, no border or fill. Pass the lucide icon element as `icon`.
 */
export function StatusLine({
  icon,
  children,
  className,
}: {
  icon: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex items-start gap-2 text-sm text-[var(--text-dim)]',
        className
      )}
    >
      <span
        aria-hidden
        className="flex h-5 shrink-0 items-center [&_svg]:size-4"
      >
        {icon}
      </span>
      <div className="min-w-0">{children}</div>
    </div>
  )
}

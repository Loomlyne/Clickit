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
        'flex items-start gap-2.5 border px-3.5 py-3 text-sm',
        isError
          ? 'rounded-lg border-destructive/35 bg-destructive/12 text-[var(--color-brand-red-safe)]'
          : 'rounded-xl border-[var(--color-brand-green-safe)]/35 bg-[var(--color-brand-green-safe)]/12 p-4 text-[var(--color-brand-green-safe)]',
        className
      )}
    >
      {isError ? (
        <AlertCircle className="mt-0.5 size-[18px] shrink-0" aria-hidden />
      ) : (
        <CheckCircle2 className="mt-0.5 size-[18px] shrink-0" aria-hidden />
      )}
      <div className="min-w-0">{children}</div>
    </div>
  )
}

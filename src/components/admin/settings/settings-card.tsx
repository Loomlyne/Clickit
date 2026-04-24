import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'

/**
 * Shared editorial card used for every settings section.
 * Uses the editorial design system tokens:
 *   rounded-[6px] border border-[var(--line)] bg-[var(--bg-2)] p-6 md:p-8
 */
export function SettingsCard({
  title,
  description,
  action,
  children,
  className,
}: {
  title: string
  description?: string
  action?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section
      className={cn(
        'rounded-[6px] border border-[var(--line)] bg-[var(--bg-2)] p-6 md:p-8',
        className
      )}
    >
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-white">{title}</h2>
          {description && (
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          )}
        </div>
        {action}
      </header>
      {children}
    </section>
  )
}

/**
 * Labeled form row — used inside SettingsCard for key/value inputs.
 */
export function SettingsField({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: ReactNode
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-medium uppercase tracking-[0.16em] text-white/60">
        {label}
      </span>
      {children}
      {hint && <span className="block text-xs text-muted-foreground">{hint}</span>}
    </label>
  )
}

import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'
import { adminPanelClass } from '@/components/admin/admin-shell'

/**
 * Shared admin panel used for every settings section.
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
    <section className={cn(adminPanelClass, 'p-5 md:p-6', className)}>
      <header className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-[16px] font-semibold text-[var(--text)]">
            {title}
          </h2>
          {description && (
            <p className="mt-0.5 text-[14px] text-[var(--text-dim)]">
              {description}
            </p>
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
      <span className="text-[13px] font-medium text-[var(--text-dim)]">
        {label}
      </span>
      {children}
      {hint && (
        <span className="block text-[12px] text-[var(--text-mute)]">
          {hint}
        </span>
      )}
    </label>
  )
}

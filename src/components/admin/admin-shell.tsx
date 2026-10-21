import type { ComponentProps, ReactNode } from 'react'
import { ArrowLeft } from 'lucide-react'

import { Link } from '@/i18n/navigation'
import { cn } from '@/lib/utils'

// UI System roles: card 12px, hairline border, --bg-1 surface. No inset glow.
export const adminPanelClass =
  'rounded-card border border-[var(--line)] bg-[var(--bg-1)]'

export const adminTableShellClass =
  'overflow-hidden rounded-card border border-[var(--line)] bg-[var(--bg-1)]'

export function AdminPanel({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <section className={cn(adminPanelClass, 'p-5', className)}>
      {children}
    </section>
  )
}

export function AdminTableShell({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return <div className={cn(adminTableShellClass, className)}>{children}</div>
}

export function AdminPageHeader({
  title,
  description,
  action,
  crumb,
  className,
}: {
  title: string
  description?: string
  action?: ReactNode
  crumb?: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-col gap-3 md:flex-row md:items-end md:justify-between',
        className
      )}
    >
      <div className="min-w-0">
        {crumb}
        <h1
          className={cn(
            'text-[24px] leading-8 font-semibold tracking-tight text-[var(--text)]',
            crumb && 'mt-1'
          )}
        >
          {title}
        </h1>
        {description && (
          <p className="mt-1 max-w-2xl text-[14px] leading-6 text-[var(--text-dim)]">
            {description}
          </p>
        )}
      </div>
      {action ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {action}
        </div>
      ) : null}
    </div>
  )
}

export function AdminBackLink({
  href,
  children,
  className,
}: {
  href: ComponentProps<typeof Link>['href']
  children: ReactNode
  className?: string
}) {
  return (
    <Link
      href={href}
      className={cn(
        '-ms-2 inline-flex min-h-11 items-center gap-1.5 rounded-full px-2 text-[13px] text-[var(--text-mute)] transition-colors hover:text-[var(--text)]',
        className
      )}
    >
      <ArrowLeft className="size-4 rtl:scale-x-[-1]" />
      {children}
    </Link>
  )
}

export function AdminMetricStrip({
  items,
  className,
}: {
  items: { label: string; value: ReactNode; className?: string }[]
  className?: string
}) {
  return (
    <div
      className={cn(
        adminTableShellClass,
        'grid grid-cols-2 divide-[var(--line)] md:grid-cols-4 md:divide-x',
        className
      )}
    >
      {items.map((item, i) => (
        <div
          key={item.label}
          className={cn(
            'px-5 py-4',
            i > 1 && 'border-t border-[var(--line)] md:border-t-0',
            i % 2 === 1 && 'border-s border-[var(--line)] md:border-s-0'
          )}
        >
          <p className="text-[11px] font-semibold tracking-[0.12em] text-[var(--text-mute)] uppercase">
            {item.label}
          </p>
          <p
            className={cn(
              'mt-1 text-[24px] leading-8 font-semibold tracking-tight text-[var(--text)]',
              item.className
            )}
          >
            {item.value}
          </p>
        </div>
      ))}
    </div>
  )
}

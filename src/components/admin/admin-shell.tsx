import type { ComponentProps, ReactNode } from 'react'
import { ArrowLeft } from 'lucide-react'

import { Link } from '@/i18n/navigation'
import { cn } from '@/lib/utils'

export const adminPanelClass =
  'rounded-lg border border-white/8 bg-[var(--bg-2)] shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]'

export const adminTableShellClass =
  'overflow-hidden rounded-lg border border-white/8 bg-[var(--bg-2)] shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]'

export function AdminPanel({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <section className={cn(adminPanelClass, 'p-5 md:p-6', className)}>
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
  eyebrow,
  title,
  description,
  action,
  className,
}: {
  eyebrow?: string
  title: string
  description?: string
  action?: ReactNode
  className?: string
}) {
  return (
    <AdminPanel className={cn('p-6 md:p-8', className)}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          {eyebrow && (
            <p className="text-muted-foreground text-xs tracking-[0.24em] uppercase">
              {eyebrow}
            </p>
          )}
          <h1
            className={cn(
              'text-foreground font-semibold tracking-tight',
              eyebrow ? 'mt-3 text-3xl' : 'text-2xl'
            )}
          >
            {title}
          </h1>
          {description && (
            <p className="text-muted-foreground mt-2 max-w-2xl text-sm leading-6 md:text-base">
              {description}
            </p>
          )}
        </div>
        {action}
      </div>
    </AdminPanel>
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
        'text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 rounded-[8px] border border-white/8 bg-white/[0.03] px-4 py-2 text-sm transition-colors hover:border-white/16 hover:bg-white/[0.05]',
        className
      )}
    >
      <ArrowLeft className="size-4 rtl:scale-x-[-1]" />
      {children}
    </Link>
  )
}

export function AdminToolbar({
  eyebrow,
  title,
  description,
  actions,
  children,
  className,
}: {
  eyebrow?: string
  title: string
  description?: string
  actions?: ReactNode
  children?: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-col gap-4 border-b border-white/8 pb-5 lg:flex-row lg:items-end lg:justify-between',
        className
      )}
    >
      <div>
        {eyebrow && (
          <p className="text-muted-foreground text-xs tracking-[0.18em] uppercase">
            {eyebrow}
          </p>
        )}
        <h2 className="text-foreground mt-2 text-xl font-semibold tracking-tight">
          {title}
        </h2>
        {description && (
          <p className="text-muted-foreground mt-2 max-w-2xl text-sm leading-6">
            {description}
          </p>
        )}
      </div>
      {(actions || children) && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          {children}
          {actions}
        </div>
      )}
    </div>
  )
}

export function AdminMetric({
  label,
  value,
  className,
}: {
  label: string
  value: ReactNode
  className?: string
}) {
  return (
    <div className={cn(adminPanelClass, 'p-4', className)}>
      <p className="text-muted-foreground text-xs tracking-[0.16em] uppercase">
        {label}
      </p>
      <p className="text-foreground mt-3 text-3xl font-semibold tracking-tight">
        {value}
      </p>
    </div>
  )
}

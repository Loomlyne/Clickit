'use client'

import { useTranslations } from 'next-intl'
import { adminPanelClass } from '@/components/admin/admin-shell'

export function EmptyState({
  heading,
  body,
  action,
}: {
  heading: string
  body: string
  action?: React.ReactNode
}) {
  const t = useTranslations('admin.emptyState')
  return (
    <div className={`${adminPanelClass} flex flex-col items-center justify-center px-6 py-16 text-center`}>
      <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
        {t('defaultLabel')}
      </p>
      <h3 className="mt-4 text-[22px] font-semibold tracking-tight text-foreground">
        {heading}
      </h3>
      <p className="mt-3 max-w-md text-[15px] leading-7 text-muted-foreground">
        {body}
      </p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  )
}

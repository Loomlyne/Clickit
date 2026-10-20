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
    <div
      className={`${adminPanelClass} flex flex-col items-center justify-center px-6 py-14 text-center`}
    >
      <p className="text-[11px] font-semibold tracking-[0.12em] text-[var(--text-mute)] uppercase">
        {t('defaultLabel')}
      </p>
      <h3 className="text-foreground mt-3 text-[20px] font-semibold tracking-tight">
        {heading}
      </h3>
      <p className="mt-2 max-w-md text-[14px] leading-6 text-[var(--text-dim)]">
        {body}
      </p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  )
}

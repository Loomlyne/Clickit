'use client'

import { useLocale } from 'next-intl'

export function EmptyState({
  heading,
  body,
  action,
}: {
  heading: string
  body: string
  action?: React.ReactNode
}) {
  const locale = useLocale()
  const isArabic = locale === 'ar'
  return (
    <div className="flex flex-col items-center justify-center rounded-[28px] border border-white/10 bg-white/[0.04] px-6 py-16 text-center shadow-[0_24px_80px_rgba(0,0,0,0.24)]">
      <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
        {isArabic ? 'حالة فارغة' : 'Empty State'}
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

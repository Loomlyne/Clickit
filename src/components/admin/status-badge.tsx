'use client'

import { useTranslations } from 'next-intl'

// Status colour is purposeful and sparse: brand-safe tints plus a dot, 12px.
const statusConfig: Record<
  string,
  { key: string; className: string; dot: string }
> = {
  'now-streaming': {
    key: 'statusNowStreaming',
    className: 'bg-brand-green-safe/12 text-brand-green-safe',
    dot: 'bg-brand-green-safe',
  },
  'coming-soon': {
    key: 'statusComingSoon',
    className: 'bg-brand-orange-safe/12 text-brand-orange-safe',
    dot: 'bg-brand-orange-safe',
  },
  draft: {
    key: 'statusDraft',
    className: 'bg-[var(--bg-3)] text-[var(--text-dim)]',
    dot: 'bg-[var(--text-mute)]',
  },
  published: {
    key: 'statusPublished',
    className: 'bg-brand-blue-safe/12 text-brand-blue-safe',
    dot: 'bg-brand-blue-safe',
  },
  archived: {
    key: 'statusArchived',
    className: 'bg-brand-red-safe/12 text-brand-red-safe',
    dot: 'bg-brand-red-safe',
  },
}

export function StatusBadge({ status }: { status: string }) {
  const t = useTranslations('admin.statusBadge')
  const config = statusConfig[status] ?? statusConfig['draft']
  const label = t(config.key as never)
  return (
    <span
      data-slot="badge"
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] leading-4 font-medium whitespace-nowrap ${config.className}`}
      aria-label={t('ariaLabel', { label })}
    >
      <span className={`size-1.5 rounded-full ${config.dot}`} aria-hidden />
      {label}
    </span>
  )
}

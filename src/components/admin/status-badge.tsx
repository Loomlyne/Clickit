'use client'

import { useTranslations } from 'next-intl'
import { Badge } from '@/components/ui/badge'

const statusConfig: Record<string, { key: string; className: string }> = {
  'now-streaming': {
    key: 'statusNowStreaming',
    className:
      'border-emerald-400/25 bg-emerald-500/14 text-emerald-200 hover:bg-emerald-500/14',
  },
  'coming-soon': {
    key: 'statusComingSoon',
    className:
      'border-amber-400/25 bg-amber-500/14 text-amber-100 hover:bg-amber-500/14',
  },
  draft: {
    key: 'statusDraft',
    className:
      'border-white/8 bg-white/[0.03] text-muted-foreground hover:bg-white/[0.04]',
  },
  published: {
    key: 'statusPublished',
    className:
      'border-sky-400/25 bg-sky-500/14 text-sky-100 hover:bg-sky-500/14',
  },
  archived: {
    key: 'statusArchived',
    className:
      'border-red-400/25 bg-red-500/14 text-red-100 hover:bg-red-500/14',
  },
}

export function StatusBadge({ status }: { status: string }) {
  const t = useTranslations('admin.statusBadge')
  const config = statusConfig[status] ?? statusConfig['draft']
  const label = t(config.key as never)
  return (
    <Badge
      className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${config.className}`}
      aria-label={t('ariaLabel', { label })}
    >
      {label}
    </Badge>
  )
}

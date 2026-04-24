'use client'

import { useLocale } from 'next-intl'
import { Badge } from '@/components/ui/badge'

const statusConfig: Record<string, { en: string; ar: string; className: string }> = {
  'now-streaming': { en: 'Now Streaming', ar: 'يُبثّ الآن', className: 'border-emerald-400/25 bg-emerald-500/14 text-emerald-200 hover:bg-emerald-500/14' },
  'coming-soon': { en: 'Coming Soon', ar: 'قريباً', className: 'border-amber-400/25 bg-amber-500/14 text-amber-100 hover:bg-amber-500/14' },
  'draft': { en: 'Draft', ar: 'مسودة', className: 'border-[var(--line)] bg-[var(--bg-2)] text-muted-foreground hover:bg-[var(--bg-2)]' },
  'published': { en: 'Published', ar: 'منشور', className: 'border-sky-400/25 bg-sky-500/14 text-sky-100 hover:bg-sky-500/14' },
  'archived': { en: 'Archived', ar: 'مؤرشف', className: 'border-red-400/25 bg-red-500/14 text-red-100 hover:bg-red-500/14' },
}

export function StatusBadge({ status }: { status: string }) {
  const locale = useLocale()
  const isArabic = locale === 'ar'
  const config = statusConfig[status] ?? statusConfig['draft']
  const label = isArabic ? config.ar : config.en
  return (
    <Badge className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${config.className}`} aria-label={`${isArabic ? 'الحالة' : 'Status'}: ${label}`}>
      {label}
    </Badge>
  )
}

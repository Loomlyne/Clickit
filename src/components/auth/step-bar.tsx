import { useTranslations } from 'next-intl'

import { cn } from '@/lib/utils'

/**
 * Step progress (UI-SPEC 5.6): decorative segments plus one screen-reader
 * sentence. Used by welcome (2 segments) and MFA enrol (2 segments).
 */
export function StepBar({
  current,
  total,
  className,
}: {
  current: number
  total: number
  className?: string
}) {
  const t = useTranslations('auth')
  return (
    <div className={cn('mb-6 flex gap-2', className)}>
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          aria-hidden
          className={cn(
            'h-1 flex-1 rounded-full',
            i < current ? 'bg-[var(--primary)]' : 'bg-[var(--bg-3)]'
          )}
        />
      ))}
      <span className="sr-only">{t('stepOf', { current, total })}</span>
    </div>
  )
}

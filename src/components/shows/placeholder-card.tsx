import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'

export function PlaceholderCard() {
  const t = useTranslations('show')
  return (
    <div
      aria-hidden="true"
      className={cn(
        'flex-shrink-0 overflow-hidden rounded-[24px] bg-[var(--bg-2)] opacity-50'
      )}
      style={{ width: 'var(--landscape-w)', aspectRatio: '16 / 9' }}
    >
      <div className="flex h-full w-full items-center justify-center">
        <span className="mono">{t('comingSoonBadge')}</span>
      </div>
    </div>
  )
}

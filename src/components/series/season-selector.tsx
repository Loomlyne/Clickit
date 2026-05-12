'use client'

import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import type { ViewSeason } from '@/lib/queries'

interface SeasonSelectorProps {
  seasons: ViewSeason[]
  activeSeason: string // season.id
  onSeasonChange: (seasonId: string) => void
}

export function SeasonSelector({
  seasons,
  activeSeason,
  onSeasonChange,
}: SeasonSelectorProps) {
  const activeSeasonNumber = seasons.find((s) => s.id === activeSeason)?.seasonNumber ?? 1
  const t = useTranslations('show')

  return (
    <div>
      <div className="flex gap-0 border-b border-[var(--line)]">
        {seasons.map((season) => (
          <button
            key={season.id}
            onClick={() => onSeasonChange(season.id)}
            className={cn(
              'px-4 py-2.5 font-[family-name:var(--font-mono)] text-[12px] uppercase tracking-[0.1em] transition-colors cursor-pointer border-b-2 -mb-px',
              activeSeason === season.id
                ? 'text-white border-[var(--primary)]'
                : 'text-[var(--text-mute)] hover:text-white border-transparent'
            )}
          >
            {t('seasonShortLabel', { number: season.seasonNumber })}
          </button>
        ))}
      </div>
      <span className="sr-only" aria-live="polite">
        {t('showingSeason', { number: activeSeasonNumber })}
      </span>
    </div>
  )
}

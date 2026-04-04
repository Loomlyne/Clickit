'use client'

import { cn } from '@/lib/utils'
import type { ViewSeason } from '@/lib/queries'

interface SeasonSelectorProps {
  seasons: ViewSeason[]
  activeSeason: string // season.id
  onSeasonChange: (seasonId: string) => void
  brandColorHex?: string
}

export function SeasonSelector({
  seasons,
  activeSeason,
  onSeasonChange,
  brandColorHex = '#2C3569',
}: SeasonSelectorProps) {
  const activeSeasonNumber = seasons.find((s) => s.id === activeSeason)?.seasonNumber ?? 1

  return (
    <div>
      <div className="flex gap-2 flex-wrap">
        {seasons.map((season) => (
          <button
            key={season.id}
            onClick={() => onSeasonChange(season.id)}
            className={cn(
              'px-4 py-1.5 rounded-full text-sm font-medium transition-all cursor-pointer border',
              activeSeason === season.id
                ? 'text-black border-transparent'
                : 'bg-white/5 text-white/60 hover:text-white border-white/10'
            )}
            style={
              activeSeason === season.id
                ? { background: brandColorHex, borderColor: 'transparent' }
                : {}
            }
          >
            S{season.seasonNumber}
          </button>
        ))}
      </div>
      <span className="sr-only" aria-live="polite">
        Showing Season {activeSeasonNumber}
      </span>
    </div>
  )
}

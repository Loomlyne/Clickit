'use client'

import { useMemo } from 'react'

import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { Season } from '@/lib/mock-data'

interface SeasonSelectorProps {
  seasons: Season[]
  activeSeason: string // season.id
  onSeasonChange: (seasonId: string) => void
}

export function SeasonSelector({
  seasons,
  activeSeason,
  onSeasonChange,
}: SeasonSelectorProps) {
  const activeSeasonNumber = useMemo(() => {
    const season = seasons.find((s) => s.id === activeSeason)
    return season?.seasonNumber ?? 1
  }, [seasons, activeSeason])

  if (seasons.length <= 5) {
    // Tabs variant for 1-5 seasons
    return (
      <div>
        <Tabs value={activeSeason} onValueChange={onSeasonChange}>
          <TabsList className="bg-surface-2 border-border">
            {seasons.map((season) => (
              <TabsTrigger
                key={season.id}
                value={season.id}
                className="text-muted-foreground data-[state=active]:text-foreground data-[state=active]:bg-surface-3"
              >
                Season {season.seasonNumber} ({season.episodeCount})
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <span className="sr-only" aria-live="polite">
          Showing Season {activeSeasonNumber}
        </span>
      </div>
    )
  }

  // Select variant for 6+ seasons
  return (
    <div>
      <Select value={activeSeason} onValueChange={onSeasonChange}>
        <SelectTrigger className="w-[200px] bg-surface-2 border-border">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {seasons.map((season) => (
            <SelectItem key={season.id} value={season.id}>
              Season {season.seasonNumber} ({season.episodeCount} episodes)
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <span className="sr-only" aria-live="polite">
        Showing Season {activeSeasonNumber}
      </span>
    </div>
  )
}

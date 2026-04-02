'use client'

import { useState } from 'react'

import { SeasonSelector } from '@/components/series/season-selector'
import { EpisodeList } from '@/components/series/episode-list'
import { MetadataCard } from './metadata-card'
import type { Season, Episode, Show } from '@/lib/mock-data'

interface SeriesDetailContentProps {
  seasons: Season[]
  episodesBySeason: Record<string, Episode[]>
  showBrandColor: Show['brandColor']
  show: Show
}

export function SeriesDetailContent({
  seasons,
  episodesBySeason,
  showBrandColor,
  show,
}: SeriesDetailContentProps) {
  const [activeSeasonId, setActiveSeasonId] = useState(seasons[0]?.id ?? '')
  const currentEpisodes = episodesBySeason[activeSeasonId] ?? []

  return (
    <div className="flex flex-col gap-8 lg:flex-row">
      <div className="min-w-0 flex-1">
        {seasons.length > 0 && (
          <SeasonSelector
            seasons={seasons}
            activeSeason={activeSeasonId}
            onSeasonChange={setActiveSeasonId}
          />
        )}
        <div className="mt-6">
          <EpisodeList
            episodes={currentEpisodes}
            showBrandColor={showBrandColor}
          />
        </div>
      </div>
      <div className="hidden w-72 shrink-0 lg:block">
        <MetadataCard show={show} />
      </div>
    </div>
  )
}

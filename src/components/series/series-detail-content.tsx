'use client'

import { useState } from 'react'

import { SeasonSelector } from '@/components/series/season-selector'
import { EpisodeList } from '@/components/series/episode-list'
import type { Season, Episode, Show } from '@/lib/mock-data'

interface SeriesDetailContentProps {
  seasons: Season[]
  episodesBySeason: Record<string, Episode[]>
  showBrandColor: Show['brandColor']
}

export function SeriesDetailContent({
  seasons,
  episodesBySeason,
  showBrandColor,
}: SeriesDetailContentProps) {
  const [activeSeasonId, setActiveSeasonId] = useState(seasons[0]?.id ?? '')
  const currentEpisodes = episodesBySeason[activeSeasonId] ?? []

  return (
    <>
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
    </>
  )
}

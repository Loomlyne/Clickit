'use client'

import { useState } from 'react'

import { SeasonSelector } from '@/components/series/season-selector'
import { EpisodeList } from '@/components/series/episode-list'
import { MetadataCard } from './metadata-card'
import type { ViewSeason, ViewEpisode, ViewShow } from '@/lib/queries'

interface SeriesDetailContentProps {
  seasons: ViewSeason[]
  episodesBySeason: Record<string, ViewEpisode[]>
  showBrandColor: ViewShow['brandColor']
  show: ViewShow
  progressMap?: Record<string, { progressPercent: number; completed: boolean }>
}

export function SeriesDetailContent({
  seasons,
  episodesBySeason,
  showBrandColor,
  show,
  progressMap,
}: SeriesDetailContentProps) {
  const [activeSeasonId, setActiveSeasonId] = useState(seasons[0]?.id ?? '')
  const currentEpisodes = episodesBySeason[activeSeasonId] ?? []
  return (
    <div className="flex flex-col gap-8 lg:flex-row">
      <div className="min-w-0 flex-1 rounded-[14px] border border-[var(--line)] bg-[var(--bg-1)] p-6">
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
            progressMap={progressMap}
          />
        </div>
      </div>
      <div className="hidden w-72 shrink-0 lg:block">
        <MetadataCard show={show} />
      </div>
    </div>
  )
}

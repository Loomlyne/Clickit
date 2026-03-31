'use client'

import { useState } from 'react'
import { motion } from 'motion/react'

import { Badge } from '@/components/ui/badge'
import { YouTubePlayer } from '@/components/watch/youtube-player'
import { EpisodeBreadcrumb } from '@/components/watch/episode-breadcrumb'
import { EpisodeNav } from '@/components/watch/episode-nav'
import { SeasonSelector } from '@/components/series/season-selector'
import { EpisodeList } from '@/components/series/episode-list'
import {
  type Episode,
  type Show,
  type Season,
  brandColorBgMap,
} from '@/lib/mock-data'

interface WatchPageContentProps {
  episode: Episode
  show: Show
  season: Season
  seasons: Season[]
  episodesBySeason: Record<string, Episode[]>
  prevEpisode: Episode | null
  nextEpisode: Episode | null
}

const CINEMA_EASE = [0.16, 1, 0.3, 1] as const

export function WatchPageContent({
  episode,
  show,
  season,
  seasons,
  episodesBySeason,
  prevEpisode,
  nextEpisode,
}: WatchPageContentProps) {
  const [activeSeasonId, setActiveSeasonId] = useState(season.id)
  const currentEpisodes = episodesBySeason[activeSeasonId] ?? []

  return (
    <div className="-mt-16">
      {/* Sidebar layout: player+metadata left, episodes right */}
      <div className="flex flex-col lg:flex-row gap-0 lg:gap-6 max-w-[1400px] mx-auto">
        {/* Left column — player + metadata + nav */}
        <div className="flex-1 min-w-0">
          {/* Player */}
          <YouTubePlayer
            videoId={episode.youtubeId ?? ''}
            brandColor={brandColorBgMap[show.brandColor]}
          />

          {/* Metadata section */}
          <motion.div
            className="px-4 md:px-6 pt-4"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: CINEMA_EASE }}
          >
            <EpisodeBreadcrumb
              showTitle={show.title}
              showSlug={show.slug}
              seasonNumber={season.seasonNumber}
              episodeNumber={episode.episodeNumber}
            />

            <h1 className="mt-3 text-[28px] font-bold leading-[1.2] text-foreground">
              {episode.title}
            </h1>

            <Badge variant="secondary" className="mt-2 text-sm text-muted-foreground">
              {episode.duration} min
            </Badge>

            <p className="mt-3 text-base leading-relaxed text-muted-foreground line-clamp-3 md:line-clamp-none">
              {episode.description}
            </p>
          </motion.div>

          {/* Episode Navigation */}
          <div className="px-4 md:px-6 pt-6">
            <EpisodeNav prev={prevEpisode} next={nextEpisode} />
          </div>
        </div>

        {/* Right column — episode sidebar */}
        <aside
          aria-label="Episode selector"
          className="w-full lg:w-[380px] shrink-0 lg:max-h-[calc(100vh-80px)] lg:overflow-y-auto border-t lg:border-t-0 lg:border-l border-border bg-card/50 pt-4 lg:pt-16 pb-8 px-4"
        >
          <h2 className="text-lg font-bold text-foreground mb-3">Episodes</h2>
          <div className="sticky top-0 z-10 bg-card/50 pb-3">
            <SeasonSelector
              seasons={seasons}
              activeSeason={activeSeasonId}
              onSeasonChange={setActiveSeasonId}
            />
          </div>
          <div className="mt-2">
            <EpisodeList
              episodes={currentEpisodes}
              showBrandColor={show.brandColor}
              currentEpisodeId={episode.id}
            />
          </div>
        </aside>
      </div>
    </div>
  )
}

'use client'

import { useState } from 'react'
import { motion } from 'motion/react'

import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
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
    <div>
      {/* Player section */}
      <div className="w-full max-w-[1400px] mx-auto -mt-16">
        <YouTubePlayer
          videoId={episode.youtubeId ?? ''}
          brandColor={brandColorBgMap[show.brandColor]}
        />
      </div>

      {/* Metadata section */}
      <motion.div
        className="max-w-5xl mx-auto px-6 md:px-12 pt-4"
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

      {/* Episode Navigation -- per D-05, D-06 */}
      <div className="max-w-5xl mx-auto px-6 md:px-12 pt-6">
        <EpisodeNav prev={prevEpisode} next={nextEpisode} />
      </div>

      {/* Separator */}
      <div className="max-w-5xl mx-auto px-6 md:px-12 pt-8">
        <Separator className="bg-border" />
      </div>

      {/* Episode Quick-Selector -- per D-07 */}
      <section
        aria-label="Episode selector"
        className="max-w-5xl mx-auto px-6 md:px-12 pt-8 pb-16"
      >
        <h2 className="text-xl font-bold text-foreground mb-4">Episodes</h2>
        <SeasonSelector
          seasons={seasons}
          activeSeason={activeSeasonId}
          onSeasonChange={setActiveSeasonId}
        />
        <div className="mt-6">
          <EpisodeList
            episodes={currentEpisodes}
            showBrandColor={show.brandColor}
            currentEpisodeId={episode.id}
          />
        </div>
      </section>
    </div>
  )
}

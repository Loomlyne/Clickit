'use client'

import { motion } from 'motion/react'

import { Badge } from '@/components/ui/badge'
import { YouTubePlayer } from '@/components/watch/youtube-player'
import { EpisodeBreadcrumb } from '@/components/watch/episode-breadcrumb'
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
}: WatchPageContentProps) {
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
    </div>
  )
}

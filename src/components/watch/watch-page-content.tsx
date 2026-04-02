'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion } from 'motion/react'
import { ArrowLeft } from 'lucide-react'

import { cn } from '@/lib/utils'
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
import { CINEMA_EASE } from '@/lib/cinema'

interface WatchPageContentProps {
  episode: Episode
  show: Show
  season: Season
  seasons: Season[]
  episodesBySeason: Record<string, Episode[]>
  prevEpisode: Episode | null
  nextEpisode: Episode | null
}

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

  const [barVisible, setBarVisible] = useState(true)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleMouseMove = useCallback(() => {
    setBarVisible(true)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setBarVisible(false), 3000)
  }, [])

  // Start the auto-hide timer on mount
  useEffect(() => {
    timerRef.current = setTimeout(() => setBarVisible(false), 3000)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [])

  return (
    <div className="-mt-16">
      {/* Sidebar layout: player+metadata left, episodes right */}
      <div className="flex flex-col lg:flex-row gap-0 lg:gap-6 max-w-[1400px] mx-auto">
        {/* Left column — player + metadata + nav */}
        <div className="flex-1 min-w-0">
          {/* Player */}
          <div onMouseMove={handleMouseMove} className="relative">
            {/* Auto-hiding top bar */}
            <div className={cn(
              'absolute top-0 left-0 right-0 z-20 flex items-center gap-3 px-4 py-3',
              'bg-gradient-to-b from-black/80 to-transparent transition-opacity duration-300',
              barVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
            )}>
              <Link href={`/series/${show.slug}`} className="text-white/70 transition-colors hover:text-white">
                <ArrowLeft className="size-5" />
              </Link>
              <span className="truncate text-sm text-white/80">
                {show.title} &bull; S{season.seasonNumber}E{episode.episodeNumber}
              </span>
            </div>

            <YouTubePlayer
              videoId={episode.youtubeId ?? ''}
              brandColor={brandColorBgMap[show.brandColor]}
            />
          </div>

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
          className="w-full lg:w-[380px] shrink-0 border-t lg:border-t-0 lg:border-l border-border bg-card/50 pt-4 lg:pt-16 pb-8 px-4"
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

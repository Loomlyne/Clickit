'use client'

import { useState } from 'react'
import Link from 'next/link'
import { motion } from 'motion/react'
import { ArrowLeft } from 'lucide-react'
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


  return (
    <div className="bg-black text-white -mt-16 pt-16 relative z-30">
      {/* Back bar — static, always visible */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-white/[0.06]">
        <Link
          href={`/series/${show.slug}`}
          className="flex items-center gap-2 text-white/80 hover:text-white transition-colors"
        >
          <ArrowLeft className="size-5" />
          <span className="text-sm font-medium">
            {show.title} &bull; S{season.seasonNumber}E{episode.episodeNumber}
          </span>
        </Link>
      </div>

      {/* Main layout: player+metadata left/top, sidebar right/bottom */}
      <div className="flex flex-col lg:flex-row min-h-[calc(100vh-7rem)]">
        {/* Player + metadata (left on desktop, top on mobile) */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Player — capped height so metadata is visible without scrolling */}
          <div className="w-full bg-black" style={{ aspectRatio: '16/9', maxHeight: '50vh' }}>
            <YouTubePlayer
              videoId={episode.youtubeId ?? ''}
              brandColor={brandColorBgMap[show.brandColor]}
            />
          </div>

          {/* Metadata below player */}
          <motion.div
            className="px-6 py-6"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: CINEMA_EASE }}
          >
            {/* Breadcrumb */}
            <EpisodeBreadcrumb
              showTitle={show.title}
              showSlug={show.slug}
              seasonNumber={season.seasonNumber}
              episodeNumber={episode.episodeNumber}
            />

            {/* Episode title — display font (Playfair Display) */}
            <h1
              className="font-display font-bold text-white mt-3 leading-tight"
              style={{ fontSize: 'clamp(1.5rem, 3vw, 2rem)' }}
            >
              {episode.title}
            </h1>

            {/* Duration badge */}
            {episode.duration && (
              <div className="mt-2">
                <span className="text-xs bg-white/10 text-white/60 px-2.5 py-1 rounded-full">
                  {episode.duration} min
                </span>
              </div>
            )}

            {/* Description */}
            <p className="mt-3 text-white/60 text-sm leading-relaxed line-clamp-3 md:line-clamp-none max-w-2xl">
              {episode.description}
            </p>

            {/* Prev/Next nav */}
            <div className="mt-6">
              <EpisodeNav prev={prevEpisode} next={nextEpisode} />
            </div>
          </motion.div>
        </div>

        {/* Sidebar — episode list (right on desktop, bottom on mobile) */}
        <aside
          aria-label="Episode selector"
          className="w-full lg:w-[360px] lg:flex-shrink-0 border-t border-white/[0.06] lg:border-t-0 lg:border-l lg:border-white/[0.06] bg-black"
        >
          <div className="lg:sticky lg:top-0 lg:h-screen lg:overflow-y-auto scrollbar-hide">
            <div className="px-4 py-4 border-b border-white/[0.06]">
              <p className="text-white/40 text-xs uppercase tracking-wider mb-1">{show.title}</p>
              <p className="text-white font-semibold">Episodes</p>
              <div className="mt-3">
                <SeasonSelector
                  seasons={seasons}
                  activeSeason={activeSeasonId}
                  onSeasonChange={setActiveSeasonId}
                />
              </div>
            </div>
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

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
      {/* Player — full width, edge to edge */}
      <div className="w-full aspect-video max-h-[65vh] bg-black">
        <YouTubePlayer
          videoId={episode.youtubeId ?? ''}
          brandColor={brandColorBgMap[show.brandColor]}
        />
      </div>

      {/* Below player: metadata + sidebar */}
      <div className="flex flex-col lg:flex-row">
        {/* Metadata */}
        <div className="flex-1 min-w-0">
          <motion.div
            className="px-6 py-5"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: CINEMA_EASE }}
          >
            {/* Back link + breadcrumb row */}
            <div className="flex items-center gap-4 mb-4">
              <Link
                href={`/series/${show.slug}`}
                className="flex items-center gap-1.5 text-white/50 hover:text-white transition-colors text-sm"
              >
                <ArrowLeft className="size-4" />
                <span>{show.title}</span>
              </Link>
              <span className="text-white/20">|</span>
              <EpisodeBreadcrumb
                showTitle={show.title}
                showSlug={show.slug}
                seasonNumber={season.seasonNumber}
                episodeNumber={episode.episodeNumber}
              />
            </div>

            {/* Episode title */}
            <h1
              className="font-display font-bold text-white leading-tight"
              style={{ fontSize: 'clamp(1.25rem, 2.5vw, 1.75rem)' }}
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
            <p className="mt-3 text-white/60 text-sm leading-relaxed max-w-2xl">
              {episode.description}
            </p>

            {/* Prev/Next nav */}
            <div className="mt-5">
              <EpisodeNav prev={prevEpisode} next={nextEpisode} />
            </div>
          </motion.div>
        </div>

        {/* Sidebar — episode list */}
        <aside
          aria-label="Episode selector"
          className="w-full lg:w-[340px] lg:flex-shrink-0 border-t border-white/[0.06] lg:border-t-0 lg:border-l lg:border-white/[0.06] bg-black"
        >
          <div className="lg:sticky lg:top-16 lg:max-h-[calc(100vh-4rem)] lg:overflow-y-auto scrollbar-hide">
            <div className="px-4 py-3 border-b border-white/[0.06]">
              <p className="text-white/40 text-xs uppercase tracking-wider mb-1">{show.title}</p>
              <p className="text-white font-semibold text-sm">Episodes</p>
              <div className="mt-2">
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

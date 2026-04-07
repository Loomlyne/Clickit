'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion } from 'motion/react'
import { ArrowLeft } from 'lucide-react'
import { YouTubePlayer } from '@/components/watch/youtube-player'
import { AutoplayOverlay } from '@/components/watch/autoplay-overlay'
import { EpisodeBreadcrumb } from '@/components/watch/episode-breadcrumb'
import { EpisodeNav } from '@/components/watch/episode-nav'
import { SeasonSelector } from '@/components/series/season-selector'
import { EpisodeList } from '@/components/series/episode-list'
import { useProgressTracker } from '@/hooks/use-progress-tracker'
import type { ViewEpisode, ViewShow, ViewSeason } from '@/lib/queries'
import { BRAND_COLOR_BG } from '@/lib/brand-colors'
import { CINEMA_EASE } from '@/lib/cinema'

interface WatchPageContentProps {
  episode: ViewEpisode
  show: ViewShow
  season: ViewSeason
  seasons: ViewSeason[]
  episodesBySeason: Record<string, ViewEpisode[]>
  prevEpisode: ViewEpisode | null
  nextEpisode: ViewEpisode | null
  initialProgressSeconds?: number
  userId?: string | null
}

export function WatchPageContent({
  episode,
  show,
  season,
  seasons,
  episodesBySeason,
  prevEpisode,
  nextEpisode,
  initialProgressSeconds,
  userId,
}: WatchPageContentProps) {
  const [activeSeasonId, setActiveSeasonId] = useState(season.id)
  const currentEpisodes = episodesBySeason[activeSeasonId] ?? []
  const [playerInstance, setPlayerInstance] = useState<YT.Player | null>(null)
  const [showAutoplay, setShowAutoplay] = useState(false)
  const router = useRouter()

  // Progress tracking
  const { forceFlush } = useProgressTracker(playerInstance, episode.id, userId ?? null)

  return (
    <div className="-mt-24 md:-mt-28 bg-black pt-24 md:pt-28 text-white">
      {/* Side-by-side: player+metadata left, episodes right */}
      <div className="flex flex-col lg:flex-row">
        {/* Left column: player + metadata */}
        <div className="w-full flex-1 min-w-0">
          {/* Player */}
          <div className="relative w-full aspect-video bg-[#111]">
            <YouTubePlayer
              videoId={episode.youtubeId ?? ''}
              brandColor={BRAND_COLOR_BG[show.brandColor]}
              onReady={(player) => {
                setPlayerInstance(player)
                if (initialProgressSeconds && initialProgressSeconds > 0) {
                  player.seekTo(initialProgressSeconds, true)
                }
              }}
              onStateChange={(state) => {
                // YT.PlayerState.ENDED === 0
                if (state === 0) {
                  forceFlush()
                  if (nextEpisode) {
                    setShowAutoplay(true)
                  }
                }
                // YT.PlayerState.PAUSED === 2
                if (state === 2) {
                  forceFlush()
                }
              }}
            />
            {showAutoplay && nextEpisode && (
              <AutoplayOverlay
                nextEpisode={{
                  id: nextEpisode.id,
                  title: nextEpisode.title,
                  seasonNumber: seasons.find(s => s.id === nextEpisode.seasonId)?.seasonNumber ?? 1,
                  episodeNumber: nextEpisode.episodeNumber,
                }}
                onPlayNow={() => {
                  setShowAutoplay(false)
                  router.push(`/watch/${nextEpisode.id}`)
                }}
                onCancel={() => setShowAutoplay(false)}
              />
            )}
          </div>

          {/* Metadata below player */}
          <motion.div
            className="px-4 py-5"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: CINEMA_EASE }}
          >
            <div className="flex items-center gap-3 mb-3">
              <Link
                href={`/series/${show.slug}`}
                className="flex items-center gap-1.5 text-white/50 hover:text-white transition-colors text-sm"
              >
                <ArrowLeft className="size-4" />
                {show.title}
              </Link>
              <span className="text-white/20">|</span>
              <EpisodeBreadcrumb
                seasonNumber={season.seasonNumber}
                episodeNumber={episode.episodeNumber}
              />
            </div>

            <h1
              className="font-display font-semibold leading-tight text-white"
              style={{ fontSize: 'clamp(1.25rem, 2.5vw, 1.75rem)' }}
            >
              {episode.title}
            </h1>

            {episode.duration && (
              <span className="inline-block mt-2 text-xs bg-white/10 text-white/60 px-2.5 py-1 rounded-full">
                {episode.duration} min
              </span>
            )}

            <p className="mt-3 text-white/60 text-sm leading-relaxed max-w-2xl">
              {episode.description}
            </p>

            <div className="mt-5">
              <EpisodeNav prev={prevEpisode} next={nextEpisode} />
            </div>
          </motion.div>
        </div>

        {/* Right column: episode list — sits beside the player on desktop */}
        <aside
          aria-label="Episode selector"
          className="w-full px-[14px] lg:flex-shrink-0 border-t border-white/[0.06] lg:border-t-0 lg:border-l lg:border-white/[0.06] bg-black"
        >
          <div className="lg:sticky lg:top-16 lg:h-[calc(100dvh-4rem)] lg:overflow-y-auto scrollbar-hide">
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

'use client'

import { useState, useRef, useEffect } from 'react'
import { useLocale } from 'next-intl'
import { Link, useRouter } from '@/i18n/navigation'
import { YouTubePlayer } from '@/components/watch/youtube-player'
import { AutoplayOverlay } from '@/components/watch/autoplay-overlay'
import { useProgressTracker } from '@/hooks/use-progress-tracker'
import type { ViewEpisode, ViewShow, ViewSeason } from '@/lib/queries'
import { BRAND_COLOR_BG } from '@/lib/brand-colors'

interface WatchShellProps {
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

export function WatchShell({
  episode,
  show,
  season,
  seasons,
  episodesBySeason,
  prevEpisode,
  nextEpisode,
  initialProgressSeconds,
  userId,
}: WatchShellProps) {
  // currentEpisode in state so Plan 02's handleEpisodeSwitch can update it
  // without remounting the iframe (videoId prop stays frozen at episode.youtubeId)
  const [currentEpisode, setCurrentEpisode] = useState(episode)
  const [playerInstance, setPlayerInstance] = useState<YT.Player | null>(null)
  const [showAutoplay, setShowAutoplay] = useState(false)

  // playerRef seeded here — Plan 02 calls playerRef.current.loadVideoById()
  const playerRef = useRef<YT.Player | null>(null)

  const router = useRouter()
  const locale = useLocale()
  const isArabic = locale === 'ar'

  // episodeId must be currentEpisode.id (state), NOT episode.id (initial prop).
  // Plan 02 updates currentEpisode before calling loadVideoById so the hook's
  // save closure targets the new episode immediately.
  const { forceFlush } = useProgressTracker(playerInstance, currentEpisode.id, userId ?? null)

  // Bounce back to series if episode has no video
  useEffect(() => {
    if (!episode.youtubeId) {
      router.replace(`/series/${show.slug}`)
    }
  }, [episode.youtubeId, router, show.slug])

  if (!episode.youtubeId) return null

  return (
    <div
      className="fixed inset-0 h-dvh min-h-svh overflow-hidden bg-black"
      data-lenis-prevent
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {/* Player — absolute inset-0 overrides YouTubePlayer's aspect-video container */}
      <div className="absolute inset-0">
        <YouTubePlayer
          videoId={episode.youtubeId}
          brandColor={BRAND_COLOR_BG[show.brandColor]}
          onReady={(player) => {
            playerRef.current = player
            setPlayerInstance(player)
            if (initialProgressSeconds && initialProgressSeconds > 0) {
              player.seekTo(initialProgressSeconds, true)
            }
          }}
          onStateChange={(state) => {
            if (state === 0) {
              // Video ended
              forceFlush()
              if (nextEpisode) setShowAutoplay(true)
            }
            if (state === 2) {
              // Paused
              forceFlush()
            }
          }}
        />
      </div>

      {/* Minimal back link — Phase 33 replaces this with full auto-hide chrome */}
      <div className="absolute top-4 left-4 z-10">
        <Link
          href={`/series/${show.slug}`}
          className="text-sm text-white/50 hover:text-white transition-colors duration-150"
          aria-label={isArabic ? 'العودة للمسلسل' : 'Back to show'}
        >
          ← Back
        </Link>
      </div>

      {/* AutoplayOverlay — sibling of player div, not child (cross-origin pointer events) */}
      {showAutoplay && nextEpisode && (
        <AutoplayOverlay
          nextEpisode={{
            id: nextEpisode.id,
            title: nextEpisode.title,
            seasonNumber: seasons.find((s) => s.id === nextEpisode.seasonId)?.seasonNumber ?? 1,
            episodeNumber: nextEpisode.episodeNumber,
          }}
          onPlayNow={() => {
            setShowAutoplay(false)
            // Plan 02 replaces this router.push with handleEpisodeSwitch (loadVideoById)
            router.push(`/watch/${nextEpisode.id}`)
          }}
          onCancel={() => setShowAutoplay(false)}
        />
      )}
    </div>
  )
}

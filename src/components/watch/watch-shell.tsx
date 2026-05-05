'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
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
  // currentNextEpisode is derived state — recalculated on every episode switch
  // so autoplay always queues the episode after the *current* one, not the initial prop.
  const [currentNextEpisode, setCurrentNextEpisode] = useState(nextEpisode)
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

  // Derive the episode that follows `current` by scanning episodesBySeason.
  // Cross-season: if current is the last episode in its season, returns the
  // first episode of the next season (by seasonNumber). Returns null at series end.
  function findNextEpisode(current: ViewEpisode): ViewEpisode | null {
    const seasonEps = episodesBySeason[current.seasonId] ?? []
    const idx = seasonEps.findIndex((e) => e.id === current.id)
    if (idx !== -1 && idx < seasonEps.length - 1) return seasonEps[idx + 1]
    const currentSeason = seasons.find((s) => s.id === current.seasonId)
    if (!currentSeason) return null
    const nextSeason = seasons.find((s) => s.seasonNumber === currentSeason.seasonNumber + 1)
    if (!nextSeason) return null
    const nextSeasonEps = episodesBySeason[nextSeason.id] ?? []
    return nextSeasonEps[0] ?? null
  }

  function handleEpisodeSwitch(newEpisode: ViewEpisode) {
    if (!playerRef.current || !newEpisode.youtubeId) return
    // 1. Save outgoing position — closure still has old episodeId
    forceFlush()
    // 2. Dismiss overlay if it's visible (e.g. user picks a different episode
    //    while the 8-second countdown is running — Phase 33 episode drawer path)
    setShowAutoplay(false)
    // 3. Update episode state and recalculate the next pointer
    setCurrentEpisode(newEpisode)
    setCurrentNextEpisode(findNextEpisode(newEpisode))
    // 4. Swap video without remounting the iframe
    playerRef.current.loadVideoById({
      videoId: newEpisode.youtubeId,
      startSeconds: 0,
    })
    // 5. Sync URL without triggering a Next.js re-render
    window.history.replaceState(null, '', `/${locale}/watch/${newEpisode.id}`)
  }

  // Stable callback for AutoplayOverlay — useCallback prevents the overlay's
  // useEffect([onPlayNow]) from restarting the 8-second countdown on each render.
  const handlePlayNow = useCallback(() => {
    setShowAutoplay(false)
    if (currentNextEpisode) handleEpisodeSwitch(currentNextEpisode)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentNextEpisode])

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
              if (currentNextEpisode) setShowAutoplay(true)
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
      {showAutoplay && currentNextEpisode && (
        <AutoplayOverlay
          nextEpisode={{
            id: currentNextEpisode.id,
            title: currentNextEpisode.title,
            seasonNumber: seasons.find((s) => s.id === currentNextEpisode.seasonId)?.seasonNumber ?? 1,
            episodeNumber: currentNextEpisode.episodeNumber,
          }}
          onPlayNow={handlePlayNow}
          onCancel={() => setShowAutoplay(false)}
        />
      )}
    </div>
  )
}

'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useLocale } from 'next-intl'
import { Link, useRouter } from '@/i18n/navigation'
import { YouTubePlayer } from '@/components/watch/youtube-player'
import { AutoplayOverlay } from '@/components/watch/autoplay-overlay'
import { useProgressTracker } from '@/hooks/use-progress-tracker'
import { useIdleTimer } from '@/hooks/use-idle-timer'
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
  initialSaved?: boolean      // default false — used by useWatchlist in Plan 02
  initialLiked?: boolean      // default false — used by useLikes in Plan 02
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
  initialSaved = false,
  initialLiked = false,
}: WatchShellProps) {
  // currentEpisode in state so Plan 02's handleEpisodeSwitch can update it
  // without remounting the iframe (videoId prop stays frozen at episode.youtubeId)
  const [currentEpisode, setCurrentEpisode] = useState(episode)
  // currentNextEpisode is derived state — recalculated on every episode switch
  // so autoplay always queues the episode after the *current* one, not the initial prop.
  const [currentNextEpisode, setCurrentNextEpisode] = useState(nextEpisode)
  // currentPrevEpisode mirrors currentNextEpisode — recalculated on every episode switch
  // so the prev arrow always targets the episode before the *current* one.
  const [currentPrevEpisode, setCurrentPrevEpisode] = useState(prevEpisode)
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

  const { isIdle, resetTimer } = useIdleTimer(3000)
  // used in Plan 02 — overlay JSX added in 33-02-PLAN.md
  // currentPrevEpisode and chromeClass consumed by overlay JSX in Plan 02
  const chromeClass = isIdle ? 'opacity-0 pointer-events-none' : 'opacity-100 pointer-events-auto'

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

  // Mirror of findNextEpisode — inverse direction. Cross-season: if current is
  // the first episode in its season, returns the last episode of the previous season.
  function findPrevEpisode(current: ViewEpisode): ViewEpisode | null {
    const seasonEps = episodesBySeason[current.seasonId] ?? []
    const idx = seasonEps.findIndex((e) => e.id === current.id)
    if (idx > 0) return seasonEps[idx - 1]
    const currentSeason = seasons.find((s) => s.id === current.seasonId)
    if (!currentSeason) return null
    const prevSeason = seasons.find((s) => s.seasonNumber === currentSeason.seasonNumber - 1)
    if (!prevSeason) return null
    const prevSeasonEps = episodesBySeason[prevSeason.id] ?? []
    return prevSeasonEps[prevSeasonEps.length - 1] ?? null
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
    setCurrentPrevEpisode(findPrevEpisode(newEpisode))
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
      onPointerMove={resetTimer}
      onPointerDown={resetTimer}
      onTouchStart={resetTimer}
      onKeyDown={resetTimer}
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
              // Paused — flush progress and force chrome visible
              forceFlush()
              resetTimer()
            }
            if (state === 1) {
              // Playing/resumed — restart idle countdown
              resetTimer()
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

'use client'

import dynamic from 'next/dynamic'
import { useState, useRef, useEffect, useCallback } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Link, useRouter } from '@/i18n/navigation'
import { AutoplayOverlay } from '@/components/watch/autoplay-overlay'
import {
  EpisodeTray,
  WATCH_TRAY_SNAP_POINTS,
  type WatchTraySnapPoint,
} from '@/components/watch/episode-tray'
import { Tr } from '@/components/i18n/tr'
import { useProgressTracker } from '@/hooks/use-progress-tracker'
import { useIdleTimer } from '@/hooks/use-idle-timer'
import { useWatchlist } from '@/hooks/use-watchlist'
import { useLikes } from '@/hooks/use-likes'
import { toast } from 'sonner'
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Bookmark,
  Heart,
  Share2,
} from 'lucide-react'
import type { ViewEpisode, ViewShow, ViewSeason } from '@/lib/queries'
import { BRAND_COLOR_BG } from '@/lib/brand-colors'

const YouTubePlayer = dynamic(
  () =>
    import('@/components/watch/youtube-player').then((m) => ({
      default: m.YouTubePlayer,
    })),
  {
    ssr: false,
    loading: () => (
      <div
        className="flex h-full min-h-0 w-full flex-1 items-center justify-center bg-black"
        aria-hidden
      />
    ),
  }
)

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
  initialSaved?: boolean // default false, used by useWatchlist in Plan 02
  initialLiked?: boolean // default false, used by useLikes in Plan 02
  progressMap?: Record<string, { progressPercent: number; completed: boolean }>
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
  progressMap = {},
}: WatchShellProps) {
  // currentEpisode in state so Plan 02's handleEpisodeSwitch can update it
  // without remounting the iframe (videoId prop stays frozen at episode.youtubeId)
  const [currentEpisode, setCurrentEpisode] = useState(episode)
  // currentNextEpisode is derived state, recalculated on every episode switch
  // so autoplay always queues the episode after the *current* one, not the initial prop.
  const [currentNextEpisode, setCurrentNextEpisode] = useState(nextEpisode)
  // currentPrevEpisode mirrors currentNextEpisode, recalculated on every episode switch
  // so the prev arrow always targets the episode before the *current* one.
  const [currentPrevEpisode, setCurrentPrevEpisode] = useState(prevEpisode)
  const [playerInstance, setPlayerInstance] = useState<YT.Player | null>(null)
  const [showAutoplay, setShowAutoplay] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [activeSeasonId, setActiveSeasonId] = useState(episode.seasonId)
  const [traySnapPoint, setTraySnapPoint] = useState<WatchTraySnapPoint>(
    WATCH_TRAY_SNAP_POINTS[0]
  )

  // playerRef seeded here, Plan 02 calls playerRef.current.loadVideoById()
  const playerRef = useRef<YT.Player | null>(null)

  const router = useRouter()
  const locale = useLocale()
  const t = useTranslations('watch')

  // episodeId must be currentEpisode.id (state), NOT episode.id (initial prop).
  // Plan 02 updates currentEpisode before calling loadVideoById so the hook's
  // save closure targets the new episode immediately.
  const { forceFlush } = useProgressTracker(
    playerInstance,
    currentEpisode.id,
    userId ?? null
  )

  const { isIdle, resetTimer } = useIdleTimer(3000, {
    initialIdle: false,
    startOnMount: true,
    disabled: isPaused,
  })
  const chromeClass = isIdle
    ? 'opacity-0 pointer-events-none'
    : 'opacity-100 pointer-events-auto'

  const { isInList, toggle: toggleWatchlist } = useWatchlist(
    show.id,
    initialSaved,
    userId ?? null
  )
  const { isLiked: isShowLiked, toggle: toggleLike } = useLikes(
    show.id,
    initialLiked,
    userId ?? null
  )

  function handleShare() {
    if (typeof navigator !== 'undefined' && navigator.share) {
      navigator.share({ url: window.location.href }).catch(() => {
        /* user dismissed */
      })
    } else {
      navigator.clipboard.writeText(window.location.href).then(() => {
        toast.success(t('linkCopied'))
      })
    }
  }

  const currentSeason = seasons.find((s) => s.id === currentEpisode.seasonId)
  const seasonNumber = currentSeason?.seasonNumber ?? season.seasonNumber

  // Derive the episode that follows `current` by scanning episodesBySeason.
  // Cross-season: if current is the last episode in its season, returns the
  // first episode of the next season (by seasonNumber). Returns null at series end.
  function findNextEpisode(current: ViewEpisode): ViewEpisode | null {
    const seasonEps = episodesBySeason[current.seasonId] ?? []
    const idx = seasonEps.findIndex((e) => e.id === current.id)
    if (idx !== -1 && idx < seasonEps.length - 1) return seasonEps[idx + 1]
    const currentSeason = seasons.find((s) => s.id === current.seasonId)
    if (!currentSeason) return null
    const nextSeason = seasons.find(
      (s) => s.seasonNumber === currentSeason.seasonNumber + 1
    )
    if (!nextSeason) return null
    const nextSeasonEps = episodesBySeason[nextSeason.id] ?? []
    return nextSeasonEps[0] ?? null
  }

  // Mirror of findNextEpisode, inverse direction. Cross-season: if current is
  // the first episode in its season, returns the last episode of the previous season.
  function findPrevEpisode(current: ViewEpisode): ViewEpisode | null {
    const seasonEps = episodesBySeason[current.seasonId] ?? []
    const idx = seasonEps.findIndex((e) => e.id === current.id)
    if (idx > 0) return seasonEps[idx - 1]
    const currentSeason = seasons.find((s) => s.id === current.seasonId)
    if (!currentSeason) return null
    const prevSeason = seasons.find(
      (s) => s.seasonNumber === currentSeason.seasonNumber - 1
    )
    if (!prevSeason) return null
    const prevSeasonEps = episodesBySeason[prevSeason.id] ?? []
    return prevSeasonEps[prevSeasonEps.length - 1] ?? null
  }

  function handleEpisodeSwitch(newEpisode: ViewEpisode) {
    if (!playerRef.current || !newEpisode.youtubeId) return
    // 1. Save outgoing position, closure still has old episodeId
    forceFlush()
    // 2. Dismiss overlay if it's visible (e.g. user picks a different episode
    //    while the 8-second countdown is running, Phase 33 episode drawer path)
    setShowAutoplay(false)
    // 3. Update episode state and recalculate the next pointer
    setCurrentEpisode(newEpisode)
    setCurrentNextEpisode(findNextEpisode(newEpisode))
    setCurrentPrevEpisode(findPrevEpisode(newEpisode))
    setActiveSeasonId(newEpisode.seasonId)
    setIsPaused(false)
    // 4. Swap video without remounting the iframe
    playerRef.current.loadVideoById({
      videoId: newEpisode.youtubeId,
      startSeconds: 0,
    })
    // 5. Sync URL without triggering a Next.js re-render
    window.history.replaceState(
      window.history.state ?? null,
      '',
      `/${locale}/watch/${newEpisode.id}`
    )
  }

  // Stable callback for AutoplayOverlay, useCallback prevents the overlay's
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

  const playerBottom = WATCH_TRAY_SNAP_POINTS[0]

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
      {/* Player */}
      <div
        className="absolute top-0 right-0 left-0 transition-[bottom] duration-300 ease-out [&>div]:aspect-auto [&>div]:h-full [&>div]:min-h-0"
        style={{ bottom: playerBottom }}
      >
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
              setIsPaused(false)
              forceFlush()
              if (currentNextEpisode) setShowAutoplay(true)
            }
            if (state === 2) {
              // Paused, flush progress and force chrome visible
              setIsPaused(true)
              forceFlush()
              resetTimer()
            }
            if (state === 1) {
              // Playing/resumed, restart idle countdown
              setIsPaused(false)
              resetTimer()
            }
          }}
        />
      </div>

      {/* Auto-hide chrome, top overlay strip */}
      <div
        className={`fixed top-0 right-0 left-0 z-20 flex items-center justify-between border-b border-white/10 bg-zinc-950/90 px-4 [padding-top:max(1rem,env(safe-area-inset-top))] pb-8 shadow-[0_8px_32px_-8px_rgba(0,0,0,0.65)] backdrop-blur-md transition-opacity duration-200 ease-in-out ${chromeClass}`}
        inert={isIdle}
      >
        {/* Left: back to show */}
        <Link
          href={`/series/${show.slug}`}
          className="flex items-center gap-1.5 text-sm text-white/70 transition-colors duration-150 hover:text-white"
          aria-label={t('backToShow', { title: show.title })}
          tabIndex={isIdle ? -1 : 0}
        >
          <ArrowLeft className="size-5" />
          {show.title}
        </Link>

        {/* Center: episode title + S/E badge */}
        <div className="flex flex-col items-center gap-0.5">
          <span className="text-sm leading-none font-medium text-white">
            {currentEpisode.title}
          </span>
          <span className="font-mono text-xs leading-none text-white/50">
            <Tr
              k="seasonEpisodeShort"
              values={{
                season: seasonNumber,
                episode: currentEpisode.episodeNumber,
              }}
            />
          </span>
        </div>

        {/* Right: action buttons */}
        <div className="flex items-center gap-3">
          <button
            onClick={toggleWatchlist}
            className="flex size-8 items-center justify-center text-white/70 transition-colors duration-150 hover:text-white"
            aria-label={
              isInList ? t('removeFromWatchlist') : t('addToWatchlist')
            }
            aria-pressed={isInList}
            tabIndex={isIdle ? -1 : 0}
          >
            <Bookmark
              className={`size-5 ${isInList ? 'fill-white text-white' : ''}`}
            />
          </button>
          <button
            onClick={toggleLike}
            className="flex size-8 items-center justify-center text-white/70 transition-colors duration-150 hover:text-white"
            aria-label={isShowLiked ? t('unlikeShow') : t('likeShow')}
            aria-pressed={isShowLiked}
            tabIndex={isIdle ? -1 : 0}
          >
            <Heart
              className={`size-5 ${isShowLiked ? 'fill-pink-400 text-pink-400' : ''}`}
            />
          </button>
          <button
            onClick={handleShare}
            className="flex size-8 items-center justify-center text-white/70 transition-colors duration-150 hover:text-white"
            aria-label={t('shareEpisode')}
            tabIndex={isIdle ? -1 : 0}
          >
            <Share2 className="size-5" />
          </button>
        </div>
      </div>

      {/* Auto-hide chrome, prev episode arrow */}
      {currentPrevEpisode && (
        <button
          onClick={() => handleEpisodeSwitch(currentPrevEpisode)}
          className={`fixed top-1/2 left-3 z-20 flex size-10 -translate-y-1/2 items-center justify-center rounded-[10px] bg-black/40 backdrop-blur-sm transition-opacity duration-200 ease-in-out ${chromeClass}`}
          aria-label={t('previousEpisode')}
          tabIndex={isIdle ? -1 : 0}
        >
          <ChevronLeft className="size-5 text-white" />
        </button>
      )}

      {/* Auto-hide chrome, next episode arrow */}
      {currentNextEpisode && (
        <button
          onClick={() => handleEpisodeSwitch(currentNextEpisode)}
          className={`fixed top-1/2 right-3 z-20 flex size-10 -translate-y-1/2 items-center justify-center rounded-[10px] bg-black/40 backdrop-blur-sm transition-opacity duration-200 ease-in-out ${chromeClass}`}
          aria-label={t('nextEpisode')}
          tabIndex={isIdle ? -1 : 0}
        >
          <ChevronRight className="size-5 text-white" />
        </button>
      )}

      {/* AutoplayOverlay, sibling of player div, not child (cross-origin pointer events) */}
      {showAutoplay && currentNextEpisode && (
        <AutoplayOverlay
          nextEpisode={{
            id: currentNextEpisode.id,
            title: currentNextEpisode.title,
            seasonNumber:
              seasons.find((s) => s.id === currentNextEpisode.seasonId)
                ?.seasonNumber ?? 1,
            episodeNumber: currentNextEpisode.episodeNumber,
          }}
          onPlayNow={handlePlayNow}
          onCancel={() => setShowAutoplay(false)}
        />
      )}

      <EpisodeTray
        show={show}
        seasons={seasons}
        episodesBySeason={episodesBySeason}
        currentEpisode={currentEpisode}
        activeSeasonId={activeSeasonId}
        activeSnapPoint={traySnapPoint}
        progressMap={progressMap}
        onSeasonChange={setActiveSeasonId}
        onSnapPointChange={setTraySnapPoint}
        onEpisodeSelect={handleEpisodeSwitch}
      />
    </div>
  )
}

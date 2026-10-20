'use client'

import dynamic from 'next/dynamic'
import { useEffect, useRef, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react'

import { Link, useRouter } from '@/i18n/navigation'
import { Button } from '@/components/ui/button'
import { Tr } from '@/components/i18n/tr'
import { EpisodeList } from '@/components/watch/episode-list'
import { WatchActions, useWatchAnnouncer } from '@/components/watch/watch-actions'
import { useProgressTracker } from '@/hooks/use-progress-tracker'
import { formatClock, isolate } from '@/lib/i18n-format'
import {
  nextPositions,
  resumeSecondsFor,
  seedPositions,
  type PositionEvent,
  type PositionsMap,
} from '@/lib/watch/resume'
import type { ViewEpisode, ViewShow, ViewSeason } from '@/lib/queries'

// Stacked watch page (D-08, UI-SPEC section 3): a solid top bar, the black
// 16:9 stage, the control bar, then the scrolling episode section. Nothing is
// ever drawn over the YouTube iframe (YouTube required minimum functionality).

const YouTubePlayer = dynamic(
  () =>
    import('@/components/watch/youtube-player').then((m) => ({
      default: m.YouTubePlayer,
    })),
  {
    ssr: false,
    loading: () => <div className="size-full bg-black" aria-hidden />,
  }
)

type ServerProgress = {
  progressPercent: number
  completed: boolean
  progressSeconds: number
  durationSeconds: number
}

interface WatchShellProps {
  episode: ViewEpisode
  show: ViewShow
  season: ViewSeason
  seasons: ViewSeason[]
  episodesBySeason: Record<string, ViewEpisode[]>
  /** Unused: the shell derives previous / next from the current episode. */
  prevEpisode?: ViewEpisode | null
  /** Unused: the shell derives previous / next from the current episode. */
  nextEpisode?: ViewEpisode | null
  /** @deprecated The start comes from `progressMap` (resume rules). */
  initialProgressSeconds?: number
  userId?: string | null
  initialSaved?: boolean
  initialLiked?: boolean
  progressMap?: Record<string, ServerProgress>
}

/** A playable episode is live and has a video (the series page rule). */
function canPlay(episode: ViewEpisode | null): episode is ViewEpisode {
  return Boolean(episode && episode.isLive && episode.youtubeId)
}

/** The player's clock, or NaN when the player cannot answer. */
function readClock(player: YT.Player): { seconds: number; duration: number } {
  try {
    return { seconds: player.getCurrentTime(), duration: player.getDuration() }
  } catch {
    return { seconds: Number.NaN, duration: Number.NaN }
  }
}

/** The YouTube id the player is on, or null. */
function videoIdOf(player: YT.Player | null): string | null {
  try {
    return player?.getVideoData?.()?.video_id || null
  } catch {
    return null
  }
}

export function WatchShell({
  episode,
  show,
  season,
  seasons,
  episodesBySeason,
  userId,
  initialSaved = false,
  initialLiked = false,
  progressMap = {},
}: WatchShellProps) {
  const router = useRouter()
  const locale = useLocale()
  const t = useTranslations('watch')
  const tPlayer = useTranslations('player')
  const tCommon = useTranslations('common')
  const { announce, node: announcerNode } = useWatchAnnouncer()

  // Current episode in state: a switch swaps the video in the same player
  // (loadVideoById) instead of remounting the iframe.
  const [currentEpisode, setCurrentEpisode] = useState(episode)
  const [activeSeasonId, setActiveSeasonId] = useState(episode.seasonId)
  const [playerInstance, setPlayerInstance] = useState<YT.Player | null>(null)
  const playerRef = useRef<YT.Player | null>(null)
  const boxRef = useRef<HTMLDivElement>(null)

  // Per-episode positions for this session (A -> B -> A resumes each one where
  // it was). The ref is read by handlers; the state drives the list's bars.
  const [positions, setPositions] = useState<PositionsMap>(() => seedPositions(progressMap))
  const positionsRef = useRef(positions)
  function applyPositions(event: PositionEvent) {
    positionsRef.current = nextPositions(positionsRef.current, event)
    setPositions(positionsRef.current)
  }

  // Where the current episode started; > 0 shows "Resumed at m:ss".
  const [resumeFrom, setResumeFrom] = useState(() => resumeSecondsFor(positions[episode.id]))
  // The video the player is created with (first mount only; later switches load).
  const [mountVideo] = useState(() => ({ videoId: episode.youtubeId, startSeconds: resumeFrom }))

  const { forceFlush, resetBaseline } = useProgressTracker(
    playerInstance,
    currentEpisode.id,
    userId ?? null,
    currentEpisode.youtubeId ?? undefined
  )

  // The tracker zeroes its baseline whenever the episode or player changes;
  // put the resume point back after that (declared after the tracker, so it
  // runs after the tracker's own effect).
  useEffect(() => {
    resetBaseline(resumeFrom)
  }, [currentEpisode.id, playerInstance, resumeFrom, resetBaseline])

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

  // Mirror of findNextEpisode, inverse direction. Cross-season: if current is
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

  const prevTarget = findPrevEpisode(currentEpisode)
  const nextTarget = findNextEpisode(currentEpisode)
  const prevPlayable = canPlay(prevTarget) ? prevTarget : null
  const nextPlayable = canPlay(nextTarget) ? nextTarget : null

  // Switch order (D-10): 1. outgoing clock into the map, 2. save it, 3. set
  // the new episode, 4. tracker baseline at the new start, 5. load at the
  // episode's own saved position.
  function handleEpisodeSwitch(target: ViewEpisode) {
    if (!target.youtubeId) return
    const player = playerRef.current

    if (player && videoIdOf(player) === currentEpisode.youtubeId) {
      const clock = readClock(player)
      applyPositions({
        type: 'leave',
        episodeId: currentEpisode.id,
        seconds: clock.seconds,
        duration: clock.duration,
      })
    }

    forceFlush()

    const startSeconds = resumeSecondsFor(positionsRef.current[target.id])
    setCurrentEpisode(target)
    setActiveSeasonId(target.seasonId)
    setResumeFrom(startSeconds)

    resetBaseline(startSeconds)

    player?.loadVideoById({ videoId: target.youtubeId, startSeconds })

    // Sync URL without triggering a Next.js re-render
    window.history.replaceState(
      window.history.state ?? null,
      '',
      `/${locale}/watch/${target.id}`
    )
  }

  // "Start from the beginning": back to 0:00, the tracker saves from 0, and
  // focus goes to the stage box so it is not lost when the button unmounts.
  function handleStartOver() {
    const player = playerRef.current
    if (!player) return
    player.seekTo(0, true)
    applyPositions({ type: 'restart', episodeId: currentEpisode.id })
    resetBaseline(0)
    setResumeFrom(0)
    boxRef.current?.focus()
  }

  function handleStateChange(state: number) {
    if (state === 0) {
      // Ended: completed, back at 0:00 for the next visit.
      applyPositions({ type: 'ended', episodeId: currentEpisode.id })
      forceFlush()
    }
    if (state === 2) forceFlush()
  }

  // Bounce back to series if episode has no video
  useEffect(() => {
    if (!episode.youtubeId) {
      router.replace(`/series/${show.slug}`)
    }
  }, [episode.youtubeId, router, show.slug])

  if (!episode.youtubeId || !mountVideo.videoId) return null

  const currentSeason = seasons.find((s) => s.id === currentEpisode.seasonId)
  const seasonNumber = currentSeason?.seasonNumber ?? season.seasonNumber
  const seasonEpisodes = episodesBySeason[currentEpisode.seasonId] ?? []
  const seasonEpisodeLong = tPlayer('seasonEpisodeLong', {
    season: seasonNumber,
    episode: currentEpisode.episodeNumber,
  })
  const episodeOfTotal = tPlayer('episodeOfTotal', {
    current: currentEpisode.episodeNumber,
    total: Math.max(seasonEpisodes.length, currentEpisode.episodeNumber),
  })

  const actionProps = {
    showId: show.id,
    showTitle: show.title,
    userId: userId ?? null,
    initialSaved,
    initialLiked,
    announce,
  }

  return (
    <div
      className="flex h-dvh flex-col overflow-hidden bg-[var(--bg-0)] pb-[env(safe-area-inset-bottom)] [@media(orientation:landscape)_and_(max-height:500px)]:h-auto [@media(orientation:landscape)_and_(max-height:500px)]:min-h-dvh [@media(orientation:landscape)_and_(max-height:500px)]:overflow-visible"
    >
      {announcerNode}

      {/* Top bar: static, solid, in normal flow (never over the stage). */}
      <header className="flex-none border-b border-[var(--line)] bg-[var(--bg-0)] pt-[env(safe-area-inset-top)]">
        <div className="flex h-14 items-center gap-2 px-2 md:h-[72px] md:gap-4 md:px-5">
          <Link
            href={`/series/${show.slug}`}
            aria-label={t('backToShow', { title: isolate(show.title) })}
            className="flex size-11 shrink-0 items-center justify-center rounded-full text-[var(--text-dim)] transition-colors duration-150 hover:text-[var(--text)] focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-0)] focus-visible:outline-none md:hidden"
          >
            <ArrowLeft className="size-5 rtl:rotate-180" aria-hidden />
          </Link>
          <Link
            href={`/series/${show.slug}`}
            className="inline-flex min-h-11 max-w-[30%] shrink-0 items-center gap-2 rounded-full text-sm text-[var(--text-dim)] transition-colors duration-150 hover:text-[var(--text)] focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-0)] focus-visible:outline-none max-md:hidden"
          >
            <ArrowLeft className="size-5 shrink-0 rtl:rotate-180" aria-hidden />
            <bdi className="truncate">{show.title}</bdi>
          </Link>

          <div className="min-w-0 flex-1 text-center">
            <h1 className="truncate text-sm font-bold text-[var(--text)]">
              <bdi>{currentEpisode.title}</bdi>
            </h1>
            <p className="truncate text-[11px] text-[var(--text-mute)]">
              <span className="md:hidden">
                <Tr
                  k="seasonEpisodeShort"
                  values={{ season: seasonNumber, episode: currentEpisode.episodeNumber }}
                />
              </span>
              <span className="max-md:hidden">{seasonEpisodeLong}</span>
            </p>
          </div>

          {/* Share on phones; Watchlist, Like and Share from md up. */}
          <WatchActions {...actionProps} variant="top" include={['watchlist', 'like', 'share']} />
        </div>
      </header>

      {/* Stage: black, 16:9 box centred, letterboxed when wider. */}
      <div className="relative flex flex-none justify-center bg-black h-[max(200px,min(56.25vw,calc(100dvh_-_356px_-_env(safe-area-inset-top))))] md:h-[max(200px,min(56.25vw,calc(100dvh_-_372px_-_env(safe-area-inset-top))))] [@media(orientation:landscape)_and_(max-height:500px)]:h-[calc(100dvh_-_56px_-_env(safe-area-inset-top))]!">
        <div
          ref={boxRef}
          role="region"
          aria-label={tPlayer('videoPlayerAria')}
          tabIndex={-1}
          className="relative aspect-video h-full min-h-[200px] max-w-full min-w-[200px] outline-none focus:outline-none"
        >
          <YouTubePlayer
            videoId={mountVideo.videoId}
            startSeconds={mountVideo.startSeconds}
            onReady={(player) => {
              playerRef.current = player
              setPlayerInstance(player)
            }}
            onStateChange={handleStateChange}
          />
        </div>
      </div>

      {/* Control bar under the video. */}
      <div className="flex-none h-[60px] grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-b border-[var(--line)] bg-[var(--bg-1)] px-3 py-2 md:px-5">
        <Button
          variant="outline"
          size="icon-lg"
          className="border-[var(--line)] bg-white/[0.04] md:hidden"
          disabled={!prevPlayable}
          onClick={() => prevPlayable && handleEpisodeSwitch(prevPlayable)}
          aria-label={t('previousEpisode')}
        >
          <ChevronLeft className="size-5 rtl:rotate-180" aria-hidden />
        </Button>
        <Button
          variant="outline"
          className="min-h-11 px-6 py-2 text-sm font-bold max-md:hidden"
          disabled={!prevPlayable}
          onClick={() => prevPlayable && handleEpisodeSwitch(prevPlayable)}
        >
          <ChevronLeft className="size-4 rtl:rotate-180" aria-hidden />
          {tCommon('previous')}
        </Button>

        <div className="min-w-0 text-center">
          <p className="truncate text-sm font-bold text-[var(--text)] max-md:hidden">
            <bdi>{currentEpisode.title}</bdi>
          </p>
          <StatusLine
            resumedAt={
              resumeFrom > 0
                ? tPlayer('resumedAt', { time: formatClock(resumeFrom, locale) })
                : null
            }
            freshDesktop={seasonEpisodeLong}
            freshPhone={episodeOfTotal}
            startFromBeginning={tPlayer('startFromBeginning')}
            startOver={tPlayer('startOver')}
            onStartOver={handleStartOver}
          />
        </div>

        <Button
          variant="outline"
          size="icon-lg"
          className="border-[var(--line)] bg-white/[0.04] md:hidden"
          disabled={!nextPlayable}
          onClick={() => nextPlayable && handleEpisodeSwitch(nextPlayable)}
          aria-label={t('nextEpisode')}
        >
          <ChevronRight className="size-5 rtl:rotate-180" aria-hidden />
        </Button>
        <Button
          variant="outline"
          className="min-h-11 px-6 py-2 text-sm font-bold max-md:hidden"
          disabled={!nextPlayable}
          onClick={() => nextPlayable && handleEpisodeSwitch(nextPlayable)}
        >
          {t('nextEpisode')}
          <ChevronRight className="size-4 rtl:rotate-180" aria-hidden />
        </Button>
      </div>

      {/* Episode section: the only part that scrolls. */}
      <EpisodeList
        seasons={seasons}
        episodesBySeason={episodesBySeason}
        currentEpisodeId={currentEpisode.id}
        activeSeasonId={activeSeasonId}
        onSeasonChange={setActiveSeasonId}
        onSelect={handleEpisodeSwitch}
        progressMap={positions}
        locale={locale}
        seasonRowEnd={
          <WatchActions {...actionProps} variant="season-row" include={['watchlist', 'like']} />
        }
      />
    </div>
  )
}

/**
 * The control bar's status line (UI-SPEC 3.5). Resumed: "Resumed at m:ss ·"
 * plus the start-over button; otherwise the fresh-start text. Checker flag e:
 * only the inner "Resumed at" span truncates; the element that wraps the
 * button never clips, so its 12px hit-area stretch stays whole.
 */
function StatusLine({
  resumedAt,
  freshDesktop,
  freshPhone,
  startFromBeginning,
  startOver,
  onStartOver,
}: {
  resumedAt: string | null
  freshDesktop: string
  freshPhone: string
  startFromBeginning: string
  startOver: string
  onStartOver: () => void
}) {
  if (!resumedAt) {
    return (
      <p className="truncate text-sm text-[var(--text-mute)]">
        <span className="md:hidden">{freshPhone}</span>
        <span className="max-md:hidden">{freshDesktop}</span>
      </p>
    )
  }
  return (
    <p className="flex min-w-0 items-center justify-center text-sm whitespace-nowrap text-[var(--text-mute)]">
      <span className="min-w-0 truncate">{resumedAt}</span>
      <span aria-hidden className="shrink-0 px-1">
        ·
      </span>
      <button
        type="button"
        className="relative shrink-0 text-[var(--text-dim)] underline underline-offset-4 hover:text-[var(--text)] after:absolute after:-inset-x-3 after:-inset-y-3 after:content-[''] focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:outline-none"
        onClick={onStartOver}
      >
        <span className="md:hidden">{startOver}</span>
        <span className="max-md:hidden">{startFromBeginning}</span>
      </button>
    </p>
  )
}

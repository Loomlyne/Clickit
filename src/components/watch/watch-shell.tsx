'use client'

import dynamic from 'next/dynamic'
import { useEffect, useRef, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react'

import { reportPlayerError } from '@/app/actions/player-errors'
import { Link, useRouter } from '@/i18n/navigation'
import { Button } from '@/components/ui/button'
import { Tr } from '@/components/i18n/tr'
import { EpisodeList } from '@/components/watch/episode-list'
import { PlayerErrorCard } from '@/components/watch/player-error-card'
import {
  UpNextCard,
  type UpNextEpisode,
  type UpNextState,
} from '@/components/watch/up-next-card'
import { WatchActions, useWatchAnnouncer } from '@/components/watch/watch-actions'
import { useElementVisible } from '@/hooks/use-element-visible'
import { useProgressTracker } from '@/hooks/use-progress-tracker'
import { BRAND_COLOR_HEX } from '@/lib/brand-colors'
import { formatClock, isolate } from '@/lib/i18n-format'
import {
  ENDED_MODE,
  barView,
  endedEffects,
  endedReducer,
  playerHidden,
  type EndedEvent,
  type EndedState,
} from '@/lib/watch/ended-state'
import { playerIframeHidden } from '@/lib/watch/player-dom'
import { errorCardFor } from '@/lib/watch/player-errors'
import {
  nextPositions,
  resumeSecondsFor,
  seedPositions,
  type PositionEvent,
  type PositionsMap,
} from '@/lib/watch/resume'
import type { StoredNonOkStatus } from '@/lib/watch/status-map'
import type { ViewEpisode, ViewShow, ViewSeason } from '@/lib/queries'

// Stacked watch page (D-08, UI-SPEC sections 3 and 4): a solid top bar, the
// black 16:9 stage, the control bar, then the scrolling episode section.
// Nothing is ever drawn over a visible YouTube iframe (YouTube required minimum
// functionality). The error card, the UAE card and (in 'card' mode only) the
// up-next card REPLACE the iframe: the player is stopped, then its wrapper is
// hidden. In the shipped 'bar' mode the ended video and YouTube's end screen
// stay as they are and the control bar turns into the up-next strip.

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
  userId?: string | null
  initialSaved?: boolean
  initialLiked?: boolean
  /** Saved positions for the show's episodes (getEpisodesProgress). */
  progressMap?: Record<string, ServerProgress>
  /** Stored non-ok YouTube statuses (getEpisodeYouTubeStatuses). */
  youtubeStatuses?: Record<string, StoredNonOkStatus>
}

/** A play request that waits until the player is visible (UI-SPEC 4.1). */
type PendingPlay =
  | { seq: number; kind: 'load'; videoId: string; startSeconds: number }
  | { seq: number; kind: 'replay' }

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

/** The stage card's state in 'card' mode. */
function stageStateFor(state: EndedState, visible: boolean): UpNextState | null {
  switch (state.kind) {
    case 'upnext':
      if (!state.counting) return 'static'
      return visible ? 'counting' : 'paused'
    case 'cancelled':
      return 'cancelled'
    case 'series-end':
      return 'series-end'
    default:
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
  youtubeStatuses = {},
}: WatchShellProps) {
  const router = useRouter()
  const locale = useLocale()
  const t = useTranslations('watch')
  const tPlayer = useTranslations('player')
  const tCommon = useTranslations('common')
  const { announce, node: announcerNode } = useWatchAnnouncer()

  function isBlocked(target: ViewEpisode): boolean {
    return youtubeStatuses[target.id] === 'blocked_ae'
  }

  // Current episode in state: a switch swaps the video in the same player
  // (loadVideoById) instead of remounting the iframe.
  const [currentEpisode, setCurrentEpisode] = useState(episode)
  const [activeSeasonId, setActiveSeasonId] = useState(episode.seasonId)
  const [playerInstance, setPlayerInstance] = useState<YT.Player | null>(null)
  const playerRef = useRef<YT.Player | null>(null)
  const boxRef = useRef<HTMLDivElement>(null)

  // Player box at least 50% in view and the tab visible: the countdown only
  // moves while this is true.
  const visible = useElementVisible(boxRef)

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

  // ENDED / error state (D-09, D-11). A stored UAE block opens on its card and
  // the player is not created until a playable episode is current.
  const [ended, setEnded] = useState<EndedState>(() =>
    isBlocked(episode)
      ? { kind: 'error', code: null, storedStatus: 'blocked_ae' }
      : { kind: 'playing' }
  )
  const endedRef = useRef(ended)
  const hidden = playerHidden(ENDED_MODE, ended)

  // The video the player is created with. Later switches load into it.
  const [mountVideo, setMountVideo] = useState<{ videoId: string; startSeconds: number } | null>(
    () =>
      episode.youtubeId && !isBlocked(episode)
        ? { videoId: episode.youtubeId, startSeconds: resumeFrom }
        : null
  )

  // Play requests run from an effect after the commit that un-hides the
  // player, so nothing loads or plays while hidden.
  const [pendingPlay, setPendingPlay] = useState<PendingPlay | null>(null)
  const playSeqRef = useRef(0)
  const playedSeqRef = useRef(0)
  function requestPlay(play: { kind: 'load'; videoId: string; startSeconds: number } | { kind: 'replay' }) {
    playSeqRef.current += 1
    setPendingPlay({ ...play, seq: playSeqRef.current })
  }

  // The episode whose ENDED was already recorded; its stopped or finished
  // clock must not be written back as a 'leave'.
  const endedEpisodeRef = useRef<string | null>(null)
  // Viewer reports: at most one per episode per page load (T-06-56).
  const reportedRef = useRef(new Set<string>())
  const logged153Ref = useRef(false)

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

  // Un-hide before load: runs after the commit in which the card and the
  // hidden flag were cleared, and never while the player is hidden.
  useEffect(() => {
    if (!pendingPlay || hidden || !playerInstance) return
    if (playedSeqRef.current === pendingPlay.seq) return
    playedSeqRef.current = pendingPlay.seq
    try {
      if (pendingPlay.kind === 'load') {
        playerInstance.loadVideoById({
          videoId: pendingPlay.videoId,
          startSeconds: pendingPlay.startSeconds,
        })
      } else {
        playerInstance.seekTo(0, true)
        playerInstance.playVideo()
      }
    } catch {
      // Player destroyed between the request and the commit.
    }
  }, [pendingPlay, hidden, playerInstance])

  // Development check (UAT blocker 3): while a card replaces the player the
  // iframe must be out of layout (offsetParent === null).
  useEffect(() => {
    if (process.env.NODE_ENV === 'production' || !hidden) return
    console.assert(
      playerIframeHidden(boxRef.current),
      '[watch] iframe visible under a card'
    )
  }, [hidden, ended, mountVideo])

  function stopPlayer() {
    try {
      playerRef.current?.stopVideo()
    } catch {
      // Player already destroyed
    }
  }

  // One transition of the ENDED state machine, with its side effect: stop the
  // video before it is hidden (never in 'bar' mode outside an error).
  // Returns true when the next episode must be loaded.
  function dispatchEnded(event: EndedEvent): boolean {
    const prev = endedRef.current
    const result = endedReducer(ENDED_MODE, prev, event, visible)
    const effects = endedEffects(ENDED_MODE, prev, result.state)
    if (effects.stop) stopPlayer()
    endedRef.current = result.state
    setEnded(result.state)
    return result.advance
  }

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

  function seasonNumberOf(target: ViewEpisode): number {
    return seasons.find((s) => s.id === target.seasonId)?.seasonNumber ?? season.seasonNumber
  }

  const prevTarget = findPrevEpisode(currentEpisode)
  const nextTarget = findNextEpisode(currentEpisode)
  const prevPlayable = canPlay(prevTarget) ? prevTarget : null
  const nextPlayable = canPlay(nextTarget) ? nextTarget : null

  // Switch order (D-10): 1. outgoing clock into the map, 2. save it, 3. set
  // the new episode, 4. tracker baseline at the new start, 5. clear any card
  // in the same update and load at the episode's own saved position from the
  // effect above. A UAE-blocked target shows its card and loads nothing.
  // Also used for Try again (target = the current episode).
  function handleEpisodeSwitch(target: ViewEpisode) {
    if (!target.youtubeId) return
    const player = playerRef.current

    const clockIsCurrent =
      player !== null &&
      !playerHidden(ENDED_MODE, endedRef.current) &&
      endedEpisodeRef.current !== currentEpisode.id &&
      videoIdOf(player) === currentEpisode.youtubeId
    if (player && clockIsCurrent) {
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
    endedEpisodeRef.current = null

    resetBaseline(startSeconds)

    if (isBlocked(target)) {
      // Stops the current video (if any) before its wrapper is hidden.
      dispatchEnded({ type: 'error', code: null, storedStatus: 'blocked_ae' })
    } else {
      dispatchEnded({ type: 'switch' })
      if (!mountVideo) setMountVideo({ videoId: target.youtubeId, startSeconds })
      requestPlay({ kind: 'load', videoId: target.youtubeId, startSeconds })
    }

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

  function handlePlayNow() {
    if (dispatchEnded({ type: 'playNow' }) && nextPlayable) handleEpisodeSwitch(nextPlayable)
  }

  function handleCancel() {
    dispatchEnded({ type: 'cancel' })
  }

  // Card mode only: un-hide, then seekTo(0) + playVideo from the effect.
  function handleWatchAgain() {
    dispatchEnded({ type: 'watchAgain' })
    applyPositions({ type: 'restart', episodeId: currentEpisode.id })
    endedEpisodeRef.current = null
    resetBaseline(0)
    setResumeFrom(0)
    requestPlay({ kind: 'replay' })
  }

  // The countdown: one tick per second, only while counting and in view.
  const counting = ended.kind === 'upnext' && ended.counting
  const tickRef = useRef<() => void>(() => {})
  useEffect(() => {
    tickRef.current = () => {
      if (dispatchEnded({ type: 'tick' }) && nextPlayable) handleEpisodeSwitch(nextPlayable)
    }
  })
  useEffect(() => {
    if (!counting || !visible) return
    const id = window.setInterval(() => tickRef.current(), 1000)
    return () => window.clearInterval(id)
  }, [counting, visible])

  function handleStateChange(state: number) {
    if (state === 0) {
      // Ended: completed, back at 0:00 for the next visit. In 'bar' mode the
      // video and YouTube's end screen stay; endedEffects decides any stop.
      applyPositions({ type: 'ended', episodeId: currentEpisode.id })
      endedEpisodeRef.current = currentEpisode.id
      forceFlush()
      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      dispatchEnded({ type: 'ended', hasNext: Boolean(nextPlayable), reducedMotion })
    }
    if (state === 1) {
      // Playing again (e.g. YouTube's own replay on the end screen): back to
      // the normal control bar.
      endedEpisodeRef.current = null
      const kind = endedRef.current.kind
      if (kind !== 'playing' && kind !== 'error') dispatchEnded({ type: 'switch' })
    }
    if (state === 2) forceFlush()
  }

  // Branded error (D-11): stop and hide through endedEffects (an error always
  // stops), pick the reason with the stored status, report once per load.
  function handlePlayerError(code: number) {
    const storedStatus = youtubeStatuses[currentEpisode.id] ?? null
    dispatchEnded({ type: 'error', code, storedStatus })
    const spec = errorCardFor({ code, storedStatus, hasNext: Boolean(nextPlayable) })
    if (code === 153 && !logged153Ref.current) {
      logged153Ref.current = true
      console.error('[watch] YouTube error 153 (referrer)')
    }
    if (spec.reportable && userId && !reportedRef.current.has(currentEpisode.id)) {
      reportedRef.current.add(currentEpisode.id)
      void reportPlayerError(currentEpisode.id, code).catch(() => {
        // Advisory only: the daily check flags the episode as well.
      })
    }
  }

  // The browser refused scripted playback: show the player with YouTube's own
  // play button (never un-hide an error card).
  function handleAutoplayBlocked() {
    const state = endedRef.current
    if (playerHidden(ENDED_MODE, state) && state.kind !== 'error') {
      dispatchEnded({ type: 'switch' })
    }
  }

  // Bounce back to series if episode has no video
  useEffect(() => {
    if (!episode.youtubeId) {
      router.replace(`/series/${show.slug}`)
    }
  }, [episode.youtubeId, router, show.slug])

  if (!episode.youtubeId) return null

  const seasonNumber = seasonNumberOf(currentEpisode)
  const seasonEpisodes = episodesBySeason[currentEpisode.seasonId] ?? []
  const seasonEpisodeLong = tPlayer('seasonEpisodeLong', {
    season: seasonNumber,
    episode: currentEpisode.episodeNumber,
  })
  const episodeOfTotal = tPlayer('episodeOfTotal', {
    current: currentEpisode.episodeNumber,
    total: Math.max(seasonEpisodes.length, currentEpisode.episodeNumber),
  })

  const cardShow = {
    title: show.title,
    slug: show.slug,
    brandHex: BRAND_COLOR_HEX[show.brandColor] ?? BRAND_COLOR_HEX['brand-blue'],
  }
  const upNextEpisode: UpNextEpisode | null = nextPlayable
    ? {
        title: nextPlayable.title,
        seasonNumber: seasonNumberOf(nextPlayable),
        episodeNumber: nextPlayable.episodeNumber,
        minutes: nextPlayable.duration,
        thumbnailUrl: nextPlayable.youtubeId
          ? `https://i.ytimg.com/vi/${nextPlayable.youtubeId}/hqdefault.jpg`
          : null,
      }
    : null
  const finishedEpisode = { seasonNumber, episodeNumber: currentEpisode.episodeNumber }
  const secondsLeft = ended.kind === 'upnext' ? ended.secondsLeft : 0

  // What replaces the player inside the box (never drawn over a visible one).
  const errorSpec =
    ended.kind === 'error'
      ? errorCardFor({
          code: ended.code,
          storedStatus: ended.storedStatus,
          hasNext: Boolean(nextPlayable),
        })
      : null
  const stageState = ENDED_MODE === 'card' ? stageStateFor(ended, visible) : null

  // 'bar' mode: which face the control bar shows.
  const view = ENDED_MODE === 'bar' ? barView(ended) : 'normal'
  const barState: UpNextState | null =
    view === 'upnext-counting'
      ? visible
        ? 'counting'
        : 'paused'
      : view === 'upnext-static'
        ? 'static'
        : view === 'series-end'
          ? 'series-end'
          : null
  const finished = view === 'finished' || stageState !== null

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
          {mountVideo ? (
            <YouTubePlayer
              videoId={mountVideo.videoId}
              startSeconds={mountVideo.startSeconds}
              hidden={hidden}
              onReady={(player) => {
                playerRef.current = player
                setPlayerInstance(player)
              }}
              onStateChange={handleStateChange}
              onError={handlePlayerError}
              onAutoplayBlocked={handleAutoplayBlocked}
            />
          ) : null}

          {/* Cards fill the box only while the iframe is hidden. */}
          {errorSpec ? (
            <PlayerErrorCard
              spec={errorSpec}
              show={cardShow}
              hasNext={Boolean(nextPlayable)}
              onPrimary={() => {
                if (errorSpec.primary === 'tryAgain') handleEpisodeSwitch(currentEpisode)
                else if (nextPlayable) handleEpisodeSwitch(nextPlayable)
              }}
            />
          ) : stageState ? (
            <UpNextCard
              variant="stage"
              state={stageState}
              secondsLeft={secondsLeft}
              next={upNextEpisode}
              current={finishedEpisode}
              show={cardShow}
              onPlayNow={handlePlayNow}
              onCancel={handleCancel}
              onWatchAgain={handleWatchAgain}
            />
          ) : null}
        </div>
      </div>

      {/* Control bar under the video; in 'bar' mode the up-next strip takes
          its place after ENDED (same spot, nothing on the player). */}
      {barState ? (
        <div className="flex-none border-b border-[var(--line)]">
          <UpNextCard
            variant="bar"
            state={barState}
            secondsLeft={secondsLeft}
            next={upNextEpisode}
            current={finishedEpisode}
            show={cardShow}
            onPlayNow={handlePlayNow}
            onCancel={handleCancel}
            onWatchAgain={handleWatchAgain}
          />
        </div>
      ) : (
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
              finished={finished ? tPlayer('finished') : null}
              resumedAt={
                resumeFrom > 0 && !errorSpec
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
      )}

      {/* Episode section: the only part that scrolls. UAE-blocked episodes
          stay selectable (picking one shows its card). */}
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
 * The control bar's status line (UI-SPEC 3.5). Finished after ENDED; Resumed:
 * "Resumed at m:ss ·" plus the start-over button; otherwise the fresh-start
 * text. Checker flag e: only the inner "Resumed at" span truncates; the
 * element that wraps the button never clips its 12px hit-area stretch.
 */
function StatusLine({
  finished,
  resumedAt,
  freshDesktop,
  freshPhone,
  startFromBeginning,
  startOver,
  onStartOver,
}: {
  finished: string | null
  resumedAt: string | null
  freshDesktop: string
  freshPhone: string
  startFromBeginning: string
  startOver: string
  onStartOver: () => void
}) {
  if (finished) {
    return <p className="truncate text-sm text-[var(--text-mute)]">{finished}</p>
  }
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

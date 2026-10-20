'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import Image from 'next/image'
import { useTranslations } from 'next-intl'

import { cn } from '@/lib/utils'
import { progressPercent, type PositionsMap } from '@/lib/watch/resume'
import type { ViewEpisode, ViewSeason } from '@/lib/queries'

// Static episode section (06-UI-SPEC 3.6): season pills, a desktop rail and a
// phone list. No drawer, no hover raise, nothing drawn over the player.

const THUMB_QUALITIES = ['maxresdefault', 'sddefault', 'hqdefault'] as const

const FOCUS_OUTLINE =
  'outline-none focus-visible:outline-2 focus-visible:outline-[var(--primary)] focus-visible:outline-offset-2'

type EpisodeListProps = {
  seasons: ViewSeason[]
  episodesBySeason: Record<string, ViewEpisode[]>
  currentEpisodeId: string
  activeSeasonId: string
  onSeasonChange: (seasonId: string) => void
  onSelect: (episode: ViewEpisode) => void
  progressMap: PositionsMap
  locale: string
  /** Phone Watchlist / Like (WatchActions variant 'season-row'). */
  seasonRowEnd?: ReactNode
}

/** An episode is playable when it is live and has a YouTube video. */
function isPlayable(episode: ViewEpisode): boolean {
  return episode.isLive && Boolean(episode.youtubeId)
}

/**
 * i.ytimg.com thumbnail, maxres -> standard -> high through onError. Keyed by
 * video id by the caller, so the fallback step resets per episode. Renders its
 * own brand-neutral background, so a failed image still leaves a clean tile.
 */
function EpisodeThumb({
  youtubeId,
  className,
  children,
}: {
  youtubeId: string | null
  className?: string
  children?: ReactNode
}) {
  const [step, setStep] = useState(0)
  const quality = THUMB_QUALITIES[step]

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-[11px] bg-[var(--bg-2)]',
        className
      )}
    >
      {youtubeId && quality && (
        <Image
          src={`https://i.ytimg.com/vi/${youtubeId}/${quality}.jpg`}
          alt=""
          fill
          unoptimized
          sizes="220px"
          className="object-cover"
          aria-hidden
          onError={() => setStep((s) => s + 1)}
        />
      )}
      {children}
    </div>
  )
}

export function EpisodeList({
  seasons,
  episodesBySeason,
  currentEpisodeId,
  activeSeasonId,
  onSeasonChange,
  onSelect,
  progressMap,
  locale,
  seasonRowEnd,
}: EpisodeListProps) {
  const t = useTranslations('watch')
  const tPlayer = useTranslations('player')
  const tEpisode = useTranslations('episode')
  const rootRef = useRef<HTMLElement>(null)

  const episodes = episodesBySeason[activeSeasonId] ?? []
  const hasSeasonPills = seasons.length > 1
  const numberFormat = new Intl.NumberFormat(locale)

  // Keep the current episode visible after a switch. The copy that is hidden
  // at this breakpoint (display: none) ignores the call.
  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const current = rootRef.current?.querySelectorAll('[data-current="true"]')
    current?.forEach((node) =>
      node.scrollIntoView({
        inline: 'nearest',
        block: 'nearest',
        behavior: reduced ? 'auto' : 'smooth',
      })
    )
  }, [currentEpisodeId, activeSeasonId])

  function metaFor(episode: ViewEpisode): string {
    if (!isPlayable(episode)) return t('notOutYet')
    if (episode.id === currentEpisodeId) return t('nowPlaying')
    const entry = progressMap[episode.id]
    if (entry?.completed) return t('watched')
    if (entry && entry.seconds > 0 && entry.duration > 0) {
      const minutes = Math.max(1, Math.ceil((entry.duration - entry.seconds) / 60))
      return t('minutesLeft', { minutes })
    }
    return episode.duration ? tEpisode('minutesAbbr', { duration: episode.duration }) : ''
  }

  function titleFor(episode: ViewEpisode) {
    return (
      <>
        {numberFormat.format(episode.episodeNumber)} · <bdi>{episode.title}</bdi>
      </>
    )
  }

  return (
    <section
      ref={rootRef}
      className="min-h-0 flex-1 overflow-y-auto bg-[var(--bg-1)]"
    >
      <h2 className="sr-only">{t('episodesHeading')}</h2>

      {(hasSeasonPills || seasonRowEnd) && (
        <div
          className={cn(
            'flex items-center gap-2 px-4 pt-3 md:px-5',
            !hasSeasonPills && 'md:hidden'
          )}
        >
          {hasSeasonPills && (
            <div className="flex min-w-0 gap-2 overflow-x-auto py-1">
              {seasons.map((season) => {
                const active = season.id === activeSeasonId
                return (
                  <button
                    key={season.id}
                    type="button"
                    onClick={() => onSeasonChange(season.id)}
                    aria-pressed={active}
                    className={cn(
                      'min-h-11 shrink-0 rounded-full border px-4 text-sm transition-colors',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-1)]',
                      active
                        ? 'border-[var(--text)] bg-[var(--text)] text-[var(--bg-0)]'
                        : 'border-[var(--line)] text-[var(--text-dim)] hover:text-[var(--text)]'
                    )}
                  >
                    {tPlayer('seasonLabel', { number: season.seasonNumber })}
                  </button>
                )
              })}
            </div>
          )}
          {seasonRowEnd && (
            <div className="ms-auto shrink-0 md:hidden">{seasonRowEnd}</div>
          )}
        </div>
      )}

      {/* Desktop rail */}
      <div className="flex snap-x gap-4 overflow-x-auto px-5 py-2 max-md:hidden">
        {episodes.map((episode) => {
          const current = episode.id === currentEpisodeId
          const playable = isPlayable(episode)
          return (
            <button
              key={episode.id}
              type="button"
              onClick={() => onSelect(episode)}
              disabled={!playable}
              aria-disabled={!playable}
              aria-current={current ? 'true' : undefined}
              data-current={current ? 'true' : undefined}
              className={cn(
                'w-[220px] flex-none snap-start rounded-[12px] text-start',
                FOCUS_OUTLINE,
                !playable && 'cursor-not-allowed'
              )}
            >
              <EpisodeThumb
                key={episode.youtubeId ?? episode.id}
                youtubeId={episode.youtubeId}
                className={cn(
                  'h-[124px] w-[220px]',
                  current && 'outline-2 outline-[var(--primary)] outline-offset-2',
                  !playable && 'opacity-40'
                )}
              />
              <span className="mt-2 block h-[3px] overflow-hidden rounded-full bg-white/[0.18]">
                <span
                  className="block h-full bg-[var(--primary)]"
                  style={{ width: `${progressPercent(progressMap[episode.id])}%` }}
                />
              </span>
              <span className="mt-2 block truncate text-sm text-[var(--text)]">
                {titleFor(episode)}
              </span>
              <span className="mt-1 block text-[11px] text-[var(--text-mute)]">
                {metaFor(episode)}
              </span>
            </button>
          )
        })}
      </div>

      {/* Phone list */}
      <div className="flex flex-col gap-2 px-4 py-3 md:hidden">
        {episodes.map((episode) => {
          const current = episode.id === currentEpisodeId
          const playable = isPlayable(episode)
          return (
            <button
              key={episode.id}
              type="button"
              onClick={() => onSelect(episode)}
              disabled={!playable}
              aria-disabled={!playable}
              aria-current={current ? 'true' : undefined}
              data-current={current ? 'true' : undefined}
              className={cn(
                'flex w-full items-center gap-3 rounded-[12px] p-2 text-start',
                FOCUS_OUTLINE,
                current && 'bg-[var(--bg-2)]',
                !playable && 'cursor-not-allowed'
              )}
            >
              <EpisodeThumb
                key={episode.youtubeId ?? episode.id}
                youtubeId={episode.youtubeId}
                className={cn('h-[63px] w-28 shrink-0', !playable && 'opacity-40')}
              >
                <span className="absolute inset-x-0 bottom-0 h-[3px] bg-white/[0.18]">
                  <span
                    className="block h-full bg-[var(--primary)]"
                    style={{ width: `${progressPercent(progressMap[episode.id])}%` }}
                  />
                </span>
              </EpisodeThumb>
              <span className="min-w-0 flex-1">
                <span className="line-clamp-2 block text-sm text-[var(--text)]">
                  {titleFor(episode)}
                </span>
                <span className="mt-1 block text-[11px] text-[var(--text-mute)]">
                  {metaFor(episode)}
                </span>
              </span>
            </button>
          )
        })}
      </div>
    </section>
  )
}

'use client'

import { useEffect, useId, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Play } from 'lucide-react'

import { Link } from '@/i18n/navigation'
import { Button } from '@/components/ui/button'
import { ShowArt } from '@/components/primitives/show-art'
import { CountdownRing } from '@/components/watch/countdown-ring'
import { isolate } from '@/lib/i18n-format'
import { cn } from '@/lib/utils'

export type UpNextVariant = 'stage' | 'bar'

/**
 * counting   countdown running
 * paused     countdown frozen (player out of view or tab hidden)
 * static     reduced motion: no ring, no auto-advance, only Play now (bar)
 * cancelled  Cancel pressed (stage card only; the bar hands back to the control bar)
 * series-end no next episode
 */
export type UpNextState =
  | 'counting'
  | 'paused'
  | 'static'
  | 'cancelled'
  | 'series-end'

export type UpNextEpisode = {
  title: string
  seasonNumber: number
  episodeNumber: number
  minutes: number | null
  thumbnailUrl: string | null
}

export type UpNextShow = { title: string; slug: string; brandHex: string }

export type UpNextCardProps = {
  variant: UpNextVariant
  state: UpNextState
  secondsLeft: number
  next: UpNextEpisode | null
  /** The episode that just finished; only used for the series-end eyebrow. */
  current?: { seasonNumber: number; episodeNumber: number } | null
  show: UpNextShow
  onPlayNow: () => void
  onCancel: () => void
  onWatchAgain: () => void
}

/**
 * Brand glow behind a card: the show colour at 25 percent on the end side,
 * away from the text block (UI-SPEC 4.1). Mirrored in RTL.
 */
export function cardGlow(brandHex: string, rtl: boolean): string {
  const at = rtl ? '15% 40%' : '85% 40%'
  return `radial-gradient(ellipse at ${at}, ${brandHex}40 0, transparent 50%), var(--bg-0)`
}

/**
 * The ENDED surface of the watch page (D-09, UI-SPEC section 4.2 and 4.2b).
 * 'bar' (shipped default) replaces the control bar under the visible player;
 * 'stage' fills the video box while the iframe is hidden (card mode only).
 */
export function UpNextCard(props: UpNextCardProps) {
  const { state, onCancel } = props

  // Esc = Cancel while a countdown or the static strip is showing.
  useEffect(() => {
    if (state !== 'counting' && state !== 'paused' && state !== 'static') return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !event.defaultPrevented) onCancel()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [state, onCancel])

  return props.variant === 'bar' ? (
    <UpNextBar {...props} />
  ) : (
    <UpNextStage {...props} />
  )
}

/** One polite announcement when the card shows. Focus is never moved. */
function Announce({ children }: { children: string }) {
  // Frozen at mount: the message is read once, not on every tick.
  const [message] = useState(children)
  return (
    <p role="status" aria-live="polite" className="sr-only">
      {message}
    </p>
  )
}

function useAnnouncement(
  state: UpNextState,
  secondsLeft: number,
  next: UpNextEpisode | null
) {
  const t = useTranslations('player')
  if (state === 'counting' || state === 'paused') {
    return t('upNextAnnounce', { seconds: secondsLeft })
  }
  if (state === 'static' && next) {
    return t('upNextEyebrow', {
      season: next.seasonNumber,
      episode: next.episodeNumber,
    })
  }
  return null
}

function BackToShow({
  show,
  primary,
  layout,
}: {
  show: UpNextShow
  primary: boolean
  layout: string
}) {
  const t = useTranslations('watch')
  return (
    <Button
      asChild
      variant={primary ? 'default' : 'outline'}
      className={cn('min-h-11 min-w-0 px-6 py-2 text-sm font-bold', layout)}
    >
      <Link href={`/series/${show.slug}`}>
        <span className="truncate">
          {t('backToShow', { title: isolate(show.title) })}
        </span>
      </Link>
    </Button>
  )
}

/** Control-bar strip under the visible player. Never drawn over the video. */
function UpNextBar({
  state,
  secondsLeft,
  next,
  show,
  onPlayNow,
  onCancel,
}: UpNextCardProps) {
  const t = useTranslations('player')
  const titleId = useId()
  const announcement = useAnnouncement(state, secondsLeft, next)

  // Cancel hands back to the normal control bar (06-14): nothing to render.
  if (state === 'cancelled') return null

  if (state === 'series-end') {
    return (
      <section
        aria-labelledby={titleId}
        className="flex flex-col gap-3 bg-[var(--uis-primary-soft)] px-4 py-2 sm:min-h-[60px] sm:flex-row sm:items-center sm:gap-4"
      >
        <div className="min-w-0 flex-1">
          <p
            id={titleId}
            className="truncate text-sm font-bold text-[var(--text)]"
          >
            {t.rich('seriesEndHeading', {
              show: show.title,
              bdi: (chunks) => <bdi>{chunks}</bdi>,
            })}
          </p>
          <p className="text-sm text-[var(--text-dim)]">{t('seriesEndBody')}</p>
        </div>
        <div className="flex gap-2">
          <BackToShow show={show} primary={false} layout="sm:flex-none" />
        </div>
      </section>
    )
  }

  if (!next) return null

  const showRing = state !== 'static'

  return (
    <section
      aria-labelledby={titleId}
      className="flex flex-col gap-3 bg-[var(--uis-primary-soft)] px-4 py-2 sm:min-h-[60px] sm:flex-row sm:items-center sm:gap-4"
    >
      {announcement ? <Announce>{announcement}</Announce> : null}
      <div className="flex min-w-0 flex-1 items-center gap-3">
        {showRing ? (
          <CountdownRing
            size={44}
            secondsLeft={secondsLeft}
            paused={state === 'paused'}
          />
        ) : null}
        <div className="min-w-0 flex-1">
          <p
            id={titleId}
            className="truncate text-sm font-bold text-[var(--text)]"
          >
            {t.rich('upNextBarTitle', {
              title: next.title,
              bdi: (chunks) => <bdi>{chunks}</bdi>,
            })}
          </p>
          <p className="truncate text-sm text-[var(--text-dim)]">
            {t('seasonEpisodeLong', {
              season: next.seasonNumber,
              episode: next.episodeNumber,
            })}
          </p>
        </div>
      </div>
      <div className="flex gap-2">
        <Button
          onClick={onPlayNow}
          className="min-h-11 flex-1 px-6 py-2 text-sm font-bold sm:flex-none"
        >
          <Play className="size-4 fill-current" aria-hidden />
          {t('autoplayPlayNow')}
        </Button>
        {state === 'static' ? null : (
          <Button
            variant="outline"
            onClick={onCancel}
            className="min-h-11 flex-1 px-6 py-2 text-sm font-bold sm:flex-none"
          >
            {t('upNextCancel')}
          </Button>
        )}
      </div>
    </section>
  )
}

/** Card that fills the video box while the iframe is hidden (card mode). */
function UpNextStage({
  state,
  secondsLeft,
  next,
  current,
  show,
  onPlayNow,
  onCancel,
  onWatchAgain,
}: UpNextCardProps) {
  const t = useTranslations('player')
  const tEpisode = useTranslations('episode')
  const locale = useLocale()
  const titleId = useId()
  const announcement = useAnnouncement(state, secondsLeft, next)
  const frame = 'absolute inset-0 @container overflow-hidden'
  const style = { background: cardGlow(show.brandHex, locale === 'ar') }
  const inner =
    'flex h-full flex-col justify-center gap-3 p-4 @min-[560px]:flex-row @min-[560px]:items-center @min-[560px]:gap-8 @min-[560px]:px-12 @min-[560px]:py-6'
  const overline =
    'truncate text-[11px] tracking-[0.14em] text-[var(--text-dim)] uppercase @min-[560px]:mb-2'

  if (state === 'series-end') {
    return (
      <section aria-labelledby={titleId} className={frame} style={style}>
        <div className={inner}>
          <div className="min-w-0 flex-1">
            {current ? (
              <p className={overline}>
                {t('upNextDoneEyebrow', {
                  season: current.seasonNumber,
                  episode: current.episodeNumber,
                })}
              </p>
            ) : null}
            <h2
              id={titleId}
              className="mb-2 text-[20px] leading-tight font-bold text-[var(--text)] @min-[560px]:text-[24px]"
            >
              {t.rich('seriesEndHeading', {
                show: show.title,
                bdi: (chunks) => <bdi>{chunks}</bdi>,
              })}
            </h2>
            <p className="mb-4 text-sm text-[var(--text-dim)]">
              {t('seriesEndBody')}
            </p>
            <div className="flex gap-2">
              <Button
                onClick={onWatchAgain}
                className="min-h-11 flex-1 px-6 py-2 text-sm font-bold @min-[560px]:flex-none"
              >
                {t('watchAgain')}
              </Button>
              <BackToShow
                show={show}
                primary={false}
                layout="flex-1 @min-[560px]:flex-none"
              />
            </div>
          </div>
        </div>
      </section>
    )
  }

  if (!next) return null

  const counting = state === 'counting' || state === 'paused'

  return (
    <section aria-labelledby={titleId} className={frame} style={style}>
      {announcement ? <Announce>{announcement}</Announce> : null}
      <div className={inner}>
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center gap-3">
            <p className={`${overline} min-w-0 flex-1`}>
              {t('upNextEyebrow', {
                season: next.seasonNumber,
                episode: next.episodeNumber,
              })}
            </p>
            {counting ? (
              <CountdownRing
                size={44}
                secondsLeft={secondsLeft}
                paused={state === 'paused'}
                className="ms-auto @min-[560px]:hidden"
              />
            ) : null}
          </div>
          <h2
            id={titleId}
            className="mb-1 line-clamp-1 text-[20px] leading-tight font-bold text-[var(--text)] @min-[560px]:mb-2 @min-[560px]:line-clamp-2 @min-[560px]:text-[24px]"
          >
            <bdi>{next.title}</bdi>
          </h2>
          {next.minutes != null ? (
            <p className="mb-4 hidden text-sm text-[var(--text-dim)] @min-[560px]:block">
              {tEpisode('minutesAbbr', { duration: next.minutes })}
            </p>
          ) : null}
          <div className="flex gap-2">
            <Button
              onClick={onPlayNow}
              className="min-h-11 flex-1 px-6 py-2 text-sm font-bold @min-[560px]:flex-none"
            >
              <Play className="size-4 fill-current" aria-hidden />
              {t('autoplayPlayNow')}
            </Button>
            {counting ? (
              <Button
                variant="outline"
                onClick={onCancel}
                className="min-h-11 flex-1 px-6 py-2 text-sm font-bold @min-[560px]:flex-none"
              >
                {t('upNextCancel')}
              </Button>
            ) : (
              <Button
                variant="outline"
                onClick={onWatchAgain}
                className="min-h-11 flex-1 px-6 py-2 text-sm font-bold @min-[560px]:flex-none"
              >
                {t('watchAgain')}
              </Button>
            )}
          </div>
        </div>
        <div className="relative hidden flex-none @min-[560px]:block">
          <ShowArt
            brandColor={show.brandHex}
            title={next.title}
            aspectRatio="220/124"
            imageUrl={next.thumbnailUrl ?? undefined}
            className="w-[220px] rounded-media"
          />
          {counting ? (
            <CountdownRing
              size={64}
              secondsLeft={secondsLeft}
              paused={state === 'paused'}
              className="absolute -end-3 -top-3 rounded-full bg-[var(--bg-0)]"
            />
          ) : null}
        </div>
      </div>
    </section>
  )
}

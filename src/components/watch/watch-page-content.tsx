// Watch page — YT-style layout matching handoff watch.jsx
'use client'

import { useState } from 'react'
import { useLocale } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { useRouter } from '@/i18n/navigation'
import { ArrowLeft } from 'lucide-react'
import { YouTubePlayer } from '@/components/watch/youtube-player'
import { AutoplayOverlay } from '@/components/watch/autoplay-overlay'
import { EpisodeNav } from '@/components/watch/episode-nav'
import { SeasonSelector } from '@/components/series/season-selector'
import { useProgressTracker } from '@/hooks/use-progress-tracker'
import type { ViewEpisode, ViewShow, ViewSeason } from '@/lib/queries'
import { BRAND_COLOR_BG } from '@/lib/brand-colors'

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
  const locale = useLocale()
  const isArabic = locale === 'ar'

  const { forceFlush } = useProgressTracker(playerInstance, episode.id, userId ?? null)

  return (
    <div className="min-h-screen bg-[var(--bg-0)] text-white">
      {/* Sticky header — matches handoff .yt-header */}
      <div className="sticky top-0 z-20 flex items-center gap-3 border-b border-[var(--line)] px-4 py-3 md:gap-[18px] md:px-8 md:py-3.5" style={{ background: 'rgba(10,10,10,0.92)', backdropFilter: 'blur(14px)' }}>
        <Link
          href={`/series/${show.slug}`}
          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border border-[var(--line)] bg-white/[0.06] transition-colors hover:bg-white/[0.12]"
          aria-label={isArabic ? 'العودة للمسلسل' : 'Back to show'}
        >
          <ArrowLeft className="size-[18px] rtl:scale-x-[-1]" />
        </Link>
        {/* Mobile: just episode title (single line, truncated) */}
        <div className="min-w-0 flex-1 md:hidden">
          <div className="truncate text-[14px] font-medium text-white">
            E{String(episode.episodeNumber).padStart(2, '0')} · {episode.title}
          </div>
          <div className="mono mt-0.5 truncate text-[10.5px] text-[var(--text-dim)]" style={{ letterSpacing: '0.12em' }}>
            {show.title}
          </div>
        </div>
        {/* Desktop: full breadcrumb */}
        <div className="mono hidden items-center gap-2 md:flex" style={{ letterSpacing: '0.14em' }}>
          <span className="cursor-pointer hover:text-white" onClick={() => router.push(`/series/${show.slug}`)}>{show.title}</span>
          <span className="opacity-40">›</span>
          <span className="cursor-pointer hover:text-white" onClick={() => router.push(`/series/${show.slug}`)}>
            {isArabic ? `الموسم ${season.seasonNumber}` : `Season ${season.seasonNumber}`}
          </span>
          <span className="opacity-40">›</span>
          <span className="text-white">
            E{String(episode.episodeNumber).padStart(2, '0')} · {episode.title}
          </span>
        </div>
        {/* Right-side links — desktop only */}
        <div className="ms-auto hidden gap-2 md:flex">
          <Link href="/browse" className="inline-flex items-center rounded-[4px] border border-[var(--line-2)] px-3 py-[7px] text-[12.5px] transition-colors hover:bg-white/[0.04]">
            {isArabic ? 'تصفح' : 'Browse'}
          </Link>
          <Link href={`/series/${show.slug}`} className="inline-flex items-center rounded-[4px] border border-[var(--line-2)] px-3 py-[7px] text-[12.5px] transition-colors hover:bg-white/[0.04]">
            {isArabic ? 'العودة للمسلسل' : 'Back to show'}
          </Link>
        </div>
      </div>

      {/* Main grid — matches handoff .yt-layout */}
      <div className="mx-auto grid max-w-[1600px] grid-cols-1 gap-6 px-4 py-4 md:gap-8 md:px-8 md:py-6 lg:grid-cols-[minmax(0,1fr)_420px]">
        {/* Left: player + metadata */}
        <div className="min-w-0">
          {/* Player frame — rounded-[10px] with shadow */}
          <div className="relative w-full aspect-video overflow-hidden rounded-[10px] bg-black shadow-[0_20px_60px_rgba(0,0,0,0.4)]">
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
                if (state === 0) {
                  forceFlush()
                  if (nextEpisode) setShowAutoplay(true)
                }
                if (state === 2) forceFlush()
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

          {/* Title — matches handoff .yt-title */}
          <h1 className="font-display mt-4 mb-3 text-[20px] font-medium leading-[1.25] tracking-[-0.01em] sm:mt-[22px] sm:mb-3.5 sm:text-[28px] sm:leading-[1.2]" style={{ textWrap: 'balance' }}>
            {episode.title}
          </h1>

          {/* Channel + actions row — YT-style prominence */}
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] pb-4 sm:gap-4">
            <Link href={`/series/${show.slug}`} className="flex min-w-0 items-center gap-3">
              {show.posterUrl && (
                <div
                  className="h-10 w-10 flex-shrink-0 rounded-full border border-[var(--line-2)] bg-cover bg-center sm:h-[46px] sm:w-[46px]"
                  style={{ backgroundImage: `url(${show.posterUrl})` }}
                />
              )}
              <div className="min-w-0">
                <div className="truncate text-[14px] font-semibold tracking-[-0.005em] sm:text-[15px]">{show.title}</div>
                <div className="mono mt-0.5 truncate text-[10.5px] sm:text-xs" style={{ letterSpacing: '0.1em' }}>
                  {isArabic ? `الموسم ${season.seasonNumber}` : `Season ${season.seasonNumber}`} · {isArabic ? 'حلقة' : 'Episode'} {episode.episodeNumber}
                </div>
              </div>
            </Link>
          </div>

          {/* Description card — matches handoff .yt-desc */}
          <div className="mb-6 rounded-[10px] border border-[var(--line)] bg-[var(--bg-1)] p-3.5 sm:p-4">
            <div className="mono mb-2.5 flex flex-wrap gap-3 text-[10.5px] sm:gap-3.5 sm:text-xs" style={{ letterSpacing: '0.12em' }}>
              <span style={{ color: 'var(--accent)' }}>{show.genre}</span>
              {episode.duration && <span className="text-[var(--text-dim)]">{episode.duration} {isArabic ? 'دقيقة' : 'min'}</span>}
            </div>
            <p className="m-0 text-[14px] leading-[1.55] text-[var(--text-dim)]" style={{ textWrap: 'pretty' }}>
              {episode.description}
            </p>
          </div>

          {/* Prev / Next episode nav */}
          <div className="mb-8">
            <EpisodeNav prev={prevEpisode} next={nextEpisode} />
          </div>
        </div>

        {/* Right: episode sidebar — matches handoff .yt-side */}
        <aside className="min-w-0">
          <div className="flex items-center justify-between gap-2.5 mb-3">
            <div>
              <div className="mono mb-1 text-[var(--text-mute)]">
                {isArabic ? 'الحلقات' : 'Episodes'} · {isArabic ? `الموسم ${season.seasonNumber}` : `Season ${season.seasonNumber}`}
              </div>
              <div className="font-display text-[20px]">{show.title}</div>
            </div>
            {seasons.length > 1 && (
              <SeasonSelector
                seasons={seasons}
                activeSeason={activeSeasonId}
                onSeasonChange={setActiveSeasonId}
              />
            )}
          </div>

          <div className="flex flex-col gap-1">
            {currentEpisodes.map((ep) => {
              const isCurrent = ep.id === episode.id
              const thumbUrl = ep.youtubeId
                ? `https://img.youtube.com/vi/${ep.youtubeId}/mqdefault.jpg`
                : null
              return (
                <Link
                  key={ep.id}
                  href={`/watch/${ep.id}`}
                  className={`yt-side-ep ${isCurrent ? 'current' : ''}`}
                >
                  <div className="yt-side-thumb">
                    {thumbUrl ? (
                      <img src={thumbUrl} alt={ep.title} />
                    ) : (
                      <div className="h-full w-full bg-[var(--bg-3)]" />
                    )}
                    {ep.duration && (
                      <div className="yt-side-runtime">{ep.duration} min</div>
                    )}
                    {isCurrent && (
                      <div className="yt-side-now">{isArabic ? 'يعرض الآن' : 'NOW PLAYING'}</div>
                    )}
                  </div>
                  <div className="yt-side-body">
                    <div className="yt-side-num">E{String(ep.episodeNumber).padStart(2, '0')}</div>
                    <div className="yt-side-title">{ep.title}</div>
                    <div className="yt-side-desc">{ep.description}</div>
                  </div>
                </Link>
              )
            })}
          </div>
        </aside>
      </div>
    </div>
  )
}

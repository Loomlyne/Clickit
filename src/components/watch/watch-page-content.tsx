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
import { EpisodeList } from '@/components/series/episode-list'
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
      <div className="sticky top-0 z-20 flex items-center gap-[18px] border-b border-[var(--line)] px-8 py-3.5" style={{ background: 'rgba(10,10,10,0.92)', backdropFilter: 'blur(14px)' }}>
        <Link
          href={`/series/${show.slug}`}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--line)] bg-white/[0.06] transition-colors hover:bg-white/[0.12]"
        >
          <ArrowLeft className="size-[18px] rtl:scale-x-[-1]" />
        </Link>
        <div className="mono flex items-center gap-2" style={{ letterSpacing: '0.14em' }}>
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
        <div className="ms-auto flex gap-2">
          <Link href="/browse" className="inline-flex items-center rounded-[4px] border border-[var(--line-2)] px-3 py-[7px] text-[12.5px] transition-colors hover:bg-white/[0.04]">
            {isArabic ? 'تصفح' : 'Browse'}
          </Link>
          <Link href={`/series/${show.slug}`} className="inline-flex items-center rounded-[4px] border border-[var(--line-2)] px-3 py-[7px] text-[12.5px] transition-colors hover:bg-white/[0.04]">
            {isArabic ? 'العودة للمسلسل' : 'Back to show'}
          </Link>
        </div>
      </div>

      {/* Main grid — matches handoff .yt-layout */}
      <div className="mx-auto grid max-w-[1600px] grid-cols-1 gap-8 px-8 py-6 lg:grid-cols-[minmax(0,1fr)_420px]">
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
          <h1 className="font-display mt-[22px] mb-3.5 text-[28px] font-medium leading-[1.2] tracking-[-0.01em]" style={{ textWrap: 'balance' }}>
            {episode.title}
          </h1>

          {/* Channel + actions row */}
          <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
            <Link href={`/series/${show.slug}`} className="flex items-center gap-3">
              {show.posterUrl && (
                <div
                  className="h-[46px] w-[46px] flex-shrink-0 rounded-full border border-[var(--line-2)] bg-cover bg-center"
                  style={{ backgroundImage: `url(${show.posterUrl})` }}
                />
              )}
              <div>
                <div className="text-[15px] font-semibold tracking-[-0.005em]">{show.title}</div>
                <div className="mono mt-0.5" style={{ letterSpacing: '0.1em' }}>
                  {isArabic ? `الموسم ${season.seasonNumber}` : `Season ${season.seasonNumber}`} · {isArabic ? 'حلقة' : 'Episode'} {episode.episodeNumber}
                </div>
              </div>
            </Link>
          </div>

          {/* Description card — matches handoff .yt-desc */}
          <div className="mb-6 rounded-[10px] border border-[var(--line)] bg-[var(--bg-1)] p-4">
            <div className="mono mb-2.5 flex flex-wrap gap-3.5" style={{ letterSpacing: '0.12em' }}>
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

        {/* Right: episode sidebar */}
        <aside className="min-w-0">
          <div className="lg:sticky lg:top-[72px] lg:h-[calc(100dvh-72px)] lg:overflow-y-auto scrollbar-hide rounded-[10px] border border-[var(--line)] bg-[var(--bg-1)]">
            <div className="border-b border-[var(--line)] px-4 py-3">
              <div className="mono mb-1 text-[var(--text-mute)]">{show.title}</div>
              <div className="text-[15px] font-semibold">{isArabic ? 'الحلقات' : 'Episodes'}</div>
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

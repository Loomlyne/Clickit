'use client'

import { useTranslations } from 'next-intl'
import { Drawer } from 'vaul'
import { ChevronUp, Play } from 'lucide-react'

import { ShowArt } from '@/components/primitives/show-art'
import { Tr } from '@/components/i18n/tr'
import { cn } from '@/lib/utils'
import { BRAND_COLOR_HEX } from '@/lib/brand-colors'
import type { ViewEpisode, ViewSeason, ViewShow } from '@/lib/queries'

export const WATCH_TRAY_SNAP_POINTS = ['134px', 0.5] as const
export type WatchTraySnapPoint = (typeof WATCH_TRAY_SNAP_POINTS)[number]

type EpisodeProgress = {
  progressPercent: number
  completed: boolean
}

interface EpisodeTrayProps {
  show: ViewShow
  seasons: ViewSeason[]
  episodesBySeason: Record<string, ViewEpisode[]>
  currentEpisode: ViewEpisode
  activeSeasonId: string
  activeSnapPoint: WatchTraySnapPoint
  progressMap: Record<string, EpisodeProgress>
  onSeasonChange: (seasonId: string) => void
  onSnapPointChange: (snapPoint: WatchTraySnapPoint) => void
  onEpisodeSelect: (episode: ViewEpisode) => void
}

export function EpisodeTray({
  show,
  seasons,
  episodesBySeason,
  currentEpisode,
  activeSeasonId,
  activeSnapPoint,
  progressMap,
  onSeasonChange,
  onSnapPointChange,
  onEpisodeSelect,
}: EpisodeTrayProps) {
  const t = useTranslations('watch')
  const tEpisode = useTranslations('episode')
  const brandColor = BRAND_COLOR_HEX[show.brandColor] ?? BRAND_COLOR_HEX['brand-blue']
  const activeEpisodes = episodesBySeason[activeSeasonId] ?? []
  const isTrayRaised = activeSnapPoint === WATCH_TRAY_SNAP_POINTS[1]

  return (
    <Drawer.Root
      open
      modal={false}
      dismissible={false}
      direction="bottom"
      snapPoints={[...WATCH_TRAY_SNAP_POINTS]}
      activeSnapPoint={activeSnapPoint}
      setActiveSnapPoint={(snapPoint) => {
        if (
          snapPoint === WATCH_TRAY_SNAP_POINTS[0] ||
          snapPoint === WATCH_TRAY_SNAP_POINTS[1]
        ) {
          onSnapPointChange(snapPoint)
        }
      }}
      snapToSequentialPoint
      noBodyStyles
    >
      <Drawer.Portal>
        <Drawer.Content
          onMouseEnter={() => onSnapPointChange(WATCH_TRAY_SNAP_POINTS[1])}
          onMouseLeave={() => onSnapPointChange(WATCH_TRAY_SNAP_POINTS[0])}
          className="fixed inset-x-0 bottom-0 z-30 flex h-[95dvh] max-h-[95dvh] flex-col rounded-t-[16px] border border-[var(--line)] bg-[var(--bg-1)]/95 text-[var(--text)] shadow-2xl backdrop-blur-xl outline-none"
        >
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex min-h-[72px] items-center gap-4 border-b border-[var(--line)] bg-[var(--bg-1)]/80 px-4 py-3 backdrop-blur-xl sm:px-8">
              <div className="flex max-w-[34vw] shrink-0 gap-2 overflow-x-auto pb-1 sm:max-w-none">
                {seasons.map((season) => (
                  <button
                    key={season.id}
                    type="button"
                    onClick={() => onSeasonChange(season.id)}
                    className={cn(
                      'h-11 shrink-0 rounded-full border px-4 font-mono text-xs transition',
                      activeSeasonId === season.id
                        ? 'border-[var(--primary)] bg-[var(--primary)] text-[var(--primary-foreground)]'
                        : 'border-[var(--line)] bg-white/5 text-[var(--text-dim)] hover:bg-white/10 hover:text-[var(--text)]'
                    )}
                    aria-pressed={activeSeasonId === season.id}
                  >
                    <Tr
                      k="seasonShort"
                      values={{ season: season.seasonNumber }}
                    />
                  </button>
                ))}
              </div>

              <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
                <div className="grid min-w-0 gap-1 sm:flex sm:items-baseline sm:gap-10">
                  <Drawer.Title className="truncate text-lg font-semibold tracking-normal">
                    {show.title}
                  </Drawer.Title>
                  <Drawer.Description className="truncate text-sm text-[var(--text-mute)]">
                    {currentEpisode.title}
                  </Drawer.Description>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    onSnapPointChange(
                      isTrayRaised
                        ? WATCH_TRAY_SNAP_POINTS[0]
                        : WATCH_TRAY_SNAP_POINTS[1]
                    )
                  }
                  className="flex size-11 shrink-0 items-center justify-center rounded-full border border-[var(--line)] bg-white/5 text-[var(--text-dim)] transition hover:bg-white/10 hover:text-[var(--text)]"
                  aria-label={isTrayRaised ? t('lowerTray') : t('raiseTray')}
                >
                  <ChevronUp
                    className={cn(
                      'size-4 transition-transform',
                      isTrayRaised && 'rotate-180'
                    )}
                  />
                </button>
              </div>
            </div>

            <div className="min-h-0 flex-1 px-5 py-5 sm:px-8">
              <div className="flex h-full gap-5 overflow-x-auto overflow-y-hidden pb-5 [scrollbar-color:rgba(255,255,255,0.45)_transparent] [scrollbar-width:thin]">
                {activeEpisodes.map((episode) => {
                  const isCurrent = episode.id === currentEpisode.id
                  const progress = progressMap[episode.id]
                  const thumbnailUrl = episode.youtubeId
                    ? `https://img.youtube.com/vi/${episode.youtubeId}/hqdefault.jpg`
                    : undefined

                  return (
                    <button
                      key={episode.id}
                      type="button"
                      onClick={() => {
                        onEpisodeSelect(episode)
                        onSnapPointChange(WATCH_TRAY_SNAP_POINTS[0])
                      }}
                      disabled={
                        episode.status !== 'published' || !episode.youtubeId
                      }
                      className={cn(
                        'group flex h-fit w-[260px] shrink-0 flex-col rounded-[12px] border p-0 text-start transition sm:w-[360px] md:w-[400px]',
                        isCurrent
                          ? 'border-[var(--primary)] bg-white/[0.06]'
                          : 'border-transparent bg-transparent hover:border-[var(--line-2)]',
                        (episode.status !== 'published' ||
                          !episode.youtubeId) &&
                          'cursor-not-allowed opacity-45'
                      )}
                      aria-current={isCurrent ? 'true' : undefined}
                    >
                      <ShowArt
                        brandColor={brandColor}
                        title={episode.title}
                        imageUrl={thumbnailUrl}
                        className="w-full rounded-[11px]"
                      >
                        <div className="flex h-full items-center justify-center bg-black/20 opacity-0 transition group-hover:opacity-100">
                          <span className="flex size-12 items-center justify-center rounded-full bg-black/65">
                            <Play className="size-5 fill-white text-white" />
                          </span>
                        </div>
                        {episode.duration && (
                          <div className="absolute end-3 bottom-3 rounded-full bg-black/75 px-2.5 py-1 text-xs font-semibold text-white">
                            {tEpisode('minutesAbbr', {
                              duration: episode.duration,
                            })}
                          </div>
                        )}
                      </ShowArt>

                      <span className="mt-4 flex min-w-0 flex-col px-1 pb-2">
                        <span className="flex min-w-0 items-center gap-2">
                          <span className="rounded-full bg-white/10 px-2 py-0.5 font-mono text-[11px] text-[var(--text-dim)]">
                            <Tr
                              k="seasonEpisodeShort"
                              values={{
                                season:
                                  seasons.find(
                                    (season) => season.id === episode.seasonId
                                  )?.seasonNumber ?? 1,
                                episode: episode.episodeNumber,
                              }}
                            />
                          </span>
                          {isCurrent && (
                            <span className="rounded-full bg-[var(--primary)] px-2 py-0.5 font-mono text-[11px] text-[var(--primary-foreground)]">
                              {t('nowPlayingBadge')}
                            </span>
                          )}
                        </span>
                        <span className="mt-2 truncate text-sm font-medium text-[var(--text)]">
                          {episode.title}
                        </span>
                        <span className="mt-1 line-clamp-1 text-xs text-[var(--text-mute)]">
                          {episode.description}
                        </span>
                        {!progress?.completed && progress?.progressPercent ? (
                          <span className="mt-2 h-1 overflow-hidden rounded-full bg-white/10">
                            <span
                              className="block h-full rounded-full"
                              style={{
                                width: `${progress.progressPercent}%`,
                                backgroundColor: brandColor,
                              }}
                            />
                          </span>
                        ) : null}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  )
}

'use client'

import { Drawer } from 'vaul'
import { ChevronUp, Play } from 'lucide-react'

import { ShowArt } from '@/components/primitives/show-art'
import { cn } from '@/lib/utils'
import { BRAND_COLOR_HEX } from '@/lib/brand-colors'
import type { ViewEpisode, ViewSeason, ViewShow } from '@/lib/queries'

export const WATCH_TRAY_SNAP_POINTS = ['104px', 0.5] as const
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
  const brandColor = BRAND_COLOR_HEX[show.brandColor] ?? '#2C3569'
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
          className="fixed inset-x-0 bottom-0 z-30 flex h-[95dvh] max-h-[95dvh] flex-col rounded-t-[8px] border border-white/10 bg-black/92 text-white shadow-2xl outline-none backdrop-blur-xl"
        >
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex min-h-[72px] items-center gap-4 border-b border-white/10 bg-black/80 px-4 py-3 backdrop-blur-xl sm:px-8">
              <div className="flex max-w-[34vw] shrink-0 gap-2 overflow-x-auto pb-1 sm:max-w-none">
                {seasons.map((season) => (
                  <button
                    key={season.id}
                    type="button"
                    onClick={() => onSeasonChange(season.id)}
                    className={cn(
                      'h-10 shrink-0 rounded-full border px-3 font-mono text-xs transition',
                      activeSeasonId === season.id
                        ? 'border-white bg-white text-black'
                        : 'border-white/10 bg-white/5 text-white/55 hover:bg-white/10 hover:text-white'
                    )}
                    aria-pressed={activeSeasonId === season.id}
                  >
                    S{season.seasonNumber}
                  </button>
                ))}
              </div>

              <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
                <div className="grid min-w-0 gap-1 sm:flex sm:items-baseline sm:gap-10">
                  <Drawer.Title className="truncate text-lg font-semibold tracking-normal">
                    {show.title}
                  </Drawer.Title>
                  <Drawer.Description className="truncate text-sm text-white/50">
                    {currentEpisode.title}
                  </Drawer.Description>
                </div>
                <button
                  type="button"
                  onClick={() => onSnapPointChange(isTrayRaised ? WATCH_TRAY_SNAP_POINTS[0] : WATCH_TRAY_SNAP_POINTS[1])}
                  className="flex size-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/70 transition hover:bg-white/10 hover:text-white"
                  aria-label={isTrayRaised ? 'Lower episode tray' : 'Raise episode tray'}
                >
                  <ChevronUp className={cn('size-4 transition-transform', isTrayRaised && 'rotate-180')} />
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
                      disabled={episode.status !== 'published' || !episode.youtubeId}
                      className={cn(
                        'group flex h-fit w-[260px] shrink-0 flex-col rounded-[8px] border p-0 text-left transition sm:w-[360px] md:w-[400px]',
                        isCurrent
                          ? 'border-white/35 bg-white/12'
                          : 'border-transparent bg-transparent hover:border-white/12',
                        (episode.status !== 'published' || !episode.youtubeId) && 'cursor-not-allowed opacity-45'
                      )}
                      aria-current={isCurrent ? 'true' : undefined}
                    >
                      <ShowArt
                        brandColor={brandColor}
                        title={episode.title}
                        imageUrl={thumbnailUrl}
                        className="w-full rounded-[16px]"
                      >
                        <div className="flex h-full items-center justify-center bg-black/20 opacity-0 transition group-hover:opacity-100">
                          <span className="flex size-12 items-center justify-center rounded-full bg-black/65">
                            <Play className="size-5 fill-white text-white" />
                          </span>
                        </div>
                        {episode.duration && (
                          <div className="absolute bottom-3 right-3 rounded-[6px] bg-black/75 px-2 py-1 text-sm font-semibold text-white">
                            {episode.duration}:00
                          </div>
                        )}
                      </ShowArt>

                      <span className="mt-4 flex min-w-0 flex-col px-1 pb-2">
                        <span className="flex min-w-0 items-center gap-2">
                          <span className="rounded-full bg-white/10 px-2 py-0.5 font-mono text-[10px] text-white/55">
                            S{seasons.find((season) => season.id === episode.seasonId)?.seasonNumber ?? 1} E{episode.episodeNumber}
                          </span>
                          {isCurrent && (
                            <span className="rounded-full bg-white px-2 py-0.5 font-mono text-[10px] text-black">
                              Now
                            </span>
                          )}
                        </span>
                        <span className="mt-2 truncate text-sm font-medium text-white">
                          {episode.title}
                        </span>
                        <span className="mt-1 line-clamp-1 text-xs text-white/45">
                          {episode.description}
                        </span>
                        {!progress?.completed && progress?.progressPercent ? (
                          <span className="mt-2 h-1 overflow-hidden rounded-full bg-white/10">
                            <span
                              className="block h-full rounded-full"
                              style={{ width: `${progress.progressPercent}%`, backgroundColor: brandColor }}
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

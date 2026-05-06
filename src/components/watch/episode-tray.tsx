'use client'

import { Drawer } from 'vaul'
import { ChevronUp, Play } from 'lucide-react'

import { ShowArt } from '@/components/primitives/show-art'
import { cn } from '@/lib/utils'
import { BRAND_COLOR_HEX } from '@/lib/brand-colors'
import type { ViewEpisode, ViewSeason, ViewShow } from '@/lib/queries'

export const WATCH_TRAY_SNAP_POINTS = ['24px', 0.5, 0.95] as const
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
  const allEpisodes = seasons.flatMap((season) => episodesBySeason[season.id] ?? [])
  const currentIndex = allEpisodes.findIndex((episode) => episode.id === currentEpisode.id)
  const currentCount = currentIndex === -1 ? currentEpisode.episodeNumber : currentIndex + 1
  const activeEpisodes = episodesBySeason[activeSeasonId] ?? []
  const isPeek = activeSnapPoint === WATCH_TRAY_SNAP_POINTS[0]

  function expandTray() {
    onSnapPointChange(WATCH_TRAY_SNAP_POINTS[1])
  }

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
          snapPoint === WATCH_TRAY_SNAP_POINTS[1] ||
          snapPoint === WATCH_TRAY_SNAP_POINTS[2]
        ) {
          onSnapPointChange(snapPoint)
        }
      }}
      snapToSequentialPoint
      noBodyStyles
    >
      <Drawer.Portal>
        <Drawer.Content className="fixed inset-x-0 bottom-0 z-30 mx-auto flex h-[95dvh] max-h-[95dvh] max-w-5xl flex-col rounded-t-[8px] border border-white/10 bg-black/92 text-white shadow-2xl outline-none backdrop-blur-xl">
          <button
            type="button"
            onClick={expandTray}
            className="grid h-6 w-full grid-cols-[1fr_auto_1fr] items-center gap-3 border-b border-white/10 px-4 text-left"
            aria-label={isPeek ? 'Open episode tray' : 'Episode tray handle'}
          >
            <span className="min-w-0 truncate text-[11px] font-medium text-white/60">
              {show.title}
            </span>
            <Drawer.Handle className="h-1.5 w-12 rounded-full bg-white/35" />
            <span className="min-w-0 truncate text-right font-mono text-[11px] text-white/45">
              Ep {currentCount} of {allEpisodes.length || currentCount}
            </span>
          </button>

          <div className="flex min-h-0 flex-1 flex-col">
            <div className="border-b border-white/10 px-4 py-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <Drawer.Title className="truncate text-lg font-semibold tracking-normal">
                    {show.title}
                  </Drawer.Title>
                  <Drawer.Description className="mt-1 truncate text-sm text-white/50">
                    {currentEpisode.title}
                  </Drawer.Description>
                </div>
                <button
                  type="button"
                  onClick={() => onSnapPointChange(WATCH_TRAY_SNAP_POINTS[0])}
                  className="flex size-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/70 transition hover:bg-white/10 hover:text-white"
                  aria-label="Collapse episode tray"
                >
                  <ChevronUp className="size-4 rotate-180" />
                </button>
              </div>

              <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
                {seasons.map((season) => (
                  <button
                    key={season.id}
                    type="button"
                    onClick={() => onSeasonChange(season.id)}
                    className={cn(
                      'h-8 shrink-0 rounded-full border px-3 font-mono text-xs transition',
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
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
              <div className="space-y-2">
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
                        'grid w-full grid-cols-[112px_1fr] gap-3 rounded-[8px] border p-2 text-left transition sm:grid-cols-[144px_1fr]',
                        isCurrent
                          ? 'border-white/25 bg-white/12'
                          : 'border-transparent bg-white/[0.03] hover:border-white/12 hover:bg-white/[0.07]',
                        (episode.status !== 'published' || !episode.youtubeId) && 'cursor-not-allowed opacity-45'
                      )}
                      aria-current={isCurrent ? 'true' : undefined}
                    >
                      <ShowArt
                        brandColor={brandColor}
                        title={episode.title}
                        imageUrl={thumbnailUrl}
                        className="rounded-[6px]"
                      >
                        <div className="flex h-full items-center justify-center bg-black/20">
                          <Play className="size-5 fill-white text-white opacity-80" />
                        </div>
                      </ShowArt>

                      <span className="flex min-w-0 flex-col justify-center">
                        <span className="flex items-center gap-2">
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
                        <span className="mt-2 flex items-center gap-2 text-[11px] text-white/40">
                          {episode.duration ? `${episode.duration} min` : 'unknown min'}
                          {progress?.completed && <span>Completed</span>}
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

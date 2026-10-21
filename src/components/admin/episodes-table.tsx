'use client'

import {
  useEffect,
  useOptimistic,
  useRef,
  useState,
  useTransition,
} from 'react'
import { useLocale, useTranslations } from 'next-intl'
import {
  Archive,
  ChevronDown,
  ChevronUp,
  CircleAlert,
  Loader2,
  Pencil,
} from 'lucide-react'
import { toast } from 'sonner'

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { StatusBadge } from '@/components/admin/status-badge'
import { YouTubeStatusChip } from '@/components/admin/youtube-status-chip'
import { ConfirmDialog } from '@/components/admin/confirm-dialog'
import { EmptyState } from '@/components/admin/empty-state'
import { EpisodeFormDrawer } from '@/components/admin/episode-form-drawer'
import { AdminTableShell } from '@/components/admin/admin-shell'
import {
  archiveEpisode,
  reorderEpisode,
  updateEpisode,
} from '@/app/[locale]/admin/actions'
import type { Database } from '@/lib/database.types'
import { useRowVersions } from '@/components/admin/row-version'
import { cantPlayReason, type CantPlayReason } from '@/lib/admin/youtube-health'
import { isolate, localeTag } from '@/lib/i18n-format'
import { cn } from '@/lib/utils'
import { needsEnglishTitle } from '@/server/youtube/script'

type Episode = Database['public']['Tables']['episodes']['Row']

type ShowDefaults = {
  title: string
  title_ar: string | null
  description: string
  description_ar: string | null
}

type Direction = 'up' | 'down'

// Visible 44px circles (UI-SPEC 5.1); no invisible hit area (tap-area opt-in).
const ARROW_CLASS =
  'border-[var(--line)] bg-white/[0.04] text-[var(--text-dim)] hover:text-[var(--text)] disabled:opacity-35'

/** How long the moved row stays highlighted before it fades back. */
const MOVED_HIGHLIGHT_MS = 1200

/** Plain sentence end for a server reason dropped into a longer message. */
function sentence(text: string): string {
  const trimmed = text.trim()
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`
}

/** The admin.youtubeStatus key that words each stored not-ok status. */
const STATUS_TEXT_KEY = {
  private: 'private',
  removed: 'removed',
  not_embeddable: 'notEmbeddable',
  blocked_ae: 'blockedUae',
  not_ready: 'notReady',
} as const

interface EpisodesTableProps {
  episodes: Episode[]
  showId: string
  seasonId: string
  nextEpisodeNumber: number
  showDefaults: ShowDefaults
}

export function EpisodesTable({
  episodes,
  showId,
  seasonId,
  nextEpisodeNumber,
  showDefaults,
}: EpisodesTableProps) {
  const t = useTranslations('admin.episodeForm')
  const tTable = useTranslations('admin.episodesTable')
  const tCommon = useTranslations('common')
  const tStatus = useTranslations('admin.youtubeStatus')
  const locale = useLocale()

  // Scheduled times are authored and published in UAE time — show them in it,
  // not in whoever's browser timezone happens to be open.
  const formatAirTime = (iso: string) =>
    new Intl.DateTimeFormat(locale === 'ar' ? 'ar-AE' : 'en-GB', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Dubai',
    }).format(new Date(iso))
  // Check dates are Dubai dates too (the daily check runs on UAE time).
  const formatCheckDate = (iso: string) =>
    new Intl.DateTimeFormat(localeTag(locale), {
      day: 'numeric',
      month: 'short',
      timeZone: 'Asia/Dubai',
    }).format(new Date(iso))
  const reasonText = (reason: CantPlayReason) =>
    reason === 'viewer_report'
      ? tTable('cantPlayViewerReport')
      : tStatus(STATUS_TEXT_KEY[reason])
  const [isPending, startTransition] = useTransition()
  const [editEpisode, setEditEpisode] = useState<Episode | null>(null)
  // An episode save lands only while the row still holds the updated_at it was opened with (item 8).
  const versions = useRowVersions()
  const [editFocus, setEditFocus] = useState<'title' | undefined>(undefined)
  // The arrow that was clicked ("<episodeId>:<up|down>"), for its spinner.
  const [movingKey, setMovingKey] = useState<string | null>(null)
  // The moved row is highlighted for a moment after a successful move.
  const [highlightId, setHighlightId] = useState<string | null>(null)
  const [liveMessage, setLiveMessage] = useState('')
  // Where focus goes back to once the table is idle again.
  const focusBack = useRef<{ id: string; direction: Direction } | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [archiveTarget, setArchiveTarget] = useState<Episode | null>(null)
  const [archiveLoading, setArchiveLoading] = useState(false)

  const [optimisticEpisodes, setOptimisticEpisodes] = useOptimistic(
    episodes,
    (
      state: Episode[],
      { episodeId, direction }: { episodeId: string; direction: Direction }
    ) => {
      const idx = state.findIndex((e) => e.id === episodeId)
      if (idx === -1) return state
      const swapIdx = direction === 'up' ? idx - 1 : idx + 1
      if (swapIdx < 0 || swapIdx >= state.length) return state
      const next = [...state]
      const aNum = next[idx].episode_number
      const bNum = next[swapIdx].episode_number
      next[idx] = { ...next[idx], episode_number: bNum }
      next[swapIdx] = { ...next[swapIdx], episode_number: aNum }
      next.sort((a, b) => a.episode_number - b.episode_number)
      return next
    }
  )

  useEffect(() => {
    if (!highlightId) return
    const timer = setTimeout(() => setHighlightId(null), MOVED_HIGHLIGHT_MS)
    return () => clearTimeout(timer)
  }, [highlightId])

  // The re-sorted row is a different DOM position, so focus goes back to the
  // same arrow by episode id; if that arrow is now disabled (the row reached
  // the top or bottom) the other arrow of the row takes it.
  useEffect(() => {
    const request = focusBack.current
    if (!request || isPending) return
    focusBack.current = null
    const find = (direction: Direction) =>
      document.querySelector<HTMLButtonElement>(
        `[data-arrow="${request.id}:${direction}"]`
      )
    const other: Direction = request.direction === 'up' ? 'down' : 'up'
    const target = [find(request.direction), find(other)].find(
      (el) => el && !el.disabled
    )
    target?.focus()
  }, [isPending])

  function handleReorder(episode: Episode, direction: Direction) {
    // The nearest neighbour in the shown order, whatever its number (D-13).
    const index = optimisticEpisodes.findIndex((e) => e.id === episode.id)
    const neighbour =
      optimisticEpisodes[direction === 'up' ? index - 1 : index + 1]
    const newNumber = neighbour?.episode_number ?? episode.episode_number
    setMovingKey(`${episode.id}:${direction}`)
    startTransition(async () => {
      setOptimisticEpisodes({ episodeId: episode.id, direction })
      let result: Awaited<ReturnType<typeof reorderEpisode>>
      try {
        result = await reorderEpisode(episode.id, direction)
      } catch {
        result = { success: false, error: tCommon('error') }
      }
      setMovingKey(null)
      if (result.success) {
        setHighlightId(episode.id)
        setLiveMessage(
          tTable.markup('moved', {
            title: episode.title,
            number: newNumber,
            bdi: (chunks) => isolate(chunks),
          })
        )
        focusBack.current = { id: episode.id, direction }
      } else {
        // The optimistic order reverts when this transition ends.
        toast.error(
          tTable.markup('moveFailed', {
            title: episode.title,
            reason: sentence(result.error || tCommon('error')),
            bdi: (chunks) => isolate(chunks),
          })
        )
      }
    })
  }

  function handleEdit(episode: Episode) {
    setEditEpisode(episode)
    setEditFocus(
      needsEnglishTitle({ title: episode.title, title_ar: episode.title_ar })
        ? 'title'
        : undefined
    )
    setDrawerOpen(true)
  }

  async function handleArchiveConfirm() {
    if (!archiveTarget) return
    setArchiveLoading(true)
    const result = await archiveEpisode(archiveTarget.id, showId)
    setArchiveLoading(false)
    if (result.success) {
      toast.success(t('episodeArchived'))
      setArchiveTarget(null)
    } else {
      toast.error(result.error || tCommon('error'))
    }
  }

  if (episodes.length === 0) {
    return (
      <EmptyState heading={tTable('emptyHeading')} body={tTable('emptyBody')} />
    )
  }

  return (
    <TooltipProvider delayDuration={300}>
      <p className="sr-only" aria-live="polite">
        {liveMessage}
      </p>
      <AdminTableShell>
        <Table>
          <TableHeader>
            <TableRow className="bg-transparent">
              <TableHead className="w-16">#</TableHead>
              <TableHead>{t('titleLabel')}</TableHead>
              <TableHead className="hidden w-28 sm:table-cell">
                {t('durationLabel')}
              </TableHead>
              <TableHead className="hidden w-28 md:table-cell">
                {tTable('youtubeColumn')}
              </TableHead>
              <TableHead className="w-[110px]">{t('statusLabel')}</TableHead>
              <TableHead className="w-64 text-end">
                {tTable('actionsColumn')}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {optimisticEpisodes.map((episode, index) => (
              <TableRow
                key={episode.id}
                className={cn(
                  'align-top transition-colors duration-700 motion-reduce:transition-none',
                  highlightId === episode.id && 'bg-[var(--uis-primary-soft)]'
                )}
              >
                <TableCell className="text-muted-foreground pt-5 font-mono text-xs">
                  #{episode.episode_number}
                </TableCell>
                <TableCell className="py-4 break-words whitespace-normal">
                  <span className="text-foreground font-medium">
                    {episode.title}
                  </span>
                  {episode.title_ar && (
                    <span
                      dir="rtl"
                      className="text-muted-foreground mt-1 block text-sm"
                    >
                      {episode.title_ar}
                    </span>
                  )}
                  {needsEnglishTitle({
                    title: episode.title,
                    title_ar: episode.title_ar,
                  }) && (
                    <YouTubeStatusChip tone="warn" className="mt-2">
                      {tStatus('needsEnglishTitle')}
                    </YouTubeStatusChip>
                  )}
                  <span className="text-muted-foreground mt-1 block text-xs sm:hidden">
                    {episode.duration
                      ? t('durationMinutes', { minutes: episode.duration })
                      : tTable('missingDuration')}
                  </span>
                </TableCell>
                <TableCell className="text-muted-foreground hidden pt-5 sm:table-cell">
                  {episode.duration
                    ? t('durationMinutes', { minutes: episode.duration })
                    : tTable('missingDuration')}
                </TableCell>
                <TableCell className="hidden pt-4 md:table-cell">
                  {episode.youtube_video_id ? (
                    <span className="inline-block max-w-[90px] truncate rounded-full border border-[var(--line)] bg-[var(--bg-2)] px-2 py-1 font-mono text-xs">
                      {episode.youtube_video_id}
                    </span>
                  ) : (
                    <span className="text-muted-foreground text-xs">
                      {tTable('noVideo')}
                    </span>
                  )}
                </TableCell>
                <TableCell className="pt-4">
                  <StatusBadge status={episode.status} />
                  {episode.publish_at && episode.status !== 'published' && (
                    <span className="text-muted-foreground mt-1.5 block text-xs">
                      {formatAirTime(episode.publish_at)}
                    </span>
                  )}
                  {(() => {
                    // Flag only (D-17): the episode stays exactly as it is.
                    const reason = cantPlayReason(episode)
                    if (!reason) return null
                    return (
                      <div className="mt-2 flex flex-col items-start gap-1">
                        <YouTubeStatusChip
                          tone="bad"
                          icon={<CircleAlert className="size-4" />}
                        >
                          {tTable('cantPlayBadge')}
                        </YouTubeStatusChip>
                        <span className="max-w-[180px] text-[11px] text-[var(--text-mute)]">
                          {episode.youtube_checked_at
                            ? tTable('cantPlayReason', {
                                reason: reasonText(reason),
                                date: formatCheckDate(
                                  episode.youtube_checked_at
                                ),
                              })
                            : reasonText(reason)}
                        </span>
                      </div>
                    )
                  })()}
                </TableCell>
                <TableCell className="pt-3">
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <div className="flex items-center gap-2">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="outline"
                            size="icon-lg"
                            className={ARROW_CLASS}
                            data-arrow={`${episode.id}:up`}
                            onClick={() => handleReorder(episode, 'up')}
                            disabled={isPending || index === 0}
                            aria-label={tTable('moveUpAria', {
                              title: isolate(episode.title),
                            })}
                          >
                            {movingKey === `${episode.id}:up` ? (
                              <Loader2 className="size-4 animate-spin motion-reduce:animate-none" />
                            ) : (
                              <ChevronUp className="size-4" />
                            )}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent className="text-[11px]">
                          {tTable('moveUp')}
                        </TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="outline"
                            size="icon-lg"
                            className={ARROW_CLASS}
                            data-arrow={`${episode.id}:down`}
                            onClick={() => handleReorder(episode, 'down')}
                            disabled={
                              isPending ||
                              index === optimisticEpisodes.length - 1
                            }
                            aria-label={tTable('moveDownAria', {
                              title: isolate(episode.title),
                            })}
                          >
                            {movingKey === `${episode.id}:down` ? (
                              <Loader2 className="size-4 animate-spin motion-reduce:animate-none" />
                            ) : (
                              <ChevronDown className="size-4" />
                            )}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent className="text-[11px]">
                          {tTable('moveDown')}
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <Button
                      variant="outline"
                      className="min-h-11 px-6 py-2 text-sm font-bold"
                      onClick={() => handleEdit(episode)}
                      aria-label={tTable('editEpisodeAria', {
                        title: isolate(episode.title),
                      })}
                    >
                      <Pencil className="size-4 sm:me-1" />
                      <span className="hidden sm:inline">
                        {tCommon('edit')}
                      </span>
                    </Button>
                    <Button
                      variant="ghost"
                      className="min-h-11 px-6 py-2 text-sm font-bold"
                      onClick={() => setArchiveTarget(episode)}
                      aria-label={tTable('archiveEpisodeAria', {
                        title: isolate(episode.title),
                      })}
                    >
                      <Archive className="size-4 sm:me-1" />
                      <span className="hidden sm:inline">
                        {tTable('archiveTooltip')}
                      </span>
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </AdminTableShell>

      <EpisodeFormDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        episode={editEpisode}
        initialFocus={editFocus}
        showId={showId}
        seasonId={seasonId}
        showDefaults={showDefaults}
        nextEpisodeNumber={nextEpisodeNumber}
        onSave={async (data) => {
          if (!editEpisode) {
            return { success: false, error: tTable('noEpisodeSelected') }
          }
          const expected = versions.expected(editEpisode.id, editEpisode.updated_at)
          const result = await updateEpisode(
            editEpisode.id,
            { ...data, show_id: showId, season_id: seasonId },
            expected
          )
          versions.saved(editEpisode.id, expected, result.updatedAt)
          return result
        }}
      />

      <ConfirmDialog
        open={!!archiveTarget}
        onOpenChange={(open) => {
          if (!open) setArchiveTarget(null)
        }}
        title={tTable('archiveEpisodeTitle')}
        description={tTable('archiveEpisodeDescription', {
          title: archiveTarget?.title ?? tTable('thisEpisode'),
        })}
        confirmLabel={tTable('archiveEpisodeTitle')}
        onConfirm={handleArchiveConfirm}
        destructive
        loading={archiveLoading}
      />
    </TooltipProvider>
  )
}

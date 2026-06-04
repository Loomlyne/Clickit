'use client'

import { useOptimistic, useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { Archive, ChevronDown, ChevronUp, Pencil } from 'lucide-react'
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

type Episode = Database['public']['Tables']['episodes']['Row']

type ShowDefaults = {
  title: string
  title_ar: string | null
  description: string
  description_ar: string | null
}

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
  const [isPending, startTransition] = useTransition()
  const [editEpisode, setEditEpisode] = useState<Episode | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [archiveTarget, setArchiveTarget] = useState<Episode | null>(null)
  const [archiveLoading, setArchiveLoading] = useState(false)

  const [optimisticEpisodes, setOptimisticEpisodes] = useOptimistic(
    episodes,
    (
      state: Episode[],
      { episodeId, direction }: { episodeId: string; direction: 'up' | 'down' }
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

  function handleReorder(episodeId: string, direction: 'up' | 'down') {
    startTransition(async () => {
      setOptimisticEpisodes({ episodeId, direction })
      const result = await reorderEpisode(episodeId, direction)
      if (!result.success) toast.error(result.error || tCommon('error'))
    })
  }

  function handleEdit(episode: Episode) {
    setEditEpisode(episode)
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
              <TableHead className="w-52 text-end">
                {tTable('actionsColumn')}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {optimisticEpisodes.map((episode, index) => (
              <TableRow key={episode.id} className="align-top">
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
                    <span className="inline-block max-w-[90px] truncate rounded-full border border-white/8 bg-white/[0.03] px-2 py-1 font-mono text-xs">
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
                </TableCell>
                <TableCell className="pt-4">
                  <div className="flex items-center justify-end gap-2">
                    <div className="flex items-center gap-1">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => handleReorder(episode.id, 'up')}
                            disabled={isPending || index === 0}
                            aria-label={tTable('moveUpAria', {
                              title: episode.title,
                            })}
                          >
                            <ChevronUp className="size-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>{tTable('moveUp')}</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => handleReorder(episode.id, 'down')}
                            disabled={
                              isPending ||
                              index === optimisticEpisodes.length - 1
                            }
                            aria-label={tTable('moveDownAria', {
                              title: episode.title,
                            })}
                          >
                            <ChevronDown className="size-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>{tTable('moveDown')}</TooltipContent>
                      </Tooltip>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(episode)}
                      aria-label={tTable('editEpisodeAria', {
                        title: episode.title,
                      })}
                    >
                      <Pencil className="size-3.5 sm:me-1" />
                      <span className="hidden sm:inline">
                        {tCommon('edit')}
                      </span>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setArchiveTarget(episode)}
                      aria-label={tTable('archiveEpisodeAria', {
                        title: episode.title,
                      })}
                    >
                      <Archive className="size-3.5 sm:me-1" />
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
        showId={showId}
        seasonId={seasonId}
        showDefaults={showDefaults}
        nextEpisodeNumber={nextEpisodeNumber}
        onSave={async (data) => {
          if (!editEpisode) {
            return { success: false, error: tTable('noEpisodeSelected') }
          }
          return updateEpisode(editEpisode.id, {
            ...data,
            show_id: showId,
            season_id: seasonId,
          })
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

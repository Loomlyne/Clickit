'use client'

import { useState, useTransition, useOptimistic } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Pencil, ChevronUp, ChevronDown, Archive } from 'lucide-react'
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
import { reorderEpisode, updateEpisode, archiveEpisode } from '@/app/[locale]/admin/actions'
import type { Database } from '@/lib/database.types'

type Episode = Database['public']['Tables']['episodes']['Row']

interface EpisodesTableProps {
  episodes: Episode[]
  showId: string
  seasonId: string
  nextEpisodeNumber: number
}

export function EpisodesTable({ episodes, showId, seasonId, nextEpisodeNumber }: EpisodesTableProps) {
  const t = useTranslations('admin.episodeForm')
  const tCommon = useTranslations('common')
  const locale = useLocale()
  const isArabic = locale === 'ar'
  const [isPending, startTransition] = useTransition()
  const [editEpisode, setEditEpisode] = useState<Episode | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [archiveTarget, setArchiveTarget] = useState<Episode | null>(null)
  const [archiveLoading, setArchiveLoading] = useState(false)

  // Optimistic episode list for instant reorder feedback
  const [optimisticEpisodes, setOptimisticEpisodes] = useOptimistic(
    episodes,
    (state: Episode[], { episodeId, direction }: { episodeId: string; direction: 'up' | 'down' }) => {
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
    },
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
    return <EmptyState heading={isArabic ? 'لا توجد حلقات' : 'No Episodes'} body={isArabic ? 'أضف حلقة إلى هذا الموسم.' : 'Add an episode to this season.'} />
  }

  return (
    <TooltipProvider delayDuration={300}>
      <AdminTableShell>
        <Table>
          <TableHeader>
            <TableRow className="bg-transparent">
              <TableHead className="w-12">#</TableHead>
              <TableHead>{t('titleLabel')}</TableHead>
              <TableHead className="hidden w-20 sm:table-cell">{t('durationLabel')}</TableHead>
              <TableHead className="hidden w-24 md:table-cell">{isArabic ? 'يوتيوب' : 'YouTube'}</TableHead>
              <TableHead className="w-[100px]">{t('statusLabel')}</TableHead>
              <TableHead className="w-32 text-end">{isArabic ? 'الإجراءات' : 'Actions'}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {optimisticEpisodes.map((episode, index) => (
              <TableRow key={episode.id}>
                <TableCell className="font-mono text-xs text-muted-foreground">
                  #{episode.episode_number}
                </TableCell>
                <TableCell>
                  <span className="font-medium">{episode.title}</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground sm:hidden">
                    {episode.duration ? `${episode.duration} ${isArabic ? 'دقيقة' : 'min'}` : ''}
                  </span>
                </TableCell>
                <TableCell className="hidden text-muted-foreground sm:table-cell">
                  {episode.duration ? `${episode.duration} ${isArabic ? 'دقيقة' : 'min'}` : '---'}
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  {episode.youtube_video_id ? (
                    <span className="inline-block max-w-[80px] truncate rounded-full border border-white/8 bg-white/[0.03] px-2 py-1 text-xs font-mono">
                      {episode.youtube_video_id}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">{isArabic ? 'لا يوجد فيديو' : 'No video'}</span>
                  )}
                </TableCell>
                <TableCell>
                  <StatusBadge status={episode.status} />
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-end gap-0.5">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon-xs" onClick={() => handleEdit(episode)} aria-label={isArabic ? `تعديل ${episode.title}` : `Edit ${episode.title}`}>
                          <Pencil />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>{tCommon('edit')}</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => handleReorder(episode.id, 'up')}
                          disabled={isPending || index === 0}
                          aria-label={isArabic ? 'نقل لأعلى' : 'Move up'}
                        >
                          <ChevronUp />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>{isArabic ? 'نقل لأعلى' : 'Move up'}</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => handleReorder(episode.id, 'down')}
                          disabled={isPending || index === optimisticEpisodes.length - 1}
                          aria-label={isArabic ? 'نقل لأسفل' : 'Move down'}
                        >
                          <ChevronDown />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>{isArabic ? 'نقل لأسفل' : 'Move down'}</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon-xs" onClick={() => setArchiveTarget(episode)} aria-label={isArabic ? `أرشفة ${episode.title}` : `Archive ${episode.title}`}>
                          <Archive />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>{isArabic ? 'أرشفة' : 'Archive'}</TooltipContent>
                    </Tooltip>
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
        nextEpisodeNumber={nextEpisodeNumber}
        onSave={async (data) => {
          if (!editEpisode) return { success: false, error: 'No episode selected' }
          return updateEpisode(editEpisode.id, { ...data, show_id: showId, season_id: seasonId })
        }}
      />

      <ConfirmDialog
        open={!!archiveTarget}
        onOpenChange={(open) => { if (!open) setArchiveTarget(null) }}
        title={isArabic ? 'أرشفة الحلقة' : 'Archive Episode'}
        description={isArabic
          ? `سيُخفي هذا "${archiveTarget?.title ?? 'هذه الحلقة'}" عن الزوار.`
          : `This will hide "${archiveTarget?.title ?? 'this episode'}" from viewers.`}
        confirmLabel={isArabic ? 'أرشفة الحلقة' : 'Archive Episode'}
        onConfirm={handleArchiveConfirm}
        destructive
        loading={archiveLoading}
      />
    </TooltipProvider>
  )
}

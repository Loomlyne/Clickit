'use client'

import { useState, useTransition, useOptimistic } from 'react'
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
      if (!result.success) toast.error(result.error || 'Reorder failed')
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
      toast.success(`"${archiveTarget.title}" archived`)
      setArchiveTarget(null)
    } else {
      toast.error(result.error || 'Failed to archive episode')
    }
  }

  if (episodes.length === 0) {
    return <EmptyState heading="No Episodes" body="Add an episode to this season." />
  }

  return (
    <TooltipProvider delayDuration={300}>
      <div className="overflow-hidden rounded-[24px] border border-white/10 bg-black/20">
        <Table>
          <TableHeader>
            <TableRow className="bg-transparent">
              <TableHead className="w-12">#</TableHead>
              <TableHead>Title</TableHead>
              <TableHead className="hidden w-20 sm:table-cell">Duration</TableHead>
              <TableHead className="hidden w-24 md:table-cell">YouTube</TableHead>
              <TableHead className="w-[100px]">Status</TableHead>
              <TableHead className="w-32 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {optimisticEpisodes.map((episode, index) => (
              <TableRow key={episode.id} className="group transition-colors hover:bg-white/[0.02]">
                <TableCell className="font-mono text-xs text-muted-foreground">
                  #{episode.episode_number}
                </TableCell>
                <TableCell>
                  <span className="font-medium">{episode.title}</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground sm:hidden">
                    {episode.duration ? `${episode.duration} min` : ''}
                  </span>
                </TableCell>
                <TableCell className="hidden text-muted-foreground sm:table-cell">
                  {episode.duration ? `${episode.duration} min` : '---'}
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  {episode.youtube_video_id ? (
                    <span className="inline-block max-w-[80px] truncate rounded-full border border-white/10 bg-white/[0.06] px-2 py-1 text-xs font-mono">
                      {episode.youtube_video_id}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">No video</span>
                  )}
                </TableCell>
                <TableCell>
                  <StatusBadge status={episode.status} />
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-end gap-0.5">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon-xs" onClick={() => handleEdit(episode)} aria-label={`Edit ${episode.title}`}>
                          <Pencil />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Edit</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => handleReorder(episode.id, 'up')}
                          disabled={isPending || index === 0}
                          aria-label="Move up"
                        >
                          <ChevronUp />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Move up</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => handleReorder(episode.id, 'down')}
                          disabled={isPending || index === optimisticEpisodes.length - 1}
                          aria-label="Move down"
                        >
                          <ChevronDown />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Move down</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon-xs" onClick={() => setArchiveTarget(episode)} aria-label={`Archive ${episode.title}`}>
                          <Archive />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Archive</TooltipContent>
                    </Tooltip>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

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
        title="Archive Episode"
        description={`This will hide "${archiveTarget?.title ?? 'this episode'}" from viewers.`}
        confirmLabel="Archive Episode"
        onConfirm={handleArchiveConfirm}
        destructive
        loading={archiveLoading}
      />
    </TooltipProvider>
  )
}

'use client'

import { useState, useTransition } from 'react'
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
import { StatusBadge } from '@/components/admin/status-badge'
import { ConfirmDialog } from '@/components/admin/confirm-dialog'
import { EmptyState } from '@/components/admin/empty-state'
import { EpisodeFormDrawer } from '@/components/admin/episode-form-drawer'
import { reorderEpisode, updateEpisode, archiveEpisode } from '@/app/admin/actions'
import type { Database } from '@/lib/database.types'

type Episode = Database['public']['Tables']['episodes']['Row']

interface EpisodesTableProps {
  episodes: Episode[]
  showId: string
  seasonId: string
}

export function EpisodesTable({ episodes, showId, seasonId }: EpisodesTableProps) {
  const [isPending, startTransition] = useTransition()
  const [editEpisode, setEditEpisode] = useState<Episode | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [archiveTarget, setArchiveTarget] = useState<Episode | null>(null)
  const [archiveLoading, setArchiveLoading] = useState(false)

  function handleReorder(episodeId: string, direction: 'up' | 'down') {
    startTransition(async () => {
      await reorderEpisode(episodeId, direction)
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
      toast.success('Episode archived')
      setArchiveTarget(null)
    } else {
      toast.error(result.error || 'Failed to archive episode')
    }
  }

  if (episodes.length === 0) {
    return <EmptyState heading="No Episodes" body="Add an episode to this season." />
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">#</TableHead>
            <TableHead>Title</TableHead>
            <TableHead className="w-20">Duration</TableHead>
            <TableHead className="w-20">YouTube</TableHead>
            <TableHead className="w-[100px]">Status</TableHead>
            <TableHead className="w-40">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {episodes.map((episode, index) => (
            <TableRow key={episode.id}>
              <TableCell className="font-mono text-muted-foreground">
                {episode.episode_number}
              </TableCell>
              <TableCell className="font-medium">{episode.title}</TableCell>
              <TableCell className="text-muted-foreground">
                {episode.duration ? `${episode.duration}m` : '---'}
              </TableCell>
              <TableCell>
                {episode.youtube_video_id ? (
                  <span className="inline-block max-w-[72px] truncate rounded bg-muted px-1.5 py-0.5 text-xs font-mono">
                    {episode.youtube_video_id}
                  </span>
                ) : (
                  <span className="text-muted-foreground">---</span>
                )}
              </TableCell>
              <TableCell>
                <StatusBadge status={episode.status} />
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => handleEdit(episode)}
                    aria-label="Edit episode"
                  >
                    <Pencil />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => handleReorder(episode.id, 'up')}
                    disabled={isPending || index === 0}
                    aria-label="Move episode up"
                  >
                    <ChevronUp />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => handleReorder(episode.id, 'down')}
                    disabled={isPending || index === episodes.length - 1}
                    aria-label="Move episode down"
                  >
                    <ChevronDown />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => setArchiveTarget(episode)}
                    aria-label="Archive episode"
                  >
                    <Archive />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {/* Edit Episode Drawer */}
      <EpisodeFormDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        episode={editEpisode}
        showId={showId}
        seasonId={seasonId}
        nextEpisodeNumber={episodes.length + 1}
        onSave={async (data) => {
          if (!editEpisode) return { success: false, error: 'No episode selected' }
          return updateEpisode(editEpisode.id, {
            ...data,
            show_id: showId,
            season_id: seasonId,
          })
        }}
      />

      {/* Archive Confirm Dialog */}
      <ConfirmDialog
        open={!!archiveTarget}
        onOpenChange={(open) => { if (!open) setArchiveTarget(null) }}
        title="Archive Episode"
        description="This will hide this episode from viewers."
        confirmLabel="Archive Episode"
        onConfirm={handleArchiveConfirm}
        destructive
        loading={archiveLoading}
      />
    </>
  )
}

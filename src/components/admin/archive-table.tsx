'use client'

import { useState } from 'react'
import { RotateCcw, Trash2, AlertTriangle } from 'lucide-react'

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { EmptyState } from '@/components/admin/empty-state'
import { ConfirmDialog } from '@/components/admin/confirm-dialog'
import { restoreShow, deleteShowPermanently, resolveConflictsAndRestore } from '@/app/[locale]/admin/actions'
import type { EpisodeConflict } from '@/app/[locale]/admin/actions'
import { toast } from 'sonner'
import type { Database } from '@/lib/database.types'

type Show = Database['public']['Tables']['shows']['Row']

interface ArchiveTableProps {
  shows: Show[]
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export function ArchiveTable({ shows }: ArchiveTableProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deletingShow, setDeletingShow] = useState<Show | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [restoring, setRestoring] = useState<string | null>(null)

  // Conflict resolution state
  const [conflictDialogOpen, setConflictDialogOpen] = useState(false)
  const [conflictShow, setConflictShow] = useState<Show | null>(null)
  const [conflicts, setConflicts] = useState<EpisodeConflict[]>([])
  const [fixes, setFixes] = useState<Record<string, number>>({})
  const [resolving, setResolving] = useState(false)

  function handleDeleteClick(show: Show) {
    setDeletingShow(show)
    setDeleteDialogOpen(true)
  }

  async function handleRestore(show: Show) {
    setRestoring(show.id)
    const result = await restoreShow(show.id)
    setRestoring(null)
    if (result.success) {
      toast.success(`"${show.title}" restored`)
    } else if (result.conflicts && result.conflicts.length > 0) {
      // Open conflict resolution dialog
      setConflictShow(show)
      setConflicts(result.conflicts)
      // Pre-fill fixes with current numbers so user sees what needs changing
      const initialFixes: Record<string, number> = {}
      for (const c of result.conflicts) {
        initialFixes[c.episodeId] = c.episodeNumber
      }
      setFixes(initialFixes)
      setConflictDialogOpen(true)
    } else {
      toast.error(result.error ?? 'Failed to restore show')
    }
  }

  async function handleResolveAndRestore() {
    if (!conflictShow) return
    setResolving(true)
    const fixArray = Object.entries(fixes).map(([episodeId, newEpisodeNumber]) => ({
      episodeId,
      newEpisodeNumber,
    }))
    const result = await resolveConflictsAndRestore(conflictShow.id, fixArray)
    setResolving(false)
    if (result.success) {
      setConflictDialogOpen(false)
      setConflictShow(null)
      setConflicts([])
      toast.success(`"${conflictShow.title}" restored`)
    } else if (result.conflicts && result.conflicts.length > 0) {
      // Still conflicts after fix attempt — update the dialog
      setConflicts(result.conflicts)
      const newFixes: Record<string, number> = {}
      for (const c of result.conflicts) {
        newFixes[c.episodeId] = fixes[c.episodeId] ?? c.episodeNumber
      }
      setFixes(newFixes)
      toast.error('Some conflicts remain — update the numbers and try again')
    } else {
      toast.error(result.error ?? 'Failed to restore show')
    }
  }

  async function handleDeleteConfirm() {
    if (!deletingShow) return
    setDeleting(true)
    const result = await deleteShowPermanently(deletingShow.id)
    setDeleting(false)
    if (result.success) {
      toast.success(`"${deletingShow.title}" permanently deleted`)
      setDeleteDialogOpen(false)
      setDeletingShow(null)
    } else {
      toast.error(result.error ?? 'Failed to delete show')
    }
  }

  if (shows.length === 0) {
    return <EmptyState heading="Archive Empty" body="Archived shows will appear here." />
  }

  return (
    <TooltipProvider delayDuration={300}>
      <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.24)] md:p-6">
        <div className="flex items-center justify-between pb-4 text-sm text-muted-foreground">
          <span>{shows.length} archived show{shows.length !== 1 ? 's' : ''}</span>
          <span>Newest changes first</span>
        </div>

        <div className="overflow-hidden rounded-[24px] border border-white/10 bg-black/20">
          <Table>
            <TableHeader>
              <TableRow className="bg-transparent">
                <TableHead>Show</TableHead>
                <TableHead className="hidden w-[100px] sm:table-cell">Genre</TableHead>
                <TableHead className="hidden w-[130px] md:table-cell">Archived</TableHead>
                <TableHead className="w-[180px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shows.map((show) => (
                <TableRow key={show.id} className="group transition-colors hover:bg-white/[0.02]">
                  <TableCell>
                    <span className="font-medium">{show.title}</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground sm:hidden">{show.genre}</span>
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground sm:table-cell">{show.genre}</TableCell>
                  <TableCell className="hidden text-sm text-muted-foreground md:table-cell">
                    {formatDate(show.updated_at)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-2">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleRestore(show)}
                            disabled={restoring === show.id}
                          >
                            <RotateCcw className="mr-1 size-3.5" />
                            {restoring === show.id ? 'Restoring...' : 'Restore'}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Restore show and all episodes</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDeleteClick(show)}
                          >
                            <Trash2 className="mr-1 size-3.5" />
                            Delete
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Permanently delete - cannot be undone</TooltipContent>
                      </Tooltip>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Permanently Delete Show"
        description={`This will permanently delete "${deletingShow?.title ?? 'this show'}" and all its seasons and episodes. This action cannot be undone.`}
        confirmLabel="Delete Permanently"
        onConfirm={handleDeleteConfirm}
        destructive
        loading={deleting}
      />

      {/* Conflict resolution dialog */}
      <Dialog open={conflictDialogOpen} onOpenChange={setConflictDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="size-5 text-amber-500" />
              Episode Number Conflicts
            </DialogTitle>
            <DialogDescription>
              {`"${conflictShow?.title ?? ''}" has episodes whose numbers are already taken. Change the numbers below to resolve conflicts, then click Fix & Restore.`}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            {conflicts.map((c) => (
              <div key={c.episodeId} className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 space-y-2">
                <div className="text-sm">
                  <span className="font-medium text-foreground">S{c.seasonNumber} E{c.episodeNumber}</span>
                  {' — '}
                  <span className="text-muted-foreground">{c.episodeTitle}</span>
                </div>
                <div className="text-xs text-amber-400">
                  Conflicts with existing episode: &quot;{c.conflictingEpisodeTitle}&quot;
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground shrink-0">New #:</span>
                  <Input
                    type="number"
                    min={1}
                    value={fixes[c.episodeId] ?? c.episodeNumber}
                    onChange={(e) => setFixes(prev => ({
                      ...prev,
                      [c.episodeId]: parseInt(e.target.value) || 1,
                    }))}
                    className="h-8 w-24"
                  />
                </div>
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConflictDialogOpen(false)}
              disabled={resolving}
            >
              Cancel
            </Button>
            <Button
              onClick={handleResolveAndRestore}
              disabled={resolving}
            >
              {resolving ? 'Fixing...' : 'Fix & Restore'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  )
}

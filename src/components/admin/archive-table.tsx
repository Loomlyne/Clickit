'use client'

import { useState } from 'react'
import { RotateCcw, Trash2 } from 'lucide-react'

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
import { EmptyState } from '@/components/admin/empty-state'
import { ConfirmDialog } from '@/components/admin/confirm-dialog'
import { restoreShow, deleteShowPermanently } from '@/app/admin/actions'
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
    </TooltipProvider>
  )
}

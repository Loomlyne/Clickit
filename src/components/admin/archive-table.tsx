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
      <p className="text-sm text-muted-foreground mb-4">{shows.length} archived show{shows.length !== 1 ? 's' : ''}</p>

      <div className="rounded-lg border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-[var(--card)]">
              <TableHead>Show</TableHead>
              <TableHead className="w-[100px] hidden sm:table-cell">Genre</TableHead>
              <TableHead className="w-[130px] hidden md:table-cell">Archived</TableHead>
              <TableHead className="w-[180px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {shows.map((show) => (
              <TableRow key={show.id} className="group hover:bg-white/[0.02] transition-colors">
                <TableCell>
                  <span className="font-medium">{show.title}</span>
                  <span className="block text-xs text-muted-foreground sm:hidden mt-0.5">{show.genre}</span>
                </TableCell>
                <TableCell className="text-muted-foreground hidden sm:table-cell">{show.genre}</TableCell>
                <TableCell className="text-muted-foreground text-sm hidden md:table-cell">
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
                      <TooltipContent>Permanently delete — cannot be undone</TooltipContent>
                    </Tooltip>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
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

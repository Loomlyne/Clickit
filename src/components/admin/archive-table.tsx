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
  // Delete dialog state
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
      toast.success('Show restored')
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
      toast.success('Show permanently deleted')
      setDeleteDialogOpen(false)
      setDeletingShow(null)
    } else {
      toast.error(result.error ?? 'Failed to delete show')
    }
  }

  // Empty state
  if (shows.length === 0) {
    return (
      <EmptyState
        heading="Archive Empty"
        body="Archived shows will appear here."
      />
    )
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Show Name</TableHead>
            <TableHead className="w-[120px]">Genre</TableHead>
            <TableHead className="w-[140px]">Archived Date</TableHead>
            <TableHead className="w-[180px]">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {shows.map((show) => (
            <TableRow key={show.id} className="h-14">
              <TableCell className="font-medium">{show.title}</TableCell>
              <TableCell className="text-muted-foreground">{show.genre}</TableCell>
              <TableCell className="text-muted-foreground">
                {formatDate(show.updated_at)}
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleRestore(show)}
                    disabled={restoring === show.id}
                  >
                    <RotateCcw className="mr-1 size-3.5" />
                    {restoring === show.id ? 'Restoring...' : 'Restore'}
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleDeleteClick(show)}
                  >
                    <Trash2 className="mr-1 size-3.5" />
                    Delete
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {/* Permanent delete confirmation dialog */}
      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Permanently Delete Show"
        description={`This will permanently delete ${deletingShow?.title ?? 'this show'} and all its seasons and episodes. This action cannot be undone.`}
        confirmLabel="Delete Permanently"
        onConfirm={handleDeleteConfirm}
        destructive
        loading={deleting}
      />
    </>
  )
}

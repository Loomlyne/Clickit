'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Pencil, Archive } from 'lucide-react'

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
import { EmptyState } from '@/components/admin/empty-state'
import { ConfirmDialog } from '@/components/admin/confirm-dialog'
import { ShowFormDrawer } from '@/components/admin/show-form-drawer'
import { createShow, updateShow, archiveShow } from '@/app/admin/actions'
import { toast } from 'sonner'
import type { Database } from '@/lib/database.types'

type Show = Database['public']['Tables']['shows']['Row']

interface ShowsTableProps {
  shows: Show[]
}

export function ShowsTable({ shows }: ShowsTableProps) {
  // Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editingShow, setEditingShow] = useState<Show | null>(null)

  // Archive dialog state
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false)
  const [archivingShow, setArchivingShow] = useState<Show | null>(null)
  const [archiving, setArchiving] = useState(false)

  function handleCreate() {
    setEditingShow(null)
    setDrawerOpen(true)
  }

  function handleEdit(show: Show) {
    setEditingShow(show)
    setDrawerOpen(true)
  }

  function handleArchiveClick(show: Show) {
    setArchivingShow(show)
    setArchiveDialogOpen(true)
  }

  async function handleArchiveConfirm() {
    if (!archivingShow) return
    setArchiving(true)
    const result = await archiveShow(archivingShow.id)
    setArchiving(false)
    if (result.success) {
      toast.success('Show archived')
      setArchiveDialogOpen(false)
      setArchivingShow(null)
    } else {
      toast.error(result.error ?? 'Failed to archive show')
    }
  }

  async function handleSave(data: Parameters<typeof createShow>[0] & { id?: string }) {
    if (editingShow) {
      return updateShow(editingShow.id, data)
    }
    return createShow(data)
  }

  // Empty state
  if (shows.length === 0) {
    return (
      <>
        <EmptyState
          heading="No Shows Yet"
          body="Create your first show to get started."
          action={
            <Button onClick={handleCreate}>Create Show</Button>
          }
        />
        <ShowFormDrawer
          open={drawerOpen}
          onOpenChange={setDrawerOpen}
          show={editingShow}
          onSave={handleSave}
        />
      </>
    )
  }

  return (
    <>
      <div className="flex items-center justify-end mb-4">
        <Button onClick={handleCreate}>Create Show</Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Show Name</TableHead>
            <TableHead className="w-[120px]">Genre</TableHead>
            <TableHead className="w-[120px]">Status</TableHead>
            <TableHead className="w-[80px]">Episodes</TableHead>
            <TableHead className="w-[140px]">Broadcast</TableHead>
            <TableHead className="w-[100px]">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {shows.map((show) => (
            <TableRow key={show.id} className="h-14">
              <TableCell>
                <Link
                  href={`/admin/shows/${show.id}`}
                  className="font-medium text-foreground hover:underline"
                >
                  {show.title}
                </Link>
              </TableCell>
              <TableCell className="text-muted-foreground">{show.genre}</TableCell>
              <TableCell>
                <StatusBadge status={show.status} />
              </TableCell>
              <TableCell className="text-muted-foreground">{show.episode_count}</TableCell>
              <TableCell className="text-muted-foreground">
                {show.broadcast_day && show.broadcast_time
                  ? `${show.broadcast_day} ${show.broadcast_time}`
                  : '---'}
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => handleEdit(show)}
                    aria-label={`Edit ${show.title}`}
                  >
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => handleArchiveClick(show)}
                    aria-label={`Archive ${show.title}`}
                  >
                    <Archive className="size-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {/* Show create/edit drawer */}
      <ShowFormDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        show={editingShow}
        onSave={handleSave}
      />

      {/* Archive confirmation dialog */}
      <ConfirmDialog
        open={archiveDialogOpen}
        onOpenChange={setArchiveDialogOpen}
        title="Archive Show"
        description={`This will hide ${archivingShow?.title ?? 'this show'} from all viewers. You can restore it from the Archive section.`}
        confirmLabel="Archive Show"
        onConfirm={handleArchiveConfirm}
        destructive
        loading={archiving}
      />
    </>
  )
}
